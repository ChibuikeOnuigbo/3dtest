# Five-reference comparison and adoption matrix

This is a **research-suitability** score based on files inspected on 2026-09-04. It is
not a game-quality, performance, browser, security or visual score; none of the five
specimens was run in this environment. “Pattern value” means an idea can be independently
reimplemented, not copied.

## Weighted comparison

| Rank | Reference | Maintainable architecture /25 | Relevant systems /25 | Small-game scope fit /20 | Asset/provenance confidence /20 | QA/ops evidence /10 | Total /100 | Decision |
|---:|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Enari Engine | 17 | 20 | 11 | 3 | 2 | **53** | Pattern source only; useful modular boundaries but too coupled/asset-laden. |
| 2 | Three.js FPS/TPS starter | 12 | 20 | 16 | 1 | 1 | **50** | Pattern source only; excellent capsule/octree lesson, inadequate licensing/build/scoping. |
| 3 | CSS-3D-Dungeon | 9 | 17 | 15 | 2 | 1 | **44** | Interaction/pacing evidence only; wrong renderer and built-only source. |
| 4 | FPS2 | 4 | 18 | 4 | 2 | 1 | **29** | Comparative anti-pattern plus weapon/media inventory; no adoption. |
| 5 | FPS Asset Kit | 0 | 4 | 8 | 2 | 0 | **14** | Intake/provenance lesson only; no runtime and rejected flat weapons. |

### Scoring rationale

- **Enari** has a source tree, TypeScript/Vite organization, physics/render separation and
  asset manager, but global/hard-coded content plus third-party media make it unsuitable
  as a base. Its installation was not possible without breaking TLS.
- **Starter** exposes the fewest moving parts that demonstrate robust movement/camera
  ideas. It has no root license and uses remote imports/sample media; its inline-page
  shape is deliberately not adopted.
- **CSS-3D-Dungeon** gives unusually concrete proof that interaction zones, prompt
  lifecycle, task progression and room audio can create a compact route. Its CSS
  pseudo-3D renderer and minified build are intentionally excluded.
- **FPS2** provides the required deep FPS comparison and asset inventory, but a giant
  inline runtime, eager loading, URL map switches, external dependencies and third-party
  content conflict with the new game's needs.
- **FPS Asset Kit** establishes why aggregate README assertions are not an asset ledger.
  Its “Flat Guns” are aesthetically rejected and it contains no gameplay code.

## Requirement coverage matrix

| New-game requirement | Strongest evidence | Rejected/reference caution | Independent production requirement |
|---|---|---|---|
| Pointer lock / action input | Enari, Starter, CSS Dungeon | FPS2 combines many paths in a monolith. | Input service owns focus/lock, actions and UI pause states. |
| First-person motor / collision | Starter capsule-octree; Enari capsule physics | FPS2 object bounds/name matching. | Swept kinematic capsule against authored static colliders. |
| Camera | Enari FPS separation; Starter obstruction ray | No need to ship TPS mode. | First-person only, no unused dual-controller scope. |
| Door and interaction flow | CSS Dungeon activation/prompt/task callbacks | Proximity must not auto-complete actions. | Focus ray + semantic range proxy + explicit state transition. |
| Objectives / ending | CSS Dungeon task/portal sequence | Neither FPS controller demo provides narrative state. | Finite data-driven mission state with a real terminal ending. |
| Weapons | Enari state/clip markers conceptual only | FPS2 media/all weapons blocked; asset kit flat weapons rejected. | Small authored data set; later only individually cleared visual/audio assets. |
| Animation | Starter crossfade concepts; Enari mixer/markers | Sample/third-party clips cannot be carried over. | Only implement animation promised by actual approved assets. |
| Audio/UI | CSS Dungeon feedback layering | Do not reuse bundled sound/UI. | Web Audio unlock, category gain, captions/subtitles and semantic HUD. |
| Rendering/performance | Enari viewmodel pass; Starter substeps | Expensive postprocessing/eager assets. | Zone manifest, local dependency, measured tiers and device-safe defaults. |
| QA | No specimen gives sufficient evidence. | Static source review is not a test. | Browser/Playwright critical path, screenshots, console and performance logs. |

## Non-negotiable adoption record

No source files, copied controls, GLTFs, images, textures, animation clips, UI artwork,
audio, fonts, levels, maps, effects, scripts, downloaded repo releases or dependency
bundles from the five repositories may ship in this game. The allowed output of this
study is the independently authored pattern library at
[`../architecture/PATTERN_LIBRARY.md`](../architecture/PATTERN_LIBRARY.md).
