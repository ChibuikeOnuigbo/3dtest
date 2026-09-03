#!/usr/bin/env python3
"""Create a concise metadata index from metadata JSON files."""
from __future__ import annotations
import json, pathlib
root = pathlib.Path("research/metadata")
records=[]
for path in sorted(root.glob("*.json")):
    data=json.loads(path.read_text())
    if data.get("status") != "failed":
        records.append({k:data.get(k) for k in ("id","title","channel","duration","webpage_url","availability","license")})
pathlib.Path("research/videos/source_index.json").write_text(json.dumps(records,indent=2,ensure_ascii=False)+"\n")
print(f"Indexed {len(records)} metadata records")
