# Repository study — Three.js Liminality

**Status:** RESEARCH ONLY / NOT EXECUTED. Fresh shallow specimen `d57abb61d6546de0379df15f60b0ba33210b1ee6`; source read only, not executed.

## Architecture
Vite + Three r174 + cannon-es + heap-js. README/source layout exposes Player, Maze, ExitDoor, PowerSwitch, WeepingAngel, lighting/audio resources and procedural maze chunks. Reuse only conceptual state boundaries; reject procedural Backrooms maze, analogue post effects and its media.

## Player, camera, movement and collision
The inspected source/README evidence is treated as an implementation reference, not a verified runtime result. A new game must keep one input owner, camera owner, deterministic player motor and authored collision; no reference controller is copied.

## Levels, interactions, state
Any level/map and interaction conclusions are limited to the referenced source layout. The new game maintains independent room/door/objective state and will test actual reachability rather than adopting reference scene names or triggers.

## Asset loading, animation, audio and UI
Repository media and UI are not permissioned merely by being present. Import/animation/audio techniques may be studied, but every production file needs its own licence/provenance/technical/visual decision.

## Performance and QA
No live benchmark or browser QA result is attributed to this specimen. Future comparison focuses on asset loading cost, collision complexity, draw/triangle counts and browser evidence.

## Assets / licence
Root code LICENSE is MIT. README names Sketchfab, Pixabay, TextureCan, Poly Haven and “other” CC media without per-file source/terms.

## Good patterns
- Narrow subsystem boundaries, semantic game state and explicit feedback are worth independently reimplementing when actually supported by source review.

## Bad patterns / what to avoid
- Whole-repository import, unpinned remote runtime dependencies, source-licence assumptions for third-party media, untested README feature claims, giant inline controllers, and unmeasured asset loading.

## Reusable patterns
- Reasoning patterns only: bounded state transitions, authored collision proxies, capability-aware loading and testable input/interaction contracts.
