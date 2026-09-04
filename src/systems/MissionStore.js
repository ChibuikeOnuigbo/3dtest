import { createInitialMission, dispatchMission } from '../data/mission.js';

export class MissionStore {
  constructor() {
    this.state = createInitialMission();
    this.listeners = new Set();
  }

  send(event) {
    const result = dispatchMission(this.state, event);
    this.listeners.forEach((listener) => listener(this.state, result, event));
    return result;
  }

  update(delta) {
    if (this.state.tool.cooldown > 0) this.state.tool.cooldown = Math.max(0, this.state.tool.cooldown - delta);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reset() {
    this.state = createInitialMission();
    this.listeners.forEach((listener) => listener(this.state, { changed: true, text: 'Maintenance reset.', cue: 'tick' }, { type: 'reset' }));
  }
}
