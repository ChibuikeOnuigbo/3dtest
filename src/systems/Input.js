export class Input {
  constructor(domElement) {
    this.domElement = domElement;
    this.keys = new Set();
    this.locked = false;
    this.started = false;
    this.fireListeners = new Set();
    this.interactListeners = new Set();
    this.lockListeners = new Set();

    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => this.onPointerLock());
    document.addEventListener('mousemove', (event) => this.onMouseMove(event));
    this.domElement.addEventListener('mousedown', (event) => {
      if (event.button === 0 && this.locked) this.fireListeners.forEach((listener) => listener());
    });
  }

  onKeyDown(event) {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (event.code === 'KeyE' && this.locked && !event.repeat) this.interactListeners.forEach((listener) => listener());
  }

  onPointerLock() {
    this.locked = document.pointerLockElement === this.domElement;
    if (!this.locked) this.keys.clear();
    this.lockListeners.forEach((listener) => listener(this.locked));
  }

  onMouseMove(event) {
    if (!this.locked || !this.onLook) return;
    this.onLook(event.movementX, event.movementY);
  }

  requestLock() {
    this.domElement.requestPointerLock?.();
  }

  movement() {
    const x = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const z = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    return { x, z, sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), jump: this.keys.has('Space') };
  }

  onFire(listener) { this.fireListeners.add(listener); }
  onInteract(listener) { this.interactListeners.add(listener); }
  onLock(listener) { this.lockListeners.add(listener); }
}
