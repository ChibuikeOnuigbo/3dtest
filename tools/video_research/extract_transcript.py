#!/usr/bin/env python3
"""Convert downloaded WebVTT captions into non-dialogue research text inputs."""
from __future__ import annotations
import argparse, html, re
from pathlib import Path

def clean(s):
 s=re.sub(r'^\d+$','',s.strip()); s=re.sub(r'^\d\d:\d\d(?::\d\d)?\.\d\d\d\s+-->.*$','',s); s=re.sub(r'<[^>]*>','',s); return html.unescape(s).strip()
def main():
 p=argparse.ArgumentParser();p.add_argument('--videos',type=Path,default=Path('research/videos'));p.add_argument('--output-dir',type=Path,default=Path('research/transcripts'));a=p.parse_args();a.output_dir.mkdir(parents=True,exist_ok=True); count=0
 for path in sorted(a.videos.glob('*.vtt')):
  lines=[]; last=''
  for raw in path.read_text(encoding='utf-8',errors='replace').splitlines():
   value=clean(raw)
   if value and value not in ('WEBVTT',last):lines.append(value);last=value
  out=a.output_dir/(path.stem+'.txt');out.write_text('\n'.join(lines)+'\n',encoding='utf-8'); count+=1
 print(f'caption files converted: {count}')
if __name__=='__main__': main()
