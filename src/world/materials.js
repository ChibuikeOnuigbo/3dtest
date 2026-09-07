import * as THREE from 'three';

/**
 * Material families for Rivet Run.
 *
 * Hierarchy (per docs/visual_style.md):
 *   PRIMARY   — concrete deck/roof, corrugated cladding, brick masonry (large surfaces)
 *   SECONDARY — painted structural steel, checker plate, grating, glazing (medium)
 *   ACCENT    — oxide-orange route paint, amber lamps, relay panels (small, sparse)
 *
 * Every textured family uses world-space UVs (see geometry.js) at the physical tile
 * size recorded in public/textures/sets/manifest.json, so a 30 m wall and a 1 m post
 * share one texel density. Poly Haven CC0 scan sets are preferred when the CI
 * acquisition step has placed them under public/textures/polyhaven/<id>/; otherwise
 * the project-generated sets are used. The chosen source is reported in the probe.
 */

const SET_SOURCES = {
  concrete: { generated: 'concrete_roof', polyhaven: 'concrete_floor_worn_001', tile: 3 },
  brick: { generated: 'brick_industrial', polyhaven: 'brick_wall_09', tile: 2.4 },
  corrugated: { generated: 'corrugated_steel', polyhaven: 'corrugated_iron_02', tile: 2 },
  checker: { generated: 'checker_plate', polyhaven: 'metal_plate', tile: 1.2 },
  grating: { generated: 'steel_grating', polyhaven: null, tile: 1 },
  facade: { generated: 'office_facade', polyhaven: null, tile: 8 },
  rust: { generated: 'corrugated_steel', polyhaven: 'rusty_metal_sheet', tile: 2 },
  // Roller-shutter curtain. Poly Haven's scan is a photographed shutter (horizontal slats); the generated
  // corrugated fallback has VERTICAL ribs, so RollerDoor swaps the curtain UVs when `sources.shutter` is generated.
  shutter: { generated: 'corrugated_steel', polyhaven: 'painted_metal_shutter', tile: 2 },
};

function makeLoader(manager) {
  const loader = new THREE.TextureLoader(manager);
  return (url, { color = false, tile = 2 } = {}) => {
    const texture = loader.load(url);
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    texture.userData.tile = tile;
    return texture;
  };
}

/**
 * @param {object} options
 * @param {THREE.LoadingManager} [options.manager]
 * @param {Set<string>} [options.availablePolyhaven] ids present under public/textures/polyhaven
 * @param {boolean} [options.headless] skip texture loading entirely (Node tests)
 */
/**
 * Large-scale (17 m) value-noise "grime" mask used to break the visible tiling of the
 * 1–3 m PBR sets. Sampled in world space inside the standard shader, so a 40 m roof gets
 * slow albedo/roughness drift instead of a perfectly periodic pattern. Built in memory —
 * no texture file, and no extra draw calls (one extra texture fetch per fragment).
 */
