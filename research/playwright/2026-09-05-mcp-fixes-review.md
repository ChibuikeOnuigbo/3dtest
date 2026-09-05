# Playwright / MCP fixes review — 2026-09-05

## Scope

This record distinguishes the **Playwright test runner used by Rivet Run** from
an **MCP server**. The game uses pinned `@playwright/test` with direct test and
capture scripts; it does not start `@playwright/mcp`, so an MCP allow-host flag
cannot manufacture a local browser executable or repair a direct-runner browser
cache.

## Supplied sources and bounded result

| Source | Review outcome | Applicable conclusion |
|---|---|---|
| GitHub Community discussion 178826 | Read in full through GitHub. It documents that hosted Copilot's Bash firewall and `PLAYWRIGHT_MCP_ALLOWED_ORIGINS/HOSTS` do not govern its default MCP process. A custom MCP configuration with CLI `--allowed-hosts` can be required for **that hosted MCP/CDN case**; its accepted answer warns against wildcard allowlists. | Not a fix for this project: our direct runner is not an MCP server and the game bundles Three.js locally. Do not add a permissive wildcard or external CDN dependency. |
| TestDino troubleshooting article | Read in full. It recommends a supported Node runtime, pinned compatible packages/lockfile, explicit pre-install of browsers, minimal runner configuration, direct terminal diagnostics, absolute paths and artifacts/traces. | Applicable: Node 22 and pinned `@playwright/test` already satisfy the runtime/version baseline. Add an explicit GitHub Actions browser-provision/capture workflow, artifacts, and maintain minimal config. |
| Reddit `MCP/Playwright Hangs Forever on Loading tools...` | Direct Reddit and old.Reddit fetch returned HTTP 403. The supplied title/snippet was available through a normal web search, so only metadata/snippet-level findings are recorded. It attributes an LM Studio stdio tool-list hang to clean JSON-RPC stdout, non-interactive `npx` setup, absolute paths, timeout/OOM checks and a standalone MCP launch test. | LM Studio and stdio MCP are out of scope. Do not claim a full post review. The general lessons—avoid interactive installs in automation and use unambiguous paths—inform the CI workflow only. |

## Implemented response

`.github/workflows/browser-qa.yml` is GitHub-hosted Ubuntu CI. It runs on
relevant pushes to this Arena branch and supports manual dispatch after the
workflow reaches the default branch. It does the following in an observable order:

1. checks out source and configures Node 22;
2. runs `npm ci` (locked direct-runner dependencies, no `@latest` MCP handshake);
3. explicitly installs Playwright Chromium and Linux libraries **before** testing;
4. prints the resolved `chromium.executablePath()`;
5. runs the existing Playwright smoke test;
6. starts the Vite app at an explicit same-runner `127.0.0.1:5173` endpoint;
7. passes the resolved executable path to the no-download real-player capture
   script; and
8. uploads PNG/trace/report/log evidence as a 14-day artifact.

This is a lawful CI environment, not a TLS bypass, proxy/mirror, browser binary
commit, or claimed local-browser fix. Browser evidence generated there must still
be inspected semantically before visual scores/pass claims are made.

## Local-environment boundary

This Arena environment still has Playwright packages but no usable local
Chrome/Chromium executable. The GitHub workflow is an alternate reproducible
browser QA path. Do **not** upload a browser binary/cache to Git. If a vetted
local executable later becomes available, set `BROWSER_EXECUTABLE_PATH` for
`tools/qa/capture_visual_views.mjs` and run the same capture contract locally.
