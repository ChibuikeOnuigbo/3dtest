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

## Visual-control pipeline

`tools/qa/capture_visual_views.mjs` records only live pointer-locked player
movement/look input into immutable `capture_record.json` files. The capture tool
cannot award quality. `qa/visual/review_contract.schema.json`, nine role briefs
and `tools/qa/validate_visual_reviews.mjs` make the later semantic inspection,
per-frame identity, dead-zone findings, score gate and `approved: false/true`
state explicit. The validator only checks review metadata; it never sees pixels
and can never manufacture an approval. Geometry/art changes require a new run
and invalidate prior approvals.

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

## Visual semantic review — GitHub Actions run 33962103333 (round 01, rejected)

**Evidence:** [`qa/visual/evidence/33962103333/`](../qa/visual/evidence/33962103333/) — ten actual Chromium player-height captures and the original capture record. This was a manual semantic review of what is visible in every PNG, not a build, metric, or screenshot-existence pass. Detailed independent-role findings are preserved in [`review_round_01.json`](../qa/visual/evidence/33962103333/review_round_01.json).

| Frame | Requested / recorded region | Inspection result | Approval |
| --- | --- | --- | --- |
| `01-dispatch-spawn` | Dispatch Bay / `dispatch-bay` | **INSPECTED_NEEDS_FIXES** — blank beige sky dominates, mustard route mass and black foreground occlusion read as unfinished prototype geometry. | `false` |
| `02-dispatch-look-east` | Dispatch Bay / `dispatch-bay` | **INSPECTED_NEEDS_FIXES** — east look still has no convincing exterior depth; detached window-strip pattern is visible. | `false` |
| `03-dispatch-look-west` | Dispatch Bay / `dispatch-bay` | **INSPECTED_NEEDS_FIXES** — west look repeats the same sparse grid/empty-sky composition. | `false` |
| `04-intake-motion` | Intake Steps / `intake-steps` | **INSPECTED_NEEDS_FIXES** — actual position is only at the early terminal-facing area; route is dominated by giant flat ochre surfaces. | `false` |
| `05-switch-house-arrival` | Switch House / `switch-house` claimed | **INSPECTED_NEEDS_FIXES** — claimed label is invalid: actual camera position remains near Z 35 before the intake/switch-house transition. | `false` |
| `06-transfer-beacon` | Transfer Beacon / `transfer-beacon` claimed | **INSPECTED_NEEDS_FIXES** — same near-spawn terminal-facing scene; not evidence of arrival. | `false` |
| `07-east-span-runup` | East Span / `east-span` claimed | **INSPECTED_NEEDS_FIXES** — same early scene and no east-span run-up is semantically visible. | `false` |
| `08-east-span-transfer` | East Span / `east-span` claimed | **INSPECTED_NEEDS_FIXES** — actual position remains in the early coordinate band; later-region claim rejected. | `false` |
| `09-boiler-court-arrival` | Boiler Court / `boiler-court` claimed | **INSPECTED_NEEDS_FIXES** — no boiler-court construction is visible; capture remains near early route. | `false` |
| `10-boiler-court-look` | Boiler Court / `boiler-court` claimed | **INSPECTED_NEEDS_FIXES** — same failed composition, not a boiler-court vista. | `false` |

### Batch verdict

`CAPTURED: true` — browser launch, pointer lock, gameplay input and PNG generation occurred.

`INSPECTED: true` — every committed frame was manually semantically examined.

`APPROVED: false` — no image earns approval and this batch is **not** proof of a whole-route walkthrough.

The capture record's original planned labels are retained as capture facts, but must not be used as region-arrival proof: frames nominally representing Switch House through Boiler Court remain in the early route coordinate band. No scores were retroactively inserted into the original capture record. The review-round scores in the companion JSON are diagnostic critic findings, not approval scores.

**Concrete rebuild gate before the next evidence batch:** replace the blank-sky/ochre-block composition with a readable physical atmosphere plus foreground → playable roof → adjacent construction → lower world → distant skyline layers; reduce and structurally embed repeated facade windows; remove lower-right camera occlusion; make stair/threshold movement reach the declared regions; fail requested captures on navigation miss; then recapture and re-review every affected player-height frame.

## Visual semantic review — GitHub Actions run 33962715816 (round 01, rejected)

**Evidence:** [`qa/visual/evidence/33962715816/`](../qa/visual/evidence/33962715816/) was produced from the rebuilt branch in GitHub Actions and every one of its nine player-height PNGs was semantically inspected. The durable frame-by-frame and independent-role review is [`review_round_01.json`](../qa/visual/evidence/33962715816/review_round_01.json). This is a rejected evidence round, not an approval report.

