#!/usr/bin/env python3
"""Process each indexed YouTube reference once without retaining full videos.

A run requests info JSON, thumbnails and any available English captions via yt-dlp.
It never asks yt-dlp to download a video stream. Network failures are structured
research evidence, not silently retried or treated as video findings.
"""
from __future__ import annotations
import argparse, json, subprocess, sys
from datetime import date
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument('--index', type=Path, default=Path('research/videos/source_index.json'))
    p.add_argument('--yt-dlp', default='yt-dlp')
    args = p.parse_args()
    data = json.loads(args.index.read_text())
    root = args.index.parents[1]
    videos, meta, transcripts = root/'videos', root/'metadata', root/'transcripts'
    for directory in (videos, meta, transcripts): directory.mkdir(parents=True, exist_ok=True)
    processed = 0
    for entry in data['sources']:
        if entry.get('status') != 'queued':
            continue
        video_id, url = entry['id'], entry['url']
        output = str(videos / '%(id)s.%(ext)s')
        command = [args.yt_dlp, '--no-playlist', '--skip-download', '--write-info-json',
            '--write-thumbnail', '--write-subs', '--write-auto-subs', '--sub-langs', 'en,en-US,en-GB,en.*',
            '--convert-subs', 'vtt', '--output', output, url]
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        log_path = meta / f'yt-dlp-{video_id}.log'
        log_path.write_text(f'command: {" ".join(command[:-1])} <source-url-redacted>\n\n{result.stdout}', encoding='utf-8')
        entry['status'] = 'metadata_caption_thumbnail_collected' if result.returncode == 0 else 'blocked'
        entry['attempt_date'] = str(date.today())
        entry['returncode'] = result.returncode
        entry['log'] = str(log_path.relative_to(args.index.parent.parent))
        entry['full_video_retained'] = False
        processed += 1
        print(f'{video_id}: {entry["status"]} (exit {result.returncode})')
    args.index.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    print(f'processed unique queued sources: {processed}')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
