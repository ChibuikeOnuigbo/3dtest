# Evidence-first video pipeline

| Required entrypoint | Current implementation | Evidence boundary |
|---|---|---|
| `download_reference.py` | metadata/caption/thumbnail-only `fetch_video.py` wrapper | no bulk video media retention |
| `metadata.py` | `extract_metadata.py` wrapper | needs successful info JSON |
| `transcripts.py` | `extract_transcript.py` wrapper | needs caption artefact |
| `frames.py` | `extract_frames.py` wrapper | accepts only explicitly supplied permitted clip |
| `contact_sheet.py` | builds sheet from valid local selected frames | fails rather than inventing sheet |
| `analyze.py` | `analyze_video.py` wrapper | outputs empty observations until evidence exists |
| `build_evidence.py` | validates unique source/analysis records | no fabrication |

All network code uses normal certificate validation. The current 11-source ledger has no
retrieved thumbnail, captions, metadata or frame; `contact_sheet.py` correctly refuses to
produce an empty/fictional visual result.
