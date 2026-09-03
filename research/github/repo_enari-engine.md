# enari-engine — Repository Study

- **Source:** https://github.com/iErcann/enari-engine
- **Pinned research head:** `b2e17ff`
- **Repository footprint:** ~38 MB / 124 files
- **License:** MIT, copyright 2024 iercan (repository code). Individual bundled assets carry their own terms as listed in README.
- **Rating for The Last Signal:** **7.0 / 10**

## Summary / architecture
TypeScript/Vite Three.js FPS engine arranged into `Core`, `Controller`, `Input`, `Physics`, `View` and `Game`. `main.ts` initializes Ammo, calls a global loader, creates the game and runs one requestAnimationFrame loop. `Game.update()` caps timestep at 20ms and updates player, input, actors, physics and rendering in that order.

## Player / camera / movement
`PlayerController` delegates movement/jump/shoot actions to `Player`. `FPSCameraManager` places camera at player position plus eye offset, calculates direction from camera quaternion and uses YXZ Euler mouse look. This camera-body separation is a good pattern. Input-to-movement detail belongs in other classes, so it should not be assumed complete merely from public methods.

## Collision / level
Ammo handles physics. `MapMesh.addPhysics()` traverses every map render mesh and creates a trimesh collider. That is convenient for imported maps but potentially expensive and brittle for a small authored world; `Game.setPhysicsObjects()` also adds individual cube actors. We adapt the separation of render/collision, **not automatic trimesh collision for all meshes**.

## Asset loading / graphics
`GlobalLoadingManager` centralizes GLTF loading and configures Meshopt and DRACO loader objects. It then serially loads player, map, weapons and bullet into a registry. Map code adds fake spotlights based on node names. This supports the principle of a loader/registry and named authored metadata. Weaknesses: all content is eagerly loaded; error callback logs but never rejects, risking unresolved load promises; Draco decoder path is commented out.

## Animation / audio / UI
Contains `AnimationMixer`-related mesh classes, first/third person player rendering and an `AudioManager`; README demonstrates weapon animation support. Tweakpane Debug UI and CSM/particle dependencies make the engine broader than this project needs. We will use deterministic transforms instead of copying weapon/character animation logic.

## Performance / QA
Uses capped delta and Meshopt hook; `three-csm`, `three-nebula`, Tweakpane and Ammo add substantial dependency/complexity. No focused test suite was found. Current dependencies include Three `^0.164.0`, which should not dictate our current dependency version.

## Asset/license warning
The README credits some Sketchfab assets and explicitly names a Kenney environment asset. **Those assets are banned for this project and are not used.** Individual reference assets are not covered by the repository MIT code license.

## What is good
- Sensible module boundaries and one top-level game loop.
- Player/camera separation and bounded time step.
- GLTF loader registry concept; Meshopt-aware loading.
- Explicit renderer/player modes instead of scattered rendering logic.

## What is bad / should not copy
- Old Ammo physics stack and broad feature set are unnecessary for five rooms.
- Per-render-mesh trimesh generation is unsuitable for our deliberate AABB collisions.
- Eager load-all and non-rejecting loader error path are reliability risks.
- Kenney assets cannot be reused.

## Adaptation
Write new small ES modules: `PlayerController`, `World`, `InteractionSystem`, `ObjectiveSystem`, `AudioSystem`, `UI` and `GameState`. Use `requestAnimationFrame`, capped delta and data registries. No source file is copied.
