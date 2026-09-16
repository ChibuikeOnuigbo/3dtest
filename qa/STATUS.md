# QA status — 2026-09-07 23:05 UTC

**Active world:** Rivet Run: Highline District. **VISUAL APPROVAL = FALSE.**

## What is true right now (CAPTURED / INSPECTED / APPROVED are different things)
- Logic tests: 34/34 (`npm run test:logic`) — route sim, movement, level map, door geometry,
  prop placement contract (8 seeds, 0 floating / 0 overlapping real props). Test pass ≠ visual pass.
- Production build: passes.
- **CAPTURED + INSPECTED (staged poses, local SwiftShader Chromium, 960×540):** 01, 05, 07, 07d, 07e,
  10, 13, 15, 17d (passes 12–13), 17e, 18, 19. Semantic reviews with A–J answers and defects in
  `qa/visual/staged/2026-09-07-local/REVIEW.md`. These are player-height frames but staged (teleport),
  so they count as inspection evidence, not approval.
- **CAPTURED in CI gameplay mode (real input through the route):** last complete run is old
  (34050674229; navigation stalled after frame 03). Run 34162559951 (commit `38d832d`) outcome
  unknown — the GitHub token in the sandbox expired at ~22:20 UTC, so status/log reads and pushes
  fail with 401. Nothing after `38d832d` has run in CI yet (7 local commits waiting to push).
- **APPROVED:** none.

## Blockers that need the user
1. GitHub connection in Arena needs to be reconnected (token invalid → cannot push or read CI).
2. Repository secrets `SKETCHFAB_API_TOKEN` and/or `SKETCHFAB_PROXY_URL` (the Cloudflare worker URL
   was never received in the sandbox) — `gh secret set` returns 403 for this session even with a
   valid token, so they must be added in the repo settings.
3. The Poly Haven models, OGA audio bank and Sketchfab/hunt models only exist as CI artifacts
   (no sandbox egress); local frames therefore show the procedural stand-ins where real models go.

## Next CI run will
- fetch Poly Haven sets/models + the 13-cue CC0 OGA audio bank into `public/`,
- run the Sketchfab query-matrix intake (search/triage always; download only with the secret),
- run the prop placement contract with the run's seed,
- capture gameplay + staged frames and commit them under `qa/visual/evidence/<run_id>/`.
Dispatch with `asset_hunt_hours=2` to run the timed asset hunt (Sketchfab → Poly Haven → OGA 3D).
