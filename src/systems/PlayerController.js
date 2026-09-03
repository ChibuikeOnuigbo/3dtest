import * as THREE from 'three';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class PlayerController {
  constructor(camera, canvas, collision) {
    this.camera=camera; this.canvas=canvas; this.collision=collision;
    this.position=new THREE.Vector3(0, 0, 0); this.velocity=new THREE.Vector3(); this.radius=.28;
    this.eyeHeight=1.65; this.verticalVelocity=0; this.onFloor=true; this.enabled=false; this.keys={};
    this.yaw=new THREE.Object3D(); this.pitch=new THREE.Object3D(); this.yaw.add(this.pitch); this.pitch.add(camera); camera.position.set(0,this.eyeHeight,0);
    this.onKeyDown=(event)=>{ this.keys[event.code]=true; };
    this.onKeyUp=(event)=>{ this.keys[event.code]=false; };
    this.onMouseMove=(event)=>{ if (document.pointerLockElement!==this.canvas) return; this.yaw.rotation.y-=event.movementX*.0022; this.pitch.rotation.x=clamp(this.pitch.rotation.x-event.movementY*.0022,-1.42,1.42); };
    window.addEventListener('keydown',this.onKeyDown); window.addEventListener('keyup',this.onKeyUp); document.addEventListener('mousemove',this.onMouseMove);
  }
  addTo(scene) { scene.add(this.yaw); this.sync(); }
  requestLock() { this.canvas.requestPointerLock?.(); }
  reset(position = new THREE.Vector3(0,0,0), rotation=0) { this.position.copy(position); this.velocity.set(0,0,0); this.verticalVelocity=0; this.pitch.rotation.x=0; this.yaw.rotation.y=rotation; this.sync(); }
  sync() { this.yaw.position.set(this.position.x, this.position.y, this.position.z); this.camera.position.set(0,this.eyeHeight,0); }
  update(delta) {
    if (!this.enabled) return;
    const desired=new THREE.Vector3();
    if (this.keys.KeyW) desired.z-=1; if (this.keys.KeyS) desired.z+=1; if (this.keys.KeyA) desired.x-=1; if (this.keys.KeyD) desired.x+=1;
    if (desired.lengthSq()>0) desired.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw.rotation.y);
    const speed=this.keys.ShiftLeft ? 4.1 : 2.85;
    const blend=1-Math.exp(-15*delta);
    this.velocity.x+=((desired.x*speed)-this.velocity.x)*blend; this.velocity.z+=((desired.z*speed)-this.velocity.z)*blend;
    if (desired.lengthSq()===0) { const stop=1-Math.exp(-12*delta); this.velocity.x+=-this.velocity.x*stop; this.velocity.z+=-this.velocity.z*stop; }
    this.collision.moveCircle(this.position, new THREE.Vector3(this.velocity.x*delta,0,this.velocity.z*delta), this.radius);
    this.verticalVelocity-=16*delta; this.position.y+=this.verticalVelocity*delta;
    if (this.position.y<=this.collision.floorY) { this.position.y=this.collision.floorY; this.verticalVelocity=0; this.onFloor=true; }
    if (this.position.y < -5) this.reset();
    this.sync();
  }
  lookAt(point) {
    const origin=new THREE.Vector3(this.position.x,this.position.y+this.eyeHeight,this.position.z); const d=point.clone().sub(origin).normalize();
    this.yaw.rotation.y=Math.atan2(-d.x,-d.z); this.pitch.rotation.x=clamp(Math.asin(d.y),-1.42,1.42); this.sync();
  }
  teleport(position, lookTarget) { this.position.set(position[0],position[1]||0,position[2]); this.velocity.set(0,0,0); this.verticalVelocity=0; if (lookTarget) this.lookAt(new THREE.Vector3(...lookTarget)); else this.sync(); }
  dispose() { window.removeEventListener('keydown',this.onKeyDown); window.removeEventListener('keyup',this.onKeyUp); document.removeEventListener('mousemove',this.onMouseMove); }
}
