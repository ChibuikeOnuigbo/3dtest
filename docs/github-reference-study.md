# GitHub Reference Study — Ranked Top 3 + Two Additional Repositories

**Date:** 2026-09-03  
**Scope:** The five repositories requested by the user were shallow-cloned into the ignored local research laboratory at `research/github_repos/`. They were inspected there only; no source or asset was copied into the game. The research checkouts are intentionally excluded from Git because they total roughly 3.1 GB.

## Ranking outcome

Scores rate **fit for this small atmospheric, non-combat Three.js game**, not the repositories' worth as projects. A score accounts for current maintainability, clarity, verified license, technical relevance, runtime independence and visual/asset fit.

| User research order | Repository | Evidence-based score | Verdict |
|---:|---|---:|---|
| 1 | `petroulacl/fps-asset-kit` | **5.8 / 10** | Useful provenance leads for CC0 PBR surfaces and sound; not an engine and its flat weapon aesthetic is unsuitable. Do not import its 1.6GB library wholesale. |
| 2 | `MeroVinggen/CSS-3D-Dungeon` | **4.1 / 10** | Complete small quest/UI pacing is worth studying; CSS transforms and bundled/minified implementation do not fit a Three.js runtime. |
| 3 | `iErcann/enari-engine` | **7.0 / 10** | Strongest modular Three.js reference among the first three. Learn system separation, GLTF loader configuration and physics concepts; do not inherit old Ammo stack or its Kenney assets. |
| 4 | `Parking-Master/FPS2` | **2.8 / 10** | A feature inventory, but monolithic legacy HTML, remote dependencies and large unverified asset footprint make it a poor technical base. |
| 5 | `hugohamelcom/threejs-fps-tps-starterkit-advanced` | **6.2 / 10** | Best direct movement/collision reference: Three.js `Octree` + `Capsule`, OOB recovery and delta clamping. Must be decomposed; its all-in-one HTML is not adopted. |

### Final selection of patterns

1. **Player collision:** Adapt the *idea* of the starter kit's capsule/Octree separation, but use authored axis-aligned collision volumes for this compact world instead of building an Octree from every render mesh.
2. **Module boundary:** Take Enari's separation of input, player, render and asset loading as an architectural principle—not its code or Ammo integration.
3. **Interaction/UI pacing:** Adapt CSS Dungeon's compact goal/prompt feedback principle, with an original DOM UI.
4. **Asset discipline:** Use the fps-asset-kit's stated upstream CC0 PBR provenance only after independently recording the upstream license. Adopt only three selected texture sets; no weapons.
5. **Do not use:** FPS2 architecture, remote runtime dependencies, copied gameplay, Kenney assets, and any reference assets without separately verified license.

## Study evidence

- Five repositories were cloned from their supplied URLs at shallow HEADs: `a19b745` (fps-asset-kit), `6544eb6` (CSS-3D-Dungeon), `b2e17ff` (enari-engine), `f8a2997` (FPS2) and `fae654e` (starterkit).
- Enari contains `package.json`, TypeScript source and an MIT LICENSE. It declares Three `^0.164.0`, Ammo, Draco/Meshopt imports and a Vite build.
- CSS Dungeon and FPS2 have MIT LICENSE files. CSS Dungeon ships a production bundle, not source modules.
- Starterkit's README **claims MIT**, but no root license file was present in the checkout; do not copy code until that claim is independently confirmed.
- fps-asset-kit has no repository license file; its README claims the listed upstream assets are CC0. Treat only the separately identified upstream assets—not the repository as a licensed code package—as candidate sources.

Detailed reports: `research/github/repo_*.md`.
