#!/usr/bin/env python3
"""Non-executing research inventory for source repositories and their media files."""
from __future__ import annotations
import argparse, hashlib, json, pathlib, struct
from collections import Counter, defaultdict
SKIP={'.git','node_modules','.next','dist','build'}
MODEL_EXT={'.glb','.gltf','.fbx','.obj','.dae','.blend'}
IMAGE_EXT={'.png','.jpg','.jpeg','.webp','.gif','.svg','.hdr','.ktx2','.bmp'}
AUDIO_EXT={'.mp3','.wav','.ogg','.flac','.aac','.m4a'}
CODE_EXT={'.js','.mjs','.ts','.tsx','.html','.css','.json'}

def gltf_json_info(doc):
    triangles=0
    for mesh in doc.get('meshes',[]):
        for primitive in mesh.get('primitives',[]):
            accessor=primitive.get('indices')
            if accessor is not None: triangles += doc.get('accessors',[{}])[accessor].get('count',0)//3
    external_uris=[]
    for bucket in ('buffers','images'):
        for entry in doc.get(bucket,[]):
            uri=entry.get('uri','')
            if uri and not uri.startswith('data:'): external_uris.append(uri)
    bounds=[]
    for a in doc.get('accessors',[]):
        if a.get('type')=='VEC3' and 'min' in a and 'max' in a: bounds.append({'min':a['min'],'max':a['max'],'count':a.get('count')})
    return {'scenes':len(doc.get('scenes',[])),'nodes':len(doc.get('nodes',[])),'meshes':len(doc.get('meshes',[])),'materials':len(doc.get('materials',[])),'textures':len(doc.get('textures',[])),'skins':len(doc.get('skins',[])),'animations':len(doc.get('animations',[])),'animation_names':[a.get('name','unnamed') for a in doc.get('animations',[])],'indexed_triangles':triangles,'external_uris':external_uris,'position_accessor_bounds':bounds[:100]}

def glb_info(path: pathlib.Path):
    try:
        data=path.read_bytes(); magic,version,length=struct.unpack('<4sII',data[:12])
        if magic != b'glTF': return {'parse_warning':'missing glTF magic'}
        json_length,kind=struct.unpack('<I4s',data[12:20]); doc=json.loads(data[20:20+json_length])
        return {'glb_version':version,'declared_bytes':length,'valid_length':length==len(data), **gltf_json_info(doc)}
    except Exception as exc: return {'parse_warning':str(exc)}

def digest(path: pathlib.Path):
    h=hashlib.sha256()
    with path.open('rb') as f:
      for chunk in iter(lambda:f.read(1_048_576),b''): h.update(chunk)
    return h.hexdigest()

def main():
    p=argparse.ArgumentParser();p.add_argument('repo');p.add_argument('--output',required=True);args=p.parse_args();root=pathlib.Path(args.repo).resolve();files=[];types=Counter();by_dir=defaultdict(lambda:{'files':0,'bytes':0})
    for file in sorted(root.rglob('*')):
      if not file.is_file() or any(part in SKIP for part in file.relative_to(root).parts):continue
      rel=file.relative_to(root).as_posix();ext=file.suffix.lower();size=file.stat().st_size;types[ext or '[none]']+=1
      record={'path':rel,'extension':ext or '[none]','bytes':size,'category':'code' if ext in CODE_EXT else 'model' if ext in MODEL_EXT else 'image' if ext in IMAGE_EXT else 'audio' if ext in AUDIO_EXT else 'other'}
      if ext in MODEL_EXT:
       record['sha256']=digest(file)
       if ext=='.glb':record['inspection']=glb_info(file)
       elif ext=='.gltf':
        try: record['inspection']=gltf_json_info(json.loads(file.read_text()))
        except Exception as exc: record['inspection']={'parse_warning':str(exc)}
      files.append(record)
      top=rel.split('/')[0];by_dir[top]['files']+=1;by_dir[top]['bytes']+=size
    report={'repository':str(root),'file_count':len(files),'total_bytes':sum(x['bytes'] for x in files),'extension_counts':dict(sorted(types.items())),'directory_summary':dict(by_dir),'models':[x for x in files if x['category']=='model'],'images':[x for x in files if x['category']=='image'],'audio':[x for x in files if x['category']=='audio']}
    out=pathlib.Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n');print(f'{out}: {report["file_count"]} files, {len(report["models"])} models, {len(report["images"])} images, {len(report["audio"])} audio')
if __name__=='__main__':main()
