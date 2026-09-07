# Technical debt and verification debt

| ID | Debt / risk | Current evidence | Release effect | Resolution gate |
|---|---|---|---|---|
| TD-01 | No Playwright browser executable | `qa/playwright-attempt-2026-09-04.log` exit 1: Chromium headless shell absent; prior secure install retries failed with TLS resets. | **Blocker:** no actual game input/capture/console/performance QA. | Secure browser provisioning; run and inspect full C01–C06 suite. |
| TD-02 | Current source blockout has no browser visual review | Build/logic checks only; no screenshots. | **Blocker for 90% visual score.** | Capture/review player-height images of R1–R5 and ending; fix defects. |
| TD-03 | No external final art is cleared | `research/assets/ASSET_LEDGER.md`: all candidates hold/rejected. | Cannot claim final asset quality/credits. | Pass original-source license, content, visual and performance intake for each chosen asset—or formally ship fully original art with its own art quality review. |
| TD-04 | Build warns about a 566.32 kB minified entry (145.11 kB gzip) exceeding Vite's default 500 kB advisory. | `qa/build-2026-09-04.log`; build exit 0. | Not hidden; may affect initial load on constrained networks. | Measure real load/frame timing; split/defer noncritical code if evidence requires it. Do not silence warning as a “fix.” |
| TD-05 | Circle-vs-AABB collision is a deliberately simple initial motor. | Node unit has only a door case. | Corners, all thresholds, jump/ceiling and frame-spike behavior remain unverified. | Browser test exact clearance suite; replace with capsule/swept solution if defects appear. |
| TD-06 | E2E route timing is authored but not executed. | `tests/game.spec.js` C01/C05 discovered but launch failed before code execution. | It may require path/timing corrections after browser availability. | Execute without mutation/teleport; make every screenshot/assertion pass. |

No debt item is silently waived by a successful build or static test.
