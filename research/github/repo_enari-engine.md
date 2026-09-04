# Repository study — Enari Engine

**Specimen:** `iErcann/enari-engine`, shallow checkout `b2e17ff75e66f25e57358482ce2d2cc84aeca20e`.
**Scope:** source inspection only; the application did not install or run. `npm ci` stopped at
a verified TLS certificate error while obtaining a dependency, and no TLS protection was
weakened. Detailed earlier trace: [`enari_engine_source_study.md`](./enari_engine_source_study.md).

| Aspect | Verified finding | Adoption decision |
|---|---|---|
| License/provenance | Root `LICENSE` is MIT for code; README credits separately sourced models/maps/media. | Source concepts only. No bundled code/media is approved for copying. |
| Build/entry | TypeScript + Vite 5; `src/main.ts` initializes Ammo, preloads, builds `Game`, starts the loop. Dependencies include Three r164, Ammo, nebula/CSM/Tweakpane. | Use an independently authored, small Vite/Three structure only after architecture choice. |
| Render/graphics | One WebGL renderer, optional composer, PCF shadows, tone mapping, world scene plus a depth-cleared viewmodel renderer. | Extract the *separate viewmodel/world pass* idea; avoid default costly effects. |
| Camera/input | Document pointer-lock state, YXZ FPS yaw/pitch camera, action-like keys/mouse binding. | Adopt the principle: one input service and camera ownership boundary. |
| Player/collision | Dynamic upright capsule in Ammo; ground queries and yaw-relative movement; static map triangle collider generated from render mesh. | Reject render-mesh-as-collision. Create authored coarse collision volumes and deterministic motor tests. |
| Weapons | Key-selected FPS meshes, visual clip-marker sidecars, ray hit effects; reload is visual rather than authoritative gameplay state. | Use a data-driven weapon state machine, separate from animation. No model/clip reuse. |
| Levels/interactions/state | Baked `pool_day_baked.glb` is hard-coded; `Spot*` names create lights. No verified objective, door, interaction, local persistence or save system found in `src/`. | Keep room/door/objective state explicit data, not inferred from model names. |
| Animation/audio/UI | `AnimationMixer` handles viewmodel/character clips. Audio loader code is partly commented. UI is loading/FPS/crosshair focused. | Reuse neither. Require user-gesture audio unlock, real mix behavior and legible objective UI. |
| Performance/QA | dt is clamped to 20 ms and shadows are periodically refreshed; no project browser run/QA evidence was collected. | Use measured quality tiers and Playwright performance/console checks later. |

## Graphics and asset ledger

Inventory scan: 97 files / 26,461,044 bytes / 12 model-format files / 10 images / one
audio file ([`enari_inventory.json`](./enari_inventory.json)). Named content includes a
baked pool world, three first-person meshes, RobotExpressive, a shell, texture images and
a loading sound. README attributions include non-commercial/share-alike content. Root MIT
cannot clear those files. Each is **BLOCKED** for production; no compatibility/visual
inspection equals no eligibility.

## Useful independent patterns

1. Centralize asset manifests and report individual load errors.
2. Keep fixed/safe simulation timing distinct from render timing.
3. Keep world geometry and first-person viewmodel depth/render concerns separate.
4. Make authored semantic metadata explicit, but do not let arbitrary artist node names
   become the game state schema.

## Risks / gaps

The project mixes a rich physics stack, global mutable game object, hard-coded boot
assets and gameplay/view timing. It is not a small-game base. No multiplayer, save,
objective, door or interaction system was verified; it must not be credited with them.
