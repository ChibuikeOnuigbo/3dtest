# Repository study — FPS Asset Kit

**Specimen:** `petroulacl/fps-asset-kit`, shallow checkout
`a19b7458a593598211c95ec46ef4eb4b6d1f94d7`. It is an asset aggregate, not a runtime;
there is no player, camera, collision, interactions, level, game state, renderer, UI,
animation controller or QA suite to evaluate.

| Aspect | Verified finding | Adoption decision |
|---|---|---|
| License/provenance | No root `LICENSE` or individual credit/license file is present. README asserts CC0/equivalent and names ambientCG/OpenGameArt sources, but that is not per-file provenance evidence. | Entire checkout remains blocked pending original-source verification of each candidate. |
| Build/runtime | README plus two downloader scripts; no game entry/build/package. | Not a code reference. Do not run downloader scripts or bulk-import. |
| Graphics assets | README describes 24 PBR texture sets and four HDRIs; checkout inventory finds 163 images and 553,710,828 texture bytes. Expected `hdris/` content is absent from local tree. | Potential texture candidates only after direct original license + resolution + visual review. No HDRI is available/cleared. |
| Weapon models | 20 “Flat Guns” packs in GLB/FBX/OBJ forms, 86 models total. | **Rejected:** explicitly flat/stylized/toy-like visual direction conflicts with the visual target. |
| Audio | 94 audio files / 345,400,488 bytes; README claims firearm/footstep sources. | Blocked until each original source/terms/version is verified and an actual gameplay mix test passes. |
| Animation | FBX files are described as rigged; no independent clip/rig inspection was completed. | No animation claim or adoption. |
| Performance/QA | Total is 908,476,679 bytes across 442 files. There is no load budget, compression report, runtime test or attribution export. | Bulk import rejected. Any future approved source must have a byte budget/manifest/license entry. |

## Strict asset disposition

No asset from this repository goes to production now. Texture/source candidates, if
independently verified at original ambientCG pages, must receive an asset ID, original
URL, exact license text/version, local-file hash, material role, texture-size budget and
visual coherence review. Weapon files are rejected even if their upstream CC0 assertion
later proves accurate because provenance clearance and aesthetic suitability are separate
requirements.

## Useful process finding

A README that says “all CC0” is insufficient evidence for a release credit/license
ledger. It is an intake lead, not authorization. The project will prefer a small coherent
set over an unbounded 900 MB aggregate.
