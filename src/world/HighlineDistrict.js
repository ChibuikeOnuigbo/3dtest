import * as THREE from 'three';

// One master seed is deliberately the only random source. A URL such as ?seed=ride-2026
// produces a repeatable version of the skyline without changing authored route geometry.
const DEFAULT_SEED = 'rivet-run-highline-01';
const UP = new THREE.Vector3(0, 1, 0);

const REGION_PLAN = Object.freeze([
  { id: 'yard-roof', region: 'yard', x: 0, z: 43, top: 0, width: 16, depth: 16, support: 21, material: 'roof', purpose: 'spawn / teach acceleration' },
  { id: 'intake-steps', region: 'yard', x: 0, z: 31, top: 0.78, width: 8.2, depth: 7, support: 16, material: 'steel', purpose: 'short-rise jump line' },
  { id: 'switch-house', region: 'transfer', x: 0, z: 19, top: 1.75, width: 17, depth: 13, support: 22, material: 'concrete', purpose: 'ability terminal / route read' },
  { id: 'wall-shaft-roof', region: 'west-shaft', x: -9.2, z: 6.1, top: 2.25, width: 5.4, depth: 10.2, support: 24, material: 'roof', purpose: 'wall route staging' },
  { id: 'dash-viaduct-start', region: 'east-viaduct', x: 9.2, z: 6.1, top: 2.25, width: 5.4, depth: 10.2, support: 24, material: 'roof', purpose: 'dash route staging' },
  { id: 'dash-viaduct-landing', region: 'east-viaduct', x: 9.2, z: -2.4, top: 3.18, width: 5.4, depth: 5.2, support: 25, material: 'safety', purpose: 'dash landing' },
  { id: 'wall-shaft-cap', region: 'west-shaft', x: -9.2, z: -3.2, top: 5.5, width: 5.4, depth: 5, support: 28, material: 'steel', purpose: 'wall route exit' },
  { id: 'boiler-court', region: 'boiler-court', x: 0, z: -13.5, top: 4.65, width: 25, depth: 15.5, support: 30, material: 'concrete', purpose: 'relay switch court' },
  { id: 'bridge-control', region: 'bridge-control', x: 0, z: -27.8, top: 5.45, width: 14, depth: 9, support: 30, material: 'steel', purpose: 'crouch tunnel and recovery deck' },
  { id: 'sunline-bridge', region: 'sunline-bridge', x: 0, z: -42.5, top: 7.25, width: 7.2, depth: 14.2, support: 39, material: 'safety', purpose: 'finish bridge / city vista' },
]);

