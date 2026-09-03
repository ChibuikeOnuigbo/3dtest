# Technical Pattern Library — Selected Architecture

## Chosen runtime
Vanilla ES modules + Vite + current Three.js. No gameplay framework, physics engine or UI framework. The world is small enough that the few systems below are more testable than a general-purpose engine.

| Pattern | Source evidence | Why it works | Limitations | Our adaptation |
|---|---|---|---|---|
| Player body + camera | Enari camera/player split; Enari tutorial transcript | Collision should constrain a body, not a camera. | Needs explicit sync. | `PlayerController` owns feet position/velocity; camera uses eye height. |
| Pointer Lock + pitch clamp | Enari / starterkit inspection | Predictable first-person mouse look. | Requires user gesture, unavailable on some embedded contexts. | Begin button requests lock; keyboard remains functional for QA. |
| Capped delta | Enari and starterkit | Reduces huge tab-resume steps and tunnelling. | Does not replace physics substeps for complex worlds. | `min(clockDelta, 0.05)` and axis-separated movement. |
| Capsule-like collision | starterkit `Capsule`/Octree | Rounded player avoids snagging. | Dynamic/complex mesh collision needs more work. | 2D circle footprint + fixed floor height against named authored AABBs. |
| Data-driven collision | Required scope / reference weaknesses | Exact boxes are inspectable and cheap. | Orthogonal rooms only. | `CollisionWorld` registers static/dynamic AABBs by id. |
| Raycast interaction | Three.js `Raycaster` docs / required interaction model | The centered object determines one contextual action. | Small targets need generous hit areas. | Visual child plus invisible, deliberately sized interaction proxy; range gate 2.8m. |
| Reusable door state machine | Required door testing | Keeps visual, collision, sound and lock states synchronized. | Does not handle arbitrary mesh doors. | `Door` has `locked`, `targetOpen`, progress and a doorway safety test. |
| Explicit game state | Required objective rule | Prevents scattered implicit flags. | Must keep mutation central. | `GameState` validates transitions and emits events for UI/world/audio. |
| Mechanical transforms | Animation research | Correct for dials/lever/hinged doors and no rig dependency. | Not humanoid animation. | Fixed-duration interpolation or discrete rotation; registered in animation manifest. |
| Procedural Web Audio | Browser API | Avoids unverified files; stateful audio maps to systems. | User gesture required; no sampled realism. | Wind/noise, transformer hum and deterministic UI/repair tones. |
| Shared textures/materials | Three docs + performance constraint | Lowers texture/material churn and draw overhead. | Fewer surface variants. | Three PBR sets, cloned texture transforms, shared primitive geometries. |
| Instrumented QA API | Browser testing requirement | Critical path can be deterministically replayed. | Not a substitute for manual play. | Test hook positions/aims player then uses live interaction resolver. |

## Module map

```
src/
  main.js                    boot, renderer, update order
  core/GameState.js          explicit transitions/objectives/events
  systems/PlayerController.js movement, gravity, Pointer Lock
  systems/CollisionWorld.js  authored collision volumes
  systems/InteractionSystem.js raycast, conditions, activation
  systems/AudioSystem.js     user-gesture sound graph and event cues
  systems/UI.js              DOM overlay / pause / end states
  world/Materials.js         PBR texture loading and material cache
  world/World.js             room assembly, lights, props, doors
```

## Update order
`input/player movement → collision resolution → door transforms → interaction focus → world state visuals → audio state → UI → render`. The state object is the sole owner of critical path flags.
