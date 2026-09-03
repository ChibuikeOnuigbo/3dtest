import * as THREE from 'three';
import { createMaterialLibrary } from './Materials.js';

const lerp=(a,b,t)=>a+(b-a)*t;

function canvasTexture(lines, { width=768, height=256, bg='#07131b', color='#b9e8ef', accent='#e48a39', size=46 }={}) {
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height; const ctx=canvas.getContext('2d');
  ctx.fillStyle=bg; ctx.fillRect(0,0,width,height); ctx.strokeStyle='#314852'; ctx.lineWidth=4; ctx.strokeRect(12,12,width-24,height-24);
  ctx.fillStyle=accent; ctx.fillRect(34,35,10,height-70); ctx.fillStyle=color; ctx.font=`600 ${size}px "IBM Plex Mono", monospace`; ctx.textBaseline='middle';
  lines.forEach((line,index)=>ctx.fillText(line,64,72+index*(size+18)));
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; texture.anisotropy=4;
  return { texture, update(next) { return canvasTexture(next,{width,height,bg,color,accent,size}); } };
}

class RelayDoor {
  constructor(world) {
    this.world=world; this.locked=true; this.open=false; this.target=0; this.progress=0; this.notifiedOpen=false;
    this.pivot=new THREE.Group(); this.pivot.name='gallery-security-door'; this.pivot.position.set(21.05,0,3.28);
    this.leaf=world.box('gallery-security-door-leaf',[1.05,1.48,0],[2.1,2.96,.16],world.mats.metal,{parent:this.pivot,castShadow:true});
    const glass=world.box('door-view-slot',[1.06,1.8,-.091],[.55,.52,.012],world.mats.cyan,{parent:this.pivot}); glass.material=world.mats.cyan;
    world.scene.add(this.pivot); world.collision.addBox('gallery-door',[22.1,1.5,3.28],[2.12,3,.28],true);
  }
  toggle(player) {
    if (this.locked) return 'LOCKED — RESTORE SHORE POWER';
    if (this.open) {
      if (this.world.collision.isCircleInBox(player.position,player.radius,'gallery-door')) return 'DOORWAY OBSTRUCTED';
      this.open=false; this.target=0; this.notifiedOpen=false; this.world.audio.cue('door'); return 'CLOSING SECURITY DOOR';
    }
    this.open=true; this.target=1; this.world.audio.cue('door'); return 'OPENING TRANSMITTER GALLERY';
  }
  update(delta) {
    this.progress=lerp(this.progress,this.target,Math.min(1,delta*7));
    if (Math.abs(this.target-this.progress)<.002) this.progress=this.target;
    this.pivot.rotation.y=-this.progress*Math.PI*.51;
    this.world.collision.setEnabled('gallery-door',this.progress<.58);
    if (this.progress===1 && !this.notifiedOpen) { this.notifiedOpen=true; this.world.onDoorOpened(); }
  }
  reset() { this.locked=true; this.open=false; this.target=0; this.progress=0; this.notifiedOpen=false; this.pivot.rotation.y=0; this.world.collision.setEnabled('gallery-door',true); }
}

