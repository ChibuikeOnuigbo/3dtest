import { OBJECTIVES, PHASES } from '../data/mission.js';

export class Hud {
  constructor() {
    this.objective = document.querySelector('#objective');
    this.charges = document.querySelector('#charges');
    this.beacon = document.querySelector('#beacon-state');
    this.promptNode = document.querySelector('#prompt');
    this.toastNode = document.querySelector('#toast');
    this.systemStatus = document.querySelector('#system-status');
    this.toastTimeout = null;
  }

  update(state) {
    this.objective.textContent = OBJECTIVES[state.phase];
    this.charges.textContent = state.tool.equipped ? `${state.tool.charges} / 6` : 'UNISSUED';
    this.beacon.textContent = state.beaconOnline ? 'ONLINE' : state.phase === PHASES.ROUTE_READY ? 'ARMABLE' : 'OFFLINE';
    this.systemStatus.textContent = state.beaconOnline ? 'SYSTEM / SIGNAL LIVE' : `SYSTEM / ${state.phase.toUpperCase()}`;
  }

  prompt(text) { this.promptNode.textContent = text; }

  toast(text, cue = 'tick') {
    this.toastNode.textContent = text;
    this.toastNode.dataset.cue = cue;
    this.toastNode.classList.remove('show');
    void this.toastNode.offsetWidth;
    this.toastNode.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toastNode.classList.remove('show'), 3400);
  }
}
