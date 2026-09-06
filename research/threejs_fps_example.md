# Three.js `games_fps` example study

**Sources inspected 2026-09-06:**

- <https://threejs.org/examples/games_fps.html>
- <https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/games_fps.html>

## What is verified in the example

The example labels itself as an Octree/static-triangle-mesh collision demo. It
uses `Octree`, `Capsule`, pointer lock, yaw/pitch with `YXZ` rotation order,
gravity, fixed substeps, a world GLTF collider, fog, a hemisphere/directional
light, debug Stats/GUI and throwable icosahedral spheres.

## Rivet Run adoption boundary

- Useful: independently improve the player motor toward a swept capsule/static
  world-query model if first-person capture demonstrates current AABB edge/corner
  issues. Fixed integration/substeps, a camera yaw/pitch separation and collision
  normal response are research targets.
- Not adopted: its cyan background, demo terrain, debug UI, thrown ball gameplay,
  icosahedra, global example assets or use of the example as final environment art.
- Current status: the existing authored AABB controller remains in use until
  player-height observations establish a concrete collision defect worth a safe
  migration. A technical idea is not a reason to destabilise a playable route.
