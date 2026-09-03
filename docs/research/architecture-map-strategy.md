# Evidence-led architecture and interior/exterior map strategy

**Status: architecture decision for a future independent prototype. No game code, map,
model, texture, UI, audio, animation, or scene from the research repositories is
approved or copied.** The diagrams beside this document are design diagrams—not
Playwright artifacts.

## Problem investigated

Both references demonstrate useful FPS building blocks but neither offers the desired
mission composition unchanged:

- Enari has a clean TypeScript/Three/Ammo separation, named-node map loading and a
  separate viewmodel-rendering facility, but loads one hard-coded map and turns render
  meshes into Bullet colliders.
- FPS2 selects one standalone `scene.gltf` from a URL parameter. It does not provide a
  portal/room transition that preserves mission state, and collision is repeatedly
  inferred from render object names and `Box3` tests.

The aim is one small, high-quality mission in which exterior and enclosed building
spaces feel materially and mechanically different **without a normal door triggering a
level swap or respawn**.

## Proposed system boundary

```text
Browser input → normalized ActionState → PlayerMotor → spatial queries/collision
                                  │                 ↘ event stream
                                  ├→ WeaponStateMachine → hit/impact/AI events
                                  └→ InteractionRay ──→ data-driven Door/Objective states

Asset manifest (license + budget gate) → async ZoneLoader → logical MissionState
MissionState → World scene / collision registry / audio zones / HUD model
World scene + viewmodel scene → capability quality profile → WebGL frame
```

This retains an *architectural lesson* from Enari (loader, player/camera, physics, and
render pass boundaries) and FPS2 (weapon data has ammo/reload/pickup concerns), but all
interfaces and implementations will be new. The intended dependency direction is
one-way: rendering observes simulation state; it never owns authoritative ammo, door,
objective, or collision decisions.

## One logical mission, multiple independently activatable zones

### Zone groups

| Group | Content and behavior | Lifecycle |
|---|---|---|
| `yard` | Exterior approach, cover, façade, distant non-collidable silhouette, ambient loop. | Present after initial load; farther decoration may use lower detail. |
| `threshold` | Airlock / security vestibule; lockable door, objective prompt, acoustic and lighting transition. | Always resident: this is the continuity boundary. |
| `interior-west` | Lobby, security, adjacent service room. | Visual assets activated from yard/threshold proximity; collision and interaction data resident. |
| `interior-core` | Main corridor, powered/objective room, optional return route. | Loaded before opening the final threshold, so the door never opens to missing content. |
| `roof-skyline` | Exterior horizon/sky/far lights; no gameplay collision. | Quality-scaled. |

### Door and objective state

A door has an ID, authored local pose, collision primitive ID, current state
(`locked`, `opening`, `open`, `closing`, `disabled`), an optional requirement expression,
and a load-precondition zone. The state transition is transactional:

1. Interaction ray identifies the closest reachable door surface (not a mesh-name check).
2. Mission state validates objective/inventory condition.
3. If needed, request and await target-zone visual readiness while the door remains
   locked/closed with an explicit UI/audio feedback state.
4. Animate door; interpolate/enable collision only when opening geometry has cleared.
5. Emit a local event for UI, audio, and optional AI—not direct renderer mutations.

Returning through the door reverses zone priority but preserves player pose, weapon ammo,
doors, and objectives. A **mission change**, unlike a door, uses a loading checkpoint and
is only selectable through a mission menu or clear mission finale.

## Collision and rendering layers

| Layer | Representation | Why |
|---|---|---|
| Player | Kinematic upright capsule with swept/slide movement and grounded probe. | Stable walk/sprint across dense thresholds and stairs. |
| Static architecture | Coarse authored boxes/convex volumes, never the visual mesh as a blanket default. | Predictable, cheap, reviewable collision. |
| Doors | Dedicated moving slab/portal collision shapes. | Avoid walking through a visually closed door or snagging at the jamb. |
| Interactions | Raycastable proxy planes/volumes with semantic IDs. | No behavior inferred from node/object names. |
| World visuals | Cleared, budgeted glTF or authored primitives/textures. | Visual replacement can happen without changing gameplay. |
| Viewmodel | Separate scene/pass and depth clear after world pass. | Prevent wall clipping and allow independent weapon FOV/light budget. |

## Candidate blockout topology—intentionally small

The 2D plan has a single continuous critical route:

`Yard spawn → outer cover choice → airlock → lobby → security hall → service bypass or
main corridor → relay/objective room → exit/return confirmation.`

It supports functional quality review before any serious asset acquisition:

- **Exterior** is wide enough to test sprint, sightlines and cover; it is not a giant
  empty landscape.
- **Threshold** tests locked/unlocked door behavior, state continuity, lighting/audio
  crossfade and interior preloading.
- **Interior** uses short loops and a service bypass to test collision around frames,
  corners, door swings, and weapon engagements at close/medium range.
- **Return** gives a real ending/exit condition and lets QA re-cross the threshold.

The diagram labels are technical zone names, not final story/copyrighted map content.
They will change only after a cleared asset/environment package and blockout playtest
support the final concept.

## Required gates before production implementation

1. **License/asset gate:** only individual assets that have an exact source, license,
   attribution path, visual-fit review, file-size/triangle/textures budget, and Kenney
   ban check can enter the production manifest.
2. **Blockout gate:** no decoration before a browser playtest proves camera, walk,
   sprint, capsule collision, basic door state, zone readiness, and return path.
3. **Performance gate:** measure initial load, activated-zone load, average/p1 frame time,
   draw calls, texture memory estimates and console errors on the target browser. No
   eager FPS2-scale weapon/media bundle.
4. **QA gate:** real Playwright input and screenshots must meet the strict rubric; every
   claimed weapon and interactive door needs state assertions and visual evidence.

## Research sources

- [`research/github/enari_engine_source_study.md`](../../research/github/enari_engine_source_study.md)
- [`research/github/fps2_source_study.md`](../../research/github/fps2_source_study.md)
- [`research/github/fps2_runtime_registry.json`](../../research/github/fps2_runtime_registry.json)
- [`qa/strict-fps-qa-rubric.md`](../../qa/strict-fps-qa-rubric.md)
