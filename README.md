# Pale Beacon

**Pale Beacon** is a small, original first-person Three.js mission set in a rain-swept
coastal civil-safety signal outpost. Restore the receiver, retrieve an emergency pulse
tool, clear the relay route, reseat power, route the backup channel, and arm the beacon
for an inbound rescue ferry.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Click **Begin Maintenance** to unlock audio and pointer
lock. Controls: **WASD** move, **Shift** sprint, **Space** jump, **E** interact, left
click fires the emergency pulse tool, and **Esc** pauses/releases mouse capture.

## Checks actually run

```bash
npm run test:logic   # 4 passing Node logic/collision tests
npm run build        # Vite production build
npm run test:e2e     # Playwright browser suite (currently blocked: no browser executable)
```

The build and logic tests have passed in this workspace. The Playwright invocation was
attempted against this game and is explicitly blocked by the environment's missing
Chromium executable; see [`qa/playwright-attempt-2026-09-04.log`](./qa/playwright-attempt-2026-09-04.log).
No browser capture, quality score, or completion claim is being made.

## Architecture

The runtime is an independently authored Vite/Three.js project with separate input,
player motor, collision world, mission reducer, interactions, world, drones, audio and
HUD modules. Gameplay facts are data-driven in `src/data/mission.js`; an immutable
read-only `window.__paleBeaconTestProbe.snapshot()` supports future browser assertions.
All environment meshes/materials are original procedural blockout art. No media/code from
research repositories ships in the game, and no external asset is currently approved.

## Research and provenance

- [Research index and phase status](./research/README.md)
- [Story bible / state mapping](./research/story/STORY_BIBLE.md)
- [Visual target and environment lock](./research/VISUAL_TARGET.md)
- [Source/reference comparison](./research/github/COMPARISON.md)
- [Asset ledger and license gates](./research/assets/ASSET_LEDGER.md)
- [Strict browser QA rubric](./qa/strict-fps-qa-rubric.md)
