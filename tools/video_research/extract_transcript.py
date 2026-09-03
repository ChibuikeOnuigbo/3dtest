#!/usr/bin/env python3
"""Attempt legal caption retrieval; preserves only subtitle text files returned by YouTube."""
from __future__ import annotations
import argparse, pathlib, re, subprocess, sys

def main() -> int:
    p=argparse.ArgumentParser(); p.add_argument("url"); p.add_argument("--output",default="research/transcripts"); a=p.parse_args()
    out=pathlib.Path(a.output); out.mkdir(parents=True,exist_ok=True)
    cmd=["yt-dlp","--no-warnings","--skip-download","--write-subs","--write-auto-subs","--sub-langs","en.*,en","--convert-subs","vtt","-o",str(out / "%(id)s.%(ext)s"),a.url]
    proc=subprocess.run(cmd,text=True,capture_output=True)
    log=out / f"caption-attempt-{re.sub(r'[^A-Za-z0-9]+','-',a.url[-12:])}.log"
    log.write_text((proc.stdout+"\n"+proc.stderr)[-8000:])
    if proc.returncode:
        print(f"CAPTIONS_UNAVAILABLE_OR_FAILED: {log}",file=sys.stderr); return proc.returncode
    print(f"CAPTION_ATTEMPT_OK {log}"); return 0
if __name__ == "__main__": raise SystemExit(main())
