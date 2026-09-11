/**
 * AudioDirector — an FMOD-style runtime mixer on Web Audio.
 *
 * Model (mirrors how FMOD Studio projects are organised):
 *   BANK       public/audio/oga/manifest.json (built by tools/assets/fetch_opengameart_audio.mjs from
 *              curated CC0 OpenGameArt items). Each cue id maps to N sample variations.
 *   BUSES      master → { sfx, foley (footsteps), voice (breath/effort), ambience, music-less }.
 *              Each bus is a GainNode; ambience gets a low-pass for "interior" muffling.
 *   EVENTS     `handle(event)` is the event router: footstep, jump, double_jump, wallkick, mantle,
 *              slide, dash, land(kind), ladder_*, door_*, checkpoint, relay, permit, finish, ui.
 *              An event = one or more LAYERS (e.g. jump = swish + quiet effort grunt) with
 *              multi-instrument ROUND-ROBIN (never the same variation twice in a row), random
 *              pitch (±semitones) and gain jitter, per-event cooldown/polyphony caps.
 *   PARAMETERS (RTPCs) set every frame from gameplay in `updateBeds()`:
 *              exertion   0..1  builds while sprinting/climbing, recovers while walking/standing →
 *                              breath loop gain + pulse (slow→fast heartbeat) + footstep weight.
 *              airspeed   m/s   wind-rush loop gain + low-pass opening; also fall wind.
 *              altitude   m     exterior wind bed gain (gusts).
 *              machinery  m     distance to the nearest machinery source → boiler/turbine beds.
 *              interior   bool  ambience low-pass + short convolution-free "room" feedback tail.
 *   SNAPSHOTS  `snapshot('pause'|'default')` ducks buses like an FMOD mixer snapshot.
 *
 * When the bank is absent (offline dev, CI before the intake job) every event still plays through the
 * procedural synth layer below, so the game is never silent and the event routing is identical.
 */
const BANK_URL = '/audio/oga/manifest.json';

const SURFACE_BANK = { concrete: 'footsteps_hard', brick: 'footsteps_hard', steel: 'footsteps_metal', grating: 'footsteps_metal', rubber: 'footsteps_hard', wood: 'footsteps_hard' };

export class AudioDirector {
  constructor() {
    this.context = null;
    this.master = null;
    this.buses = null;
    this.beds = null;
    this.bank = null;          // manifest
    this.buffers = new Map();  // file → AudioBuffer
    this.lastVariant = new Map();
    this.lastPlayed = new Map();
    this.loops = new Map();    // id → { source, gain, filter }
    this.params = { exertion: 0, airspeed: 0, altitude: 0, machinery: 60, interior: false };
    this.bankStatus = 'not-loaded';
    this.snapshotName = 'default';
  }

  /** Call from a user gesture. Builds the graph and starts loading the sample bank in the background. */
  begin() {
    if (this.context) { this.context.resume?.(); return; }
    const ctx = new AudioContext();
    this.context = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.6; this.master.connect(ctx.destination);
    const bus = (gain) => { const g = ctx.createGain(); g.gain.value = gain; g.connect(this.master); return g; };
    this.buses = { sfx: bus(0.9), foley: bus(0.8), voice: bus(0.55), ambience: bus(0.7) };
    this.ambienceFilter = ctx.createBiquadFilter(); this.ambienceFilter.type = 'lowpass'; this.ambienceFilter.frequency.value = 18000;
    this.buses.ambience.disconnect(); this.buses.ambience.connect(this.ambienceFilter).connect(this.master);
    this.buildSynthBeds();
    this.loadBank();
  }

