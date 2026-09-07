# Level redesign response — brighter, more legible Signal Court

## Player feedback addressed

The first blockout risked reading as a dark, straight run of similar enclosed boxes.
That weakens orientation, makes material detail hard to judge, and gives the middle of the
mission no spatial release. It must not be disguised as a finished level merely because
its objective chain is complete.

## New spatial intention

| Previous risk | Redesign action now in source | Intended player result | Future browser proof required |
|---|---|---|---|
| Uninterrupted linear corridor feeling | The former Relay Gallery is reframed and built as a **Signal Court**: an open glazed roof, central signal spindle, low bridge edge and views into both side wings. | On arrival, the player sees the generator and radio directions rather than another anonymous hall. | Player-height R2→R3 entry, left/right wing orientation, and return-path screenshots. |
| Too dim to read surfaces or entrances | Daylight background/fog, higher hemisphere/directional exposure, sky apertures, window fill lights and stronger practical fixtures replace the dark blue-hour default. | Floors, doors, room edges, props and prompts should be readable before final art. | Histogram/visual review in R1–R5; no blown-out lens/screens or black corners hiding collision. |
| Weak room landmarks | Introduced a distinct central spindle, facade glazing, generator status, radio control and final lens composition. | Each room has a memorable visual object that reinforces its objective. | Screenshot review must identify entry, exit, interaction and landmark at a glance. |
| Props could feel piled up | New elements are architectural orientation pieces (skylight, windows, bridge, spindle), not random crates. Existing prop groups remain purpose-led. | Clear use of space and stronger composition without asset spam. | Collision, scale and narrative-purpose check for every group. |

## Implementation delta

- `src/main.js`: sky/fog, hemisphere/directional light, exposure and headlamp were raised
  for a bright overcast dawn rather than an underexposed night scene.
- `src/world/Materials.js`: lighter weathered surface palette plus a readable ceiling
  material.
- `src/world/Environment.js`: a 4.6 m architectural volume, brighter practical lights,
  skylights/window fill, a roof-open Signal Court, signal-spindle hub and bridge/rail
  landmarking; rain density/opacity reduced.
- Story, environment and map records now call the middle room the **Signal Court** and
  describe dawn lighting so visual narrative and implementation do not conflict.

## Still not claimed

No browser screenshot or playthrough has confirmed this redesign. It is a more deliberate
blockout/lighting pass, not a 90% visual approval. Browser visual inspection and actual
collision routing remain release blockers.
