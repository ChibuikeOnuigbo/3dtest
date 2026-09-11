import * as THREE from 'three';

/**
 * PropLibrary — real downloaded models (Poly Haven CC0 glTF, fetched by
 * tools/assets/fetch_polyhaven_models.mjs into public/models/polyhaven/<id>/) placed through one
 * API that stays deterministic and headless-safe:
 *
 *   - The manifest (public/models/polyhaven/manifest.json) is read synchronously at construction, so
 *     world building never depends on network timing. It carries per-root-node bounds computed by
 *     tools/assets/gltf_inspect.mjs, which is what colliders and footprints are sized from — meshes
 *     are never inspected at runtime.
 *   - `place()` registers the prop (scene audit) and, when asked, its AABB collider immediately; the
 *     mesh arrives asynchronously in the browser (GLTFLoader, one load per model id, clones per instance).
 *   - Node tests pass `manifest` directly (or nothing) — no DOM, no fetch.
 *   - When a model is missing from the manifest the prop is simply NOT placed and the miss is recorded
 *     (`missing`). There is deliberately no procedural box/cylinder stand-in: a fake prop is worse than
 *     an empty spot, and the record tells the reviewer exactly what was absent in a given capture.
 *
 * Poly Haven convention handled here: a file often ships several variants as sibling root nodes offset
 * in X (`…_graffiti`, `…_rusted`). `variant` selects the node; the shipped translation is stripped so
 * every variant drops at the requested position.
 */
export class PropLibrary {
  constructor(scene, builder, { headless = false, manifest, basePath = '/models/polyhaven', extraManifests = ['/models/sketchfab/manifest.json', '/models/hunt/manifest.json'], manager } = {}) {
    this.scene = scene;
    this.builder = builder;
    this.headless = headless;
    this.basePath = basePath;
    this.manager = manager;
    this.manifest = manifest === undefined ? (headless ? null : PropLibrary.readManifest(`${basePath}/manifest.json`)) : manifest;
    this.models = { ...(this.manifest?.models || {}) };
    // Additional per-source manifests (Sketchfab authorised intake) merge into the same id space; each model
    // carries its own base_path so the loader resolves the right directory. Ids never collide (prefix `sf_`).
    if (manifest === undefined && !headless) {
      for (const url of extraManifests) {
        const extra = PropLibrary.readManifest(url);
        if (!extra?.models) continue;
        for (const [id, model] of Object.entries(extra.models)) this.models[id] = { ...model, base_path: model.base_path || extra.base_path || url.replace(/\/manifest\.json$/, '') };
        this.manifest = this.manifest || extra;
      }
    }
    this.cache = new Map();
    this.placed = [];
    this.missing = [];
    this.failures = [];
    this.loader = null;
  }

  static readManifest(url) {
    if (typeof XMLHttpRequest === 'undefined') return null;
    try {
      const request = new XMLHttpRequest();
      request.open('GET', url, false);
      request.send(null);
      if (request.status === 200) return JSON.parse(request.responseText);
    } catch { /* absent → no props */ }
    return null;
  }

  get status() {
    const ids = Object.keys(this.models);
    return { source: this.manifest ? 'manifest' : 'absent', models_available: ids.length, placed: this.placed.length, missing: this.missing.length, load_failures: this.failures.length };
  }

  has(id) { return Boolean(this.models[id]); }

  /** Root-node variants usable for display (LOD0 or un-LODed roots). */
  variantsOf(id) {
    const model = this.models[id];
    if (!model) return [];
    if (model.variants?.length) return model.variants;
    return (model.nodes || []).filter((n) => n.bounds).map((n) => n.name);
  }

  nodeInfo(id, variant) {
    const model = this.models[id];
    if (!model) return null;
    const nodes = model.nodes || [];
    return nodes.find((n) => n.name === variant && n.bounds) || nodes.find((n) => n.name === this.variantsOf(id)[0]) || nodes.find((n) => n.bounds) || null;
  }

  /** Real-world size [w, h, d] metres of a variant (from the inspected bounds). */
  sizeOf(id, variant) { const node = this.nodeInfo(id, variant); return node?.size_m || null; }

