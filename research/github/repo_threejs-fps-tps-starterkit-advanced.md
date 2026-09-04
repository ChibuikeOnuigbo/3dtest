# Repository study — threejs-fps-tps-starterkit-advanced

**Specimen:** `hugohamelcom/threejs-fps-tps-starterkit-advanced`, shallow checkout
`fae654e52eb18949f51dd0b8ac066938c3067317`. **Scope:** read-only code review; no
browser/runtime execution occurred.

| Aspect | Verified finding | Adoption decision |
|---|---|---|
| License/provenance | There is no root `LICENSE` file. README says MIT, but this assertion is not a repository license file; imported remote sample models have their own terms. | Do not copy code or media. Treat as pattern-only evidence. |
| Build/entry | Three files: `index.html`, `main.css`, README. An import map loads Three r0.174 and addons remotely from jsDelivr. | Reject remote CDN as release dependency; use pinned local package/dependency resolution later. |
| Render/graphics | WebGL renderer, shadows, fog/sky/day-night controls and debug Stats/GUI appear in one inline page. | Keep quality settings capability-driven. Reject unmeasured feature stacking/debug UI in production. |
| Camera/input | Pointer lock supports first/third-person toggle; camera obstruction uses a raycast. | Consider camera obstruction as future third-person-only contingency; chosen game will be first person, so do not pay for unused mode. |
| Player/collision | `Capsule` versus `Octree`, gravity, fixed substeps and collision response are explicit. | Most useful implementation pattern: independently make a swept capsule motor + static world query; test stairs, corners, door slabs and frame spikes. |
| Animation | `AnimationMixer`, action crossfades, idle/walk/run fallback and additive jump pose run on a remotely loaded Soldier GLB. | Extract action-state ownership/crossfade concept only; no remote/example animation or model. |
| Interactions/weapons/state | Physics spheres and camera modes are present; no authored doors, objectives, narrative interaction layer, persistence, meaningful AI, audio manager or save system were verified. | Do not expand scope from a controller demo into a copied game loop. |
| Performance/QA | Fixed substeps, Stats and GUI are developer tools; no unit/E2E suite or automated browser evidence was found. | Use a performance HUD only in dev; enforce future Playwright console/load/critical-path checks. |

## Asset / network conclusion

Inventory: just 3 repository files / 51,168 bytes, no local model/image/audio assets
([`threejs_fps_tps_starterkit_inventory.json`](./threejs_fps_tps_starterkit_inventory.json)).
The important external GLTF examples and CDN imports are remote dependencies, not
locally cleared production assets. They are **BLOCKED** from this game.

## Narrow takeaways

This is the clearest compact collision/animation reference, but its large inline page,
remote dependencies, dual camera scope and generic sample character make it a bad base.
Adopt only an independently written fixed-step collision architecture and an explicit
animation state interface if the final player/weapon art actually requires it.
