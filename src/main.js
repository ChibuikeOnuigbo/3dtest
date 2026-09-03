import * as THREE from 'three';
import { GameState } from './core/GameState.js';
import { CollisionWorld } from './systems/CollisionWorld.js';
import { PlayerController } from './systems/PlayerController.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { UI } from './systems/UI.js';
import { World } from './world/World.js';
import '../src/style.css';

const canvas=document.querySelector('#game-canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75)); renderer.setSize(window.innerWidth,window.innerHeight,false); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05; renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(68,window.innerWidth/window.innerHeight,.05,90); const clock=new THREE.Clock();
const state=new GameState(); const ui=new UI(); const audio=new AudioSystem(); const collision=new CollisionWorld(); const player=new PlayerController(camera,canvas,collision); player.addTo(scene);
const interactions=new InteractionSystem(camera,ui); const world=new World({scene,collision,interactions,state,ui,audio});
let elapsed=0; let started=false; let frameCount=0;

function resize(){camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));renderer.setSize(window.innerWidth,window.innerHeight,false);} window.addEventListener('resize',resize);
function setObjective(){ui.setObjective(state.objective);}
state.on(({event})=>{ setObjective(); if(event==='frequency-locked'){audio.cue('ready');ui.notify('CHANNEL LOCKED — TRANSMITTER ARMED');} if(event==='transmitted'){ui.setSignal(true,true);} });

function startShift(){
  if(!started){started=true;player.enabled=true;player.reset(new THREE.Vector3(0,0,0),-1.1);ui.begin();ui.notify('SYSTEM FAULT DETECTED — INSPECT THE CONSOLE',4200);}
  audio.unlock().catch(()=>{}); player.requestLock();
}
function resetShift(){state.reset();player.reset(new THREE.Vector3(0,0,0),-1.1);ui.hideEnd();ui.setPrompt('',false);ui.notify('SHIFT RESET — RELAY FAULT ACTIVE');interactions.update();}

document.querySelector('#begin-button').addEventListener('click',startShift); document.querySelector('#restart-button').addEventListener('click',()=>{resetShift();startShift();}); document.querySelector('#reset-button').addEventListener('click',resetShift);
window.addEventListener('keydown',(event)=>{if(event.code==='KeyE'&&!event.repeat&&started){audio.unlock().catch(()=>{});interactions.activate();} if(event.code==='KeyR'&&!event.repeat&&started)resetShift();});
canvas.addEventListener('click',()=>{if(started){audio.unlock().catch(()=>{});player.requestLock();}});

function animate(){
  const delta=Math.min(clock.getDelta(),.05); elapsed+=delta; if(started)player.update(delta); world.update(delta,elapsed); interactions.update(); renderer.render(scene,camera); frameCount++; requestAnimationFrame(animate);
}

async function boot(){
  try {
    await world.build(); world.bindPlayer(player); setObjective(); interactions.update(); ui.ready();
    window.__LAST_SIGNAL__={
      version:'1.0.0',
      state:()=>state.snapshot(),
      activeInteraction:()=>interactions.focus?.id ?? null,
      collision:()=>collision.debugBoxes(),
      performance:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,frameCount}),
      activate:(id)=>interactions.activateForTest(id,player),
      step:(seconds=.2)=>{world.update(seconds,elapsed+=seconds);interactions.update();return state.snapshot();},
      reset:resetShift,
      start:startShift
    };
    animate();
  } catch (error) {
    console.error('Fatal world initialization error',error); document.querySelector('#loading').textContent='RELAY INITIALIZATION FAILED'; ui.notify('INITIALIZATION FAILED — SEE CONSOLE',10000);
  }
}
boot();
