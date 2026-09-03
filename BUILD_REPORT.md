# Build Report — The Last Signal

> **Release gate status: NOT YET COMPLETE.** The game builds and deterministic QA passes, but browser-level Playwright and screenshot inspection could not run because this sandbox has no browser and all Chromium installation paths failed due network/TLS resets. This report does not represent those checks as passed.

## Game summary
A 10–15 minute first-person storm-relay mystery. An on-call technician restores Ravenscar Weather Relay so a tide-surge warning reaches the coast. There is no combat, enemy AI, generic key hunt or copied reference setting.

## Story / level / loop
- **Rooms:** Entry Airlock → Duty Office → Service Passage → Shore Breaker Room → Transmitter Gallery.
- **Loop:** orient → inspect → understand repair → interact → see/hear state change → enter new space → transmit.
- **Critical path:** console, duty log, thermal fuse, socket, breaker, security door, `3-1-4` dials, transmit button.
- **Ending:** an explicit `COASTAL WARNING ACKNOWLEDGED` status and final card.

## Technical architecture
Vite, vanilla ES modules and Three.js. Systems are separated into game state, pointer-lock player/gravity, swept circle-vs-AABB collision, raycast interaction, mechanical transforms, procedural Web Audio, DOM UI and modular world assembly. No heavyweight physics engine, character rig or external runtime dependency is used.

## Research
- **Video:** all 11 unique references processed; public-page transcript/metadata documented. yt-dlp media/caption/frame requests failed under sandbox TLS; limitation recorded.
- **GitHub:** exactly five requested checkouts—the top 3 plus extra 2—were cloned, inspected and scored. Enari (7.0) is strongest architectural reference; starterkit (6.2) supplies collision concepts. No reference code copied.
- **Assets:** public Sketchfab candidates were inspected but rejected because of blockout status, high unvalidated geometry or incompatible low-poly style. Selected ambientCG CC0 material maps form a controlled PBR backbone. No Kenney asset.

## Animation / audio / UI
Doors, fuse, breaker, dials, button and beacon use deterministic transforms documented in the manifest. Procedural wind, power hum and interaction tones follow game state after user gesture. UI is a minimal relay readout with current task, small prompt and reset.

## License / credits
See `CREDITS.md` and `research/assets/LICENSE_MANIFEST.md`. All external runtime material maps are ambientCG CC0 derivatives resized to max 1024px. No external 3D model is shipped.

## Performance evidence
Production build: application 34.67KB raw / 12.06KB gzip, Three.js 482.21KB raw / 120.78KB gzip, CSS 5.83KB raw / 1.97KB gzip. Selected PBR texture bundle: 588,125 bytes, 10 maps. Renderer FPS/draw calls still await browser execution. See `qa/performance.log`.

## QA evidence
- `npm run build`: **PASS**.
- `npm run qa`: **PASS, 9/9** checks including ordered critical path, invalid/repeat state behavior, door and wall collision, room connectivity, asset integrity, Kenney scan, interaction registration and payload budget.
- `npm run test:playthrough`: **BLOCKED** before browser launch; test source exists at `tests/critical-path.spec.js`.
- Visual screenshots/manual room inspection: **BLOCKED** by missing browser binary.

## Known limitations / required final verification
1. Execute `npx playwright install chromium && npm run test:playthrough` in a browser-capable environment.
2. Inspect recorded screenshots for airlock, office, passage, power room, gallery and ending; then record draw calls/FPS.
3. Re-run video frame/caption pipeline where the YouTube media CDN is reachable if frame-specific reference analysis is required.

## Current scores (honest, pending browser gate)

| Area | Score | Basis |
|---|---:|---|
| Playability | 7/10 | Full logical state path and collision tests pass; real browser controls not yet executed. |
| Visual coherence | 7/10 | Strict PBR palette and purposeful room plan; no rendered screenshot review yet. |
| Environment | 7/10 | Five clear service rooms and environmental landmarks; visual inspection pending. |
| Level design | 8/10 | Compact traceable route with no dead rooms. |
| Interaction | 8/10 | Reusable raycast records, conditions and state feedback; browser confirmation pending. |
| Animation | 8/10 | Appropriate, deterministic mechanical transforms. |
| Audio | 6/10 | Stateful procedural design implemented; auditory browser test pending. |
| UI | 7/10 | Minimal original hierarchy; responsive visual review pending. |
| Story | 9/10 | Feasibility-first, clear and fully mapped to gameplay. |
| Performance | 7/10 | Small static payload and no heavy systems; runtime metrics pending. |
| QA | 6/10 | Strong deterministic coverage, but blocked Playwright/visual acceptance prevents a higher score. |
