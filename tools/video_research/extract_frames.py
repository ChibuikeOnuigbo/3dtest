#!/usr/bin/env python3
"""Extract selected frames only from an explicitly supplied, lawfully obtained short clip.

This tool does not download any video. A successful metadata review must choose the
few timestamps that matter before a permitted temporary clip is supplied to it.
"""
from __future__ import annotations
import argparse, json, subprocess
from pathlib import Path

def main():
 p=argparse.ArgumentParser();p.add_argument('--clip',type=Path,required=True);p.add_argument('--timestamps',required=True,help='comma-separated seconds');p.add_argument('--output-dir',type=Path,required=True);a=p.parse_args();a.output_dir.mkdir(parents=True,exist_ok=True)
 if not a.clip.is_file(): raise SystemExit(f'clip not found: {a.clip}')
 times=[float(x) for x in a.timestamps.split(',')]
 for i,t in enumerate(times,1):
  output=a.output_dir/f'frame-{i:02d}-{t:g}s.jpg'; subprocess.run(['ffmpeg','-ss',str(t),'-i',str(a.clip),'-frames:v','1','-q:v','2',str(output)],check=True)
 (a.output_dir/'frame-manifest.json').write_text(json.dumps({'clip':str(a.clip),'timestamps_seconds':times,'full_video_retained':False},indent=2)+'\n')
 print(f'frames written: {len(times)}')
if __name__=='__main__': main()
