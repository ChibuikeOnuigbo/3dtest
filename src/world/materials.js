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
export function createMaterialLibrary({ manager, availablePolyhaven = new Set(), headless = false } = {}) {
  const load = headless ? null : makeLoader(manager);
  const sources = {};

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
    return material;
  }

  function flat(name, options) {
    const material = new THREE.MeshStandardMaterial(options);
    material.name = name;
    return material;
  }

  const containerCache = new Map();
  const library = {
    // PRIMARY
    concrete: textured('concrete', { color: '#b9b2a6', roughness: 0.94 }),
    concreteDark: textured('concrete', { color: '#7f7a72', roughness: 0.96 }),
    brick: textured('brick', { color: '#a88f7e', roughness: 0.9, normalScale: 0.9 }),
    brickDark: textured('brick', { color: '#6e5c52', roughness: 0.92, normalScale: 0.9 }),
    corrugated: textured('corrugated', { color: '#9aa4a2', roughness: 0.6, metalness: 0.35, normalScale: 1 }),
    corrugatedRust: textured('rust', { color: '#8a6a4f', roughness: 0.7, metalness: 0.3, normalScale: 1 }),
    corrugatedPale: textured('corrugated', { color: '#c8c3b4', roughness: 0.6, metalness: 0.3, normalScale: 1 }),
    facade: textured('facade', { color: '#cfcac0', roughness: 0.55, metalness: 0.15, normalScale: 0.4, envMapIntensity: 0.9 }),
    facadeWarm: textured('facade', { color: '#d5b79a', roughness: 0.55, metalness: 0.15, normalScale: 0.4, envMapIntensity: 0.9 }),
    facadeCool: textured('facade', { color: '#9fb0ba', roughness: 0.5, metalness: 0.2, normalScale: 0.4, envMapIntensity: 1 }),
    // SECONDARY
    checker: textured('checker', { color: '#8d9194', roughness: 0.5, metalness: 0.7, normalScale: 0.8, envMapIntensity: 0.8 }),
    grating: textured('grating', { color: '#6d6f70', roughness: 0.62, metalness: 0.7, normalScale: 0.5 }),
    steel: flat('painted_steel_teal', { color: '#4f6a70', roughness: 0.52, metalness: 0.62, envMapIntensity: 0.9 }),
    steelDark: flat('painted_steel_charcoal', { color: '#2f363a', roughness: 0.55, metalness: 0.7, envMapIntensity: 0.8 }),
    steelPale: flat('painted_steel_pale', { color: '#a9afae', roughness: 0.5, metalness: 0.6, envMapIntensity: 0.9 }),
    oxide: flat('oxide_red_steel', { color: '#7a3f2c', roughness: 0.6, metalness: 0.5, envMapIntensity: 0.7 }),
    galvanised: flat('galvanised_steel', { color: '#8c9497', roughness: 0.42, metalness: 0.85, envMapIntensity: 1 }),
    rubber: flat('black_rubber', { color: '#1d1f20', roughness: 0.95, metalness: 0 }),
    glass: flat('glazing', { color: '#6d8b98', roughness: 0.12, metalness: 0.92, envMapIntensity: 1.4 }),
    glassDark: flat('glazing_dark', { color: '#2b3b44', roughness: 0.18, metalness: 0.9, envMapIntensity: 1.2 }),
    container: (hex) => {
      if (!containerCache.has(hex)) containerCache.set(hex, flat(`container_${hex}`, { color: hex, roughness: 0.62, metalness: 0.45, envMapIntensity: 0.8 }));
      return containerCache.get(hex);
    },
    water: flat('harbour_water', { color: '#20404a', roughness: 0.14, metalness: 0.05, envMapIntensity: 1.6 }),
    asphalt: flat('asphalt', { color: '#3f4042', roughness: 0.98, metalness: 0 }),
    // ACCENT
    routePaint: flat('route_paint_oxide_orange', { color: '#c65a2a', roughness: 0.6, metalness: 0.2 }),
    safetyYellow: flat('safety_yellow', { color: '#c9a03a', roughness: 0.6, metalness: 0.2 }),
    lampWarm: flat('amber_lamp', { color: '#ffd9a0', emissive: '#ffb257', emissiveIntensity: 2.6, roughness: 0.3 }),
    lampCool: flat('cool_lamp', { color: '#dbeeff', emissive: '#9fd0ff', emissiveIntensity: 2.0, roughness: 0.3 }),
    lampRed: flat('beacon_red', { color: '#ff8a7a', emissive: '#ff3b2f', emissiveIntensity: 2.2, roughness: 0.3 }),
    relay: flat('relay_panel_live', { color: '#d9a35a', emissive: '#c8641d', emissiveIntensity: 1.4, roughness: 0.35, metalness: 0.4 }),
    relayDone: flat('relay_panel_done', { color: '#7fb1a2', emissive: '#1f7f66', emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.4 }),
    screen: flat('terminal_screen', { color: '#a9d7cf', emissive: '#3fb8a3', emissiveIntensity: 1.2, roughness: 0.25 }),
    windowLit: flat('window_lit_warm', { color: '#f0c78a', emissive: '#d9924a', emissiveIntensity: 0.9, roughness: 0.4 }),
    windowDim: flat('window_unlit', { color: '#31434c', roughness: 0.2, metalness: 0.85, envMapIntensity: 1.1 }),
  };
  library.sources = sources;
  return library;
}

export const TEXTURE_SET_SOURCES = SET_SOURCES;
