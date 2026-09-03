export class UI {
  constructor() {
    this.objective=document.querySelector('#objective'); this.prompt=document.querySelector('#interaction'); this.promptLabel=document.querySelector('#interaction-label'); this.message=document.querySelector('#message'); this.power=document.querySelector('#power-status'); this.signal=document.querySelector('#signal-status'); this.start=document.querySelector('#start-screen'); this.end=document.querySelector('#end-screen'); this.loading=document.querySelector('#loading'); this.messageTimer=0;
  }
  ready() { this.loading.classList.add('hidden'); }
  setObjective(text) { this.objective.textContent=text; }
  setPrompt(text, visible) { this.promptLabel.textContent=text; this.prompt.classList.toggle('hidden',!visible); }
  notify(text, duration=2600) { this.message.textContent=text; this.message.classList.add('show'); window.clearTimeout(this.messageTimer); this.messageTimer=window.setTimeout(()=>this.message.classList.remove('show'),duration); }
  setPower(active) { this.power.textContent=active?'GRID / RESTORED':'GRID / OFFLINE'; this.power.classList.toggle('live',active); }
  setSignal(active, complete=false) { this.signal.textContent=complete?'SIGNAL / ACKNOWLEDGED':active?'SIGNAL / ARMED':'SIGNAL / STANDBY'; this.signal.classList.toggle('live',active||complete); }
  begin() { this.start.classList.add('hidden'); }
  showEnd() { this.end.classList.remove('hidden'); }
  hideEnd() { this.end.classList.add('hidden'); }
}
