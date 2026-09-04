#!/usr/bin/env python3
"""Read-only texture dimensions/hash inspector."""
from __future__ import annotations
import argparse, hashlib, importlib.util, json
from pathlib import Path
SPEC=importlib.util.spec_from_file_location('forensics', Path(__file__).parents[1] / 'repo_research' / 'asset_forensics.py')
module=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(module)
p=argparse.ArgumentParser();p.add_argument('texture',type=Path);p.add_argument('--output',type=Path);a=p.parse_args()
r={'path':a.texture.as_posix(),'sha256':hashlib.sha256(a.texture.read_bytes()).hexdigest(),'bytes':a.texture.stat().st_size,'technical':module.image_details(a.texture),'status':'INSPECTED'}
text=json.dumps(r,indent=2)+'\n';(a.output.write_text(text) if a.output else print(text,end=''))
