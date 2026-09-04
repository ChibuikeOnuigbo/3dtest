import * as THREE from 'three';
import { INTERACTION_COPY } from '../data/mission.js';

export class InteractionSystem {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 3.15;
    this.focus = null;
  }

  update() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const intersections = this.raycaster.intersectObjects(this.world.getRayTargets(), true);
    const first = intersections.find((hit) => hit.object.userData.interactionId || hit.object.userData.occluder);
    this.focus = first?.object?.userData?.interactionId ?? null;
    this.world.setFocused(this.focus);
    return this.focus;
  }

  prompt(state) {
    if (!this.focus) return '';
    if (this.focus.startsWith('door:')) {
      const id = this.focus.slice(5);
      const door = state.doors[id];
      if (!door?.unlocked) return `[ E ]  ACCESS LOCKED · ${this.doorCopy(id)}`;
      return `[ E ]  ${door.open ? 'CLOSE' : 'OPEN'} · ${this.doorCopy(id)}`;
    }
    const copy = INTERACTION_COPY[this.focus];
    return copy ? `[ E ]  ${copy.verb} · ${copy.label.toUpperCase()}` : '';
  }

  doorCopy(id) {
    return { entry: 'KEEPER’S HALL', generator: 'GENERATOR BAY', workshop: 'RADIO WORKSHOP', gallery: 'LANTERN GALLERY' }[id] ?? 'DOOR';
  }

  activate(store) {
    if (!this.focus) return { changed: false, text: 'No service control in reach.', cue: 'deny' };
    if (this.focus.startsWith('door:')) return store.send({ type: 'door', id: this.focus.slice(5) });
    return store.send({ type: 'interact', id: this.focus });
  }
}
