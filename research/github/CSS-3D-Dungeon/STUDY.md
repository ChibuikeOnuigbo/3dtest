# Repository study — CSS-3D-Dungeon

**Status:** RESEARCH ONLY / NOT EXECUTED. Detailed source report: `../repo_CSS-3D-Dungeon.md`.

## Architecture
Compiled CSS pseudo-3D bundle. Its explicit proximity-prompt-objective feedback contract is the transferable pattern; it is not a Three.js base.

## Player, camera, movement and collision
The inspected source/README evidence is treated as an implementation reference, not a verified runtime result. A new game must keep one input owner, camera owner, deterministic player motor and authored collision; no reference controller is copied.

## Levels, interactions, state
Any level/map and interaction conclusions are limited to the referenced source layout. The new game maintains independent room/door/objective state and will test actual reachability rather than adopting reference scene names or triggers.

## Asset loading, animation, audio and UI
Repository media and UI are not permissioned merely by being present. Import/animation/audio techniques may be studied, but every production file needs its own licence/provenance/technical/visual decision.

## Performance and QA
No live benchmark or browser QA result is attributed to this specimen. Future comparison focuses on asset loading cost, collision complexity, draw/triangle counts and browser evidence.

## Assets / licence
MIT root code only; 49 built-bundle media items lack individual upstream ledger.

## Good patterns
- Narrow subsystem boundaries, semantic game state and explicit feedback are worth independently reimplementing when actually supported by source review.

## Bad patterns / what to avoid
- Whole-repository import, unpinned remote runtime dependencies, source-licence assumptions for third-party media, untested README feature claims, giant inline controllers, and unmeasured asset loading.

## Reusable patterns
- Reasoning patterns only: bounded state transitions, authored collision proxies, capability-aware loading and testable input/interaction contracts.
