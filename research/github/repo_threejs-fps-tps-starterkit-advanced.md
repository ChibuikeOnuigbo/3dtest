# threejs-fps-tps-starterkit-advanced — Repository Study

- **Source:** https://github.com/hugohamelcom/threejs-fps-tps-starterkit-advanced
- **Pinned research head:** `fae654e`
- **Repository footprint:** ~175 KB / 30 files
- **License:** README says MIT, but no standalone license file was present in the cloned root. **License needs independent confirmation before source reuse.**
- **Rating for The Last Signal:** **6.2 / 10**

## Summary / architecture
A single `index.html` imports Three.js CDN modules and implements first/third-person control, GLTF world/player load, sky/day cycle, capsule/octree collision, spheres, player animation, debug GUI and stats. It is a useful executable reference but its one-file architecture conflicts with maintainability requirements.

## Player / camera / movement
The player has a `Capsule(start, end, radius)`, velocity, ground state and keys. Pointer Lock drives camera rotation with pitch clamps. `updatePlayer()` applies gravity/damping, translates capsule, resolves collision, updates camera and keeps a supplied third-person camera from clipping via octree raycast. `deltaTime` is clamped and simulation uses substeps. `teleportPlayerIfOob()` resets escaped players—an important recovery concept.

## Collision / level
A Three `Octree` is built from loaded collision-world graph via `worldOctree.fromGraphNode(gltf.scene)`. `worldOctree.capsuleIntersect(playerCollider)` resolves penetration and grounds player from surface normal. This is technically appropriate for a complex static GLTF world. Our small room graph will instead use explicit AABBs to make doors and navigation fully deterministic, retaining a reset if OOB.

## Assets / animation / lighting
Uses GLTFLoader from `three/addons`, imported character animation clips and `AnimationMixer` actions. It creates/uses walk-back by reversing a clip, makes an additive subclip for jump and blends actions. Lighting includes a full day-night Sky system, directional shadows and stars—impressive but overbuilt for an indoor storm relay.

## UI / audio / performance / QA
Stats and lil-gui provide useful diagnostics. There is no production interaction system, objective state, audio manager, build config or automated test suite. CDN import maps and example-model network paths reduce offline/reproducible reliability.

## What is good
- Correct use of capsule + Octree collision and recoverable OOB reset.
- Delta clamping/substeps lower tunneling risk.
- AnimationMixer action blending and camera collision concepts are usable in the right project.
- Debug instrumentation is visible.

## What is bad / should not copy
- One 1300+ line HTML script mixes all systems.
- CDN assets and imported example model are not a stable production asset strategy.
- Day/night, spheres and third-person complexity are not needed.
- License file is absent despite README statement.

## Adaptation
Use an authored collision registry, capped delta, pointer locking, camera pitch clamp and OOB reset. Mechanical objects get simple transform animations rather than skeletal animation. No source is copied unless license is independently verified.