  /**
   * Place one instance.
   *   position  where the model's base centre goes (anchor 'base', default) or its origin (anchor 'origin')
   *   yaw       rotation about Y (three.js convention)
   *   collide   register an AABB collider sized from the rotated bounds (traits merged in)
   * Returns the placement record (with `aabb` and `solid`) or null when the model is not available.
   */
  place(id, position, yaw = 0, { variant, scale = 1, collide = false, traits = {}, colliderId, anchor = 'base', castShadow = true, family } = {}) {
    const node = this.nodeInfo(id, variant);
    if (!node) { this.missing.push({ id, variant: variant || null, position: position.map((v) => Number(v.toFixed(2))) }); return null; }
    const chosen = node.name;
    const min = node.bounds.min.map((v) => v * scale);
    const max = node.bounds.max.map((v) => v * scale);
    const lift = anchor === 'base' ? -min[1] : 0;
    const c = Math.cos(yaw); const s = Math.sin(yaw);
    // three.js Y rotation: x' = x·cos + z·sin ; z' = −x·sin + z·cos
    const xs = []; const zs = [];
    for (const x of [min[0], max[0]]) for (const z of [min[2], max[2]]) { xs.push(x * c + z * s); zs.push(-x * s + z * c); }
    const aabb = {
      min: [position[0] + Math.min(...xs), position[1] + lift + min[1], position[2] + Math.min(...zs)],
      max: [position[0] + Math.max(...xs), position[1] + lift + max[1], position[2] + Math.max(...zs)],
    };
    const size = [aabb.max[0] - aabb.min[0], aabb.max[1] - aabb.min[1], aabb.max[2] - aabb.min[2]];
    const centre = [aabb.min[0] + size[0] / 2, aabb.min[1] + size[1] / 2, aabb.min[2] + size[2] / 2];
    const record = { id, variant: chosen, position: [...position], yaw, scale, lift, aabb, size, solid: null, object: null };
    if (collide) record.solid = this.builder.addCollider(colliderId || `${id}-${this.placed.length}`, centre, size, 0, { walkable: true, ...traits, prop: id });
    this.builder.register(family || `prop:${id}`, position, yaw, { model: id, variant: chosen, size: size.map((v) => Number(v.toFixed(2))) });
    this.placed.push(record);
    if (!this.headless) this.spawn(record, castShadow);
    return record;
  }

  async loaderInstance() {
    if (!this.loader) {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      this.loader = new GLTFLoader(this.manager);
    }
    return this.loader;
  }

  load(id) {
    if (!this.cache.has(id)) {
      const model = this.models[id];
      const url = `${model.base_path || this.basePath}/${id}/${model.gltf}`;
      const promise = this.loaderInstance()
        .then((loader) => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject)))
        .then((gltf) => {
          gltf.scene.traverse((object) => {
            if (!object.isMesh) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) {
              for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (material?.[key]) material[key].anisotropy = 8;
              if (material) material.envMapIntensity = 0.9;
            }
          });
          return gltf;
        })
        .catch((error) => { this.failures.push({ id, url, error: String(error?.message || error) }); return null; });
      this.cache.set(id, promise);
    }
    return this.cache.get(id);
  }

  spawn(record, castShadow) {
    this.load(record.id).then((gltf) => {
      if (!gltf) return;
      const source = gltf.scene.getObjectByName(record.variant) || gltf.scene.children[0];
      if (!source) return;
      const instance = source.clone(true);
      instance.position.set(0, 0, 0); // Poly Haven parks variants side by side; every variant drops at the origin here
      const holder = new THREE.Group();
      holder.add(instance);
      holder.position.set(record.position[0], record.position[1] + record.lift, record.position[2]);
      holder.rotation.y = record.yaw;
      holder.scale.setScalar(record.scale);
      holder.userData.prop = record.id; holder.userData.variant = record.variant;
      holder.traverse((object) => { if (object.isMesh) { object.castShadow = castShadow; object.receiveShadow = true; } });
      this.scene.add(holder);
      record.object = holder;
    });
  }

  /** Composition report for the scene audit. */
  report() {
    const byModel = {};
    for (const p of this.placed) byModel[p.id] = (byModel[p.id] || 0) + 1;
    return { ...this.status, by_model: byModel, missing: this.missing.slice(0, 40), load_failures: this.failures };
  }
}
