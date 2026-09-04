# QA status

| Check | Current result | Evidence |
|---|---|---|
| Static mission/collision tests | PASS (4 tests) | `logic-tests-2026-09-04.log` |
| Production build | PASS with bundle advisory | `build-2026-09-04.log` |
| Spatial plan validator | PASS_WITH_BROWSER_VALIDATION_REQUIRED | `spatial_report.json` |
| Playwright install with deps/headless shell | BLOCKED | `playwright-supported-install-2026-09-04.log`, `playwright-shell-install-2026-09-04.log` |
| Browser gameplay, console, screenshots, performance | BLOCKED | No browser executable; no fabricated evidence. |
| Room approval | UNRATED | `room_scores.json` |
