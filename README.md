# The Last Signal

A short, original first-person Three.js mystery: restore a failed coastal weather relay before a tide surge reaches the shore.

## Play

```bash
npm install
npm run dev
```

Open the shown local/preview URL, choose **BEGIN SHIFT**, then use **WASD** + mouse and **E** to interact. The critical path is deliberately small and logical: inspect the fault console → read the duty log → collect/install its labelled thermal fuse → reset breaker → open gallery → tune `3 · 1 · 4` → transmit.

- `npm run build` — production build
- `npm run qa` — deterministic state, collision, room, asset and interaction-registry QA
- `npm run test:playthrough` — Playwright browser critical-path test (a Chromium binary is required)

## Design and credits

- Story / level plan: `docs/game-concept.md`, `docs/story.md`, `docs/world-plan.md`
- Research and repo comparison: `docs/reference-study.md`, `docs/github-reference-study.md`
- Asset strategy and license manifest: `docs/asset-strategy.md`, `research/assets/LICENSE_MANIFEST.md`, `CREDITS.md`
- QA status: `docs/qa-report.md`

No Kenney asset is used. The only external runtime assets are selected ambientCG CC0 PBR surface maps, resized for browser delivery and credited in the manifest.

## Verification status

Build and deterministic QA pass. Browser-level Playwright and screenshot inspection are authored but currently blocked by the sandbox's unavailable Chromium download; this is recorded transparently in `qa/playthrough.log` and `docs/qa-report.md` rather than claimed as passed.
