import * as THREE from 'three';

export class CollisionWorld {
  constructor() { this.boxes = new Map(); this.floorY = 0; }
  addBox(id, center, size, enabled = true) {
    const [x, , z] = center; const [w, , d] = size;
    this.boxes.set(id, { id, minX:x-w/2, maxX:x+w/2, minZ:z-d/2, maxZ:z+d/2, enabled });
  }
  setEnabled(id, enabled) { const box=this.boxes.get(id); if (box) box.enabled = enabled; }
  getBox(id) { return this.boxes.get(id); }
  isCircleInBox(position, radius, id) {
    const box=this.boxes.get(id); if (!box) return false;
    const x=Math.max(box.minX,Math.min(position.x,box.maxX)); const z=Math.max(box.minZ,Math.min(position.z,box.maxZ));
    return (position.x-x)**2+(position.z-z)**2 < radius*radius;
  }
  resolve(position, radius) {
    for (let iteration=0; iteration<3; iteration++) {
      let moved=false;
      for (const box of this.boxes.values()) {
        if (!box.enabled) continue;
        const nearestX=Math.max(box.minX,Math.min(position.x,box.maxX));
        const nearestZ=Math.max(box.minZ,Math.min(position.z,box.maxZ));
        let dx=position.x-nearestX, dz=position.z-nearestZ;
        const distanceSq=dx*dx+dz*dz;
        if (distanceSq >= radius*radius) continue;
        if (distanceSq > 0.000001) {
          const distance=Math.sqrt(distanceSq); const push=(radius-distance)+0.0005;
          position.x += dx/distance*push; position.z += dz/distance*push;
        } else {
          const toLeft=Math.abs(position.x-box.minX), toRight=Math.abs(box.maxX-position.x);
          const toTop=Math.abs(position.z-box.minZ), toBottom=Math.abs(box.maxZ-position.z);
          const minimum=Math.min(toLeft,toRight,toTop,toBottom);
          if (minimum===toLeft) position.x=box.minX-radius-0.0005;
          else if (minimum===toRight) position.x=box.maxX+radius+0.0005;
          else if (minimum===toTop) position.z=box.minZ-radius-0.0005;
          else position.z=box.maxZ+radius+0.0005;
        }
        moved=true;
      }
      if (!moved) break;
    }
  }
  moveCircle(position, delta, radius) {
    // Small authored-world sweeps prevent a low-FPS frame from jumping a player through a thin door or wall.
    const steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/Math.max(radius*.45,.05)));
    const stepX=delta.x/steps, stepZ=delta.z/steps;
    for(let index=0;index<steps;index++) { position.x += stepX; this.resolve(position, radius); position.z += stepZ; this.resolve(position, radius); }
  }
  debugBoxes() { return [...this.boxes.values()].map((box) => ({...box})); }
}
