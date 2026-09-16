import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * World-space UV mapping: one texture tile always covers `tile` metres, so a 20 m
 * wall and a 1 m post share the same texel density instead of one stretched texture
 * per face. This is the single biggest fix for the "one stretched texture on a giant
 * box" prototype look.
 */
export function worldUvBox(width, height, depth, tile = 2) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const uv = geometry.attributes.uv;
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  for (let index = 0; index < uv.count; index += 1) {
    const nx = Math.abs(normal.getX(index));
    const ny = Math.abs(normal.getY(index));
    const px = position.getX(index);
    const py = position.getY(index);
    const pz = position.getZ(index);
    if (nx > 0.5) uv.setXY(index, pz / tile, py / tile);
    else if (ny > 0.5) uv.setXY(index, px / tile, pz / tile);
    else uv.setXY(index, px / tile, py / tile);
  }
  uv.needsUpdate = true;
  return geometry;
}

export function worldUvCylinder(radius, height, tile = 2, segments = 18, openEnded = false) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, segments, 1, openEnded);
  const uv = geometry.attributes.uv;
  const circumference = 2 * Math.PI * radius;
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(index, uv.getX(index) * circumference / tile, uv.getY(index) * height / tile);
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * Static geometry batcher. Thousands of small architectural pieces become one mesh
 * per material, which keeps draw calls low on real hardware while allowing dense
 * set dressing. Colliders are recorded separately by the world builder.
 */
export class StaticBatcher {
  constructor(scene) {
    this.scene = scene;
    this.buckets = new Map();
    this.meshes = [];
  }

  add(geometry, material, matrix, { castShadow = true, receiveShadow = true } = {}) {
    const key = `${material.uuid}|${castShadow ? 1 : 0}${receiveShadow ? 1 : 0}`;
    if (!this.buckets.has(key)) this.buckets.set(key, { material, castShadow, receiveShadow, geometries: [] });
    const clone = geometry.clone();
    clone.applyMatrix4(matrix);
    this.buckets.get(key).geometries.push(clone);
    geometry.dispose();
  }

  flush() {
    for (const { material, castShadow, receiveShadow, geometries } of this.buckets.values()) {
      if (!geometries.length) continue;
      const merged = mergeGeometries(geometries, false);
      geometries.forEach((geometry) => geometry.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.userData.staticBatch = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
    this.buckets.clear();
    return this.meshes;
  }
}

export const tmpMatrix = new THREE.Matrix4();
export const tmpQuaternion = new THREE.Quaternion();
export const tmpEuler = new THREE.Euler();
export const tmpScale = new THREE.Vector3(1, 1, 1);

export function composeMatrix(position, rotation = [0, 0, 0]) {
  tmpEuler.set(rotation[0], rotation[1], rotation[2]);
  tmpQuaternion.setFromEuler(tmpEuler);
  return new THREE.Matrix4().compose(new THREE.Vector3(...position), tmpQuaternion, tmpScale);
}