| Frame | Actual grounded support / requested region | Semantic result | Approval |
| --- | --- | --- | --- |
| `01-dispatch-spawn` | `yard-roof` / Dispatch Bay | **INSPECTED_NEEDS_FIXES** — route contact is genuine, but sky still occupies most of the image and the first read is muddy walls, black sill and amber slabs. | `false` |
| `02-dispatch-look-east` | `yard-roof` / Dispatch Bay | **INSPECTED_NEEDS_FIXES** — giant unarticulated brown facade, tiny teal slots and sky replace a credible eastern exterior view. | `false` |
| `03-dispatch-look-west` | `yard-roof` / Dispatch Bay | **INSPECTED_NEEDS_FIXES** — repeated terminal/threshold scene; ridge is only a pale strip and there is no layered harbour vista. | `false` |
| `04-switch-house-arrival` | `yard-roof` / Switch House | **INSPECTED_NEEDS_FIXES; CAPTURED_NAVIGATION_MISS** — actual Dispatch support, not Switch House. | `false` |
| `05-transfer-beacon` | `yard-roof` / Switch House | **INSPECTED_NEEDS_FIXES; CAPTURED_NAVIGATION_MISS** — no real transfer arrival or branch read. | `false` |
| `06-east-span-runup` | `yard-roof` / East Span | **INSPECTED_NEEDS_FIXES; CAPTURED_NAVIGATION_MISS** — still Dispatch imagery, no viaduct/runway. | `false` |
| `07-east-span-transfer` | no authored support (airborne) / East Span | **INSPECTED_NEEDS_FIXES; CAPTURED_NAVIGATION_MISS** — player has fallen below route support; this is not a transfer landing. | `false` |
| `08-boiler-court-arrival` | `yard-roof` / Boiler Court | **INSPECTED_NEEDS_FIXES; CAPTURED_NAVIGATION_MISS** — visible checkpoint reset and Yard Roof contact prove recovery, not court arrival. | `false` |
| `09-boiler-court-look` | `yard-roof` / Boiler Court | **INSPECTED_NEEDS_FIXES; CAPTURED_NAVIGATION_MISS** — another Dispatch frame, invalid for Boiler Court review. | `false` |

### Batch verdict and next rebuild gate

`CAPTURED: true` — real CI Chromium, pointer lock, mouse/keyboard input and player-height screenshots occurred.

`INSPECTED: true` — every PNG was examined for visible architecture, composition and actual location evidence.

`APPROVED: false` — only three Dispatch frames have authenticated authored-support contact; all six later-region claims missed navigation. Even Dispatch remains critically below quality: the physical sky is an improvement over beige but still dominates the composition, while simple brown facade boxes and oversized amber threshold masses retain the prototype read.

Before the next run: (1) feedback-align yaw and pitch with real pointer-lock mouse input before every traversal phase; (2) record only actual grounded authored-support arrivals; (3) remove tall orange threshold blocks by opening the parapets and using thin mounted nosings; and (4) rebuild Dispatch as a layered foreground roof / adjacent constructed building / lower rail-harbour / distant industrial skyline composition. A material or geometry change invalidates this round and requires newly captured, newly inspected frames.

## Visual semantic review — GitHub Actions run 33963122090 (round 01, rejected)

**Evidence:** [`qa/visual/evidence/33963122090/`](../qa/visual/evidence/33963122090/) was fully inspected after the first attempt at pointer-lock direction calibration. Its full per-frame record is [`review_round_01.json`](../qa/visual/evidence/33963122090/review_round_01.json).

`CAPTURED: true` · `INSPECTED: true` · `APPROVED: false`

All nine images are rejected as technical visual evidence. They show almost exclusively a blue sky gradient with a small detached black/gold wrist shape, not player-visible route architecture. The capture metadata records direction Y values of approximately `+0.9468`: the camera is looking nearly vertically upward. The calibration sign was inverted for Three.js (`getWorldDirection().y = sin(cameraRig.rotation.x)`) and virtual-pointer edge clamping prevented correction. The three Dispatch captures retain real Yard Roof support contact but are still unreviewable visually; the six subsequent frames continue to report `CAPTURED_NAVIGATION_MISS`. No scores were fabricated for a sky-only invalid view.

**Required before another region capture:** use a slightly negative default pitch, derive pitch as `asin(cameraDirection.y)`, use real unbounded relative pointer movement for correction, and verify the recorded Dispatch direction/view before asking the run to traverse. This batch cannot be revived or approved by a later code change.

## Visual semantic review — GitHub Actions run 33963545789 (round 01, rejected)

**Evidence:** [`qa/visual/evidence/33963545789/`](../qa/visual/evidence/33963545789/) is the first captured batch with corrected player pitch. All nine images have been semantically reviewed alongside their actual collision-support evidence; detailed individual findings and role review are in [`review_round_01.json`](../qa/visual/evidence/33963545789/review_round_01.json).

`CAPTURED: true` · `INSPECTED: true` · `APPROVED: false`

The correction is real: the three Dispatch frames are grounded on `yard-roof` with camera direction Y about `-0.18`, and the player can now see the roof and terminal. That is evidence of a camera/capture fix—not a visual pass. The visible world remains a brown/black/orange/teal box prototype: monolithic stained facades, dark barrier blocks, detached window cards, repetitive orange stair noses, little lower harbour/rail context, and only a thin pale distant ridge. Frames 04–09 are still navigation misses: Dispatch, Intake Steps, unsupported air, then Switch House support—not the requested Switch House/East Span/Boiler Court arrivals. Those frames retain null scores and cannot be relabelled as later-region proof.

**Concrete next gate:** overlap and lower the yard-to-intake connection within the verified step bound; require exact authored support surfaces during capture; give East Landing → Boiler Court physical shallow entry risers; remove the persistent floating wrist block; split broad facades into bays/recesses/side-face windows; reduce orange to small mounted nosings; and add a player-visible lower harbour, gantry and distant industrial silhouette. A fresh real-input CI batch must be inspected after those changes.
