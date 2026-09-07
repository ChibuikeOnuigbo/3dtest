#!/usr/bin/env python3
"""Find literal local asset paths and renderer/loader patterns without executing reference code."""
from __future__ import annotations
import argparse,json,pathlib,re
EXT={'.js','.mjs','.ts','.tsx','.html','.css','.json'};IGNORE={'.git','node_modules'}
ASSET=re.compile(r"(?:[\"'`])((?:\.?\/?)(?:models|images|sounds|assets|public|forge)[^\"'`\s)]+(?:\.(?:glb|gltf|fbx|obj|dae|blend|png|jpe?g|webp|mp3|wav|ogg|flac|hdr))?)[\"'`]",re.I)
PATTERNS={'gltf_loader':r'GLTFLoader|GLTFLoader','obj_loader':r'OBJLoader','animation_mixer':r'AnimationMixer|clipAction','pointer_lock':r'PointerLock|requestPointerLock','collision':r'Box3|Capsule|Octree|Ammo|Collider|collision\(','audio':r'Audio\(|AudioLoader|PositionalAudio|\.play\(','render_loop':r'requestAnimationFrame|setAnimationLoop','network':r'WebSocket|fetch\(|XMLHttpRequest|Gametime','shadow':r'shadowMap|castShadow|receiveShadow'}
def main():
 p=argparse.ArgumentParser();p.add_argument('repo');p.add_argument('--output',required=True);a=p.parse_args();root=pathlib.Path(a.repo);refs=[];matches={key:[] for key in PATTERNS}
 for f in root.rglob('*'):
  if not f.is_file() or f.suffix.lower() not in EXT or any(x in IGNORE for x in f.parts):continue
  try:text=f.read_text(errors='ignore')
  except:continue
  rel=f.relative_to(root).as_posix()
  for match in ASSET.finditer(text):refs.append({'source':rel,'asset_path':match.group(1)})
  for key,pattern in PATTERNS.items():
   count=len(re.findall(pattern,text,re.I));
   if count:matches[key].append({'source':rel,'count':count})
 result={'repository':str(root),'literal_asset_references':refs,'pattern_matches':matches}
 out=pathlib.Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2)+'\n');print(f'{out}: {len(refs)} literal asset references')
if __name__=='__main__':main()