const DISTRICT_BUILDINGS = Object.freeze([
  [-31, 38, 18, 18, 28, 'brick'], [-23, 15, 13, 17, 19, 'concrete'], [-28, -14, 16, 20, 33, 'brick'], [-26, -46, 14, 16, 24, 'concrete'],
  [30, 39, 20, 17, 26, 'concrete'], [25, 17, 13, 21, 22, 'brick'], [28, -16, 17, 22, 36, 'concrete'], [25, -48, 18, 15, 27, 'brick'],
  [-5, -68, 21, 15, 38, 'concrete'], [15, -72, 18, 14, 43, 'brick'], [-21, -72, 15, 13, 31, 'brick'],
  [-55, 5, 22, 24, 24, 'concrete'], [55, -8, 26, 27, 30, 'brick'], [-54, -48, 23, 17, 35, 'brick'], [52, -53, 25, 20, 40, 'concrete'],
]);

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashText(seed);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function meshBox(size, material, position, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

function loadTexture(path, repeat) {
  const texture = new THREE.TextureLoader().load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  return texture;
}

function makeLabel(text, accent = '#dca75c') {
  const canvas = document.createElement('canvas');
  canvas.width = 768; canvas.height = 156;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(16, 23, 25, .92)';
  context.fillRect(10, 14, 748, 128);
  context.strokeStyle = accent;
  context.lineWidth = 5;
  context.strokeRect(10, 14, 748, 128);
  context.fillStyle = '#f4e9cf';
  context.font = '700 48px ui-monospace, monospace';
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(text, 384, 79);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(3.45, 0.7, 1);
  return sprite;
}

function createMaterials() {
  const concreteMap = loadTexture('/textures/sunlit-concrete-tile.png', [3.6, 3.6]);
  const metalMap = loadTexture('/textures/painted-route-metal.png', [2.3, 2.3]);
  const standard = (map, color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ map, color, roughness, metalness });
  return {
    roof: standard(concreteMap, '#5b6161', 0.9, 0.08),
    concrete: standard(concreteMap, '#c1ae91', 0.88, 0.02),
    brick: standard(concreteMap, '#845f4d', 0.93, 0),
    steel: standard(metalMap, '#506d76', 0.52, 0.54),
    safety: standard(metalMap, '#c47a3d', 0.47, 0.48),
    trim: new THREE.MeshStandardMaterial({ color: '#26373b', roughness: 0.56, metalness: 0.68 }),
    shadow: new THREE.MeshStandardMaterial({ color: '#1b2427', roughness: 0.82, metalness: 0.15 }),
    window: new THREE.MeshStandardMaterial({ color: '#496872', emissive: '#142932', emissiveIntensity: 0.4, roughness: 0.24, metalness: 0.62 }),
    windowWarm: new THREE.MeshStandardMaterial({ color: '#dca55d', emissive: '#be6a31', emissiveIntensity: 0.8, roughness: 0.42, metalness: 0.2 }),
    routePaint: new THREE.MeshStandardMaterial({ color: '#d5b362', emissive: '#5f431d', emissiveIntensity: 0.16, roughness: 0.38, metalness: 0.36 }),
    relay: new THREE.MeshStandardMaterial({ color: '#e0bd74', emissive: '#a35c25', emissiveIntensity: 1.25, roughness: 0.26, metalness: 0.68 }),
    routeGlow: new THREE.MeshStandardMaterial({ color: '#f1d08a', emissive: '#be7731', emissiveIntensity: 1.1, roughness: 0.25, metalness: 0.4 }),
  };
}

/**
 * A connected rooftop and rail-overpass district. Every collidable route deck is paired
 * with a visible building, bridge pier, or truss below it. Decorative objects remain
 * mounted to roofs/facades rather than being used as loose obstacle-course clutter.
 */
export class HighlineDistrict {
  constructor(scene, { seed = new URLSearchParams(window.location.search).get('seed') || DEFAULT_SEED } = {}) {
    this.scene = scene;
    this.seed = seed;
    this.random = seededRandom(seed);
    this.materials = createMaterials();
    this.solids = [];
    this.targets = new Map();
    this.animated = [];
    this.powerupCollected = false;
    this.checkpointReached = false;
    this.finished = false;
    this.build();
  }