function makeMacroNoiseTexture(size = 256, seed = 7) {
  let state = seed >>> 0;
  const rand = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const lattice = 16; const grid = new Float32Array(lattice * lattice);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const sample = (u, v) => {
    const x = u * lattice, y = v * lattice; const x0 = Math.floor(x) % lattice, y0 = Math.floor(y) % lattice; const x1 = (x0 + 1) % lattice, y1 = (y0 + 1) % lattice;
    const fx = x - Math.floor(x), fy = y - Math.floor(y); const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = grid[y0 * lattice + x0], b = grid[y0 * lattice + x1], c = grid[y1 * lattice + x0], d = grid[y1 * lattice + x1];
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const n = 0.55 * sample(u, v) + 0.3 * sample((u * 2.13) % 1, (v * 2.13) % 1) + 0.15 * sample((u * 4.7) % 1, (v * 4.7) % 1);
    const i = (y * size + x) * 4; const g = Math.round(Math.max(0, Math.min(1, n)) * 255);
    data[i] = g; data[i + 1] = g; data[i + 2] = g; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

function addMacroVariation(material, texture, { scale = 17, albedo = 0.3, roughness = 0.18 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.macroMap = { value: texture };
    shader.uniforms.macroParams = { value: new THREE.Vector3(1 / scale, albedo, roughness) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMacroWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMacroWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMacroWorld;\nuniform sampler2D macroMap;\nuniform vec3 macroParams;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat macroN = texture2D(macroMap, vMacroWorld.xz * macroParams.x + vMacroWorld.y * macroParams.x * vec2(0.71, 0.29)).r - 0.5;\ndiffuseColor.rgb *= 1.0 + macroN * 2.0 * macroParams.y;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + macroN * macroParams.z, 0.04, 1.0);');
  };
  material.customProgramCacheKey = () => 'macro-variation-v1';
  return material;
}

export function createMaterialLibrary({ manager, availablePolyhaven = new Set(), headless = false } = {}) {
  const load = headless ? null : makeLoader(manager);
  const sources = {};
  const macroNoise = headless ? null : makeMacroNoiseTexture();

  function textured(family, { color = '#ffffff', roughness = 1, metalness = 0, normalScale = 0.6, envMapIntensity = 0.7 } = {}) {
    const spec = SET_SOURCES[family];
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity });
    material.name = family;
    material.userData.tile = spec.tile;
    if (!load) { sources[family] = 'headless'; return material; }
    const usePolyhaven = spec.polyhaven && availablePolyhaven.has(spec.polyhaven);
    const base = usePolyhaven ? `/textures/polyhaven/${spec.polyhaven}` : `/textures/sets/${spec.generated}`;
    sources[family] = usePolyhaven ? `polyhaven:${spec.polyhaven}` : `generated:${spec.generated}`;
    material.map = load(`${base}/albedo.jpg`, { color: true, tile: spec.tile });
    material.normalMap = load(`${base}/normal.jpg`, { tile: spec.tile });
    material.normalScale = new THREE.Vector2(normalScale, normalScale);
    material.roughnessMap = load(`${base}/roughness.jpg`, { tile: spec.tile });
    addMacroVariation(material, macroNoise, { albedo: family === 'grating' || family === 'checker' ? 0.14 : 0.3, roughness: 0.18 });
    return material;
  }

  function flat(name, options, { macro = false } = {}) {
    const material = new THREE.MeshStandardMaterial(options);
    material.name = name;
    if (macro && macroNoise) addMacroVariation(material, macroNoise, { albedo: 0.16, roughness: 0.22 });
    return material;
  }

  const containerCache = new Map();

  /** Industrial steel-framed window: painted mullions over a lit (or dark) pane grid; drawn once, shared. */
  function windowMaterial(name, { lit, paneColor, emissive, emissiveIntensity, cols = 3, rows = 4 }) {
    if (typeof document === 'undefined') return flat(name, { color: paneColor, emissive, emissiveIntensity, roughness: 0.4 });
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 384;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = paneColor; ctx.fillRect(0, 0, 256, 384);
    // per-pane variation: some panes dimmer/brighter or broken so rows of windows do not repeat perfectly
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = ((r * 7 + c * 13) % 5) / 5;
      ctx.fillStyle = lit ? `rgba(${v > 0.6 ? 60 : 255},${v > 0.6 ? 40 : 220},${v > 0.6 ? 30 : 150},${lit ? 0.28 * v : 0})` : `rgba(140,170,190,${0.25 * v})`;
      ctx.fillRect(c * 256 / cols, r * 384 / rows, 256 / cols, 384 / rows);
    }
    ctx.fillStyle = '#23282b';
    for (let c = 0; c <= cols; c++) ctx.fillRect(Math.round(c * 256 / cols) - 5, 0, 10, 384);
    for (let r = 0; r <= rows; r++) ctx.fillRect(0, Math.round(r * 384 / rows) - 5, 256, 10);
    ctx.fillRect(0, 0, 256, 14); ctx.fillRect(0, 370, 256, 14); ctx.fillRect(0, 0, 14, 384); ctx.fillRect(242, 0, 14, 384);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const material = new THREE.MeshStandardMaterial({ map, color: '#ffffff', roughness: 0.35, metalness: 0.3, emissive: '#ffffff', emissiveMap: map, emissiveIntensity, envMapIntensity: 0.9 });
    material.name = name;
    material.userData.panel = true; material.userData.tile = 1; // builders.box maps the pane grid once across the face
    return material;
  }
  const library = {
    // PRIMARY
    concrete: textured('concrete', { color: '#b9b2a6', roughness: 0.94 }),
    concreteDark: textured('concrete', { color: '#7f7a72', roughness: 0.96 }),
    brick: textured('brick', { color: '#a88f7e', roughness: 0.9, normalScale: 0.9 }),
    brickDark: textured('brick', { color: '#6e5c52', roughness: 0.92, normalScale: 0.9 }),
    corrugated: textured('corrugated', { color: '#9aa4a2', roughness: 0.6, metalness: 0.35, normalScale: 1 }),
    corrugatedRust: textured('rust', { color: '#8a6a4f', roughness: 0.7, metalness: 0.3, normalScale: 1 }),
    corrugatedPale: textured('corrugated', { color: '#c8c3b4', roughness: 0.6, metalness: 0.3, normalScale: 1 }),
    shutter: textured('shutter', { color: '#aab3ae', roughness: 0.58, metalness: 0.22, normalScale: 1, envMapIntensity: 0.9 }),
    facade: textured('facade', { color: '#cfcac0', roughness: 0.55, metalness: 0.15, normalScale: 0.4, envMapIntensity: 0.9 }),
    facadeWarm: textured('facade', { color: '#d5b79a', roughness: 0.55, metalness: 0.15, normalScale: 0.4, envMapIntensity: 0.9 }),
    facadeCool: textured('facade', { color: '#9fb0ba', roughness: 0.5, metalness: 0.2, normalScale: 0.4, envMapIntensity: 1 }),
    // SECONDARY
    checker: textured('checker', { color: '#8d9194', roughness: 0.5, metalness: 0.7, normalScale: 0.8, envMapIntensity: 0.8 }),
    grating: textured('grating', { color: '#6d6f70', roughness: 0.62, metalness: 0.7, normalScale: 0.5 }),
    steel: flat('painted_steel_teal', { color: '#4f6a70', roughness: 0.52, metalness: 0.62, envMapIntensity: 0.9 }, { macro: true }),
    steelDark: flat('painted_steel_charcoal', { color: '#2f363a', roughness: 0.55, metalness: 0.7, envMapIntensity: 0.8 }, { macro: true }),
    steelPale: flat('painted_steel_pale', { color: '#8e9593', roughness: 0.62, metalness: 0.45, envMapIntensity: 0.7 }, { macro: true }),
    oxide: flat('oxide_red_steel', { color: '#7a3f2c', roughness: 0.6, metalness: 0.5, envMapIntensity: 0.7 }, { macro: true }),
    galvanised: flat('galvanised_steel', { color: '#8c9497', roughness: 0.42, metalness: 0.85, envMapIntensity: 1 }, { macro: true }),
    rubber: flat('black_rubber', { color: '#1d1f20', roughness: 0.95, metalness: 0 }),
    glass: flat('glazing', { color: '#9fc3cf', roughness: 0.08, metalness: 0.2, envMapIntensity: 1.2, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
    glassDark: flat('glazing_dark', { color: '#2b3b44', roughness: 0.18, metalness: 0.9, envMapIntensity: 1.2 }),
    container: (hex) => {
      if (!containerCache.has(hex)) {
        const material = flat(`container_${hex}`, { color: hex, roughness: 0.62, metalness: 0.45, envMapIntensity: 0.8 }, { macro: true });
        if (load) {
          // Painted corrugated panels: reuse the corrugated normal + roughness maps at container-rib scale (0.6 m tile).
          material.normalMap = load('/textures/sets/corrugated_steel/normal.jpg', { tile: 0.6 });
          material.normalScale = new THREE.Vector2(0.55, 0.55);
          material.roughnessMap = load('/textures/sets/corrugated_steel/roughness.jpg', { tile: 0.6 });
          material.userData.tile = 0.6;
        }
        containerCache.set(hex, material);
      }
      return containerCache.get(hex);
    },
    water: flat('harbour_water', { color: '#20404a', roughness: 0.14, metalness: 0.05, envMapIntensity: 1.6 }),
    asphalt: flat('asphalt', { color: '#3f4042', roughness: 0.98, metalness: 0 }, { macro: true }),
    // ACCENT
    routePaint: flat('route_paint_oxide_orange', { color: '#c65a2a', roughness: 0.6, metalness: 0.2 }),
    safetyYellow: flat('safety_yellow', { color: '#c9a03a', roughness: 0.6, metalness: 0.2 }),
    lampWarm: flat('amber_lamp', { color: '#ffd9a0', emissive: '#ffb257', emissiveIntensity: 2.6, roughness: 0.3 }),
    lampCool: flat('cool_lamp', { color: '#dbeeff', emissive: '#9fd0ff', emissiveIntensity: 2.0, roughness: 0.3 }),
    lampRed: flat('beacon_red', { color: '#ff8a7a', emissive: '#ff3b2f', emissiveIntensity: 2.2, roughness: 0.3 }),
    relay: flat('relay_panel_live', { color: '#d9a35a', emissive: '#c8641d', emissiveIntensity: 1.4, roughness: 0.35, metalness: 0.4 }),
    relayDone: flat('relay_panel_done', { color: '#7fb1a2', emissive: '#1f7f66', emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.4 }),
    screen: flat('terminal_screen', { color: '#a9d7cf', emissive: '#3fb8a3', emissiveIntensity: 1.2, roughness: 0.25 }),
    windowLit: windowMaterial('window_lit_warm', { lit: true, paneColor: '#e9b877', emissive: '#d9924a', emissiveIntensity: 0.75 }),
    windowDim: windowMaterial('window_unlit', { lit: false, paneColor: '#3a4d57', emissive: '#000000', emissiveIntensity: 0 }),
  };
  library.sources = sources;
  return library;
}

export const TEXTURE_SET_SOURCES = SET_SOURCES;