export class World {
  constructor({scene,collision,interactions,state,ui,audio}) { this.scene=scene; this.collision=collision; this.interactions=interactions; this.state=state; this.ui=ui; this.audio=audio; this.mats=null; this.powerLights=[]; this.faultLights=[]; this.statusScreens=[]; this.dials=[]; this.fuse=null; this.socketFuse=null; this.caseLid=null; }
  async build() {
    this.mats=await createMaterialLibrary();
    this.scene.fog=new THREE.FogExp2(0x07111a,.025); this.scene.background=new THREE.Color(0x07111a);
    this.addLighting(); this.buildStructure(); this.buildAirlock(); this.buildOffice(); this.buildService(); this.buildPower(); this.buildGallery(); this.buildExteriorHint(); this.door=new RelayDoor(this); this.resetVisuals();
    this.state.on(({event})=>{ if(event==='reset') this.resetVisuals(); });
  }
  addLighting() {
    this.scene.add(new THREE.HemisphereLight(0x63869c,0x070a0c,.52));
    const moon=new THREE.DirectionalLight(0x7ba6cc,.48); moon.position.set(-8,12,-6); moon.castShadow=true; moon.shadow.mapSize.set(1024,1024); moon.shadow.camera.left=-18; moon.shadow.camera.right=18; moon.shadow.camera.top=18; moon.shadow.camera.bottom=-18; this.scene.add(moon);
    const makeLight=(color,intensity,position,distance=7)=>{ const light=new THREE.PointLight(color,intensity,distance,2); light.position.set(...position); this.scene.add(light); return light; };
    this.faultLights.push(makeLight(0xff192d,1.4,[1.4,2.3,-.9],5),makeLight(0xff241c,1.5,[22,2.5,.8],7));
    this.powerLights.push(makeLight(0xff9b43,.08,[7,2.35,-1.2],6),makeLight(0xff9b43,.06,[14.4,2.2,.1],5),makeLight(0xffa24a,.04,[22,2.4,-.8],6),makeLight(0x35cfe4,.02,[25,3.1,8.6],9));
  }
  box(name, position, size, material, {collision=false,parent=this.scene,castShadow=true,receiveShadow=true}={}) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material); mesh.name=name; mesh.position.set(...position); mesh.castShadow=castShadow; mesh.receiveShadow=receiveShadow; parent.add(mesh);
    if (collision) this.collision.addBox(name,position,size); return mesh;
  }
  planeLabel(text, position, size, rotation=[0,0,0], options={}) {
    const {texture}=canvasTexture(String(text).split('\n'),{width:options.width??768,height:options.height??256,bg:options.bg??'#0c151b',color:options.color??'#d8e6e5',accent:options.accent??'#d38237',size:options.fontSize??42});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide})); mesh.position.set(...position); mesh.rotation.set(...rotation); this.scene.add(mesh); return mesh;
  }
  screen(name, position, size, lines, rotation=[0,0,0]) {
    const tex=canvasTexture(lines,{width:720,height:260,bg:'#071218',color:'#b6edf2',accent:'#ee7741',size:32});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({map:tex.texture,side:THREE.DoubleSide})); mesh.name=name; mesh.position.set(...position); mesh.rotation.set(...rotation); this.scene.add(mesh);
    const record={mesh,tex,position,size,rotation,lines}; this.statusScreens.push(record); return record;
  }
  setScreen(record, lines, palette={}) {
    const tex=canvasTexture(lines,{width:720,height:260,bg:palette.bg??'#071218',color:palette.color??'#b6edf2',accent:palette.accent??'#ee7741',size:32}); record.mesh.material.map.dispose(); record.mesh.material.map=tex.texture; record.mesh.material.needsUpdate=true; record.lines=lines;
  }
  floorRoom(name,x,z,w,d,h=3.2) {
    this.box(`${name}-floor`,[x,-.12,z],[w,.24,d],this.mats.concrete,{receiveShadow:true});
    this.box(`${name}-ceiling`,[x,h,z],[w,.18,d],this.mats.dark,{castShadow:false});
  }
  wallX(name,x,z,length,h=3.2) { return this.box(name,[x,h/2,z],[length,h,.18],this.mats.concrete,{collision:true}); }
  wallZ(name,x,z,length,h=3.2) { return this.box(name,[x,h/2,z],[.18,h,length],this.mats.concrete,{collision:true}); }
  doorFrame(x,z,rotation=0) {
    const parent=new THREE.Group(); parent.position.set(x,0,z); parent.rotation.y=rotation; this.scene.add(parent);
    this.box('door-frame-left',[-1.02,1.3,0],[.16,2.6,.34],this.mats.trim,{parent}); this.box('door-frame-right',[1.02,1.3,0],[.16,2.6,.34],this.mats.trim,{parent}); this.box('door-frame-top',[0,2.54,0],[2.18,.18,.34],this.mats.trim,{parent});
  }
  buildStructure() {
    this.floorRoom('airlock',0,0,6,5,3.4); this.floorRoom('office',7,0,7,6,3.2); this.floorRoom('service',14.5,0,8,3,3); this.floorRoom('power',22,0,7,6,3.5); this.floorRoom('gallery',25,8,10,8,4.2);
    // Airlock: east doorway at z=0.
    this.wallZ('airlock-west',-3,0,5,3.4); this.wallX('airlock-north',0,2.5,6,3.4); this.wallX('airlock-south',0,-2.5,6,3.4); this.wallZ('airlock-east-n',3,1.68,1.64,3.4); this.wallZ('airlock-east-s',3,-1.68,1.64,3.4);
    // Duty office: west/east doorway gaps.
    this.wallX('office-north',7,3,7,3.2); this.wallX('office-south',7,-3,7,3.2); this.wallZ('office-west-n',3.5,1.78,2.44,3.2); this.wallZ('office-west-s',3.5,-1.78,2.44,3.2); this.wallZ('office-east-n',10.5,1.78,2.44,3.2); this.wallZ('office-east-s',10.5,-1.78,2.44,3.2);
    // Narrow service passage has full top/bottom service walls and doorway gaps.
    this.wallX('service-north',14.5,1.5,8,3); this.wallX('service-south',14.5,-1.5,8,3); this.wallZ('service-west-n',10.5,.92,1.16,3); this.wallZ('service-west-s',10.5,-.92,1.16,3); this.wallZ('service-east-n',18.5,.92,1.16,3); this.wallZ('service-east-s',18.5,-.92,1.16,3);
    // Power room opens north into short security threshold.
    this.wallX('power-south',22,-3,7,3.5); this.wallZ('power-west-n',18.5,1.78,2.44,3.5); this.wallZ('power-west-s',18.5,-1.78,2.44,3.5); this.wallX('power-north-left',19.75,3,2.5,3.5); this.wallX('power-north-right',24.25,3,2.5,3.5); this.wallZ('power-east',25.5,0,6,3.5);
    // Gallery bottom leaves a matching security gap at x 21–23.
    this.wallX('gallery-south-left',20.5,4,1,4.2); this.wallX('gallery-south-right',26.5,4,7,4.2); this.wallX('gallery-north',25,12,10,4.2); this.wallZ('gallery-west',20,8,8,4.2); this.wallZ('gallery-east',30,8,8,4.2);
    this.doorFrame(3.25,0,Math.PI/2); this.doorFrame(10.75,0,Math.PI/2); this.doorFrame(18.75,0,Math.PI/2); this.doorFrame(22,3.25,0);
    this.planeLabel('RAVENSCAR\nCOASTAL RELAY',[0,2.5,-2.38],[2.2,.7],[0,0,0],{fontSize:26,bg:'#0b171d',accent:'#e18c3b'});
  }
  fixture(position, color='amber') {
    const lamp=this.box('ceiling-fixture',position,[.65,.1,.24],this.mats.trim,{castShadow:false}); const lens=this.box('fixture-lens',[position[0],position[1]-.07,position[2]],[.48,.04,.12],color==='red'?this.mats.red:color==='cyan'?this.mats.cyan:this.mats.amber,{castShadow:false}); return {lamp,lens};
  }
  createConsole({name,position,screenLines,screenOffset=[0,1.5,-.41],width=1.9,height=1.5}) {
    const group=new THREE.Group(); group.name=name; group.position.set(...position); this.scene.add(group);
    this.box(`${name}-base`,[0,.65,0],[width,1.3,.62],this.mats.metal,{parent:group,collision:true}); this.box(`${name}-top`,[0,1.35,-.12],[width,.22,.85],this.mats.trim,{parent:group});
    const rec=this.screen(`${name}-screen`,[position[0]+screenOffset[0],position[1]+screenOffset[1],position[2]+screenOffset[2]],[width*.72,.56],screenLines,[0,0,0]);
    return {group,screen:rec};
  }
  buildAirlock() {
    this.fixture([0,3.16,0],'red');
    const console=this.createConsole({name:'fault-console',position:[1.55,0,-.75],screenLines:['SYSTEM FAULT','RELAY POWER LOST'],width:1.7}); this.faultConsole=console.screen;
    this.interactions.register('fault-console',console.group,{range:2.7,prompt:()=>this.state.flags.introSeen?'Review relay status':'Inspect fault console',onInteract:()=>{ if(this.state.inspectFault()){ this.audio.cue('inspect'); this.ui.notify('FAULT PATH: DUTY OFFICE LOG'); this.setScreen(this.faultConsole,['SYSTEM FAULT','CHECK DUTY LOG'],{accent:'#ff3d45'}); } return true; },testPose:{position:[-.1,0,.0],lookAt:[1.55,.86,-.75]}});
    this.box('airlock-mat',[0.1,.03,.15],[1.8,.05,1.1],this.mats.rubber,{castShadow:false}); this.planeLabel('AIRLOCK 01',[0,2.85,2.38],[1.5,.32],[0,Math.PI,0],{fontSize:22,bg:'#11222a'});
  }
  buildOffice() {
    this.fixture([7,3.0,-1.1]); this.box('office-desk',[7,.72,-1.1],[2.55,.16,1.2],this.mats.wood,{collision:true}); this.box('office-desk-leg-a',[5.95,.36,-1.1],[.12,.7,.12],this.mats.trim,{collision:false}); this.box('office-desk-leg-b',[8.05,.36,-1.1],[.12,.7,.12],this.mats.trim,{collision:false});
    this.box('desk-chair',[7,.45,.55],[.72,.75,.62],this.mats.trim,{collision:true}); this.box('desk-back',[7,1.05,.78],[.72,.7,.1],this.mats.trim,{});
    const workOrder=new THREE.Group(); workOrder.name='work-order'; workOrder.position.set(7,.87,-1.15); this.scene.add(workOrder); this.box('work-order-paper',[0,0,0],[.72,.02,.48],this.mats.paper,{parent:workOrder,castShadow:false});
    this.planeLabel('SHIFT LOG\nTHERMAL FUSE REMOVED\nRESET: 3 / 1 / 4',[7,1.35,-1.45],[1.48,.62],[Math.PI/2,0,0],{fontSize:18,bg:'#c5c3b4',color:'#17252a',accent:'#c0522d'});
    this.interactions.register('work-order',workOrder,{range:2.55,prompt:()=>this.state.flags.noteRead?'Review duty log':'Read duty log',onInteract:()=>{ if(!this.state.flags.introSeen){this.ui.notify('CHECK THE AIRLOCK CONSOLE FIRST'); return false;} if(this.state.readNote()){this.audio.cue('paper');this.ui.notify('LOG: REPLACE THERMAL FUSE, THEN RESET BREAKER');} return true;},testPose:{position:[7,0,.85],lookAt:[7,.88,-1.15]}});
    this.box('office-locker',[9.15,1.15,1.85],[.75,2.3,.55],this.mats.metal,{collision:true}); this.planeLabel('DUTY OFFICE',[7,2.86,2.88],[1.5,.3],[0,Math.PI,0],{fontSize:20,bg:'#11222a'});
  }
  buildService() {
    this.fixture([14.4,2.82,.4]);
    for (const x of [11.4,13.4,15.4,17.4]) { this.box('service-conduit',[x,2.28,1.12],[1.55,.13,.13],this.mats.metal,{castShadow:false}); this.box('conduit-clamp',[x,2.12,1.12],[.08,.35,.25],this.mats.trim,{castShadow:false}); }
    const caseGroup=new THREE.Group(); caseGroup.name='fuse-case'; caseGroup.position.set(14.8,.75,-.65); this.scene.add(caseGroup); this.box('fuse-case-body',[0,0,0],[1.25,.78,.3],this.mats.red,{parent:caseGroup,collision:true}); this.caseLid=this.box('fuse-case-lid',[0,.46,-.08],[1.25,.1,.36],this.mats.red,{parent:caseGroup});
    this.fuse=this.box('thermal-fuse',[0,.12,-.24],[.4,.16,.1],this.mats.amber,{parent:caseGroup,castShadow:false}); this.planeLabel('THERMAL\nFUSE',[14.8,.78,-.82],[.6,.3],[0,0,0],{fontSize:16,bg:'#461014',color:'#ffe4c0',accent:'#ff5a39'});
    this.interactions.register('thermal-fuse',caseGroup,{range:2.45,prompt:()=>this.state.flags.fuseCollected?'Fuse case empty':this.state.flags.noteRead?'Collect marked thermal fuse':'Fuse case — read duty log',onInteract:()=>{ if(!this.state.flags.noteRead){this.ui.notify('THE DUTY LOG IDENTIFIES THE REQUIRED PART');return false;} if(this.state.collectFuse()){this.fuse.visible=false;this.caseLid.rotation.x=-.9;this.audio.cue('pickup');this.ui.notify('THERMAL FUSE SECURED');} return true;},testPose:{position:[13.15,0,.55],lookAt:[14.8,.85,-.65]}});
    this.planeLabel('SERVICE PASSAGE',[14.5,2.72,1.39],[1.75,.26],[0,Math.PI,0],{fontSize:16,bg:'#11222a'});
  }
  buildPower() {
    this.fixture([22,3.27,.7],'red');
    const socket=new THREE.Group(); socket.name='fuse-socket'; socket.position.set(20.2,1.25,-1.65); this.scene.add(socket); this.box('socket-cabinet',[0,0,0],[1.3,2.5,.52],this.mats.metal,{parent:socket,collision:true}); this.box('socket-slot',[0,.16,-.3],[.54,.32,.04],this.mats.dark,{parent:socket}); this.socketFuse=this.box('installed-fuse',[0,.16,-.34],[.4,.15,.08],this.mats.amber,{parent:socket,castShadow:false});
    this.interactions.register('fuse-socket',socket,{range:2.55,prompt:()=>this.state.flags.fuseInstalled?'Thermal fuse seated':this.state.flags.fuseCollected?'Install thermal fuse':'Fuse socket — part missing',onInteract:()=>{if(!this.state.flags.fuseCollected){this.ui.notify('SOCKET EMPTY — THE CASE IS IN THE SERVICE PASSAGE');return false;}if(this.state.installFuse()){this.socketFuse.visible=true;this.audio.cue('install');this.ui.notify('FUSE SEATED — BREAKER IS READY');}return true;},testPose:{position:[20.2,0,.3],lookAt:[20.2,1.4,-1.65]}});
    const breaker=new THREE.Group(); breaker.name='shore-breaker'; breaker.position.set(23,.95,-1.55); this.scene.add(breaker); this.box('breaker-cabinet',[0,0,0],[1.5,1.9,.5],this.mats.metal,{parent:breaker,collision:true}); this.breakerLever=this.box('breaker-lever',[0,.1,-.34],[.13,.78,.12],this.mats.red,{parent:breaker}); this.breakerLever.geometry.translate(0,.38,0); this.interactions.register('shore-breaker',breaker,{range:2.5,prompt:()=>this.state.flags.powerOn?'Shore breaker online':this.state.flags.fuseInstalled?'Reset shore breaker':'Breaker interlock active',onInteract:()=>{if(!this.state.flags.fuseInstalled){this.ui.notify('INTERLOCK ACTIVE — INSTALL THERMAL FUSE');return false;}if(this.state.resetBreaker()){this.breakerLever.rotation.z=-.78;this.door.locked=false;this.audio.cue('breaker');this.audio.setPower(true);this.ui.notify('GRID RESTORED — GALLERY SECURITY LOCK RELEASED');}return true;},testPose:{position:[23,0,.35],lookAt:[23,1.1,-1.55]}});
    this.faultPanel=this.screen('power-panel-screen',[22,2.45,.38],[1.7,.58],['FAULT // 07','THERMAL OPEN'],[0,Math.PI,0]); this.box('power-transformer',[24.25,.85,.75],[1.25,1.7,1.1],this.mats.trim,{collision:true}); this.planeLabel('SHORE BREAKER',[22,3.06,2.88],[1.8,.3],[0,Math.PI,0],{fontSize:20,bg:'#11222a'});
  }
  buildGallery() {
    this.fixture([25,3.92,7.5],'cyan'); this.fixture([28,3.92,9.6],'cyan');
    const console=this.createConsole({name:'transmitter-console',position:[25,0,9.25],screenLines:['WX-7 // OFFLINE','CHANNEL: 0 · 0 · 0'],width:3.9}); this.transmitterScreen=console.screen; this.box('transmitter-plinth',[25,.14,9.25],[4.4,.28,1.3],this.mats.trim,{collision:true});
    const dialX=[24.1,25,25.9]; const dialLabels=['A','B','C'];
    dialX.forEach((x,index)=>{ const dial=new THREE.Group();dial.name=`dial-${index}`;dial.position.set(x,1.36,8.82);this.scene.add(dial); const ring=new THREE.Mesh(new THREE.TorusGeometry(.29,.07,12,28),this.mats.trim);dial.add(ring);const needle=this.box('dial-needle',[0,.02,-.045],[.05,.32,.04],this.mats.amber,{parent:dial,castShadow:false}); needle.geometry.translate(0,.13,0); this.planeLabel(dialLabels[index],[x,1.82,8.76],[.25,.18],[0,0,0],{fontSize:16,bg:'#0c171c',accent:'#e68535'}); this.dials[index]={group:dial,needle}; this.interactions.register(`dial-${index}`,dial,{range:2.7,prompt:()=>this.state.flags.frequencySet?'Channel locked':this.state.flags.powerOn&&this.state.flags.galleryOpened?`Turn channel dial ${dialLabels[index]} (${this.state.dials[index]})`:'Transmitter offline',onInteract:()=>{if(!this.state.flags.powerOn||!this.state.flags.galleryOpened){this.ui.notify('RESTORE POWER AND OPEN THE GALLERY');return false;}if(this.state.flags.frequencySet){this.ui.notify('STORM-WARNING CHANNEL LOCKED');return false;} this.state.turnDial(index);this.audio.cue('dial');return true;},testPose:{position:[x,0,6.75],lookAt:[x,1.38,8.82]}}); });
    const button=new THREE.Group();button.name='transmit-button';button.position.set(27.25,1.35,8.8);this.scene.add(button); this.transmitButton=this.box('transmit-button-cap',[0,0,0],[.58,.14,.38],this.mats.red,{parent:button}); this.planeLabel('TRANSMIT',[27.25,1.78,8.76],[.86,.2],[0,0,0],{fontSize:13,bg:'#3c1015',color:'#ffe3dc',accent:'#fd5b48'});
    this.interactions.register('transmit-button',button,{range:2.75,prompt:()=>this.state.flags.transmitted?'Warning broadcast sent':this.state.flags.frequencySet?'Transmit storm warning':'Transmit disabled — set 3 · 1 · 4',onInteract:()=>{if(!this.state.flags.frequencySet){this.ui.notify('CHANNEL REQUIRES 3 · 1 · 4');return false;}if(this.state.transmit()){this.transmitButton.position.y=-.08;this.audio.cue('transmit');this.ui.notify('TRANSMISSION SENT — AWAITING COASTAL ACKNOWLEDGEMENT',3800);window.setTimeout(()=>this.ui.showEnd(),1500);}return true;},testPose:{position:[27.25,0,6.7],lookAt:[27.25,1.35,8.8]}});
    // Purposeful receive racks—not decorative scatter.
    for(const x of [21.4,28.65]) { this.box('receiver-rack',[x,1.2,10.5],[.75,2.4,1.05],this.mats.trim,{collision:true}); for(let y=0;y<3;y++)this.box('receiver-slot',[x,y*.48+.58,9.94],[.48,.2,.04],this.mats.cyan,{castShadow:false}); }
    this.planeLabel('TRANSMITTER GALLERY',[25,3.72,11.88],[2.2,.32],[0,Math.PI,0],{fontSize:20,bg:'#11222a',accent:'#35cfe4'});
  }
  buildExteriorHint() {
    // A framed blue storm window and simple antenna give the interior a clear geographic anchor without an open-world asset burden.
    const windowPane=this.box('storm-window',[29.88,2.65,8],[.03,2.2,3.4],new THREE.MeshStandardMaterial({color:0x173343,metalness:.1,roughness:.25,transparent:true,opacity:.72,emissive:0x092c42,emissiveIntensity:.6}),{castShadow:false});
    this.box('window-mullion-a',[29.82,2.65,7.15],[.1,2.4,.1],this.mats.trim,{castShadow:false}); this.box('window-mullion-b',[29.82,2.65,8.85],[.1,2.4,.1],this.mats.trim,{castShadow:false}); this.box('window-sill',[29.75,1.55,8],[.25,.13,3.7],this.mats.trim,{castShadow:false});
    const antenna=new THREE.Group(); antenna.position.set(31,0,8); this.scene.add(antenna); this.box('antenna-mast',[0,4.3,0],[.18,8.6,.18],this.mats.trim,{parent:antenna,castShadow:false}); this.box('antenna-crossbar',[0,6.2,0],[2.5,.1,.1],this.mats.trim,{parent:antenna,castShadow:false}); this.beacon=this.box('antenna-beacon',[0,7.65,0],[.35,.35,.35],this.mats.amber,{parent:antenna,castShadow:false});
    const rainMaterial=new THREE.LineBasicMaterial({color:0x74b7d0,transparent:true,opacity:.2}); const rainPoints=[]; for(let i=0;i<26;i++){const x=30.4+(i%5)*.38;const y=1.8+(i%7)*.68;const z=6.4+Math.floor(i/5)*.65;rainPoints.push(new THREE.Vector3(x,y,z),new THREE.Vector3(x-.12,y-.72,z+.04));} const rainGeo=new THREE.BufferGeometry().setFromPoints(rainPoints); this.rain=new THREE.LineSegments(rainGeo,rainMaterial);this.scene.add(this.rain);
  }
  onDoorOpened() { if(this.state.openGallery()){this.ui.notify('TRANSMITTER ONLINE — TUNE 3 · 1 · 4');} }
  updateFrequencyVisuals() {
    const signature=`${this.state.flags.powerOn}:${this.state.flags.frequencySet}:${this.state.flags.transmitted}:${this.state.dials.join(',')}`;
    if (signature===this.lastFrequencySignature) return;
    this.lastFrequencySignature=signature;
    this.dials.forEach((dial,index)=>{dial.group.rotation.z=-this.state.dials[index]*(Math.PI*2/10);});
    const ready=this.state.flags.frequencySet;
    this.setScreen(this.transmitterScreen,[ready?'WX-7 // READY':'WX-7 // ACTIVE',`CHANNEL: ${this.state.dials.join(' · ')}`],{accent:ready?'#35e0e9':'#e68238',color:ready?'#d8fbfd':'#b7edf2'}); this.ui.setSignal(ready,this.state.flags.transmitted);
  }
  resetVisuals() {
    if(!this.mats) return; this.lastFrequencySignature=null; this.fuse.visible=true; this.socketFuse.visible=false; this.caseLid.rotation.x=0; this.breakerLever.rotation.z=0; this.door?.reset();
    this.powerLights.forEach((light,index)=>light.intensity=[.08,.06,.04,.02][index]); this.faultLights.forEach(light=>light.intensity=1.35); this.mats.amber.emissiveIntensity=1.3; this.mats.red.emissiveIntensity=1.5; this.mats.cyan.emissiveIntensity=1.2; this.beacon.material=this.mats.amber; this.setScreen(this.faultConsole,['SYSTEM FAULT','RELAY POWER LOST'],{accent:'#ff3d45'}); this.setScreen(this.faultPanel,['FAULT // 07','THERMAL OPEN'],{accent:'#ff3d45'}); this.setScreen(this.transmitterScreen,['WX-7 // OFFLINE','CHANNEL: 0 · 0 · 0'],{accent:'#e68238'}); this.ui.setPower(false);this.ui.setSignal(false);this.audio.setPower(false);
  }
  update(delta,elapsed) {
    this.door?.update(delta);
    const power=this.state.flags.powerOn; const ready=this.state.flags.frequencySet; const done=this.state.flags.transmitted;
    const pulse=.74+Math.sin(elapsed*5)*.26; this.faultLights.forEach(light=>light.intensity=power?0:pulse*1.35); this.powerLights.forEach((light,index)=>{const targets=[.55,.38,.52,ready?1.25:.32];light.intensity=lerp(light.intensity,power?targets[index]:[.08,.06,.04,.02][index],Math.min(1,delta*3));});
    if(power){ this.door.locked=false; this.setScreen(this.faultPanel,['GRID // RESTORED','GALLERY LOCK RELEASED'],{accent:'#f6a24f'}); this.ui.setPower(true);}
    if(this.state.flags.galleryOpened) this.updateFrequencyVisuals();
    this.beacon.material=done?this.mats.cyan:this.mats.amber; this.beacon.material.emissiveIntensity=done?2.6:.75+Math.sin(elapsed*4)*.45;
    this.rain.position.x=Math.sin(elapsed*.6)*.08;
  }
  interactDoor(player) { const text=this.door.toggle(player);this.ui.notify(text); if(!this.door.locked) return true; return false; }
  registerDoorInteraction() { this.interactions.register('gallery-door',this.door.pivot,{range:2.8,prompt:()=>this.door.locked?'Gallery security door — locked':this.door.open?'Close gallery security door':'Open gallery security door',onInteract:()=>this.interactDoor(this.player),testPose:{position:[22,0,1.5],lookAt:[22,1.55,3.22]}}); }
  bindPlayer(player) { this.player=player; this.registerDoorInteraction(); }
}
