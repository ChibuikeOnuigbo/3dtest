import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

function meshBox(size, material, position, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

function createRouteTexture(primary, secondary, arrow = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = secondary;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 9;
  for (let x = -128; x < 340; x += 62) {
    ctx.beginPath();
    ctx.moveTo(x, 256);
    ctx.lineTo(x + 256, 0);
    ctx.stroke();
  }
  if (arrow) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f8f6df';
    for (let y = 22; y < 256; y += 84) {
      ctx.beginPath();
      ctx.moveTo(128, y + 49); ctx.lineTo(78, y); ctx.lineTo(178, y); ctx.closePath(); ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

function makeLabel(text, accent = '#9df6ff') {
  const canvas = document.createElement('canvas');
  canvas.width = 768; canvas.height = 180;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(7, 19, 38, .82)';
  ctx.fillRect(12, 28, 744, 124);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 28, 744, 124);
  ctx.fillStyle = '#f6fbef';
  ctx.font = '700 58px ui-monospace, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 384, 93);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(3.6, 0.84, 1);
  return sprite;
}

function createMaterials() {
  const route = createRouteTexture('#ef6d35', '#203a69', true);
  const jump = createRouteTexture('#2c7096', '#73eef0', true);
  return {
    concrete: new THREE.MeshStandardMaterial({ color: '#d8d4c5', roughness: 0.83, metalness: 0.04 }),
    cobalt: new THREE.MeshStandardMaterial({ color: '#183b71', roughness: 0.48, metalness: 0.53 }),
    orange: new THREE.MeshStandardMaterial({ map: route, color: '#f58e45', roughness: 0.45, metalness: 0.4 }),
    route: new THREE.MeshStandardMaterial({ map: jump, color: '#68dce0', roughness: 0.4, metalness: 0.42 }),
    slate: new THREE.MeshStandardMaterial({ color: '#294154', roughness: 0.63, metalness: 0.38 }),
    brass: new THREE.MeshStandardMaterial({ color: '#edc45f', roughness: 0.24, metalness: 0.9 }),
    magenta: new THREE.MeshStandardMaterial({ color: '#ff6ba7', emissive: '#c01f65', emissiveIntensity: 1.45, roughness: 0.28 }),
    cyan: new THREE.MeshStandardMaterial({ color: '#a5ffff', emissive: '#14cbd0', emissiveIntensity: 2.5, roughness: 0.2 }),
    violet: new THREE.MeshStandardMaterial({ color: '#c6a4ff', emissive: '#7445db', emissiveIntensity: 1.6, roughness: 0.25 }),
    white: new THREE.MeshStandardMaterial({ color: '#f7f2dc', roughness: 0.57, metalness: 0.15 }),
    dark: new THREE.MeshStandardMaterial({ color: '#10213c', roughness: 0.52, metalness: 0.65 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#8ff7ef', emissive: '#0e96a2', emissiveIntensity: 0.8, transmission: 0.15, transparent: true, opacity: 0.7, roughness: 0.12 }),
  };
}

export class SkylineCourse {
  constructor(scene) {
    this.scene = scene;
    this.materials = createMaterials();
    this.solids = [];
    this.targets = new Map();
    this.animated = [];
    this.powerupCollected = false;
    this.checkpointReached = false;
    this.finished = false;
    this.build();
  }

  addSolid(id, position, size, material, traits = {}) {
    const [x, top, z] = position;
    const [width, height, depth] = size;
    const mesh = meshBox(size, material, [x, top - height / 2, z]);
    mesh.userData.solidId = id;
    this.scene.add(mesh);
    this.solids.push({
      id,
      min: new THREE.Vector3(x - width / 2, top - height, z - depth / 2),
      max: new THREE.Vector3(x + width / 2, top, z + depth / 2),
      ...traits,
    });
    return mesh;
  }

  addRail(x, top, z, length, axis = 'z', material = this.materials.brass) {
    const rail = meshBox(axis === 'z' ? [0.08, 0.82, length] : [length, 0.82, 0.08], material, [x, top - 0.41, z]);
    this.scene.add(rail);
    for (let offset = -length / 2; offset <= length / 2; offset += 2) {
      const post = meshBox([0.08, 0.85, 0.08], material, axis === 'z' ? [x, top - 0.42, z + offset] : [x + offset, top - 0.42, z]);
      this.scene.add(post);
    }
  }

  addSign(text, position, color) {
    const sign = makeLabel(text, color);
    sign.position.set(...position);
    this.scene.add(sign);
  }

  addTruss(x, y, z, width, height, depth, material = this.materials.orange) {
    const group = new THREE.Group();
    for (const side of [-1, 1]) {
      group.add(meshBox([0.18, height, 0.18], material, [side * width / 2, height / 2, side * depth / 2]));
      group.add(meshBox([0.12, Math.hypot(width, height), 0.12], material, [side * width / 4, height / 2, side * depth / 2]));
      group.children[group.children.length - 1].rotation.z = side * Math.atan2(width / 2, height);
    }
    group.position.set(x, y, z);
    this.scene.add(group);
  }

  addBeacon(x, top, z, color, height = 2.2) {
    const group = new THREE.Group();
    group.position.set(x, top, z);
    group.add(meshBox([0.18, height, 0.18], this.materials.dark, [0, height / 2, 0]));
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.23), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.3 }));
    cap.position.y = height;
    group.add(cap);
    const light = new THREE.PointLight(color, 1.3, 6, 2);
    light.position.y = height;
    group.add(light);
    this.animated.push({ mesh: cap, type: 'pulse', base: 1 });
    this.scene.add(group);
  }

  addPowerup() {
    const group = new THREE.Group();
    group.position.set(0, 1.35, 10);
    const outer = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), this.materials.cyan);
    const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), this.materials.white);
    inner.rotation.z = Math.PI / 4;
    group.add(outer, inner);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.045, 8, 32), this.materials.cyan);
    halo.rotation.x = Math.PI / 2;
    group.add(halo);
    const light = new THREE.PointLight('#65fbfa', 2.5, 8, 2);
    group.add(light);
    group.userData.kind = 'powerup';
    this.scene.add(group);
    this.powerup = group;
    this.animated.push({ mesh: group, type: 'float', base: 1.35 });
    this.addSign('KINETIC PRISM', [0, 3.55, 10.8], '#70f5f2');
  }

  addTarget(id, position, color = '#ff6ba7') {
    const group = new THREE.Group();
    group.position.set(...position);
    const stem = meshBox([0.22, 1.0, 0.22], this.materials.dark, [0, -0.5, 0]);
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), this.materials.magenta);
    const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshStandardMaterial({ color: '#fff5d5', emissive: color, emissiveIntensity: 3 }));
    sensor.position.z = 0.4;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.055, 8, 28), this.materials.violet);
    ring.rotation.x = Math.PI / 2;
    group.add(stem, body, sensor, ring);
    group.traverse((object) => { object.userData.targetId = id; });
    this.scene.add(group);
    this.targets.set(id, { id, group, active: true, body, ring, color });
    this.animated.push({ mesh: group, type: 'target', base: position[1] });
  }

  build() {
    // Foundations: every course module has an explicit support/gantry rather than floating geometry.
    this.addSolid('ocean-foundation', [0, -1.6, -7], [58, 3.2, 68], this.materials.slate, { walkable: true });
    this.addSolid('launch-dock', [0, 0, 19], [12, 0.6, 15], this.materials.concrete, { walkable: true });
    this.addTruss(0, 0, 23, 10, 7, 3);
    this.addSign('VECTOR RUN // LAUNCH', [0, 4.7, 24.5], '#ffae61');
    this.addBeacon(-4.8, 0.4, 17.5, '#ff934e');
    this.addBeacon(4.8, 0.4, 17.5, '#ff934e');
    this.addRail(-5.5, 1.0, 19, 13);
    this.addRail(5.5, 1.0, 19, 13);

    // Intro rise and power-up platform.
    this.addSolid('prism-plinth', [0, 0.8, 10], [6, 0.8, 5], this.materials.route, { walkable: true });
    this.addPowerup();
    this.addSolid('rise-left', [-3.6, 0.35, 12], [2.1, 0.35, 5.8], this.materials.orange, { walkable: true });
    this.addSolid('rise-right', [3.6, 0.35, 12], [2.1, 0.35, 5.8], this.materials.orange, { walkable: true });

    // Central checkpoint deck: the decision point where both routes can be read at once.
    this.addSolid('checkpoint-deck', [0, 2.25, 1.4], [15, 0.55, 9.0], this.materials.concrete, { walkable: true });
    this.addSolid('checkpoint-step', [0, 1.48, 5.0], [7, 0.48, 2.8], this.materials.route, { walkable: true });
    this.addBeacon(0, 2.3, 0.2, '#63dfff', 3.0);
    this.addSign('SPLIT ROUTE // CHECKPOINT', [0, 5.9, 0.5], '#78ebff');
    this.addRail(-6.8, 3.05, 1.4, 8.1);
    this.addRail(6.8, 3.05, 1.4, 8.1);

    // West route: three deliberate wall-jump surfaces, visible as cobalt panels.
    this.addSolid('west-approach', [-8.5, 3.0, -5.2], [4.5, 0.55, 9], this.materials.slate, { walkable: true });
    this.addSolid('wall-panel-west', [-11.1, 9, -7.8], [0.42, 12, 8], this.materials.cobalt, { wallJumpable: true });
    this.addSolid('wall-panel-east', [-5.9, 9, -7.8], [0.42, 12, 8], this.materials.cobalt, { wallJumpable: true });
    this.addSolid('wall-shaft-base', [-8.5, 3.6, -10.2], [5.6, 0.6, 2.6], this.materials.route, { walkable: true });
    this.addSolid('wall-shaft-top', [-8.5, 8.2, -10.2], [5.6, 0.55, 2.6], this.materials.orange, { walkable: true });
    this.addSign('WALL LINK // 3 MAX', [-8.5, 11.4, -10.1], '#b8ccff');

    // East route: an orange dash bridge with a clearly readable gap.
    this.addSolid('east-approach', [8.5, 3.0, -4.3], [4.5, 0.55, 10.8], this.materials.slate, { walkable: true });
    this.addSolid('dash-start', [8.5, 3.55, -10.2], [4.8, 0.55, 4.0], this.materials.orange, { walkable: true, dashRoute: true });
    this.addSolid('dash-landing', [8.5, 4.4, -17.2], [4.8, 0.55, 5.0], this.materials.route, { walkable: true });
    this.addTruss(8.5, -1.5, -14, 5.4, 6, 11, this.materials.orange);
    this.addSign('DASH SPAN', [8.5, 6.8, -11.7], '#ffad69');

    // Main action court and target pylons.
    this.addSolid('target-court', [0, 4.5, -17], [24, 0.7, 14], this.materials.slate, { walkable: true });
    this.addSolid('court-step-north', [0, 3.6, -10.0], [8, 0.5, 2.3], this.materials.route, { walkable: true });
    this.addSolid('court-platform-left', [-7.2, 6.4, -17], [4.2, 0.5, 5.4], this.materials.concrete, { walkable: true });
    this.addSolid('court-platform-right', [7.2, 6.4, -17], [4.2, 0.5, 5.4], this.materials.concrete, { walkable: true });
    this.addSolid('court-cover-a', [-3.2, 5.9, -18.8], [1.4, 1.4, 2.5], this.materials.cobalt, { walkable: false });
    this.addSolid('court-cover-b', [3.2, 5.9, -15.1], [1.4, 1.4, 2.5], this.materials.cobalt, { walkable: false });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.14, 12, 48), this.materials.magenta);
    halo.position.set(0, 9.1, -17); halo.rotation.x = Math.PI / 2;
    this.scene.add(halo); this.animated.push({ mesh: halo, type: 'spin', base: 1 });
    this.addTruss(0, 4.8, -22.3, 16, 8, 2.3, this.materials.magenta);
    this.addSign('TARGET COURT // CLEAR 3', [0, 10.6, -21.7], '#ff80b9');
    this.addTarget('target-a', [-6.9, 7.15, -17]);
    this.addTarget('target-b', [0, 5.8, -20]);
    this.addTarget('target-c', [6.9, 7.15, -17]);

    // Finish bridge, deliberately supported by paired angled trusses.
    this.addSolid('finish-rise', [0, 5.5, -25.2], [7, 0.55, 3.6], this.materials.route, { walkable: true, slideRoute: true });
    // This shallow supported canopy is the intended slide/crouch lesson—not a decorative collision accident.
    this.addSolid('finish-slide-canopy', [0, 6.86, -25.2], [7.2, 0.26, 3.8], this.materials.cobalt, { nonTraversable: true });
    this.addSign('SLIDE GATE', [0, 6.45, -23.25], '#72f5f0');
    this.addSolid('finish-bridge', [0, 8.1, -30.5], [6.5, 0.55, 7.2], this.materials.white, { walkable: true });
    this.addTruss(0, -1.2, -30.5, 7.2, 9, 7.4, this.materials.brass);
    this.addRail(-2.9, 8.9, -30.5, 7);
    this.addRail(2.9, 8.9, -30.5, 7);
    const gate = new THREE.Group();
    gate.position.set(0, 8.4, -33);
    gate.add(new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.13, 12, 36), this.materials.brass));
    const gateCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), this.materials.cyan);
    gate.add(gateCore);
    const gateLight = new THREE.PointLight('#fff0b0', 2.2, 10, 2); gate.add(gateLight);
    this.scene.add(gate); this.finishGate = gate; this.animated.push({ mesh: gate, type: 'gate', base: 8.4 });
    this.addSign('SUNRISE GATE', [0, 11.6, -32.8], '#ffe4a1');

    // Intentional exterior context: water plane and simple horizon pylons, not an empty skybox.
    const water = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: '#1a7390', roughness: 0.32, metalness: 0.7, transparent: true, opacity: 0.72 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -1.58;
    this.scene.add(water);
    for (const [x, z, h] of [[-24, 9, 10], [22, -10, 13], [-21, -26, 8], [25, 23, 7]]) this.addTruss(x, -1.4, z, 3.6, h, 3.2, this.materials.cobalt);
  }

  update(elapsed) {
    for (const entry of this.animated) {
      if (entry.type === 'float') { entry.mesh.position.y = entry.base + Math.sin(elapsed * 2.1) * 0.18; entry.mesh.rotation.y = elapsed * 1.4; }
      if (entry.type === 'target') { entry.mesh.position.y = entry.base + Math.sin(elapsed * 1.7 + entry.base) * 0.16; entry.mesh.rotation.y = elapsed * 0.75; }
      if (entry.type === 'pulse') { const scale = 0.94 + Math.sin(elapsed * 3.2) * 0.09; entry.mesh.scale.setScalar(scale); }
      if (entry.type === 'spin') entry.mesh.rotation.z = elapsed * 0.18;
      if (entry.type === 'gate') { entry.mesh.rotation.y = elapsed * 0.35; entry.mesh.position.y = entry.base + Math.sin(elapsed * 1.8) * 0.14; }
    }
  }

  collectEvents(position) {
    const events = [];
    if (!this.powerupCollected && position.distanceTo(this.powerup.position) < 1.2) {
      this.powerupCollected = true; this.powerup.visible = false; events.push({ type: 'powerup', ability: 'doubleJump' });
    }
    if (!this.checkpointReached && position.distanceTo(new THREE.Vector3(0, 2.3, 0.2)) < 2.1) {
      this.checkpointReached = true; events.push({ type: 'checkpoint', position: new THREE.Vector3(0, 2.3, 1.4) });
    }
    const targetCount = [...this.targets.values()].filter((target) => target.active).length;
    if (!this.finished && targetCount === 0 && position.distanceTo(this.finishGate.position) < 2.3) {
      this.finished = true; events.push({ type: 'finish' });
    }
    return events;
  }

  hitTarget(id) {
    const target = this.targets.get(id);
    if (!target?.active) return false;
    target.active = false;
    target.body.material = this.materials.dark;
    target.ring.material = this.materials.white;
    target.group.scale.setScalar(0.76);
    return true;
  }

  activeTargetCount() { return [...this.targets.values()].filter((target) => target.active).length; }
  targetObjects() { return [...this.targets.values()].flatMap(({ group, active }) => active ? [group] : []); }

  reset() {
    this.powerupCollected = false; this.checkpointReached = false; this.finished = false;
    this.powerup.visible = true;
    this.targets.forEach((target) => { target.active = true; target.body.material = this.materials.magenta; target.ring.material = this.materials.violet; target.group.scale.setScalar(1); });
  }
}
