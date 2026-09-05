# QA report — Highline District reconstruction

**Report date:** 2026-09-05
**Visual status:** **BLOCKED — NO LOCAL BROWSER EXECUTABLE; NOT APPROVED**

## Evidence performed

| Check | Result | Scope / evidence |
|---|---|---|
| Attached failure-image review | completed | `research/visual_reference/ATTACHED_BEFORE_FAILURE_ANALYSIS.md`; directly rejects cyan void, floating islands, mascot camera obstruction, generic portals, sparse scenery and repeated materials. |
| Semantic visual capture | blocked | `qa/visual/` has the capture contract/tool but no locally available browser executable. No screenshots or scores are fabricated. |
| Logic tests | pass | `npm run test:logic`: 6/6, after reconstruction. Confirms movement/unit-map logic only. |
| Production build | pass | `npm run build`, after reconstruction. Build output carries Vite's non-fatal over-500kB chunk warning. |
| Static spatial graph | pass with browser validation required | `python3 qa/spatial_validator.py`; validates declared anchors/edges/surfaces only. |
| Poly Haven normal-TLS download | blocked | Official public acquisition attempt logged in `qa/asset_tests/polyhaven-aerial-asphalt-download-2026-09-05.log`; TLS returned `SSL_ERROR_SYSCALL`. No bypass was used and no asset was imported. |

## Required visual capture matrix

Capture actual first-person frames for: Dispatch Bay spawn; Intake speed and jump;
Permit terminal; Transfer canopy/checkpoint; West Shaft wall contacts; East Span
dash gap/landing; Boiler Court each relay and recovery deck; Control Bridge slide;
Sunline Bridge vista/finish; below-route boundary view; slam/landing; and an
end-to-end route trace. Capture both default and one deterministic alternate
`?seed=` presentation, while holding geometry invariant.

## Hostile critic rubric

For every frame/region inspect: prototype/placeholder signal; material repetition;
credible construction and supports; accidental intersections/floating ordinary
objects; silhouette/proportions; route readability; light hierarchy; colour restraint;
exterior depth; distant scenery; transition framing/destination visibility;
exploration appeal; HUD dominance; and procedural-dump signs.

## Completion threshold

Do **not** set a visual pass based on build, tests, screenshots existing, FPS or
pixel metrics. Each category must be at least **7.5/10**, overall average at
least **8.5/10**, and there can be **no critical issue** in every region and a
whole-run walkthrough. The current numeric score is deliberately `null`.
