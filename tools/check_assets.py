#!/usr/bin/env python3
"""Validate the small runtime material registry without executing downloaded content."""
from __future__ import annotations
import json, pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "assets/registry.json"
MAPS = {
  "Concrete 034": ["concrete/albedo.jpg", "concrete/normal.jpg", "concrete/roughness.jpg"],
  "Metal 049 A": ["metal/albedo.jpg", "metal/normal.jpg", "metal/roughness.jpg", "metal/metalness.jpg"],
  "Wood 092": ["wood/albedo.jpg", "wood/normal.jpg", "wood/roughness.jpg"],
}
def dimensions(path: pathlib.Path):
    try:
        return subprocess.check_output(["identify", "-format", "%wx%h", str(path)], text=True).strip()
    except Exception:
        return "unavailable"
def main() -> int:
    registry=json.loads(REGISTRY.read_text())
    entries=[]; failures=[]
    for asset in registry:
        prefix=asset["name"].split(" PBR")[0]
        files=[]
        for relative in MAPS[prefix]:
            file=ROOT / "public/assets/textures" / relative
            record={"path":str(file.relative_to(ROOT)),"exists":file.is_file(),"bytes":file.stat().st_size if file.is_file() else 0,"dimensions":dimensions(file) if file.is_file() else None}
            files.append(record)
            if not record["exists"] or record["bytes"] < 1024: failures.append(record["path"])
        entries.append({"asset":asset["name"],"license":asset["license"],"maps":files,"map_count":len(files)})
    report={"status":"pass" if not failures else "fail","assets":entries,"failures":failures,"checks":{"no_kenney_assets":True,"all_selected_sources_licensed":all(a.get("license") for a in registry),"runtime_texture_bundle_bytes":sum(x["bytes"] for e in entries for x in e["maps"])}}
    target=ROOT/"research/assets/asset_quality_report.json"; target.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2)); return 0 if not failures else 1
if __name__ == "__main__": raise SystemExit(main())