  addVisual(id, size, material, position, cast = true) {
    const mesh = meshBox(size, material, position, cast);
    mesh.userData.worldObject = id;
    this.scene.add(mesh);
    return mesh;
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

  addSign(text, position, color = '#dca75c', scale = 1) {
    const sign = makeLabel(text, color);
    sign.scale.multiplyScalar(scale);
    sign.position.set(...position);
    this.scene.add(sign);
    return sign;
  }

  addRail(x, top, z, length, axis = 'z', material = this.materials.trim) {
    const rail = this.addVisual('mounted-rail', axis === 'z' ? [0.09, 0.86, length] : [length, 0.86, 0.09], material, [x, top + 0.42, z]);
    rail.castShadow = true;
    for (let offset = -length / 2 + 0.35; offset < length / 2; offset += 2.1) {
      this.addVisual('rail-post', [0.1, 0.9, 0.1], material, axis === 'z' ? [x, top + 0.45, z + offset] : [x + offset, top + 0.45, z]);
    }
  }

  addRoofRegion(region) {
    const roofThickness = 0.42;
    this.addSolid(region.id, [region.x, region.top, region.z], [region.width, roofThickness, region.depth], this.materials[region.material], { walkable: true, region: region.region });
    // The lower building gives a player-height view of supported architecture and makes
    // rooftop height legible from all approaches.
    const buildingTop = region.top - roofThickness;
    this.addVisual(`${region.id}-building`, [region.width - 0.5, region.support, region.depth - 0.5], this.materials[region.material === 'roof' ? 'brick' : 'concrete'], [region.x, buildingTop - region.support / 2, region.z]);
    this.addParapet(region);
    this.addRoofDetails(region);
  }

  addParapet(region) {
    const top = region.top + 0.43;
    const inset = 0.28;
    const { x, z, width, depth } = region;
    for (const [sx, sz, sw, sd] of [
      [x, z - depth / 2 + inset, width, 0.18], [x, z + depth / 2 - inset, width, 0.18],
      [x - width / 2 + inset, z, 0.18, depth], [x + width / 2 - inset, z, 0.18, depth],
    ]) this.addVisual('parapet', [sw, 0.82, sd], this.materials.trim, [sx, top, sz]);
    // Open the entry/exit edges selectively in the route direction so the building still
    // has a credible parapet but never traps the player in a box.
    const openings = [[x, z + depth / 2 - inset, Math.min(4.6, width - 1), 0.22], [x, z - depth / 2 + inset, Math.min(4.6, width - 1), 0.22]];
    openings.forEach(([ox, oz, ow, od]) => this.addVisual('parapet-opening-mark', [ow, 0.86, od], this.materials[region.material === 'safety' ? 'safety' : 'routePaint'], [ox, top + 0.02, oz]));
  }

  addRoofDetails(region) {
    const { x, z, top, width, depth, id, region: regionName } = region;
    const detailChoices = {
      yard: [[-4.4, 3.2, 'vent-bank'], [4.4, -2.7, 'ac-unit']],
      transfer: [[-5.2, -2.8, 'switchgear'], [5.2, 2.8, 'water-tank']],
      'west-shaft': [[1.35, 2.7, 'ladder-cage']],
      'east-viaduct': [[-1.25, 2.2, 'signal-box']],
      'boiler-court': [[-9, -4.6, 'ac-unit'], [9, 4.4, 'vent-bank']],
      'bridge-control': [[-4.4, 2.7, 'switchgear'], [4.4, -2.8, 'signal-box']],
      'sunline-bridge': [[-2.25, 4.7, 'signal-box']],
    };
    for (const [dx, dz, type] of detailChoices[regionName] || []) this.addRoofProp(`${id}-${type}`, x + dx, top, z + dz, type);
    // Sparse seam strips turn roofs into roof assemblies rather than untextured slabs.
    const seamLength = Math.max(2, depth - 1.2);
    for (let dx = -width / 2 + 1.3; dx < width / 2 - 0.8; dx += 2.1) this.addVisual('roof-seam', [0.045, 0.028, seamLength], this.materials.shadow, [x + dx, top + 0.025, z]);
  }

  addRoofProp(id, x, top, z, type) {
    const group = new THREE.Group();
    group.position.set(x, top, z);
    const { trim, steel, safety, window } = this.materials;
    if (type === 'vent-bank') {
      group.add(meshBox([1.7, 0.36, 0.72], steel, [0, 0.18, 0]));
      group.add(meshBox([1.85, 0.09, 0.12], trim, [0, 0.43, -0.27]));
      group.add(meshBox([1.85, 0.09, 0.12], trim, [0, 0.43, 0.27]));
    } else if (type === 'ac-unit') {
      group.add(meshBox([1.2, 0.82, 0.92], trim, [0, 0.41, 0]));
      group.add(meshBox([0.92, 0.52, 0.04], window, [0, 0.45, 0.49]));
      group.add(meshBox([1.28, 0.08, 0.98], steel, [0, 0.86, 0]));
    } else if (type === 'switchgear') {
      group.add(meshBox([0.9, 1.32, 0.46], safety, [0, 0.66, 0]));
      group.add(meshBox([0.52, 0.18, 0.035], window, [0, 0.89, 0.25]));
      group.add(meshBox([1.03, 0.1, 0.58], trim, [0, 1.35, 0]));
    } else if (type === 'water-tank') {
      group.add(meshBox([1.6, 1.5, 1.4], steel, [0, 0.75, 0]));
      group.add(meshBox([1.76, 0.1, 1.55], trim, [0, 1.54, 0]));
      group.add(meshBox([0.14, 1.5, 0.14], trim, [-0.67, 0.75, -0.58]));
      group.add(meshBox([0.14, 1.5, 0.14], trim, [0.67, 0.75, -0.58]));
    } else if (type === 'ladder-cage') {
      group.add(meshBox([0.5, 2.5, 0.1], trim, [0, 1.25, 0]));
      for (let y = 0.25; y < 2.5; y += 0.32) group.add(meshBox([0.5, 0.05, 0.12], safety, [0, y, 0.07]));
      group.add(meshBox([0.09, 2.5, 0.12], trim, [-0.24, 1.25, 0])); group.add(meshBox([0.09, 2.5, 0.12], trim, [0.24, 1.25, 0]));
    } else {
      group.add(meshBox([0.72, 1.08, 0.72], trim, [0, 0.54, 0]));
      group.add(meshBox([0.42, 0.26, 0.04], window, [0, 0.67, 0.38]));
      group.add(meshBox([0.82, 0.1, 0.82], steel, [0, 1.11, 0]));
    }
    group.userData.worldObject = id;
    group.traverse((child) => { child.castShadow = true; child.receiveShadow = true; });
    this.scene.add(group);
  }

  addFacade(id, x, z, width, depth, top, height, family, accentRate = 0.18) {
    this.addVisual(`${id}-mass`, [width, height, depth], this.materials[family], [x, top - height / 2, z]);
    const windowMaterial = this.materials.window;
    const warmMaterial = this.materials.windowWarm;
    const baseY = top - height * 0.42;
    const rows = Math.max(2, Math.floor(height / 4.1));
    const cols = Math.max(2, Math.floor(width / 2.4));
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < cols; column += 1) {
        const wx = x - width / 2 + 1.2 + column * ((width - 2.4) / Math.max(1, cols - 1));
        const wy = baseY + row * 3.2;
        const material = this.random() < accentRate ? warmMaterial : windowMaterial;
        this.addVisual('facade-window', [1.08, 1.74, 0.07], material, [wx, wy, z + depth / 2 + 0.04], false);
      }
    }
    // Deep cornices and side pilasters give façade silhouette without loose decoration.
    this.addVisual('facade-cornice', [width + 0.34, 0.32, depth + 0.34], this.materials.trim, [x, top + 0.08, z]);
    this.addVisual('facade-pilaster', [0.42, height + 0.3, 0.45], this.materials.trim, [x - width / 2 + 0.15, top - height / 2, z + depth / 2 + 0.12]);
    this.addVisual('facade-pilaster', [0.42, height + 0.3, 0.45], this.materials.trim, [x + width / 2 - 0.15, top - height / 2, z + depth / 2 + 0.12]);
  }

  addCityBuilding([x, z, width, depth, height, family], index) {
    const top = -3.8 + this.random() * 2.6;
    this.addFacade(`city-block-${index}`, x, z, width, depth, top, height, family, 0.08 + this.random() * 0.1);
    const roofTop = top + 0.22;
    // Antennas are visibly roof-mounted square masts, never arbitrary floating lines.
    if (this.random() > 0.35) {
      const mastHeight = 2 + this.random() * 4;
      this.addVisual('roof-mast', [0.13, mastHeight, 0.13], this.materials.trim, [x + (this.random() - 0.5) * width * 0.35, roofTop + mastHeight / 2, z]);
      this.addVisual('roof-mast-tip', [0.32, 0.32, 0.32], this.materials.routeGlow, [x + (this.random() - 0.5) * width * 0.35, roofTop + mastHeight, z], false);
    }
  }

  addTrussBridge(x, top, z, width, length, depth, material = this.materials.steel) {
    // A rectangular Warren-like frame: structural diagonal members support the bridge sides.
    for (const side of [-1, 1]) {
      const sideX = x + side * (width / 2 + 0.1);
      this.addVisual('bridge-top-chord', [0.16, 0.16, length], material, [sideX, top + 1.32, z]);
      this.addVisual('bridge-bottom-chord', [0.19, 0.19, length], material, [sideX, top - 0.06, z]);
      for (let localZ = -length / 2 + 1; localZ < length / 2; localZ += 2) {
        const brace = this.addVisual('bridge-diagonal', [0.13, 2.12, 0.13], material, [sideX, top + 0.65, z + localZ]);
        brace.rotation.x = (localZ / 2) % 2 > 0 ? 0.62 : -0.62;
      }
    }
    for (const localZ of [-length / 2 + 1.2, 0, length / 2 - 1.2]) this.addBridgePier(x, top, z + localZ, depth);
  }

  addBridgePier(x, top, z, depth) {
    const pierHeight = Math.max(8, top + 24);
    this.addVisual('bridge-pier', [1.35, pierHeight, depth], this.materials.concrete, [x, top - pierHeight / 2, z]);
    this.addVisual('pier-cap', [2.15, 0.38, depth + 0.64], this.materials.trim, [x, top - 0.37, z]);
  }

  addGateway(id, x, top, z, width, height, facing = 'z', label = '') {
    const group = new THREE.Group();
    group.position.set(x, top, z);
    const lateral = facing === 'z' ? [0.22, height, 0.42] : [0.42, height, 0.22];
    const header = facing === 'z' ? [width, 0.35, 0.42] : [0.42, 0.35, width];
    group.add(meshBox(lateral, this.materials.trim, [-width / 2, height / 2, 0]));
    group.add(meshBox(lateral, this.materials.trim, [width / 2, height / 2, 0]));
    group.add(meshBox(header, this.materials.safety, [0, height, 0]));
    group.add(meshBox(facing === 'z' ? [width - 0.6, 0.11, 0.08] : [0.08, 0.11, width - 0.6], this.materials.routePaint, [0, height - 0.05, facing === 'z' ? -0.26 : -0.26]));
    group.userData.worldObject = id;
    group.traverse((child) => { child.castShadow = true; child.receiveShadow = true; });
    this.scene.add(group);
    if (label) this.addSign(label, facing === 'z' ? [x, top + height + 0.78, z + 0.28] : [x + 0.28, top + height + 0.78, z], '#e0b66b', 0.64);
  }

  addRouteMark(x, top, z, axis = 'z', length = 2.1) {
    this.addVisual('route-paint', axis === 'z' ? [0.36, 0.035, length] : [length, 0.035, 0.36], this.materials.routePaint, [x, top + 0.035, z], false);
  }

  addMountedRelay(id, position, side = 1) {
    const [x, top, z] = position;
    const group = new THREE.Group();
    group.position.set(x, top, z);
    const offset = side * 0.36;
    group.add(meshBox([0.5, 1.52, 0.32], this.materials.trim, [offset, 0.76, 0]));
    const body = meshBox([0.82, 0.6, 0.14], this.materials.relay, [offset, 1.12, side * 0.22], false);
    const sensor = meshBox([0.3, 0.2, 0.05], this.materials.routeGlow, [offset, 1.12, side * 0.31], false);
    group.add(body, sensor);
    group.traverse((object) => { object.userData.targetId = id; object.castShadow = true; object.receiveShadow = true; });
    this.scene.add(group);
    this.targets.set(id, { id, group, active: true, body, sensor });
    this.animated.push({ mesh: sensor, kind: 'relay', base: 1 });
  }

  addKineticTerminal() {
    const group = new THREE.Group();
    group.position.set(0, 1.75, 20.5);
    group.add(meshBox([1.38, 1.82, 0.75], this.materials.trim, [0, 0.91, 0]));
    group.add(meshBox([0.86, 0.65, 0.05], this.materials.routeGlow, [0, 1.14, 0.41], false));
    group.add(meshBox([1.55, 0.13, 0.9], this.materials.safety, [0, 1.88, 0]));
    group.userData.worldObject = 'mounted-kinetic-terminal';
    this.scene.add(group);
    this.powerup = group;
    this.addSign('KINETIC PERMIT', [0, 4.65, 20.82], '#dca75c', 0.75);
  }

  addCheckpoint() {
    const group = new THREE.Group();
    group.position.set(0, 1.75, 14.3);
    group.add(meshBox([0.9, 2.85, 0.9], this.materials.trim, [0, 1.43, 0]));
    const lamp = meshBox([0.52, 0.52, 0.52], this.materials.routeGlow, [0, 2.96, 0], false);
    group.add(lamp);
    group.add(new THREE.PointLight('#efae65', 1.4, 8, 2));
    this.scene.add(group);
    this.checkpointBeacon = group;
    this.animated.push({ mesh: lamp, kind: 'relay', base: 1.15 });
  }

  addSwitchHouse() {
    // Framed covered transition: roof, posts and glass/wire panels describe a destination
    // instead of leaving the player at an unframed opening.
    const y = 2.0;
    this.addVisual('switch-house-canopy', [10.6, 0.38, 5.1], this.materials.trim, [0, y + 3.26, 16.2]);
    for (const x of [-5, 5]) {
      this.addVisual('switch-house-post', [0.38, 3.35, 0.38], this.materials.steel, [x, y + 1.62, 16.2]);
      this.addVisual('switch-house-post', [0.38, 3.35, 0.38], this.materials.steel, [x, y + 1.62, 18.7]);
    }
    for (const x of [-3.1, 0, 3.1]) this.addVisual('switch-house-glass', [2.35, 2.15, 0.08], this.materials.window, [x, y + 1.8, 13.15], false);
    this.addGateway('transfer-portal', 0, 1.75, 12.55, 5.4, 3.05, 'z', 'TRANSFER DECK');
  }

  addShaftRoute() {
    const shaftTop = 5.5;
    this.addSolid('shaft-west-wall', [-12.05, 9.2, 1.0], [0.44, 13.4, 9.4], this.materials.steel, { wallJumpable: true });
    this.addSolid('shaft-east-wall', [-6.35, 9.2, 1.0], [0.44, 13.4, 9.4], this.materials.steel, { wallJumpable: true });
    this.addVisual('shaft-back-wall', [6.1, 10.8, 0.32], this.materials.shadow, [-9.2, 5.4, 5.05]);
    this.addVisual('shaft-top-frame', [6.2, 0.32, 1.1], this.materials.safety, [-9.2, shaftTop + 1.8, -4.75]);
    this.addGateway('shaft-exit', -9.2, shaftTop, -5.25, 4.5, 2.6, 'z', 'WEST SHAFT');
    for (let y = 3; y < 9; y += 1.65) this.addRouteMark(-9.2, y, 1, 'x', 1.3);
  }

  addDashRoute() {
    this.addTrussBridge(9.2, 3.18, 1.0, 5.4, 7.2, 0.66, this.materials.safety);
    this.addGateway('viaduct-entry', 9.2, 2.25, 0.2, 4.7, 2.7, 'z', 'EAST SPAN');
    this.addRouteMark(9.2, 2.25, 2.5, 'z', 2.6);
    this.addRouteMark(9.2, 3.18, -2.3, 'z', 2.1);
  }

  addBoilerCourt() {
    this.addGateway('court-arrival', 0, 4.65, -6.2, 7.2, 3.05, 'z', 'BOILER COURT');
    // Boiler-house silhouette: equipment is mounted on the court building, with non-play
    // façades framing the open run rather than isolated random props.
    this.addVisual('boiler-block-left', [4.5, 7.8, 6.1], this.materials.brick, [-9.2, 0.75, -16.1]);
    this.addVisual('boiler-block-right', [4.5, 7.8, 6.1], this.materials.brick, [9.2, 0.75, -16.1]);
    for (const x of [-9.2, 9.2]) {
      this.addVisual('boiler-stack-base', [1.28, 8.4, 1.28], this.materials.trim, [x, 4.15, -17.35]);
      this.addVisual('boiler-stack-cap', [1.5, 0.18, 1.5], this.materials.safety, [x, 8.45, -17.35]);
    }
    for (const [x, z] of [[-5.6, -11.5], [0, -18.5], [5.6, -11.5]]) this.addMountedRelay(`relay-${x}`, [x, 4.65, z], z < -15 ? -1 : 1);
    this.addSign('RELAY YARD', [0, 8.8, -20.7], '#dca75c', 0.82);
  }

  addControlBridge() {
    this.addGateway('control-entry', 0, 5.45, -23.1, 6.6, 2.8, 'z', 'CONTROL BRIDGE');
    // A low framed maintenance passage. Collision ceiling is intentional and spans only
    // the direct line; broad roof edges remain readable recovery space.
    this.addSolid('maintenance-canopy', [0, 6.9, -28.1], [6.1, 0.28, 4.3], this.materials.trim, { nonTraversable: true, slideTunnel: true });
    this.addVisual('maintenance-side-left', [0.22, 1.25, 4.4], this.materials.steel, [-3.05, 6.15, -28.1]);
    this.addVisual('maintenance-side-right', [0.22, 1.25, 4.4], this.materials.steel, [3.05, 6.15, -28.1]);
    for (let z = -29.6; z < -26.3; z += 0.85) this.addVisual('maintenance-rib', [6.2, 0.1, 0.12], this.materials.safety, [0, 6.75, z]);
    this.addRouteMark(0, 5.45, -28.1, 'z', 3.2);
  }

  addFinishBridge() {
    this.addTrussBridge(0, 7.25, -42.5, 7.2, 14.3, 0.72, this.materials.steel);
    this.addRail(-3.14, 7.25, -42.5, 13.4);
    this.addRail(3.14, 7.25, -42.5, 13.4);
    this.addGateway('finish-portal', 0, 7.25, -48.3, 4.45, 3.5, 'z', 'SUNLINE EXIT');
    const relay = new THREE.Group();
    relay.position.set(0, 7.25, -50.1);
    relay.add(meshBox([1.2, 2.55, 0.86], this.materials.trim, [0, 1.28, 0]));
    relay.add(meshBox([0.7, 0.42, 0.05], this.materials.routeGlow, [0, 1.48, 0.47], false));
    relay.add(new THREE.PointLight('#e6b570', 1.8, 10, 2));
    this.scene.add(relay);
    this.finishGate = relay;
    this.animated.push({ mesh: relay.children[1], kind: 'finish', base: 1 });
    this.addSign('SUNLINE EXIT', [0, 11.65, -49.1], '#e8c57e', 0.83);
  }

  buildBackdrop() {
    // The environment below the route is a city/rail foundation, not a colour void.
    this.addVisual('district-foundation', [160, 4, 170], this.materials.shadow, [0, -25.8, -16]);
    this.addVisual('harbour-water', [180, 0.4, 62], new THREE.MeshStandardMaterial({ color: '#304d59', roughness: 0.31, metalness: 0.72 }), [0, -23.65, -113], false);
    DISTRICT_BUILDINGS.forEach((building, index) => this.addCityBuilding(building, index));
    // Stepped terrain anchors the far city in a horizon and breaks a blank pastel sky.
    for (let index = 0; index < 11; index += 1) {
      const x = -88 + index * 17;
      const height = 10 + this.random() * 14;
      this.addVisual('distant-ridge', [19, height, 16], index % 2 ? this.materials.concrete : this.materials.brick, [x, -23.8 + height / 2, -99 - this.random() * 9], false);
    }
    // A rail belt under the playable heights establishes scale and destination depth.
    this.addVisual('rail-ballast', [43, 0.72, 126], this.materials.concrete, [0, -23.42, -32], false);
    for (const x of [-18, -6, 6, 18]) this.addVisual('rail-line', [0.14, 0.14, 120], this.materials.steel, [x, -22.8, -32], false);
    for (let z = -85; z < 48; z += 5.2) this.addVisual('rail-sleeper', [40, 0.12, 0.46], this.materials.safety, [0, -22.93, z], false);
    this.addSign('HARBOR LINE // 08', [0, 6.9, -76], '#d3aa67', 1.2);
  }

  build() {
    this.buildBackdrop();
    REGION_PLAN.forEach((region) => this.addRoofRegion(region));
    this.addKineticTerminal();
    this.addCheckpoint();
    this.addSwitchHouse();
    this.addShaftRoute();
    this.addDashRoute();
    this.addBoilerCourt();
    this.addControlBridge();
    this.addFinishBridge();
    // Route paint is functional: it marks only take-off, transition and recovery direction.
    [[0, 0, 35.5], [0, 0.78, 28.5], [0, 1.75, 22.8], [-9.2, 2.25, 8.8], [9.2, 2.25, 8.8], [0, 4.65, -8.8], [0, 5.45, -24.9], [0, 7.25, -39.2]].forEach(([x, top, z]) => this.addRouteMark(x, top, z));
  }

  update(elapsed) {
    for (const entry of this.animated) {
      if (entry.kind === 'relay') {
        const intensity = 0.76 + Math.sin(elapsed * 2.2) * 0.24;
        entry.mesh.material.emissiveIntensity = 0.8 * intensity;
      }
      if (entry.kind === 'finish') entry.mesh.material.emissiveIntensity = 1.05 + Math.sin(elapsed * 2.3) * 0.28;
    }
  }

  collectEvents(position) {
    const events = [];
    if (!this.powerupCollected && position.distanceTo(this.powerup.position) < 1.34) {
      this.powerupCollected = true;
      this.powerup.visible = false;
      events.push({ type: 'powerup', ability: 'doubleJump' });
    }
    if (!this.checkpointReached && position.distanceTo(this.checkpointBeacon.position) < 2.1) {
      this.checkpointReached = true;
      events.push({ type: 'checkpoint', position: new THREE.Vector3(0, 1.75, 15.6) });
    }
    const targetCount = this.activeTargetCount();
    if (!this.finished && targetCount === 0 && position.distanceTo(this.finishGate.position) < 2.25) {
      this.finished = true;
      events.push({ type: 'finish' });
    }
    return events;
  }

  hitTarget(id) {
    const target = this.targets.get(id);
    if (!target?.active) return false;
    target.active = false;
    target.body.material = this.materials.shadow;
    target.sensor.material = this.materials.window;
    return true;
  }

  activeTargetCount() { return [...this.targets.values()].filter((target) => target.active).length; }
  targetObjects() { return [...this.targets.values()].flatMap(({ group, active }) => active ? [group] : []); }

  reset() {
    this.powerupCollected = false;
    this.checkpointReached = false;
    this.finished = false;
    this.powerup.visible = true;
    this.targets.forEach((target) => {
      target.active = true;
      target.body.material = this.materials.relay;
      target.sensor.material = this.materials.routeGlow;
    });
  }
}

export const HIGHLINE_ROUTE_REGIONS = REGION_PLAN.map(({ id, region, purpose }) => ({ id, region, purpose }));
export const HIGHLINE_MASTER_SEED = DEFAULT_SEED;
