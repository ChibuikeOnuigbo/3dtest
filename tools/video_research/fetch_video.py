#!/usr/bin/env python3
"""Fetch yt-dlp metadata only; no video media is retained."""
from __future__ import annotations
import argparse, json, pathlib, re, subprocess, sys

def slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-")

def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("url")
    p.add_argument("--output", default="research/metadata")
    a = p.parse_args()
    out = pathlib.Path(a.output); out.mkdir(parents=True, exist_ok=True)
    try:
        raw = subprocess.run(["yt-dlp", "--no-warnings", "--dump-single-json", "--skip-download", a.url], text=True, capture_output=True, check=True).stdout
        data = json.loads(raw)
    except (subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError) as exc:
        error = getattr(exc, "stderr", "") or str(exc)
        failure = out / f"failed-{slug(a.url[-12:])}.json"
        failure.write_text(json.dumps({"url": a.url, "status": "failed", "error": error[-2000:]}, indent=2)+"\n")
        print(f"METADATA_FAILED {failure}: {error[-500:]}", file=sys.stderr)
        return 1
    keep = {k:data.get(k) for k in ("id","webpage_url","title","channel","channel_id","uploader","upload_date","duration","description","categories","tags","availability","license","thumbnail","subtitles","automatic_captions","view_count")}
    dest = out / f"{slug(data.get('id') or a.url[-11:])}.json"
    dest.write_text(json.dumps(keep, indent=2, ensure_ascii=False)+"\n")
    print(dest)
    return 0
if __name__ == "__main__": raise SystemExit(main())
