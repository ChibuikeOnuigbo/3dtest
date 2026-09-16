import * as THREE from 'three';
import { assembleNodes } from '../../tools/assets/prop_assemblies.mjs';

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
 *
 * Root nodes are grouped into ASSEMBLIES (tools/assets/prop_assemblies.mjs): a crate is `…_crate` +
 * `…_lid`, a trash can is a body + two handles + a leaning lid, a covered car is a cover + four wheels.
 * Bounds, colliders and the spawned meshes all cover the whole assembly, never just the first root —
 * the earlier flat "every root is a variant" reading produced 9 cm trash-can colliders and lidless crates.
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

  /** Assemblies of a model (primary root + its parts, union bounds). Computed once per model from the manifest nodes. */
  assembliesOf(id) {
    const model = this.models[id];
    if (!model) return [];
    if (!model._assemblies) model._assemblies = model.assemblies?.length ? model.assemblies : assembleNodes(model.nodes || [], id);
    return model._assemblies;
  }

  /** Placeable variants = the primary root of each assembly (`metal_trash_can`, `metal_trash_can_rust`). */
  variantsOf(id) { return this.assembliesOf(id).map((a) => a.primary); }

  /** Assembly record for a variant (falls back to the first assembly; the 90° rule below never sees a lone lid). */
  nodeInfo(id, variant) {
    const assemblies = this.assembliesOf(id);
    if (!assemblies.length) return null;
    const hit = variant ? assemblies.find((a) => a.primary === variant) : null;
    const a = hit || assemblies[0];
    return { name: a.primary, parts: a.parts, translation: a.translation, bounds: a.bounds, size_m: a.size_m, triangles: a.triangles, lod: a.lod };
  }

  /** Real-world size [w, h, d] metres of a variant (union of the assembly's inspected bounds). */
  sizeOf(id, variant) { const node = this.nodeInfo(id, variant); return node?.size_m || null; }

  /** Height in metres a prop adds when something is stacked on it (0 when the model is absent). */
  heightOf(id, variant) { return this.sizeOf(id, variant)?.[1] || 0; }

  /**
   * Local AABB {min,max} of a variant after `yaw` (and `scale`), relative to the model origin — the box
   * place() positions. Authoring code uses it to butt a prop against a wall face or stack it exactly.
   */
  extent(id, yaw = 0, { variant, scale = 1 } = {}) {
    const node = this.nodeInfo(id, variant);
    if (!node) return null;
    const min = node.bounds.min.map((v) => v * scale);
    const max = node.bounds.max.map((v) => v * scale);
    const c = Math.cos(yaw); const s = Math.sin(yaw);
    // three.js Y rotation: x' = x·cos + z·sin ; z' = −x·sin + z·cos
    const xs = []; const zs = [];
    for (const x of [min[0], max[0]]) for (const z of [min[2], max[2]]) { xs.push(x * c + z * s); zs.push(-x * s + z * c); }
    return { min: [Math.min(...xs), min[1], Math.min(...zs)], max: [Math.max(...xs), max[1], Math.max(...zs)] };
  }

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
    const local = this.extent(id, yaw, { variant: chosen, scale });
    const lift = anchor === 'base' ? -local.min[1] : 0;
    const aabb = {
      min: [position[0] + local.min[0], position[1] + lift + local.min[1], position[2] + local.min[2]],
      max: [position[0] + local.max[0], position[1] + lift + local.max[1], position[2] + local.max[2]],
    };
    const size = [aabb.max[0] - aabb.min[0], aabb.max[1] - aabb.min[1], aabb.max[2] - aabb.min[2]];
    const centre = [aabb.min[0] + size[0] / 2, aabb.min[1] + size[1] / 2, aabb.min[2] + size[2] / 2];
    const record = { id, variant: chosen, parts: node.parts || [], position: [...position], yaw, scale, lift, aabb, size, solid: null, object: null };
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
      // GLTFLoader sanitises node names (spaces → '_', []. : / stripped) — match on the sanitised form too.
      const byName = (name) => gltf.scene.getObjectByName(name) || gltf.scene.getObjectByName(name.replace(/\s/g, '_').replace(/[\[\]./:]/g, ''));
      const source = byName(record.variant) || gltf.scene.children[0];
      if (!source) return;
      const instance = source.clone(true);
      instance.position.set(0, 0, 0); // Poly Haven parks variants side by side; every variant drops at the origin here
      const holder = new THREE.Group();
      holder.add(instance);
      // Parts (lid, handles, wheels, glass…) keep their offset relative to the primary root.
      const origin = source.position;
      for (const partName of record.parts || []) {
        const part = byName(partName);
        if (!part) continue;
        const clone = part.clone(true);
        clone.position.copy(part.position).sub(origin);
        holder.add(clone);
      }
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
