/**
 * glTF 2.0 JSON inspection without loading geometry (Node + browser safe, no three.js).
 *
 * Used by tools/assets/fetch_polyhaven_models.mjs to write a per-asset record and by the runtime
 * manifest so src/world/PropLibrary.js can size colliders / pick variants without a mesh pass:
 *   - root nodes (Poly Haven ships variants such as `…_graffiti` / `…_rusted` side by side, offset in X)
 *   - per-root bounds in the root's OWN frame (translation stripped, rotation/scale applied)
 *   - triangle counts, material names, mesh names, LOD index parsed from names
 *   - ASSEMBLIES: roots grouped into "one placeable object" (crate + lid, trash can + handles + lid,
 *     car + wheels) with union bounds — see ./prop_assemblies.mjs. Treating every root as a variant
 *     was wrong: the trash can's first root is a 9 cm handle and crates lost their lids.
 */
import { assembleNodes } from './prop_assemblies.mjs';

function rotateByQuaternion([x, y, z], [qx, qy, qz, qw] = [0, 0, 0, 1]) {
  // v' = v + 2w (q × v) + 2 q × (q × v)
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  return [x + qw * tx + (qy * tz - qz * ty), y + qw * ty + (qz * tx - qx * tz), z + qw * tz + (qx * ty - qy * tx)];
}

function trs(translation = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1]) {
  return (p) => { const r = rotateByQuaternion([p[0] * scale[0], p[1] * scale[1], p[2] * scale[2]], rotation); return [r[0] + translation[0], r[1] + translation[1], r[2] + translation[2]]; };
}

function emptyBounds() { return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; }

function unionPoint(target, p) { for (let i = 0; i < 3; i += 1) { target.min[i] = Math.min(target.min[i], p[i]); target.max[i] = Math.max(target.max[i], p[i]); } }

function boundsThrough(transform, min, max, target) {
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) unionPoint(target, transform([x, y, z]));
}

function accumulateNode(gltf, index, transform, acc) {
  const node = gltf.nodes[index];
  if (node.mesh !== undefined) {
    const mesh = gltf.meshes[node.mesh];
    for (const prim of mesh.primitives || []) {
      const pos = gltf.accessors[prim.attributes?.POSITION];
      if (pos?.min && pos?.max) boundsThrough(transform, pos.min, pos.max, acc.bounds);
      const idx = prim.indices !== undefined ? gltf.accessors[prim.indices].count : (pos?.count || 0);
      acc.triangles += Math.floor(idx / 3);
      if (prim.material !== undefined) acc.materials.add(gltf.materials?.[prim.material]?.name || `material-${prim.material}`);
    }
    acc.meshNames.add(mesh.name || `mesh-${node.mesh}`);
  }
  for (const child of node.children || []) {
    const childNode = gltf.nodes[child];
    const local = trs(childNode.translation, childNode.rotation, childNode.scale);
    accumulateNode(gltf, child, (p) => transform(local(p)), acc);
  }
}

export function inspectGltf(gltf, { id = '' } = {}) {
  const scene = gltf.scenes?.[gltf.scene || 0] || { nodes: [] };
  const nodes = [];
  for (const rootIndex of scene.nodes || []) {
    const node = gltf.nodes[rootIndex];
    const acc = { bounds: emptyBounds(), triangles: 0, materials: new Set(), meshNames: new Set() };
    accumulateNode(gltf, rootIndex, trs([0, 0, 0], node.rotation, node.scale), acc);
    const finite = Number.isFinite(acc.bounds.min[0]);
    const lod = /LOD_?(\d+)/i.exec(`${[...acc.meshNames].join(' ')} ${node.name || ''}`);
    nodes.push({
      name: node.name || `node-${rootIndex}`, index: rootIndex, translation: node.translation || [0, 0, 0],
      bounds: finite ? { min: acc.bounds.min.map((v) => Number(v.toFixed(4))), max: acc.bounds.max.map((v) => Number(v.toFixed(4))) } : null,
      size_m: finite ? acc.bounds.max.map((v, i) => Number((v - acc.bounds.min[i]).toFixed(3))) : null,
      triangles: acc.triangles, materials: [...acc.materials], meshes: [...acc.meshNames], lod: lod ? Number(lod[1]) : null,
    });
  }
  return {
    generator: gltf.asset?.generator, extensions_used: gltf.extensionsUsed || [],
    nodes, assemblies: assembleNodes(nodes, id), triangles_total: nodes.reduce((s, n) => s + n.triangles, 0),
    materials: (gltf.materials || []).map((m) => ({
      name: m.name, doubleSided: Boolean(m.doubleSided), alphaMode: m.alphaMode || 'OPAQUE',
      hasNormal: Boolean(m.normalTexture), hasBaseColor: Boolean(m.pbrMetallicRoughness?.baseColorTexture), hasMetalRough: Boolean(m.pbrMetallicRoughness?.metallicRoughnessTexture),
    })),
    images: (gltf.images || []).map((i) => i.uri),
    buffers: (gltf.buffers || []).map((b) => b.uri),
  };
}

/**
 * Which placeable variants a file offers — the primary root of each assembly (LOD0 or un-LODed).
 * Parts (lids, handles, wheels, glass) are never variants; they travel with their primary.
 */
export function displayVariants(inspection) {
  const assemblies = inspection.assemblies || assembleNodes(inspection.nodes, inspection.id || '');
  return assemblies.map((a) => a.primary);
}
