import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GameState } from '../src/core/GameState.js';
import { CollisionWorld } from '../src/systems/CollisionWorld.js';

const root=new URL('..',import.meta.url).pathname;
const pass=[];
function check(name,fn){try{fn();pass.push({name,status:'pass'});}catch(error){pass.push({name,status:'fail',error:error.message});}}
function increment(state,index,times){for(let i=0;i<times;i++)assert.equal(state.turnDial(index),true);}

check('story critical-path state machine rejects wrong order and completes',()=>{
  const s=new GameState(); assert.equal(s.readNote(),false); assert.equal(s.collectFuse(),false); assert.equal(s.inspectFault(),true); assert.equal(s.readNote(),true); assert.equal(s.collectFuse(),true); assert.equal(s.installFuse(),true); assert.equal(s.resetBreaker(),true); assert.equal(s.openGallery(),true); assert.equal(s.transmit(),false);
  increment(s,0,3);increment(s,1,1);increment(s,2,4); assert.equal(s.flags.frequencySet,true); assert.equal(s.transmit(),true); assert.equal(s.flags.ended,true); assert.equal(s.objectiveKey,'complete');
});
check('state changes are idempotent and dial input cannot corrupt locked state',()=>{
  const s=new GameState();s.inspectFault();s.readNote();s.collectFuse();s.installFuse();s.resetBreaker();s.openGallery();increment(s,0,3);increment(s,1,1);increment(s,2,4);const fixed=[...s.dials];assert.equal(s.turnDial(0),false);assert.deepEqual(s.dials,fixed);assert.equal(s.transmit(),true);assert.equal(s.transmit(),false);
});
check('collision world blocks a closed doorway and permits passage after collision disable',()=>{
  const c=new CollisionWorld();c.addBox('closed',[0,0,0],[2,3,.25],true);const p={x:0,z:-1};c.moveCircle(p,{x:0,z:2},.28);assert.ok(p.z<-.39,`closed door allowed z=${p.z}`);c.setEnabled('closed',false);c.moveCircle(p,{x:0,z:2},.28);assert.ok(p.z>.8,`open door failed z=${p.z}`);
});
check('circle collision resolves a solid wall and avoids embedding',()=>{
  const c=new CollisionWorld();c.addBox('wall',[1,0,0],[.2,3,4],true);const p={x:0,z:0};c.moveCircle(p,{x:2,z:0},.28);assert.ok(p.x<.62,`wall tunnelling x=${p.x}`); assert.equal(c.isCircleInBox(p,.28,'wall'),false);
});
check('room graph is connected and room metadata is complete',()=>{
  const rooms=JSON.parse(readFileSync(join(root,'game/data/rooms.json')));assert.equal(rooms.length,5);const ids=new Set(rooms.map(r=>r.id));for(const room of rooms){for(const key of ['id','name','purpose','dimensions','position','connections','entrances','exits','objective','important_objects','lighting','story_events'])assert.ok(key in room,`${room.id} missing ${key}`);for(const link of room.connections)assert.ok(ids.has(link),`${room.id} unknown link ${link}`);}const found=new Set(['airlock']);let changed=true;while(changed){changed=false;for(const room of rooms)if(found.has(room.id))for(const link of room.connections)if(!found.has(link)){found.add(link);changed=true;}}assert.equal(found.size,rooms.length);
});
check('asset registry contains license and all runtime texture maps',()=>{
  const registry=JSON.parse(readFileSync(join(root,'assets/registry.json')));assert.equal(registry.length,3);for(const asset of registry){assert.ok(asset.license.includes('CC0'));assert.equal(asset.textures,true);}for(const path of ['concrete/albedo.jpg','concrete/normal.jpg','concrete/roughness.jpg','metal/albedo.jpg','metal/normal.jpg','metal/roughness.jpg','metal/metalness.jpg','wood/albedo.jpg','wood/normal.jpg','wood/roughness.jpg']){const full=join(root,'public/assets/textures',path);assert.ok(existsSync(full),`missing ${path}`);assert.ok(statSync(full).size>1024,`undersized ${path}`);}
});
check('no prohibited Kenney reference is shipped in runtime assets/source',()=>{
  const runtime=[join(root,'src/main.js'),join(root,'src/world/World.js'),join(root,'src/world/Materials.js'),join(root,'assets/registry.json')].map(file=>readFileSync(file,'utf8')).join('\n');assert.equal(/kenney/i.test(runtime),false);
});
check('all required live interaction IDs are registered in world source',()=>{
  const world=readFileSync(join(root,'src/world/World.js'),'utf8');for(const id of ['fault-console','work-order','thermal-fuse','fuse-socket','shore-breaker','gallery-door','transmit-button'])assert.ok(world.includes(`'${id}'`),`missing ${id}`);assert.ok(world.includes('`dial-${index}`'),'missing data-driven dial registration');
});
check('production build exists and stays within static material payload budget',()=>{
  assert.ok(existsSync(join(root,'dist/index.html')),'run npm run build first');let total=0;for(const folder of ['concrete','metal','wood'])for(const name of readdirSync(join(root,'public/assets/textures',folder)))total+=statSync(join(root,'public/assets/textures',folder,name)).size;assert.ok(total<12*1024*1024,`texture bundle ${total} exceeds 12 MB`);
});
const failures=pass.filter(x=>x.status==='fail');console.log(JSON.stringify({status:failures.length?'fail':'pass',checks:pass,summary:{passed:pass.length-failures.length,failed:failures.length}},null,2));if(failures.length)process.exit(1);
