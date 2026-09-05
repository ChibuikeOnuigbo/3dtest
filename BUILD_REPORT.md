# Build report — Vector Run: Skyline Relay (active prototype)

## Final-game direction

The previous slow signal-outpost concept has been retired from production. The active game
is a small, original **fast first-person parkour, exploration and target-action course**:
*Vector Run: Skyline Relay*. Its core is speed, vertical movement, precise routes, quick
restarts and readable target encounters. It is not a horror game.

## Movement design

The current kinematic movement controller has ground jump, buffered/coyote jump response,
air control, double-jump unlock, three-use wall-jump limit, directional dash/cooldown,
crouch clearance, ground slide, air ground-slam, fall recovery and explicit movement
states. Movement values are implementation starting values—not final feel approval.

## Level design and world

The authored Skyline Relay course is a bright coastal freight-training structure: launch
dock, kinetic-prism rise, split wall/dash routes, target court and sunrise gate. Platforms
are paired with visible gantries, trusses, piers, rails and route markers. The world uses
original procedural geometry/materials rather than a copied external map.

Source-pattern synthesis, 3D tree and route graph are in `docs/LEVEL_MAP.md` and
`game/data/level_map.json`. Environment planning is in `research/design/environment_board.md`.

## Assets, references and provenance

Nine supplied GitHub repositories remain technical/design references. Their individual
asset provenance remains independently controlled. No third-party model, texture, rig,
map, animation, UI art or audio currently ships in production. Three.js is the only
third-party runtime dependency.

## Current verification

- New movement/level-map logic suite: **6/6 passed** after the Vector Run rebuild.
- Vite production build: **passed**; bundle advisory remains for the Three.js bundle.
- `tools/qa/check_playwright.py`: package/version and local-browser diagnostic added.
- Browser playthrough/screenshots/performance: **BLOCKED**; no secure local browser binary
  is installed. Normal official installer, local-cache search and requested Debian package
  attempts are logged in `qa/`.

## Limits

Movement feel, route difficulty, visual composition, browser collision, screenshot review,
performance profiling, audio mix, settings/remapping UI and full end-to-end playthrough
need real browser QA before any completion claim.
