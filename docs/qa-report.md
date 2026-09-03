# QA Report — The Last Signal

**Date:** 2026-09-03

## Automated deterministic QA — PASS
`npm run qa` passed **9/9** checks after a collision tunnelling bug was found and repaired.

| Check | Result | Evidence |
|---|---|---|
| Ordered story progression | Pass | Invalid actions rejected; console → log → fuse → socket → breaker → door → 3-1-4 → transmit reaches `ended`. |
| Repeat/locked state | Pass | Locked dials and repeat transmit do not corrupt state. |
| Closed/open door collision | Pass | Dynamic AABB blocks passage while active and permits it when disabled. |
| Wall collision | Pass | New swept substeps prevent a large movement delta from crossing a thin solid wall. |
| Room metadata/connectivity | Pass | Five metadata-complete rooms are connected from airlock. |
| Asset integrity | Pass | 3 licensed material entries and all 10 selected maps exist. |
| Kenney ban | Pass | Runtime source/registry scan has no prohibited asset reference. |
| Interaction registry | Pass | All required actions plus data-driven dials exist. |
| Payload budget | Pass | Selected texture bundle is 588,125 bytes (<12MB cap). |

## Build — PASS
`npm run build` succeeds with Vite. The dev server accepts the Arena preview host (HTTP 200 verification performed after `allowedHosts: true`).

## Regression repaired
The first QA run found that the collision resolver only checked an end position. A sufficiently large delta could leap over a narrow closed door or wall. `CollisionWorld.moveCircle()` now sweeps movement in radius-derived substeps and resolves after each axis movement. The regression tests now pass.

## Browser Playwright — BLOCKED, NOT PASSED
The full browser test is implemented at `tests/critical-path.spec.js`, but Playwright Chromium installation failed because its CDN connection reset during TLS handshake and no system browser exists. See `qa/playthrough.log` for exact status. This means console-error, rendered visual and browser-level interaction claims remain unverified in this sandbox.

## Visual review — BLOCKED, NOT PASSED
The live preview is available for a human visual inspection, but no screenshot-capable browser exists in the sandbox. No screenshot or rendered-room approval is claimed. Planned inspection points are airlock spawn, duty office note, fuse case, powered breaker room, open gallery, tuned transmitter and ending.

## Release status
**Functional implementation and deterministic QA are ready. Final release acceptance is blocked only on browser-capable Playwright/manual visual verification.**
