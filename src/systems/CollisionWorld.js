export class CollisionWorld {
  constructor() {
    this.solids = new Map();
  }

  add(id, minX, maxX, minZ, maxZ, active = true) {
    this.solids.set(id, { id, minX, maxX, minZ, maxZ, active });
  }

  setActive(id, active) {
    const solid = this.solids.get(id);
    if (solid) solid.active = active;
  }

  isFree(x, z, radius) {
    for (const solid of this.solids.values()) {
      if (!solid.active) continue;
      const nearestX = Math.max(solid.minX, Math.min(x, solid.maxX));
      const nearestZ = Math.max(solid.minZ, Math.min(z, solid.maxZ));
      const dx = x - nearestX;
      const dz = z - nearestZ;
      if (dx * dx + dz * dz < radius * radius) return false;
    }
    return true;
  }

  move(position, dx, dz, radius) {
    const result = { x: position.x, z: position.z, blockedX: false, blockedZ: false };
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
    const stepX = dx / steps;
    const stepZ = dz / steps;
    for (let index = 0; index < steps; index += 1) {
      if (this.isFree(result.x + stepX, result.z, radius)) result.x += stepX;
      else result.blockedX = true;
      if (this.isFree(result.x, result.z + stepZ, radius)) result.z += stepZ;
      else result.blockedZ = true;
    }
    return result;
  }
}
