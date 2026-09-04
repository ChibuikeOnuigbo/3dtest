export class AudioSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.ambience = null;
    this.enabled = false;
  }

  start() {
    if (this.enabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.13;
    this.master.connect(this.context.destination);
    const oscillator = this.context.createOscillator();
    const lowpass = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 48;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 130;
    gain.gain.value = 0.02;
    oscillator.connect(lowpass).connect(gain).connect(this.master);
    oscillator.start();
    this.ambience = { oscillator, gain };
    this.enabled = true;
  }

  cue(kind = 'tick') {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const frequencies = { deny: 118, tick: 410, confirm: 520, door: 185, equip: 680, pulse: 270, 'pulse-hit': 830, power: 145, radio: 610, beacon: 740 };
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = kind === 'power' ? 'sawtooth' : 'sine';
    oscillator.frequency.setValueAtTime(frequencies[kind] ?? 360, now);
    if (kind === 'beacon') oscillator.frequency.exponentialRampToValueAtTime(1120, now + 0.62);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === 'deny' ? 0.07 : 0.1, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'beacon' ? 0.72 : 0.22));
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.8);
  }
}
