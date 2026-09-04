# Asset-use plan after all-repository forensics

This plan is deliberately **selective**. It does not turn the 620 scanned reference
assets into a merged source folder or an implicit free asset pack.

## Source separation

```text
research/github_repos/<reference>/...   ignored, read-only research laboratories
research/github/asset_forensics.json    tracked forensic source index
public/assets/<approved-id>/...          future legal production copy only
src/data/assets.js                       future typed manifest + source-credit IDs
CREDITS.md                               future final attribution export
```

A runtime import may only address `public/assets/<approved-id>/...`; it may never load
from `research/github_repos/`. This makes provenance and build size auditable and avoids
accidental bundling of reference content.

## Intended use by current game role

| Game role | Current blockout | Reference asset disposition | Admission rule |
|---|---|---|---|
| Signal-station architecture | Original modular wall/floor/door geometry | No reference map or scene suitable for automatic reuse. | Preserve authored room/collision plan; a legally cleared small material may enhance it later. |
| Hero mechanics | Original receiver/cabinet/isolator/radio/lens meshes | FPS2/Enari models remain blocked and do not match this civil-safety environment. | A replacement must be one approved prop with source record and same interaction proxy. |
| Sentries/tool | Original simple procedural meshes | FPS2 weapons and Asset Kit Flat Guns are blocked/rejected. | Only adopt a legal, visually coherent, low-budget model after target-renderer review. |
| Sound | Procedural Web Audio feedback | GitHub sound effects are all blocked. | Add only per-clip original source/licence/attribution plus in-context mix test. |
| Surface quality | Original procedural temporary materials | Asset Kit textures have unverified aggregate provenance. | Independently source and inspect a small matched PBR material family; no bulk copy. |

## Candidate manifest contract

```json
{
  "id": "mat-signal-concrete-001",
  "status": "candidate | approved | rejected",
  "original_url": "required",
  "creator": "required",
  "license": "required exact text/version",
  "credit": "required unless licence says otherwise",
  "source_file_sha256": "required on download",
  "role": "floor | wall | prop | sound | weapon | animation",
  "room_ids": ["R1"],
  "bytes": 0,
  "triangle_count": 0,
  "texture_dimensions": [],
  "review": {"legal": false, "technical": false, "visual": false, "browser_performance": false}
}
```

Only `approved` records whose four review booleans are true can ship. Current approved
count is **zero**. This is intentional and safer than a rushed, visually incoherent asset
merge.
