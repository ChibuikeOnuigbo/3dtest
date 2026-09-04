import * as THREE from 'three';

function droneMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.7, roughness: 0.3, metalness: 0.75 });
}

class Sentry {
  constructor(id, position, scene) {
    this.id = id;
    this.home = position.clone();
    this.group = new THREE.Group();
    this.group.position.copy(position);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12), new THREE.MeshStandardMaterial({ color: '#273b42', roughness: 0.32, metalness: 0.82 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 20), droneMaterial('#e96b54'));
    ring.rotation.x = Math.PI / 2;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), droneMaterial('#ff6b57'));
    eye.position.z = -0.3;
    this.group.add(shell, ring, eye);
    this.group.position.y = 1.35;
    this.group.traverse((node) => { if (node.isMesh) node.castShadow = true; });
    shell.userData.droneId = id;
    ring.userData.droneId = id;
    eye.userData.droneId = id;
    this.ring = ring;
    this.eye = eye;
    this.state = 'patrol';
    this.phase = Math.random() * Math.PI * 2;
    scene.add(this.group);
  }

  setState(state) {
    this.state = state;
    const active = state !== 'disabled';
    this.ring.material.emissive.set(active ? (state === 'alert' ? '#ff4532' : '#ba5a49') : '#1c725f');
    this.ring.material.color.set(active ? (state === 'alert' ? '#ff715c' : '#e96b54') : '#63d9b3');
    this.eye.material.emissive.set(active ? (state === 'alert' ? '#ff4d35' : '#da6654') : '#1b8a6f');
    this.eye.material.color.set(active ? '#ff6b57' : '#72f1c2');
  }

  update(elapsed, playerPosition) {
    if (this.state === 'disabled') {
      this.group.position.y = 0.6;
      this.group.rotation.z = 1.05;
      return;
    }
    const patrol = this.state === 'alert' ? 0.13 : 0.48;
    this.group.position.x = this.home.x + Math.sin(elapsed * patrol + this.phase) * 0.85;
    this.group.position.z = this.home.z + Math.cos(elapsed * patrol * 1.6 + this.phase) * 0.4;
    this.group.position.y = 1.32 + Math.sin(elapsed * 2 + this.phase) * 0.08;
    this.group.rotation.y = elapsed * 0.8 + this.phase;
    if (this.group.position.distanceTo(playerPosition) < 4.2) this.setState('alert');
    else if (this.state === 'alert') this.setState('patrol');
  }

  targets() { return [this.group]; }
}

export class Drones {
  constructor(scene) {
    this.sentries = new Map([
      ['relay-01', new Sentry('relay-01', new THREE.Vector3(0, 0, -0.2), scene)],
      ['relay-02', new Sentry('relay-02', new THREE.Vector3(-3.15, 0, 1.75), scene)],
      ['relay-03', new Sentry('relay-03', new THREE.Vector3(3.05, 0, -2.0), scene)],
    ]);
  }

  update(elapsed, playerPosition, state) {
    this.sentries.forEach((sentry, id) => {
      sentry.setState(state.sentries[id] === 'disabled' ? 'disabled' : sentry.state);
      sentry.update(elapsed, playerPosition);
    });
  }

  disable(id) {
    const sentry = this.sentries.get(id);
    if (sentry) sentry.setState('disabled');
  }

  getRayTargets() { return [...this.sentries.values()].flatMap((sentry) => sentry.targets()); }

  reset() {
    this.sentries.forEach((sentry) => {
      sentry.group.position.copy(sentry.home);
      sentry.group.position.y = 1.35;
      sentry.group.rotation.set(0, 0, 0);
      sentry.setState('patrol');
    });
  }
}
