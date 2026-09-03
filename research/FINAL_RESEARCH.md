# Final Research Summary — Current Build

## What changed the design
- Video research supported a simple arrival, spatial repair logic, landmark lighting and stateful sound. Available public transcripts/metadata were used; inaccessible temporal frames were not invented.
- The five requested GitHub repositories were cloned and rated. Enari supplied the strongest module-boundary lesson; the starterkit supplied the strongest collision recovery concept; CSS Dungeon demonstrated finite-quest pacing; fps-asset-kit supplied upstream PBR source leads; FPS2 illustrated what monolithic remote-dependency architecture to avoid.
- Current Three.js study reinforced `Raycaster` for interaction and `AnimationMixer` as the right architecture where imported clips exist. The selected game has no imported skinned model, so mechanical transform animation is technically correct.

## Why the final environment was selected
A coastal weather relay supports concrete/metal/wood PBR surfaces, purposive equipment, a narrow but memorable route and a convincing final signal beacon without outdoors/foliage/characters. Sketchfab candidates were evaluated but rejected (blockout, high pre-validation geometry or incompatible low-poly style). This is documented in the candidate and rejection logs.

## Why the final story was selected
It has a clear public-service purpose, three logical physical tasks, visible world-state changes, a five-room ceiling and a binary, testable ending. It scored 90/100 across feasibility criteria. It is intentionally not a bunker or a derivative horror-game plot.

## Why the architecture was selected
Vite + vanilla ES modules + Three.js lets the runtime stay small and transparent. Explicit `GameState`, interaction records, named collision volumes and mechanical transforms prevent competing state/physics/animation systems. See `architecture/PATTERN_LIBRARY.md`.

## Asset and animation conclusion
Three selected ambientCG CC0 PBR surface families form the verified external asset set; they were reduced to max 1024px and inspected. No unverified/huge downloaded scene is hidden in production. Animation uses original door, lever, fuse, dial and beacon transforms; no skeleton capability is claimed.

## Unresolved evidence
The sandbox prevented video media/frame downloads and Playwright's Chromium download via TLS resets. Browser-level playthrough, visual screenshots and performance FPS remain explicitly blocked—not marked as complete.
