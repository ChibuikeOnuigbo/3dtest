# 2D level map — *Pale Beacon* blockout v0.1

**Status:** implementation map, not a visual-approval image. Coordinates match the
original geometry in `src/world/Environment.js`; all dimensions are metres in a flat X/Z
plane. The camera/player stays at human height, with a small jump only—not a vertical
platforming route.

```text
                         NORTH / NEGATIVE Z
                    ┌────────────────────────┐
                    │ R5 LANTERN GALLERY      │
                    │   [beacon]  horizon     │  x: 2..12, z: -16..-8
                    └───────── D-gallery ────┘
                        R5 RADIO WORKSHOP
               ┌──── D-workshop  ─────────────┐
               │ [radio panel]                │  x: 5..12, z: -8..-1
               └──────────────────────────────┘
 ┌───────────────┐   R3 RELAY GALLERY
 │ R4 GENERATOR  │  ┌──────────────────┐
 │ [isolator]    │  │  [relay sentry]  │  x: -5..5, z: -4..4
 │   D-generator ├──┤ cable trunk      ├──D-workshop
 └───────────────┘  └────────┬─────────┘
                              │ threshold
                         R2 KEEPER’S HALL
                         [pulse cabinet]       x: -5..5, z: 4..12
                              │ D-entry
                         R1 ARRIVAL JETTY
                       [emergency receiver]    x: -7..7, z: 12..24
                         SOUTH / POSITIVE Z
```

## Room-card contract

| Space | Bound / clearance | Entry and exit | Mechanical/state role | Landmark and screenshot intent |
|---|---|---|---|---|
| R1 Arrival Jetty | 14 × 12 m external deck; entry door 2.65 m wide | Spawn at `(0, 20.5)`; receiver before hall door | Teach movement and intentional E prompt; `arrival → diagnosed` unlocks entry. | Dark tower/silhouette, wet deck, red receiver. Capture spawn/stakes view. |
| R2 Keeper’s Hall | 10 × 8 m | Entry door → open threshold to R3 | Cabinet provides one tool; `diagnosed → equipped`. | Warm desk/cabinet cluster and exterior rain contrast. Capture tool acquisition. |
| R3 Relay Gallery | 10 × 8 m | Hall threshold → side doors | One required sentry creates `equipped → relay-cleared`; then generator door can open. | Cable trunk creates left-hand route cue. Capture sentry/prompt/door state. |
| R4 Generator Bay | 7 × 7 m | Only return via generator door | Isolator gives `relay-cleared → powered`; workshop door unlocks. | Low mechanical volume and green post-power lamp. Capture power before/after. |
| R5 Workshop/Gallery | Workshop 7 × 7 m joins 10 × 8 m gallery by door | Workshop door → gallery door → mission end | Radio gives `powered → route-ready`; beacon gives final completion. | Blue radio interface, then final lens/open horizon. Capture routing and ending beam. |

## Collision / navigation invariants

- The player has a 0.36 m collision radius. All wall solids are authored axis-aligned
  volumes; no rendered prop or model name determines collision.
- Each animated door has its own collider. It stays solid until animation progress reaches
  93%; closing reverses the same contract. A visual door cannot become a non-solid wall.
- R1’s outer walls and the water boundary stop shortcutting around the mission building.
  R3 side doors are gated by the sentry/power events; there is no alternative void route.
- The safety plane resets vertical jump at floor height. No room requires jumping and
  objects are not placed as collision/platform puzzles.
- Decorative prop bodies that occupy movement space receive explicit prop collision;
  interaction raycasts choose the first target/occluder so a player cannot operate a
  console through a wall.

## Blockout validation still required

The source/map alignment and Node collision unit test are not browser spatial validation.
The future Playwright route must test every marked threshold from both sides, every closed
and open door slab, clearance beside cabinet/desk/generator, and the full route without
teleportation or state mutation.
