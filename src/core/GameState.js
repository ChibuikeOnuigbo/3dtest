const OBJECTIVES = {
  intro: 'Inspect the fault console in the airlock.',
  note: 'Read the duty log in the office.',
  fuse: 'Collect the marked thermal fuse from the service passage.',
  install: 'Install the thermal fuse in the breaker room socket.',
  breaker: 'Reset the shore breaker.',
  door: 'Open the transmitter gallery security door.',
  frequency: 'Set the storm-warning channel: 3 · 1 · 4.',
  transmit: 'Arm the warning broadcast and transmit.',
  complete: 'Transmission complete. The coast has been warned.'
};

export class GameState {
  constructor() { this.listeners = new Set(); this.reset(); }
  reset() {
    this.flags = { introSeen:false, noteRead:false, fuseCollected:false, fuseInstalled:false, powerOn:false, galleryOpened:false, frequencySet:false, transmitted:false, ended:false };
    this.dials = [0, 0, 0]; this.objectiveKey = 'intro'; this.emit('reset');
  }
  get objective() { return OBJECTIVES[this.objectiveKey]; }
  on(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(event, detail = {}) { this.listeners.forEach((listener) => listener({ event, detail, state: this.snapshot() })); }
  snapshot() { return { ...this.flags, dials:[...this.dials], objectiveKey:this.objectiveKey, objective:this.objective }; }
  transition(flag, nextObjective, event = flag) {
    if (this.flags[flag]) return false;
    this.flags[flag] = true;
    this.objectiveKey = nextObjective;
    this.emit(event);
    return true;
  }
  inspectFault() { return this.transition('introSeen', 'note', 'fault-inspected'); }
  readNote() { return this.flags.introSeen && this.transition('noteRead', 'fuse', 'note-read'); }
  collectFuse() { return this.flags.noteRead && this.transition('fuseCollected', 'install', 'fuse-collected'); }
  installFuse() { return this.flags.fuseCollected && this.transition('fuseInstalled', 'breaker', 'fuse-installed'); }
  resetBreaker() { return this.flags.fuseInstalled && this.transition('powerOn', 'door', 'power-restored'); }
  openGallery() { return this.flags.powerOn && this.transition('galleryOpened', 'frequency', 'gallery-opened'); }
  turnDial(index) {
    if (!this.flags.powerOn || !this.flags.galleryOpened || this.flags.frequencySet) return false;
    this.dials[index] = (this.dials[index] + 1) % 10;
    this.emit('dial-changed', { index, value:this.dials[index] });
    if (this.dials.join(',') === '3,1,4') this.transition('frequencySet', 'transmit', 'frequency-locked');
    return true;
  }
  transmit() {
    if (!this.flags.frequencySet || this.flags.transmitted) return false;
    this.flags.transmitted = true; this.flags.ended = true; this.objectiveKey = 'complete'; this.emit('transmitted'); return true;
  }
}

export { OBJECTIVES };