  // ------------------------------------------------------------------------------------------ bank
  async loadBank() {
    try {
      const res = await fetch(BANK_URL, { cache: 'force-cache' });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.includes('json')) { this.bankStatus = 'absent'; return; }
      this.bank = await res.json();
      this.bankStatus = 'loaded';
      // Pre-decode the always-on loops first, then the movement cues.
      const order = ['wind_rush_loop', 'breathing_tired', 'heartbeat', 'wind_gusts', 'boiler_loop', 'machine_loops', 'footsteps_hard', 'footsteps_metal', 'swishes', 'jump_land_light', 'jump_land_heavy', 'vocal_effort', 'platformer_movement'];
      for (const id of order) for (const f of this.bank.cues?.[id]?.files || []) await this.buffer(f.file).catch(() => null);
      this.startBankLoops();
    } catch { this.bankStatus = 'absent'; }
  }

  async buffer(file) {
    if (this.buffers.has(file)) return this.buffers.get(file);
    const res = await fetch(`${this.bank.base_path}/${file}`);
    const decoded = await this.context.decodeAudioData(await res.arrayBuffer());
    this.buffers.set(file, decoded);
    return decoded;
  }

  files(cueId) { return (this.bank?.cues?.[cueId]?.status === 'APPROVED' && this.bank.cues[cueId].files) || []; }

  /** Round-robin with no immediate repeat (FMOD multi-instrument "random, avoid repeating last"). */
  pickVariant(key, count) {
    if (count <= 1) return 0;
    const last = this.lastVariant.get(key);
    let next = Math.floor(Math.random() * count);
    if (next === last) next = (next + 1 + Math.floor(Math.random() * (count - 1))) % count;
    this.lastVariant.set(key, next);
    return next;
  }

  /**
   * Play one sample from a cue. Returns true when a bank sample played, false when the caller should
   * fall back to the synth. Options: bus, gain, pitch (semitone jitter ±), cooldown ms, filter (Hz),
   * pick: regex over source file names to narrow the variation pool.
   */
  playCue(cueId, { bus = 'sfx', gain = 1, pitch = 1.5, cooldown = 0, filter = 0, pick = null, offset = 0 } = {}) {
    if (!this.context || !this.bank) return false;
    let pool = this.files(cueId);
    if (pick) { const narrowed = pool.filter((f) => pick.test(f.from)); if (narrowed.length) pool = narrowed; }
    if (!pool.length) return false;
    const now = performance.now();
    if (cooldown && now - (this.lastPlayed.get(cueId) || -1e9) < cooldown) return true;
    const v = this.pickVariant(cueId + (pick ? pick.source : ''), pool.length);
    const buf = this.buffers.get(pool[v].file);
    if (!buf) { this.buffer(pool[v].file).catch(() => null); return false; }
    this.lastPlayed.set(cueId, now);
    const ctx = this.context;
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = 2 ** ((Math.random() * 2 - 1) * pitch / 12);
    const g = ctx.createGain(); g.gain.value = gain * (0.9 + Math.random() * 0.2);
    let head = src;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = filter > 0 ? 'highpass' : 'lowpass'; f.frequency.value = Math.abs(filter); head.connect(f); head = f; }
    head.connect(g).connect(this.buses[bus] || this.buses.sfx);
    src.start(0, offset);
    return true;
  }

  /** Start (or fetch) a looping sample on a named slot; returns its gain node for RTPC control. */
  loop(id, cueId, { bus = 'ambience', pick = null, gain = 0, filter = null } = {}) {
    if (this.loops.has(id)) return this.loops.get(id);
    let pool = this.files(cueId);
    if (pick) pool = pool.filter((f) => pick.test(f.from));
    if (!pool.length) return null;
    const buf = this.buffers.get(pool[0].file);
    if (!buf) return null;
    const ctx = this.context;
    const source = ctx.createBufferSource(); source.buffer = buf; source.loop = true;
    const g = ctx.createGain(); g.gain.value = gain;
    let head = source; let f = null;
    if (filter) { f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; head.connect(f); head = f; }
    head.connect(g).connect(this.buses[bus]);
    source.start(0, Math.random() * buf.duration);
    const slot = { source, gain: g, filter: f };
    this.loops.set(id, slot);
    return slot;
  }

  startBankLoops() {
    this.loop('windRush', 'wind_rush_loop', { bus: 'ambience', filter: 600 });
    this.loop('breath', 'breathing_tired', { bus: 'voice' });
    this.loop('pulseSlow', 'heartbeat', { bus: 'voice', pick: /slow/i });
    this.loop('pulseFast', 'heartbeat', { bus: 'voice', pick: /fast/i });
    this.loop('gustA', 'wind_gusts', { bus: 'ambience' });
    this.loop('boiler', 'boiler_loop', { bus: 'ambience', filter: 900 });
    this.loop('machine', 'machine_loops', { bus: 'ambience', pick: /machine|loop/i, filter: 1400 });
  }

  // ------------------------------------------------------------------------------------ synth beds
  buildSynthBeds() {
    const ctx = this.context;
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) { const white = Math.random() * 2 - 1; last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; }
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuffer; wind.loop = true;
    const windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 420; windFilter.Q.value = 0.6;
    const windGain = ctx.createGain(); windGain.gain.value = 0.0;
    wind.connect(windFilter).connect(windGain).connect(this.buses.ambience); wind.start();
    const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 49;
    const humFilter = ctx.createBiquadFilter(); humFilter.type = 'lowpass'; humFilter.frequency.value = 180;
    const humGain = ctx.createGain(); humGain.gain.value = 0.0;
    hum.connect(humFilter).connect(humGain).connect(this.buses.ambience); hum.start();
    const hum2 = ctx.createOscillator(); hum2.type = 'triangle'; hum2.frequency.value = 98.5; hum2.connect(humGain); hum2.start();
    this.beds = { windGain, windFilter, humGain };
  }

  // ------------------------------------------------------------------------------------- parameters
  /**
   * Called every frame. `speed` is horizontal speed, `sprinting`/`climbing` build exertion, `airborne`
   * + vertical speed feed the wind rush. Exertion is the FMOD-style global parameter that drives the
   * breath loop, the pulse and the footstep weight.
   */
  updateBeds(delta, { altitude = 0, machineryDistance = 60, interior = false, speed = 0, verticalSpeed = 0, sprinting = false, climbing = false, airborne = false } = {}) {
    if (!this.context) return;
    const p = this.params;
    // Exertion: +1 per 14 s of sprint (or 9 s of climbing), −1 per 20 s of rest; walking holds.
    const effort = climbing ? 1 / 9 : sprinting && speed > 5.5 ? 1 / 14 : speed > 2 ? 0 : -1 / 20;
    p.exertion = Math.min(1, Math.max(0, p.exertion + effort * delta));
    p.airspeed = Math.hypot(speed, verticalSpeed * 0.8);
    p.altitude = altitude; p.machinery = machineryDistance; p.interior = interior;
    const now = this.context.currentTime;
    const set = (param, value, tc = 0.35) => param.setTargetAtTime(value, now, tc);
    // Ambience muffling when indoors.
    set(this.ambienceFilter.frequency, interior ? 2600 : 18000, 0.5);
    // --- synth beds (always present; ducked when the bank supplies the real loops)
    const bankWind = this.loops.has('windRush') || this.loops.has('gustA');
    const windTarget = Math.min(0.16, 0.03 + Math.max(0, altitude + 4) * 0.006 + speed * 0.004) * (interior ? 0.35 : 1) * (bankWind ? 0.25 : 1);
    const humTarget = Math.max(0, 0.06 - machineryDistance * 0.0015) * (interior ? 1.6 : 1) * (this.loops.has('boiler') ? 0.3 : 1);
    set(this.beds.windGain.gain, windTarget, 0.4); set(this.beds.windFilter.frequency, 380 + speed * 22, 0.3); set(this.beds.humGain.gain, humTarget, 0.6);
    // --- bank loops driven by RTPCs
    const rush = this.loops.get('windRush');
    if (rush) { const k = Math.min(1, Math.max(0, (p.airspeed - 4) / 12)); set(rush.gain.gain, k * k * 0.55 * (interior ? 0.5 : 1), 0.15); if (rush.filter) set(rush.filter.frequency, 500 + k * 4200, 0.15); }
    const gust = this.loops.get('gustA');
    if (gust) set(gust.gain.gain, Math.min(0.5, 0.06 + Math.max(0, altitude + 4) * 0.012) * (interior ? 0.2 : 1), 0.8);
    const breath = this.loops.get('breath');
    if (breath) set(breath.gain.gain, p.exertion < 0.35 ? 0 : (p.exertion - 0.35) / 0.65 * 0.7, 0.6);
    const slow = this.loops.get('pulseSlow'); const fast = this.loops.get('pulseFast');
    const fallPulse = airborne && verticalSpeed < -9 ? 0.6 : 0;
    if (slow) set(slow.gain.gain, Math.max(0, Math.min(1, (p.exertion - 0.45) / 0.3)) * (1 - Math.max(0, (p.exertion - 0.8) / 0.2)) * 0.5, 0.5);
    if (fast) set(fast.gain.gain, Math.max(Math.max(0, (p.exertion - 0.8) / 0.2) * 0.6, fallPulse), 0.4);
    const boiler = this.loops.get('boiler');
    if (boiler) set(boiler.gain.gain, Math.max(0, 0.5 - machineryDistance * 0.012) * (interior ? 1.3 : 1), 0.7);
    const machine = this.loops.get('machine');
    if (machine) set(machine.gain.gain, Math.max(0, 0.35 - machineryDistance * 0.009), 0.7);
  }

  /** Mixer snapshot: 'pause' ducks everything but ambience; 'default' restores. */
  snapshot(name) {
    if (!this.context || this.snapshotName === name) return;
    this.snapshotName = name;
    const now = this.context.currentTime;
    const duck = name === 'pause';
    this.buses.sfx.gain.setTargetAtTime(duck ? 0.15 : 0.9, now, 0.2);
    this.buses.foley.gain.setTargetAtTime(duck ? 0.1 : 0.8, now, 0.2);
    this.buses.voice.gain.setTargetAtTime(duck ? 0 : 0.55, now, 0.2);
    this.buses.ambience.gain.setTargetAtTime(duck ? 0.35 : 0.7, now, 0.4);
  }

  status() {
    return { bank: this.bankStatus, cues: this.bank ? Object.values(this.bank.cues).filter((c) => c.status === 'APPROVED').length : 0, decoded: this.buffers.size, loops: [...this.loops.keys()], params: { ...this.params, exertion: Number(this.params.exertion.toFixed(2)), airspeed: Number(this.params.airspeed.toFixed(1)) }, snapshot: this.snapshotName };
  }

  // ------------------------------------------------------------------------------------------ synth
  variant(key, count) {
    const next = ((this.lastVariant.get(key) || 0) + 1 + Math.floor(Math.random() * (count - 1))) % count;
    this.lastVariant.set(key, next);
    return next;
  }

  tone({ frequency = 440, duration = 0.08, type = 'sine', gain = 0.05, slide = 0, noise = 0, filter = 0, bus = 'sfx' }) {
    if (!this.context) return;
    const ctx = this.context; const now = ctx.currentTime;
    const volume = ctx.createGain();
    volume.gain.setValueAtTime(gain, now);
    volume.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    let destination = volume;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; f.connect(volume); destination = f; }
    if (noise > 0) {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
      const d = buffer.getChannelData(0); for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * noise;
      const src = ctx.createBufferSource(); src.buffer = buffer; src.connect(destination); src.start();
    }
    if (frequency > 0) {
      const osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(frequency, now);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
      osc.connect(destination); osc.start(); osc.stop(now + duration);
    }
    volume.connect(this.buses?.[bus] || this.master);
  }

  synthFootstep(surface = 'concrete', speed = 5) {
    const v = this.variant(`step-${surface}`, 4);
    const g = 0.02 + Math.min(speed, 8) * 0.003;
    const table = {
      concrete: { frequency: 90 + v * 8, duration: 0.05, type: 'triangle', noise: 0.5, filter: 900 },
      steel: { frequency: 260 + v * 30, duration: 0.09, type: 'square', noise: 0.25, filter: 2400 },
      grating: { frequency: 420 + v * 40, duration: 0.11, type: 'square', noise: 0.35, filter: 3200, slide: -120 },
      rubber: { frequency: 70, duration: 0.05, type: 'sine', noise: 0.2, filter: 500 },
    };
    this.tone({ ...(table[surface] || table.concrete), gain: g, bus: 'foley' });
  }

  // ----------------------------------------------------------------------------------------- events
  footstep(surface = 'concrete', speed = 5) {
    const weight = 0.5 + Math.min(speed, 8) / 8 * 0.5 + this.params.exertion * 0.15; // heavier steps when tired/fast
    const bank = SURFACE_BANK[surface] || 'footsteps_hard';
    const played = this.playCue(bank, { bus: 'foley', gain: 0.55 * weight, pitch: surface === 'grating' ? 2.5 : 1.5, filter: surface === 'grating' ? 900 : 0, cooldown: 90 });
    if (!played) this.synthFootstep(surface, speed);
  }

  effort(gain = 0.35, pick = null) { this.playCue('vocal_effort', { bus: 'voice', gain: gain * (0.6 + this.params.exertion * 0.6), pitch: 1, cooldown: 700, pick }); }

  handle(event, context = {}) {
    switch (event.type) {
      case 'footstep': return this.footstep(event.surface, event.speed);
      case 'jump': {
        const ok = this.playCue('swishes', { gain: 0.35, pitch: 2, pick: /swish[_-]?([1-4])\b|light/i });
        if (this.params.exertion > 0.3 || Math.random() < 0.25) this.effort(0.25);
        return ok || this.tone({ frequency: 180, slide: 120, duration: 0.09, type: 'triangle', gain: 0.04, noise: 0.2, filter: 1800 });
      }
      case 'double_jump': return this.playCue('swishes', { gain: 0.45, pitch: 3 }) || this.tone({ frequency: 520, slide: 380, duration: 0.16, type: 'sine', gain: 0.05 });
      case 'wallkick': { this.effort(0.3); return this.playCue('swishes', { gain: 0.5, pitch: 1, pick: /swish[_-]?(9|1[0-3])\b|heavy/i }) || this.tone({ frequency: 240, slide: 90, duration: 0.12, type: 'square', gain: 0.05, noise: 0.4, filter: 2200 }); }
      case 'mantle': { this.effort(0.4); return this.playCue('footsteps_hard', { bus: 'foley', gain: 0.5, pitch: -3 }) || this.tone({ frequency: 130, slide: 60, duration: 0.18, type: 'triangle', gain: 0.045, noise: 0.35, filter: 1400 }); }
      case 'slide': return this.playCue('swishes', { gain: 0.3, pitch: -4, filter: -1800 }) || this.tone({ frequency: 0, duration: 0.4, noise: 0.5, gain: 0.05, filter: 1200 });
      case 'dash': return this.playCue('swishes', { gain: 0.55, pitch: 0.5, pick: /swish[_-]?(5|6|7|8)\b/i }) || this.tone({ frequency: 300, slide: -180, duration: 0.2, type: 'sawtooth', gain: 0.045, noise: 0.3, filter: 2600 });
      case 'slam_start': return this.playCue('swishes', { gain: 0.5, pitch: -6 }) || this.tone({ frequency: 200, slide: -150, duration: 0.25, type: 'sawtooth', gain: 0.04 });
      case 'ladder_step': return this.playCue('footsteps_metal', { bus: 'foley', gain: 0.35, pitch: 3, cooldown: 120 }) || this.tone({ frequency: 330 + this.variant('ladder', 3) * 40, duration: 0.07, type: 'square', gain: 0.035, noise: 0.2, filter: 2600 });
      case 'ladder_enter': return this.playCue('footsteps_metal', { bus: 'foley', gain: 0.4, pitch: 1 }) || this.tone({ frequency: 280, slide: 60, duration: 0.1, type: 'square', gain: 0.03 });
      case 'ladder_exit': return this.playCue('footsteps_metal', { bus: 'foley', gain: 0.4, pitch: -2 }) || this.tone({ frequency: 240, slide: -60, duration: 0.1, type: 'triangle', gain: 0.03 });
      case 'door_open': return this.playCue('platformer_movement', { gain: 0.5, pitch: 0.5, pick: /door_open/i, cooldown: 1500 }) || this.tone({ frequency: 110, slide: 40, duration: 0.6, type: 'sawtooth', gain: 0.03, noise: 0.2, filter: 700 });
      case 'door_close': return this.playCue('machine_loops', { gain: 0.5, pitch: 0.5, pick: /door|metal/i, cooldown: 1500 }) || this.tone({ frequency: 90, slide: -30, duration: 0.5, type: 'sawtooth', gain: 0.03, noise: 0.2, filter: 600 });
      case 'land': {
        const kind = event.kind;
        if (kind === 'slam') { this.effort(0.5, /(1[0-5]|[6-9])/); return this.playCue('jump_land_heavy', { bus: 'foley', gain: 1.0, pitch: -2 }) || this.tone({ frequency: 60, slide: -30, duration: 0.35, type: 'sine', gain: 0.12, noise: 0.8, filter: 700 }); }
        if (kind === 'stumble') { this.effort(0.45); return this.playCue('jump_land_heavy', { bus: 'foley', gain: 0.9, pitch: -1 }) || this.tone({ frequency: 80, slide: -40, duration: 0.3, type: 'triangle', gain: 0.09, noise: 0.7, filter: 800 }); }
        if (kind === 'roll') { this.effort(0.3); return this.playCue('jump_land_heavy', { bus: 'foley', gain: 0.6, pitch: 1 }) || this.tone({ frequency: 110, slide: -50, duration: 0.22, type: 'triangle', gain: 0.06, noise: 0.5, filter: 1000 }); }
        if (kind === 'hard') return this.playCue('jump_land_heavy', { bus: 'foley', gain: 0.75 }) || this.tone({ frequency: 95, slide: -40, duration: 0.18, type: 'triangle', gain: 0.07, noise: 0.5, filter: 900 });
        return this.playCue('jump_land_light', { bus: 'foley', gain: 0.6, pitch: 2 }) || this.footstep(event.surface, 7);
      }
      case 'checkpoint': return this.playCue('machine_loops', { gain: 0.4, pick: /switch/i }) || this.tone({ frequency: 560, slide: 200, duration: 0.18, type: 'triangle', gain: 0.06 });
      case 'permit': return this.tone({ frequency: 820, slide: 300, duration: 0.3, type: 'sine', gain: 0.07 });
      case 'relay': return this.playCue('machine_loops', { gain: 0.5, pick: /switch|metal/i }) || this.tone({ frequency: 720, slide: 120, duration: 0.14, type: 'square', gain: 0.06 });
      case 'relay_miss': return this.tone({ frequency: 330, duration: 0.035, type: 'triangle', gain: 0.02 });
      case 'finish': return this.tone({ frequency: 1040, slide: 260, duration: 0.5, type: 'sine', gain: 0.08 });
      case 'ui': return this.tone({ frequency: 280, duration: 0.1, type: 'square', gain: 0.03 });
      default: return undefined;
    }
  }
}
