# Enari Engine — source-level study

**Research-only record.** Inspected local shallow checkout `iErcann/enari-engine` at
`b2e17ff75e66f25e57358482ce2d2cc84aeca20e` (commit date 2025-07-10). This is a
source-reading result, not a claim that the reference game was run. The reference
project and every source asset remain in ignored `research/github_repos/enari-engine/`.

## Evidence and scope

- Repository code is MIT (`LICENSE`, copyright 2024 iercan). Its README separately
  identifies Third Party source code and individual asset attributions. That makes the
  code license **insufficient on its own** to clear the bundled maps, weapons,
  character, or media for a new game.
- Technology: TypeScript, Vite 5, Three r164, `ammojs-typed`/WASM, `three-nebula`,
  tweakpane, meshopt/Draco loader plumbing, and optional postprocessing. See
  [`package.json`](https://github.com/iErcann/enari-engine/blob/b2e17ff75e66f25e57358482ce2d2cc84aeca20e/package.json).
- Boot order is explicit: initialize Ammo → preload meshes → instantiate game → start
  `requestAnimationFrame` loop ([`src/main.ts:4–14`](https://github.com/iErcann/enari-engine/blob/b2e17ff75e66f25e57358482ce2d2cc84aeca20e/src/main.ts#L4-L14)).

## Verified system map

| System | What the source actually does | Useful pattern | Do **not** carry forward unchanged |
|---|---|---|---|
| Game frame | `Game.update()` clamps dt to 20 ms, calls player pre-step/input, actor updates, player physics, Bullet step, then renderer ([`Game.ts:103–118`](https://github.com/iErcann/enari-engine/blob/b2e17ff75e66f25e57358482ce2d2cc84aeca20e/src/Game.ts#L103-L118)). | Explicit subsystem ordering and a dt cap. | The chosen order is not a proof of ideal collision timing; write deterministic fixed-step simulation with tested interpolation for the new game. |
| Asset boot | A global manager sequentially loads the character, `pool_day_baked.glb`, three first-person meshes, and a shell; it supports Meshopt and a Draco loader ([`GlobalLoadingManager.ts:31–84`](https://github.com/iErcann/enari-engine/blob/b2e17ff75e66f25e57358482ce2d2cc84aeca20e/src/View/Mesh/GlobalLoadingManager.ts#L31-L84)). | Central manifest + `LoadingManager` progress/error channel. | Do not hard-code asset paths or serially block the full game on everything. Use a typed, license-gated manifest with per-zone asynchronous loading and failure UI. |
| World/map | `MapMesh` hard-codes `pool_day_baked.glb`; every mesh child is turned into a static Bullet triangle-mesh collider; `Spot*` nodes become fake lights ([`MapMesh.ts:16–65`](https://github.com/iErcann/enari-engine/blob/b2e17ff75e66f25e57358482ce2d2cc84aeca20e/src/View/Mesh/MapMesh.ts#L16-L65)). | Named authoring nodes can feed runtime metadata. | Do not use render mesh nodes as universal collision or infer gameplay names. New maps need explicit lightweight collision/portal/spawn/door layers. |
| Player/motor | A dynamic upright capsule uses ground raycast/contact testing; movement direction comes from yaw-projected view direction; shooting fires a 10,000-unit Bullet ray and applies impulse ([`Player.ts:76–281`](https://github.com/iErcann/enari-engine/blob/b2e17ff75e66f25e57358482ce2d2cc84aeca20e/src/Core/Player.ts#L76-L281)). | Capsule, yaw-relative movement, ground query, hitscan query are valuable primitives. | The player body disables normal gravity then manually subtracts vertical velocity; input `speed` is not consumed by controller movement. Reimplement and test a clear motor contract. |
| Input/camera | Pointer lock is tracked on the document; rotation is sent to an FPS camera using YXZ Euler order. WASD, Shift, jump, weapons, reload, and zoom are routed in `InputManager` ([`InputManager.ts:45–174`](https://github.com/iErcann/enari-engine/blob/b2e17ff75e66f25e57358482ce2d2cc84aeca20e/src/Input/InputManager.ts#L45-L174)); mouse sensitivity is `0.0015` and pitch clamped ([`FPSCameraManager.ts:31–57`](https://github.com/iErcann/enari-engine/blob/b2e17ff75e66f25e57358482ce2d2cc84aeca20e/src/View/CameraManager/FPSCameraManager.ts#L31-L57)). | Action-level input layer, pointer-lock state, yaw/pitch separation. | `Shift` selects 30 while nominal player speed is 100 and the controller ignores its speed argument, so it is not a trustworthy sprint implementation. New sprint must be stateful, stamina-aware if used, and browser-tested. |
| Weapons/animation | Key 1/2/3 replace `FPSMesh`; left mouse calls hitscan and renderer effects; reload only invokes visual animation. First-person mesh uses sidecar JSON marker ranges and an `AnimationMixer` ([`AnimatedLoadableMesh.ts:35–126`](https://github.com/iErcann/enari-engine/blob/b2e17ff75e66f25e57358482ce2d2cc84aeca20e/src/View/Mesh/AnimatedLoadableMesh.ts#L35-L126)). | Data-described weapon definitions and animation state gates. | No production weapon reuse. Also do not couple ammo/reload rules solely to view animation; model authoritative weapon state independently. |
| Rendering | One WebGL renderer manages a world scene, optional composer passes (bloom/SSAO/lens), shadows, debug UI, and a separate viewmodel renderer. Default config has postprocessing off and `legacyViewmodel: true` ([`Renderer.ts:36–59,99–180`](https://github.com/iErcann/enari-engine/blob/b2e17ff75e66f25e57358482ce2d2cc84aeca20e/src/View/Renderer/Renderer.ts#L36-L59)). | Separate world and viewmodel passes with depth clear; capability-driven quality settings. | Do not make expensive post effects or per-frame debug setup a baseline. Establish a measured device budget first. |
| Lighting/audio/UI | The renderer uses configurable tone mapping, PCF soft shadows, sRGB output, periodic shadow refresh, sky/particle hooks; audio class currently has its shot-buffer loading commented out. HUD is loading overlay + FPS + crosshair ([`SceneLighting.ts`](https://github.com/iErcann/enari-engine/blob/b2e17ff75e66f25e57358482ce2d2cc84aeca20e/src/View/Renderer/SceneLighting.ts), [`AudioManager.ts`](https://github.com/iErcann/enari-engine/blob/b2e17ff75e66f25e57358482ce2d2cc84aeca20e/src/View/Audio/AudioManager.ts)). | Central quality configuration and minimal HUD layering. | Build a real audio unlock/mix/effects system; do not describe a commented loader as working audio. |
| Network/save/state | Search of `src/` found no WebSocket/socket transport, `localStorage`, `sessionStorage`, IndexedDB, interaction/door/objective state, or save implementation. The only `fetch` is loading animation-marker JSON. | Keep local mission state data-driven from day one. | Do not infer multiplayer, persistence, doors, objectives, or save support from this reference. |

## Reference asset inventory

The local structural scan counted 12 model-format files, 10 images, and one audio file
(26.5 MB total source-tree footprint). Notable GLBs include the `pool_day_baked` map
(8,168 indexed triangles) and first-person model variants. `RobotExpressive.glb` has
14 clips. The three first-person weapon/viewmodel files have two clips each, with
sidecar marker JSON used to delimit semantic segments. The full machine-readable record
is [`enari_inventory.json`](./enari_inventory.json).

README-attributed source assets include Pool Map (Vince_Crusty), Minecraft Pickaxe
(LeoPasc02), Minecraft Wood Shop & Mill (CC BY-NC-SA), Backrooms Another Level (CC BY),
and Meat Monster (CC BY). They are all **excluded from production** pending individual
asset and license decisions; the NC-SA source is incompatible with a permissively
licensed/reusable game asset path.

## Architecture decision from this study

The new browser FPS should borrow only the *patterns*: modular boot stages, one
player-motor boundary, a separate viewmodel render pass, glTF loader error handling,
and authored map metadata. It should be independently implemented with a typed mission
state, static authored collision volumes, portal-aware interior/exterior zone activation,
central weapon state, and visual/Playwright proof. No Enari runtime code, maps, models,
textures, UI, sounds, or animation data has been copied or approved.
