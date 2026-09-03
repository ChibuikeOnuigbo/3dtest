#!/usr/bin/env python3
"""Inspect GLB JSON metadata for declared animations/nodes without rendering it."""
from __future__ import annotations
import argparse, json, pathlib, struct
p=argparse.ArgumentParser(); p.add_argument('file'); a=p.parse_args(); raw=pathlib.Path(a.file).read_bytes()
if raw[:4]!=b'glTF': raise SystemExit('Only binary GLB is supported by this lightweight inspector.')
_, length=struct.unpack('<II',raw[4:12]); chunk_len, chunk_type=struct.unpack('<I4s',raw[12:20]); doc=json.loads(raw[20:20+chunk_len])
print(json.dumps({'file':a.file,'valid_length':len(raw)==length,'nodes':len(doc.get('nodes',[])),'meshes':len(doc.get('meshes',[])),'skins':len(doc.get('skins',[])),'has_skeleton':bool(doc.get('skins')),'bone_count':sum(len(s.get('joints',[])) for s in doc.get('skins',[])),'animation_count':len(doc.get('animations',[])),'animation_names':[x.get('name','unnamed') for x in doc.get('animations',[])]},indent=2))
