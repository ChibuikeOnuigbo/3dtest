#!/usr/bin/env python3
"""Return hash and structural metadata for one local model. Read-only; no conversion."""
from __future__ import annotations
import argparse, hashlib, importlib.util, json
from pathlib import Path
SPEC=importlib.util.spec_from_file_location('forensics', Path(__file__).parents[1] / 'repo_research' / 'asset_forensics.py')
module=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(module)
p=argparse.ArgumentParser(); p.add_argument('model',type=Path); p.add_argument('--output',type=Path); a=p.parse_args()
h=hashlib.sha256(a.model.read_bytes()).hexdigest()
r={'path':a.model.as_posix(),'sha256':h,'bytes':a.model.stat().st_size,'technical':module.model_details(a.model),'status':'INSPECTED'}
text=json.dumps(r,indent=2)+'\n'; (a.output.write_text(text) if a.output else print(text,end=''))
