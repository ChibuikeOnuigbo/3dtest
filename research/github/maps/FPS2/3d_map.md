# 3D map forensics — FPS2

**Status: source-structure study, not a reproduced level.** Four map `scene.gltf` assets are catalogued (CARGO/VERTEX/GHOST/CITY paths in the runtime registry). They are separate startup maps, not a level to copy.

## Required spatial questions
- Scene extent / room boundaries: only record when parsed from an authored source file.
- Doors, windows, walkable paths and landmarks: preserve as observations, never copy an exact layout.
- Object groups: retain semantic grouping in research notes, but do not use mesh names as new-game state.

## Current finding
Four map `scene.gltf` assets are catalogued (CARGO/VERTEX/GHOST/CITY paths in the runtime registry). They are separate startup maps, not a level to copy.

## Reuse decision
No map geometry, collision, model, texture, room plan, light or source code is approved for production. The result is design/technical knowledge only.
