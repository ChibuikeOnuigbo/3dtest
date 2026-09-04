# Repository study — FPS2

**Specimen:** `Parking-Master/FPS2`, shallow checkout
`f8a2997798a969deb546ef5b6014cc031b04b01d`. **Scope:** static source/media inspection,
not a runtime pass. The full prior trace is [`fps2_source_study.md`](./fps2_source_study.md).

| Aspect | Verified finding | Adoption decision |
|---|---|---|
| License/provenance | Root source `LICENSE` is MIT, but README identifies third-party Sketchfab, Mixamo and other media relationships. | Code/media are not automatically transferable; no reuse. |
| Build/entry | No package-managed build found. `src.html` contains a 3,032-line inline runtime and uses remote Three.js/loader scripts; `server.js`/Gametime messaging support online behavior. | Reject monolithic HTML and remote-unpinned runtime dependencies. |
| Render/graphics | Three.js world with fog/sky/effects, local GLTF/GLB media and CSS/DOM HUD. | Keep the lesson that readability needs fog/lighting restraint, not its implementation/assets. |
| Camera/input | Pointer lock, keyboard/mouse/gamepad paths and FPS mechanics are present in `src.html`. | Build one normalized input map, pointer-lock recovery and remappable action semantics. |
| Player/collision | Traversal repeatedly creates `Box3` bounds from objects and keys collision partly on names such as container/cube. | Reject this expensive/fragile name-based collision approach. |
| Weapons | 11 boot-loaded weapon GLBs, firing/reload/ammo/HUD pathways and sound names are referenced. | Inventory only. New game should have a smaller explicit weapon set and a single weapon authority. |
| Maps/levels | Four independent map `scene.gltf` files are selected at initial startup via `?map=`; no live seamless map change path was found. | Reject URL map swapping for a short single mission; use one persistent mission state/room zones. |
| Interactions/state | Multiplayer/Gametime, lobby/preferences/help, match timers/kill behavior and DOM state appear. No suitable small narrative objective/door state architecture was found. | Do not inherit online complexity. Implement deterministic local mission state. |
| Animation/audio/UI | GLTF animation uses external media; 39 audio files are present; overlays include menu/loadout/reticle/vignette and game UI. | All media/UI blocked. Design original accessible HUD/audio feedback. |
| Performance/QA | Heavy eager asset boot and repeated bounds are visible. No audited build or browser performance/QA test suite was found. | Put asset loading, collision counts and console assertions under future QA. |

## Exact FPS2 asset disposition

Machine record: [`fps2_inventory.json`](./fps2_inventory.json),
[`fps2_runtime_registry.json`](./fps2_runtime_registry.json). It contains 239 files,
979,866,236 bytes, 26 model-format files, 134 images and 39 audio files. The registry
accounts for every model: 11 boot weapon GLBs, four selected map glTFs, nine
support/character/effect/vehicle models, and two Forge props. Boot weapon names are
Assault Rifle, Desert Eagle, Sniper Rifle, Rail Gun, P90 SMG, Grenade Launcher, Remington
Shotgun, Rocket Launcher, Nuke Launcher, 9mm Pistol and Odd Ball; combined GLB size is
204,946,908 bytes. **Every one is BLOCKED**: original provenance/license and visual
fitness are not individually cleared. Loading a model in FPS2 does not prove it is a
suitable usable weapon.

## Independent lessons

- A guns-first asset haul is not a coherent small story game.
- Asset counts must be measured and gated; loading every asset up front is a bad default.
- Collision, door and objective rules need data ownership instead of magic mesh names or
  browser URL parameters.
- A single playable critical path is preferable to networking, editor and match systems
  that the chosen story does not need.
