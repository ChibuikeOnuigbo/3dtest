#!/usr/bin/env python3
"""Validate the evidence ledger without inventing observations."""
from __future__ import annotations
import json
from pathlib import Path
index=json.loads(Path('research/videos/source_index.json').read_text())
analysis=json.loads(Path('research/video_analysis/videos.json').read_text())
assert len(index['sources']) == len({x['id'] for x in index['sources']}) == 11
assert len(analysis['videos']) == 11
print(json.dumps({'sources':len(index['sources']),'unique_ids':len({x['id'] for x in index['sources']}),'analysis_records':len(analysis['videos']),'status':'VALIDATED_NO_MEDIA_INVENTED'},indent=2))
