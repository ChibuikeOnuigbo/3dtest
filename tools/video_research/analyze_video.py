#!/usr/bin/env python3
"""Create a structured, human-reviewable observation template tied to a source."""
from __future__ import annotations
import argparse, json, pathlib
p=argparse.ArgumentParser(); p.add_argument("--id",required=True); p.add_argument("--source",required=True); p.add_argument("--title",default="Title pending metadata")
a=p.parse_args(); out=pathlib.Path("research/video_analysis")/f"{a.id}.json"; out.parent.mkdir(parents=True,exist_ok=True)
record={"video_id":a.id,"source":a.source,"title":a.title,"evidence_status":"requires frame/transcript review","observations":[{"timestamp":"00:00","category":"opening_environment","description":"Pending evidence review; do not treat this template as a finding.","importance":"high","confidence":"unverified","design_principle":"To be derived only after reviewing obtained evidence."}]}
out.write_text(json.dumps(record,indent=2)+"\n")
print(out)
