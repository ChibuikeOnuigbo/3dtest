import * as THREE from 'three';

const PATH='/assets/textures/';
const textureLoader=new THREE.TextureLoader();
async function texture(path, srgb=false, repeat=[1,1]) {
  const result=await textureLoader.loadAsync(`${PATH}${path}`); result.wrapS=result.wrapT=THREE.RepeatWrapping; result.repeat.set(...repeat); result.anisotropy=4; if (srgb) result.colorSpace=THREE.SRGBColorSpace; return result;
}
async function pbr(folder, options={}) {
  const repeat=options.repeat??[1,1];
  const [map,normalMap,roughnessMap,metalnessMap]=await Promise.all([
    texture(`${folder}/albedo.jpg`,true,repeat), texture(`${folder}/normal.jpg`,false,repeat), texture(`${folder}/roughness.jpg`,false,repeat), options.metal ? texture(`${folder}/metalness.jpg`,false,repeat) : Promise.resolve(null)
  ]);
  return new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, metalnessMap, metalness:options.metal?1:0, roughness:options.roughness??.72, color:options.color??0xffffff });
}
export async function createMaterialLibrary() {
  const [concrete,metal,wood]=await Promise.all([
    pbr('concrete',{repeat:[3,3],roughness:.84,color:0xaeb8be}), pbr('metal',{repeat:[2,2],metal:true,roughness:.58,color:0x8d9ca2}), pbr('wood',{repeat:[1,1],roughness:.72,color:0x9d8063})
  ]);
  const make=(color, metalness=.2, roughness=.55, emissive=0x000000, emissiveIntensity=0)=>new THREE.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity});
  return {concrete, metal, wood, trim:make(0x17212a,.75,.42), dark:make(0x0b1117,.5,.75), amber:make(0x5d2908,.35,.38,0xff731a,1.3), red:make(0x3e080b,.25,.45,0xff111d,1.5), cyan:make(0x06343d,.5,.3,0x2adfed,1.2), paper:make(0xbec0b4,0,.88), rubber:make(0x101518,0,.92)};
}
