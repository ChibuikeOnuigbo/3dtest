# 3D map forensics — enari-engine

**Status: source-structure study, not a reproduced level.** Baked pool map and collision-world GLBs exist; inspect geometry record in `../../asset_forensics_all_nine.json`. No room topology is inferred from filename alone.

## Required spatial questions
- Scene extent / room boundaries: only record when parsed from an authored source file.
- Doors, windows, walkable paths and landmarks: preserve as observations, never copy an exact layout.
- Object groups: retain semantic grouping in research notes, but do not use mesh names as new-game state.

## Current finding
Baked pool map and collision-world GLBs exist; inspect geometry record in `../../asset_forensics_all_nine.json`. No room topology is inferred from filename alone.

## Reuse decision
No map geometry, collision, model, texture, room plan, light or source code is approved for production. The result is design/technical knowledge only.
