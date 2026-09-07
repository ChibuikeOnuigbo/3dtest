# Decision — rebuild the Signal Court visual language

**Date:** 2026-09-04
**Trigger:** Player feedback found the prior grey-blue factory blockout monotonous and
insufficiently creative.

## Reference-informed design response

The rebuild deliberately applies independently authored *patterns* found through the
supplied references, without copying their source, maps, media, models or textures:

- **Enari Engine:** make a compact FPS space legible through strong world landmarks,
  material contrast and intentional environment layers rather than generic filler.
- **CSS-3D-Dungeon:** give each short room a different visual purpose and state-reading
  role; focused interaction must change the scene's feedback.
- **Triomonnezza / Liminality:** use a hub-and-wing route with a clearly readable return
  landmark, isolated room identities, doors, light pools and controlled reveals.
- **FPS2:** avoid its eager asset pile and generic map swap design; retain only the lesson
  that each tactical sightline should be obvious from an authored landmark.

## New independent world direction

The Signal Court is now an **Ariadne signal conservatory**: weathered plaster, turquoise
mosaic panels, patinated copper instruments, brass rails, tiled floors, tide-observatory
objects, hanging lamps, a three-axis signal orrery and a lighthouse gallery. It remains a
small authored outpost, not a copied industrial map.

## Source and asset boundary

No repository geometry, code, texture, image, font, audio, animation, level/map layout or
Sketchfab archive was imported. The procedural canvas maps, meshes and scenery were made
inside this project. This is required because the discovered repository media is not
individually cleared and no authorized Sketchfab download API session exists.

## Verification

Static syntax, mission tests and Vite build passed after the rebuild. Visual/browser QA
is still required; current missing browser provisioning prevents any screenshot claim.
