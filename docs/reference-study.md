# Video-reference study — evidence status

## Method actually executed

The provided YouTube source index contains 11 unique records. A local temporary virtual
environment installed `yt-dlp 2026.08.19`. The pipeline requested metadata, available
English captions/automatic captions and thumbnails with `--skip-download`; it does not
retain full video streams. The duplicated video ID policy is enforced by the unique source
index.

## Result: blocked before evidence collection

All 11 collection attempts failed with a TLS/SSL EOF when contacting YouTube. Therefore:

- no title/duration/channel details are reported as facts;
- no captions/transcripts were downloaded;
- no video frames, thumbnails or scene changes were extracted;
- no design insight in this project is falsely attributed to any supplied video.

The raw per-video logs and structured status are in
[`research/metadata/`](../research/metadata/) and
[`research/videos/source_index.json`](../research/videos/source_index.json). This is a
research blocker, not a successful video phase.

## What will count as a valid observation after collection

```json
{
  "video_id": "source ID",
  "timestamp": "00:00:00",
  "category": "environment | architecture | lighting | interaction | animation | UI | pacing",
  "description": "an original factual observation of supplied evidence",
  "importance": "high | medium | low",
  "confidence": "high | medium | low",
  "transferable_principle": "a non-copyrighted design lesson"
}
```

## Provisional non-video constraints

Until evidence exists, we will make no claim that a particular reference visual style,
room layout, story beat or interaction should be copied. The only project-wide rules used
for later planning come from the user’s directive: small feasible scope, complete
environment before prop accumulation, coherent believable materials, no Kenney material,
real collision/doors/objectives, and Playwright-backed QA before completion.
