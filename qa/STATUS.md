# QA status

| Check | Current result | Evidence |
|---|---|---|
| Static mission/collision tests | PASS (4 tests) | `logic-tests-2026-09-04.log` |
| Production build | PASS with bundle advisory | `build-2026-09-04.log` |
| Spatial plan validator | PASS_WITH_BROWSER_VALIDATION_REQUIRED | `spatial_report.json` |
| Playwright browser provision (normal Chromium, dependency/headless-shell routes, installed Chrome/Edge/Chromium channels) | BLOCKED | `playwright-chromium-install-2026-09-04.log`, `playwright-supported-install-2026-09-04.log`, `playwright-shell-install-2026-09-04.log`, `playwright-channel-discovery-2026-09-04.log` |
| System Chromium apt install | BLOCKED | Passwordless sudo was available, but the configured Debian repositories all failed connection and package chromium could not be located. See playwright-system-chromium-apt-2026-09-04.log. |
| Browser gameplay, console, screenshots, performance | BLOCKED | No browser executable, local archive, cached Playwright/Puppeteer driver or active Vite service after sandbox reset; no fabricated evidence. See `qa/browser-discovery/`. |
| Room approval | UNRATED | `room_scores.json` |
