# Master video research ledger

## Collection result

The 11 unique user-supplied YouTube references were processed once on 2026-09-04 by the
versioned `yt-dlp` pipeline (`2026.08.19`). Each request explicitly used
`--skip-download`, info JSON, English caption/automatic-caption and thumbnail requests.
No full video was retained. Every request failed while establishing a TLS connection to
YouTube. Result logs are individually stored under `research/metadata/yt-dlp-*.log` and
status is recorded in [`../videos/source_index.json`](../videos/source_index.json).

| Evidence type | Result | Interpretation |
|---|---|---|
| Source URLs | 11 unique URL/ID records | Complete input inventory; duplicated IDs are not processed twice. |
| Metadata/title/duration | 0 | Not available; do not invent video identification or duration. |
| Captions/transcripts | 0 | No story/gameplay extraction can be attributed to a video. |
| Thumbnails/frames | 0 | No visual conclusion or image comparison can be attributed to a video. |
| Full videos | 0 retained | Intentional non-retention policy was upheld. |

## Evidence rule for video conclusions

This document intentionally contains **no pretend scene analysis**. A hallway, lighting,
puzzle, asset style, pacing, interaction, or story observation requires a matching frame,
caption or metadata record. The source analysis ledger lists every item as
`blocked_no_verified_media`; an empty observation list means “not observed,” not “no
feature exists.”

## Research questions awaiting verified media

When the network prerequisite is resolved, selected frames/captions must be evaluated for:

1. **Spatial pacing:** how compression/expansion, thresholds, landmarking and room purpose
   guide the player.
2. **Light hierarchy:** which visible light sources guide navigation versus merely create
   darkness; do not copy any composition or footage.
3. **Interaction legibility:** how the player understands an interactable, receives a
   state change, and gets progression feedback.
4. **Asset coherence:** material density, architectural language, scale, surface wear and
   prop grouping—not a count of random objects.
5. **Camera/motion feel:** FOV, camera height, navigation speed, sprint use, room scale
   and accessibility tradeoffs.
6. **Story/gameplay bond:** what an event changes in player knowledge, route, environment
   or objective.

## Re-run protocol

Do not reprocess these sources blindly. When a secure connection is available, rerun only
the existing index through `tools/video_research/fetch_video.py`; it records status and
will not requeue a processed source. First inspect info/caption results, choose a few
legitimate timestamps, obtain only a temporary permitted clip if appropriate, use
`extract_frames.py`, and record each resulting observation with source, timestamp,
category, importance and confidence.
