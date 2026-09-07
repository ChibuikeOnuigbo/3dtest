# Research index — new browser 3D game

This directory is the evidence ledger for a new, small, polished Three.js browser game.
It is deliberately separated from production source. Reference repositories live only in
`research/github_repos/` and are Git-ignored; their code, models, media and node_modules
must never be copied wholesale into the runtime.

## Current phase ledger — 2026-09-04

| Phase | Status | Evidence / consequence |
|---|---|---|
| 1. Video research | **Blocked, honestly recorded** | `yt-dlp` processed 11 unique supplied URLs exactly once for metadata/captions/thumbnails without retaining video. All hit TLS EOF failures. No video image, transcript or inferred visual claim exists. |
| 2. Feasibility-first concept | **In progress** | Candidate story concepts must remain contingent on asset/provenance research. |
| 3. GitHub research | **In progress** | Five shallow research-only checkouts: Enari, CSS-3D-Dungeon, FPS2, threejs-fps-tps-starterkit-advanced, fps-asset-kit. |
| 4. Architecture extraction | **In progress** | System-pattern decisions will be based on the studies, not direct code copies. |
| 5. Asset research | **Not started** | No Sketchfab/itch.io/environment asset is cleared or may enter production. |
| 6+. Blockout through final QA | **Not started** | No game build, QA score, quality score, or Playwright game image exists. |

## Integrity rules

- Do not call an asset usable because it is present in a reference repository. Verify its
  original source, exact license, attribution requirements, use, technical fitness and
  visual fit separately.
- **No Kenney asset or Kenney-derived visual style** is allowed.
- Generated diagrams and static checks are research aids, never browser QA.
- Playwright screenshots may only be called QA evidence when created during an actual
  browser run; failures to provision a browser are blockers, not test passes.
- An unverified room, interaction, weapon, collision surface or visual space cannot be
  rated 90% or marked approved.

## Key records

- Video pipeline/index: [`videos/source_index.json`](./videos/source_index.json),
  [`video_analysis/MASTER_VIDEO_RESEARCH.md`](./video_analysis/MASTER_VIDEO_RESEARCH.md)
- Initial technical source studies: [`github/`](./github/)
- Architecture lessons: [`architecture/PATTERN_LIBRARY.md`](./architecture/PATTERN_LIBRARY.md)
- Future visual and story decisions: [`VISUAL_TARGET.md`](./VISUAL_TARGET.md),
  [`story/`](./story/), [`DECISIONS.md`](./DECISIONS.md)
- QA policy and blocking browser evidence: [`../qa/`](../qa/)
