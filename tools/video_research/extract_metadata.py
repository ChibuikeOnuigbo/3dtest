#!/usr/bin/env python3
"""Distil locally collected yt-dlp .info.json files into concise research metadata."""
from __future__ import annotations
import argparse, json
from pathlib import Path

FIELDS = ('id','title','channel','channel_id','upload_date','duration','description','categories','tags','chapters','subtitles','automatic_captions','thumbnail','webpage_url')
def main():
 p=argparse.ArgumentParser(); p.add_argument('--videos',type=Path,default=Path('research/videos')); p.add_argument('--output',type=Path,default=Path('research/metadata/videos.json')); a=p.parse_args()
 records=[]
 for file in sorted(a.videos.glob('*.info.json')):
  raw=json.loads(file.read_text(encoding='utf-8')); records.append({k:raw.get(k) for k in FIELDS}|{'info_file':str(file)})
 a.output.parent.mkdir(parents=True,exist_ok=True); a.output.write_text(json.dumps({'schema':'video-metadata/v1','videos':records},indent=2)+'\n',encoding='utf-8'); print(f'{a.output}: {len(records)} records')
if __name__=='__main__': main()
