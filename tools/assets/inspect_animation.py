#!/usr/bin/env python3
"""Read-only GLB/glTF animation-count inspector; clip verification still needs a runtime."""
from __future__ import annotations
import argparse, importlib.util, json
from pathlib import Path
SPEC=importlib.util.spec_from_file_location('forensics', Path(__file__).parents[1] / 'repo_research' / 'asset_forensics.py')
module=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(module)
p=argparse.ArgumentParser();p.add_argument('model',type=Path);a=p.parse_args()
d=module.model_details(a.model);print(json.dumps({'path':a.model.as_posix(),'animation_count':d.get('animation_count',0),'technical':d,'status':'INSPECTED_NOT_RUNTIME_VALIDATED'},indent=2))
