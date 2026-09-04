#!/usr/bin/env python3
"""Harvest public YouTube thumbnail evidence without downloading video streams.

Uses BeautifulSoup only for a supplied/legitimately fetched HTML response, never disables
TLS verification and never requests a video format. Existing yt-dlp failures are preserved;
this tool only tests the distinct public thumbnail CDN once per indexed video and records
the canonical image URL regardless of network outcome.
"""
from __future__ import annotations

import argparse
import json
import ssl
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any
from bs4 import BeautifulSoup

THUMBNAIL_TEMPLATE = "https://i.ytimg.com/vi/{id}/hqdefault.jpg"


def secure_request(url: str, timeout: int) -> tuple[bytes | None, str | None, str | None]:
    request = urllib.request.Request(url, headers={"User-Agent": "PaleBeaconResearch/1.0 (metadata-only)"})
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=ssl.create_default_context()) as response:
            return response.read(), response.headers.get_content_type(), None
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as error:
        return None, None, f"{type(error).__name__}: {error}"


def parse_watch_html(html: bytes) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    result: dict[str, str] = {}
    for prop in ("og:title", "og:image", "og:description"):
        node = soup.find("meta", attrs={"property": prop})
        if node and node.get("content"): result[prop] = node["content"]
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", default="research/videos/source_index.json", type=Path)
    parser.add_argument("--output", default="research/video_analysis/public_thumbnail_evidence.json", type=Path)
    parser.add_argument("--thumbnail-dir", default="research/video_thumbnails", type=Path)
    parser.add_argument("--timeout", default=20, type=int)
    parser.add_argument("--watch-pages", action="store_true", help="Attempt one public HTML request per source and parse OG tags with BeautifulSoup.")
    args = parser.parse_args()
    index = json.loads(args.index.read_text(encoding="utf-8"))
    args.thumbnail_dir.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, Any]] = []
    for source in index["sources"]:
        video_id = source["id"]
        thumbnail_url = THUMBNAIL_TEMPLATE.format(id=video_id)
        image, content_type, error = secure_request(thumbnail_url, args.timeout)
        record: dict[str, Any] = {
            "id": video_id,
            "watch_url": source["url"],
            "canonical_thumbnail_url": thumbnail_url,
            "thumbnail_attempt_date": date.today().isoformat(),
            "thumbnail_status": "retrieved" if image and content_type == "image/jpeg" else "blocked",
            "full_video_retained": False,
        }
        if image and content_type == "image/jpeg":
            local = args.thumbnail_dir / f"{video_id}-hqdefault.jpg"
            local.write_bytes(image)
            record["thumbnail_file"] = local.as_posix()
            record["thumbnail_bytes"] = len(image)
        else:
            record["thumbnail_error"] = error or f"unexpected content type: {content_type}"
        if args.watch_pages:
            html, html_type, html_error = secure_request(source["url"], args.timeout)
            if html and html_type == "text/html":
                record["watch_page_status"] = "retrieved"
                record["parsed_open_graph"] = parse_watch_html(html)
            else:
                record["watch_page_status"] = "blocked"
                record["watch_page_error"] = html_error or f"unexpected content type: {html_type}"
        records.append(record)
    payload = {
        "schema": "public-youtube-evidence/v1",
        "policy": "No video stream download. Direct thumbnail CDN requests use default certificate verification. Watch-page parsing is opt-in and uses BeautifulSoup only to extract public OG metadata.",
        "records": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"thumbnail retrieved: {sum(x['thumbnail_status'] == 'retrieved' for x in records)}/{len(records)}")
    if args.watch_pages: print(f"watch pages retrieved: {sum(x['watch_page_status'] == 'retrieved' for x in records)}/{len(records)}")

if __name__ == "__main__":
    main()
