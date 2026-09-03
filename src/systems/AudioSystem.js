export class AudioSystem {
  constructor() { this.context=null; this.master=null; this.wind=null; this.humGain=null; this.enabled=false; }
  async unlock() {
    if (!this.context) {
      this.context=new (window.AudioContext||window.webkitAudioContext)(); this.master=this.context.createGain(); this.master.gain.value=.34; this.master.connect(this.context.destination);
      this.createWind(); this.createHum();
    }
    await this.context.resume(); this.enabled=true;
  }
  createWind() {
    const buffer=this.context.createBuffer(1,this.context.sampleRate*2,this.context.sampleRate); const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*.38;
    const source=this.context.createBufferSource(); source.buffer=buffer; source.loop=true;
    const filter=this.context.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=380;
    const gain=this.context.createGain(); gain.gain.value=.055; source.connect(filter).connect(gain).connect(this.master); source.start(); this.wind=gain;
  }
  createHum() {
    const osc=this.context.createOscillator(); osc.type='sine'; osc.frequency.value=58;
    const overtone=this.context.createOscillator(); overtone.type='triangle'; overtone.frequency.value=116;
    const gain=this.context.createGain(); gain.gain.value=.0001; const overtoneGain=this.context.createGain(); overtoneGain.gain.value=.0001;
    osc.connect(gain).connect(this.master); overtone.connect(overtoneGain).connect(this.master); osc.start(); overtone.start(); this.humGain={gain,overtoneGain};
  }
  setPower(active) { if (!this.enabled || !this.humGain) return; const t=this.context.currentTime; const volume=active?.055:.0001; this.humGain.gain.gain.cancelScheduledValues(t); this.humGain.gain.gain.linearRampToValueAtTime(volume,t+.35); this.humGain.overtoneGain.gain.linearRampToValueAtTime(active?.012:.0001,t+.35); }
  tone(frequency=440,duration=.1,volume=.06,type='sine') {
    if (!this.enabled) return; const osc=this.context.createOscillator(); const gain=this.context.createGain(); const t=this.context.currentTime;
    osc.type=type; osc.frequency.setValueAtTime(frequency,t); gain.gain.setValueAtTime(.0001,t); gain.gain.exponentialRampToValueAtTime(volume,t+.012); gain.gain.exponentialRampToValueAtTime(.0001,t+duration); osc.connect(gain).connect(this.master); osc.start(t); osc.stop(t+duration+.02);
  }
  cue(name) { const cues={inspect:[240,.07,.035],paper:[520,.08,.025],pickup:[780,.14,.05],install:[340,.12,.055],breaker:[92,.2,.09,'square'],door:[180,.15,.04],dial:[420,.06,.025],ready:[880,.2,.055],transmit:[660,.8,.07]}; const cue=cues[name]; if (cue) this.tone(...cue); }
}
