# Read-only GitHub reference asset forensics

## Scope and hard boundary

All five supplied GitHub repositories have been freshly shallow-cloned under the ignored
`research/github_repos/` laboratory. The scan covers every locally present model, image,
audio, font and archive there without extracting/merging/copying their media into
production. The machine-readable source-of-truth is
[`asset_forensics.json`](./asset_forensics.json); it includes path, file size, SHA-256,
readable image/audio/model metadata and a per-item **BLOCKED** status.

"Collect and merge all asset folders" is not a legal or design-valid step: the root
repository licence does not necessarily cover media, and merging an 1.4 GB reference
library would violate the project’s per-asset provenance, cohesion and performance gates.
This report instead creates the required evidence to make a later, selective decision.

## Complete scan result

| Reference checkout | Asset records | Models | Images | Audio | Fonts / archives | Media bytes | Production result |
|---|---:|---:|---:|---:|---:|---:|---|
| CSS-3D-Dungeon | 49 | 0 | 25 | 23 | 1 / 0 | 6.34 MB | BLOCKED — built bundle has no per-asset upstream ledger; wrong fantasy/cartoon visual language. |
| FPS2 | 207 | 26 | 134 | 39 | 7 / 1 | 856.6 MB | BLOCKED — source MIT does not clear credited third-party models/media; maps/weapons are not a coherent outpost kit. |
| Enari Engine | 21 | 12 | 8 | 1 | 0 / 0 | 25.5 MB | BLOCKED — external asset credits include incompatible terms; maps/weapons do not match the game. |
| FPS Asset Kit | 343 | 86 | 163 | 94 | 0 / 0 | 908.3 MB | BLOCKED — no local licence/credit files; readme assertion is insufficient. “Flat Guns” additionally rejected as stylized/toy-like. |
| Three.js FPS/TPS starter | 0 | 0 | 0 | 0 | 0 / 0 | 0 | No local assets; remote sample media is not cleared. |
| **Total** | **620** | **124** | **330** | **157** | **8 / 1** | **~1.80 GB** | **0 approved** |

The scan also analyzes the FPS2 desktop ZIP without unpacking it. No archive content was
introduced into this repository.

## Geometry / wireframe evidence

The script parses glTF/GLB JSON chunks, including mesh primitives, accessors, estimated
triangle count, material slots, node count and animation count. It does not invent an
estimate for OBJ/FBX/BLEND formats it cannot reliably parse.

| Repository | Parsable models | Estimated triangles | Largest observed geometry | Consequence |
|---|---:|---:|---|---|
| FPS2 | 26 / 26 | 1,450,934 | `models/weapons/Desert_Eagle.glb`: 486,104 triangles; max character map: 185,024 | Reference startup/preload is too heavy for a compact browser mission. No direct reuse. |
| Enari | 9 / 12 | 61,970 | `public/fps_mine_sketch_galil.glb`: 14,091 | Geometry is modest but attribution/visual suitability still blocks every model. |
| FPS Asset Kit | 20 / 86 | 45,487 | `Rifle_Assault_West.glb`: 4,353 | Only GLB variants can be inspected by this no-extract scan; stylized weapon visual language is rejected. |
| CSS-3D-Dungeon | 0 | 0 | CSS transformed 2D content | Not a 3D asset source. |

The actual current game uses no item from these counts. Its geometry is independently
created in `src/world/`, so every collision proxy and interaction remains readable and
modifiable rather than tied to third-party mesh names.

## Asset-use structure (future, selective only)

| Proposed production role | Current candidate source | Status | Required approval before use |
|---|---|---|---|
| Structural walls/floors/doors | Original modular geometry | In game blockout | Browser visual/collision review; material refinement. |
| Hero console/generator/lens/sentry | Original geometry | In game blockout | Visual review and performance measurement. |
| PBR surface materials | Independently sourced original pages only, later | No candidate approved | Exact original URL/licence, hash, source credit, size/channel/UV check and in-game room screenshot. |
| First-person pulse tool | Original procedural prototype | In game blockout | Gameplay/feedback/visual review; no automatic imported weapon substitution. |
| Sound/music | No third-party audio selected | None | Original source/licence and user-gesture/mix/playthrough test. |

An approved future record must point to its original source and a copied, legally obtained
file in this game only after the asset intake gate. It may not point back into a
GitHub-reference folder as a runtime dependency.

## Rejections and non-negotiables

- No source model, weapon, map, texture, UI, sound, font, animation or code gets an
  approval merely because it was in a user-provided repository.
- No FPS2 media, CSS-Dungeon media, Enari media, or starter remote sample may be merged.
- No FPS Asset Kit flat weapon is suitable for this game’s intended believable visual
  target, regardless of any future provenance outcome.
- No Kenney material is allowed.
- Asset visual inspection happens in the target renderer at player height. A parse result,
  file hash or static thumbnail is traceability, not a quality score.
