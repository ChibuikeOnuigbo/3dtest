import * as THREE from 'three';

export class InteractionSystem {
  constructor(camera, ui) { this.camera=camera; this.ui=ui; this.raycaster=new THREE.Raycaster(); this.items=new Map(); this.focus=null; }
  register(id, object, options) {
    object.traverse((node) => { if (node.isMesh) node.userData.interactionId=id; });
    this.items.set(id, { id, object, ...options });
  }
  update() {
    const targets=[...this.items.values()].map((item)=>item.object);
    this.raycaster.setFromCamera(new THREE.Vector2(0,0),this.camera);
    const hits=this.raycaster.intersectObjects(targets,true);
    this.focus=null;
    for (const hit of hits) {
      let node=hit.object; let id=node.userData.interactionId;
      while (!id && node.parent) { node=node.parent; id=node.userData.interactionId; }
      const item=this.items.get(id);
      if (item && hit.distance <= (item.range ?? 2.8)) { this.focus=item; break; }
    }
    if (this.focus) this.ui.setPrompt(this.focus.prompt(), true); else this.ui.setPrompt('', false);
  }
  activate() {
    if (!this.focus) return false;
    const result=this.focus.onInteract();
    this.update();
    return result !== false;
  }
  get(id) { return this.items.get(id); }
  activateForTest(id, player) {
    const item=this.items.get(id); if (!item) throw new Error(`Unknown interaction: ${id}`);
    const pose=item.testPose;
    if (!pose) throw new Error(`No test pose: ${id}`);
    player.teleport(pose.position, pose.lookAt);
    this.update();
    if (this.focus?.id !== id) throw new Error(`Interaction ${id} did not receive ray focus (focused ${this.focus?.id ?? 'nothing'})`);
    return this.activate();
  }
}
