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
| GitHub-hosted browser alternative | runner pass; semantic inspection blocked | Run [`33958274539`](https://github.com/ChibuikeOnuigbo/3dtest/actions/runs/33958274539) explicitly provisioned Chromium, passed smoke/capture and uploaded its artifact. Normal TLS artifact download from this Arena environment ended in EOF, so no PNG has been inspected or scored. Exact record: `qa/visual/ci-run-33958274539.json`. |

## Evidence state machine

Every visual frame must remain in exactly one state:

- **CAPTURED_UNINSPECTED:** a real player-height browser produced a PNG and the
  immutable frame record contains camera, player, seed and trace context. There
  is no score and no approval.
- **INSPECTED_NEEDS_FIXES:** a named semantic critic has answered what is visible,
  what fails, what is repetitive/unconvincing/missing and the concrete move/add/
  replace/remove response. Its scores diagnose the current immutable frame only.
- **APPROVED:** after a fresh post-fix capture, all assigned critic roles have no
  critical issue, every category is at least 7.5 and the combined average is at
  least 8.5. Major geometry/art changes invalidate prior approval.

`tools/qa/capture_visual_views.mjs` creates the first state. It cannot and does
not produce the other two.

## Required visual capture matrix

Capture actual first-person frames for: Dispatch Bay spawn plus look-around;
Intake speed and jump; Permit terminal; Transfer canopy/checkpoint; West Shaft
wall contacts; East Span dash gap/landing; Boiler Court each relay and recovery
deck; Control Bridge slide; Sunline Bridge vista/finish; below-route boundary
view; slam/landing; and an end-to-end route trace. Capture both default and one
deterministic alternate `?seed=` presentation, while holding geometry invariant.

Each captured frame record must carry: `frame_id`, `region`, `camera_position`,
`camera_direction`, `player_state`, `seed`, `critic_status`, `critic_findings`,
`scores`, and `approved`.

## Hostile critic rubric

For every frame/region inspect: prototype/placeholder signal; material repetition;
credible construction and supports; accidental intersections/floating ordinary
objects; silhouette/proportions; route readability; light hierarchy; colour restraint;
exterior depth; distant scenery; transition framing/destination visibility;
exploration appeal; HUD dominance; and procedural-dump signs.

## Independent semantic review roles

Every reviewed frame needs an independent finding from the applicable roles:

1. AAA/indie art director — hierarchy, identity, palette and focal control.
2. Level designer — readable route, choices, pacing, recovery and transition.
3. Environment artist — believable construction, material families, dressing and depth.
4. Technical artist — asset intersections, scale, repetition, light/shadow and render issues.
5. Parkour designer — take-off, landing, verticality and mechanic visibility.
6. First-person movement designer — camera/readability during speed, air, wall, slide and landing.
7. Player/fun tester — curiosity, delight, frustration and whether the space feels worth exploring.
8. Performance reviewer — visible cost/LOD/overdraw trade-offs without replacing semantic art review.
9. Hostile quality critic — placeholder/procedural-dump/dead-zone hunt and final veto.

Each role must answer: **what is visible; what looks bad; what looks placeholder;
what is repetitive; what is unconvincing; what is missing; what must be replaced,
moved, added or removed.** Pixel statistics may support a diagnosis but never
stand in for these semantic findings.

## Completion threshold

Do **not** set a visual pass based on build, tests, screenshots existing, FPS or
pixel metrics. Each category must be at least **7.5/10**, overall average at
least **8.5/10**, and there can be **no critical issue** in every region and a
whole-run walkthrough. The current numeric score is deliberately `null`.
