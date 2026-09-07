/**
 * AudioDirector — procedural (Web Audio) placeholder for the OpenGameArt cue set
 * documented in research/opengameart/CURATION.md. Every cue slot below maps 1:1 to an
 * OGA category so swapping in curated samples only touches `playSample`.
 *
 * Cue slots: footstep(surface), jump, double_jump, land(soft|hard|roll|stumble|slam),
 * slide, dash, wallkick, mantle, ladder_step, ladder_enter/exit, checkpoint, relay,
 * permit, finish, ui. Beds: wind (altitude-scaled), machinery (near turbine hall /
 * boiler court), interior reverb tail.
 *
 * Nothing here downloads or plays remote media; the sandbox cannot reach opengameart.org,
 * and CI is where curated samples would be fetched (see .github/workflows).
 */
export class AudioDirector {
  constructor() {
    this.context = null;
    this.master = null;
    this.beds = null;
    this.variantIndex = new Map();
    this.samples = new Map(); // future: id -> AudioBuffer from curated OGA files
  }

  begin() {
    if (this.context) { this.context.resume?.(); return; }
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.context.destination);
    this.buildBeds();
  }

  buildBeds() {
    const ctx = this.context;
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) { const white = Math.random() * 2 - 1; last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; }
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuffer; wind.loop = true;
    const windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 420; windFilter.Q.value = 0.6;
    const windGain = ctx.createGain(); windGain.gain.value = 0.0;
    wind.connect(windFilter).connect(windGain).connect(this.master); wind.start();
    const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 49;
    const humFilter = ctx.createBiquadFilter(); humFilter.type = 'lowpass'; humFilter.frequency.value = 180;
    const humGain = ctx.createGain(); humGain.gain.value = 0.0;
    hum.connect(humFilter).connect(humGain).connect(this.master); hum.start();
    const hum2 = ctx.createOscillator(); hum2.type = 'triangle'; hum2.frequency.value = 98.5; hum2.connect(humGain);
    hum2.start();
    this.beds = { windGain, windFilter, humGain };
  }

  /** Called every frame with the player's altitude and distance to machinery. */
  updateBeds(delta, { altitude = 0, machineryDistance = 60, interior = false, speed = 0 } = {}) {
    if (!this.beds) return;
    const windTarget = Math.min(0.16, 0.03 + Math.max(0, altitude + 4) * 0.006 + speed * 0.004) * (interior ? 0.35 : 1);
    const humTarget = Math.max(0, 0.06 - machineryDistance * 0.0015) * (interior ? 1.6 : 1);
    const now = this.context.currentTime;
    this.beds.windGain.gain.setTargetAtTime(windTarget, now, 0.4);
    this.beds.windFilter.frequency.setTargetAtTime(380 + speed * 22, now, 0.3);
    this.beds.humGain.gain.setTargetAtTime(humTarget, now, 0.6);
  }

  variant(key, count) {
    const next = ((this.variantIndex.get(key) || 0) + 1 + Math.floor(Math.random() * (count - 1))) % count;
    this.variantIndex.set(key, next);
    return next;
  }

  tone({ frequency = 440, duration = 0.08, type = 'sine', gain = 0.05, slide = 0, noise = 0, filter = 0 }) {
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
    volume.connect(this.master);
  }

  footstep(surface = 'concrete', speed = 5) {
    const v = this.variant(`step-${surface}`, 4);
    const g = 0.02 + Math.min(speed, 8) * 0.003;
    const table = {
      concrete: { frequency: 90 + v * 8, duration: 0.05, type: 'triangle', noise: 0.5, filter: 900 },
      steel: { frequency: 260 + v * 30, duration: 0.09, type: 'square', noise: 0.25, filter: 2400 },
      grating: { frequency: 420 + v * 40, duration: 0.11, type: 'square', noise: 0.35, filter: 3200, slide: -120 },
      rubber: { frequency: 70, duration: 0.05, type: 'sine', noise: 0.2, filter: 500 },
    };
    this.tone({ ...(table[surface] || table.concrete), gain: g });
  }

  handle(event, context = {}) {
    switch (event.type) {
      case 'footstep': return this.footstep(event.surface, event.speed);
      case 'jump': return this.tone({ frequency: 180, slide: 120, duration: 0.09, type: 'triangle', gain: 0.04, noise: 0.2, filter: 1800 });
      case 'double_jump': return this.tone({ frequency: 520, slide: 380, duration: 0.16, type: 'sine', gain: 0.05 });
      case 'wallkick': return this.tone({ frequency: 240, slide: 90, duration: 0.12, type: 'square', gain: 0.05, noise: 0.4, filter: 2200 });
      case 'mantle': return this.tone({ frequency: 130, slide: 60, duration: 0.18, type: 'triangle', gain: 0.045, noise: 0.35, filter: 1400 });
      case 'slide': return this.tone({ frequency: 0, duration: 0.4, noise: 0.5, gain: 0.05, filter: 1200 });
      case 'dash': return this.tone({ frequency: 300, slide: -180, duration: 0.2, type: 'sawtooth', gain: 0.045, noise: 0.3, filter: 2600 });
      case 'slam_start': return this.tone({ frequency: 200, slide: -150, duration: 0.25, type: 'sawtooth', gain: 0.04 });
      case 'ladder_step': return this.tone({ frequency: 330 + this.variant('ladder', 3) * 40, duration: 0.07, type: 'square', gain: 0.035, noise: 0.2, filter: 2600 });
      case 'ladder_enter': return this.tone({ frequency: 280, slide: 60, duration: 0.1, type: 'square', gain: 0.03 });
      case 'ladder_exit': return this.tone({ frequency: 240, slide: -60, duration: 0.1, type: 'triangle', gain: 0.03 });
      case 'land': {
        const kind = event.kind;
        if (kind === 'slam') return this.tone({ frequency: 60, slide: -30, duration: 0.35, type: 'sine', gain: 0.12, noise: 0.8, filter: 700 });
        if (kind === 'stumble') return this.tone({ frequency: 80, slide: -40, duration: 0.3, type: 'triangle', gain: 0.09, noise: 0.7, filter: 800 });
        if (kind === 'roll') return this.tone({ frequency: 110, slide: -50, duration: 0.22, type: 'triangle', gain: 0.06, noise: 0.5, filter: 1000 });
        if (kind === 'hard') return this.tone({ frequency: 95, slide: -40, duration: 0.18, type: 'triangle', gain: 0.07, noise: 0.5, filter: 900 });
        return this.footstep(event.surface, 7);
      }
      case 'checkpoint': return this.tone({ frequency: 560, slide: 200, duration: 0.18, type: 'triangle', gain: 0.06 });
      case 'permit': return this.tone({ frequency: 820, slide: 300, duration: 0.3, type: 'sine', gain: 0.07 });
      case 'relay': return this.tone({ frequency: 720, slide: 120, duration: 0.14, type: 'square', gain: 0.06 });
      case 'relay_miss': return this.tone({ frequency: 330, duration: 0.035, type: 'triangle', gain: 0.02 });
      case 'finish': return this.tone({ frequency: 1040, slide: 260, duration: 0.5, type: 'sine', gain: 0.08 });
      case 'ui': return this.tone({ frequency: 280, duration: 0.1, type: 'square', gain: 0.03 });
      default: return undefined;
    }
  }
}
