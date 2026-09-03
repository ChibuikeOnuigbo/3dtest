# Strict browser FPS QA rubric

**Status:** QA policy and required evidence matrix only. It has **not** been executed in
this research phase because no current independently-built browser FPS is under test.
A static HTML response, a build log, generated art, an unexecuted test file, or a
manually asserted success is not Playwright evidence.

## Non-negotiable evidence rules

1. Run the actual game in a real browser using Playwright against the live preview URL.
   Tests must use the intended canvas, browser events, and pointer-lock-compatible input
   path—not direct internal state mutation except to read a documented debug probe.
2. Each critical claim needs all three: an action trace, an observable state assertion,
   and at least one captured browser screenshot from that exact run. Retain console/page
   errors, test trace/video when enabled, and frame timing measurements with the run ID.
3. A screenshot is only evidence when its sidecar test result identifies the viewport,
   app URL/revision, test scenario, timestamp, and the assertion it supports. It must not
   be a generated illustration or a static mockup.
4. Test every selectable/equippable weapon in the released game. “Weapon works” cannot be
   inferred from a shared function, model presence, or a subset of weapons.
5. Re-run a failed critical scenario after a fix. A claimed fix with no clean rerun is
   **untested**, not passing.

## Scorecard (100 points before penalties)

| Area | Pts | Required real-browser evidence | Pass condition |
|---|---:|---|---|
| Boot, resize, pause/recover | 8 | Game reaches playable state; 16:9 and narrow viewport screenshots; no fatal console/page error. | Canvas/overlay scale correctly; focus/pause cannot leave stuck input. |
| Camera & pointer lock | 14 | Click-to-lock; four direction mouse turns; pitch-limit test; unlock/relock; before/after screenshots plus yaw/pitch probe. | Horizontal rotation, clamped pitch, sensitivity and recovery are visible/consistent. |
| Walk, sprint, jump/grounding | 16 | W/A/S/D, diagonal, Shift run, release keys, doorway/stair/edge traversal; measured distance/time screenshots. | Sprint is measurably faster than walk; no drift, tunnelling, bounce, stuck key, air sprint anomaly or fall-through. |
| Collision & spatial interaction | 14 | Push every critical wall/corner/cover/doorframe; interaction-ray target; locked → denied → unlocked → open → close; return pass. | Player never crosses a closed collider; prompt targets intended entity; no snag/teleport or state loss. |
| Every weapon & firing | 22 | For each weapon: equip, fire, cooldown/automatic behavior as designed, hit/impact, empty state, reload, re-equip; a screenshot and state assertion per weapon. | Correct ammo mutation and gate; no duplicate shots, silent failed input, broken viewmodel, stuck reload or missing fire feedback. |
| Mission/zone continuity | 10 | Yard → threshold → interior → objective → return/ending; zone-load instrumentation; four zone screenshots. | Door never opens to unloaded space; objective/weapon/player state persist; ending is clear. |
| UI, audio, animation | 7 | HUD updates on health/ammo/objective; user-gesture audio unlock; fire/reload/door/zone sound checks; animation transition screenshots. | Readable HUD; meaningful feedback synchronized to events; no looping/stuck animation/audio. |
| Stability & performance | 9 | 10-minute movement/combat soak; 30 transitions; browser console capture; p50/p1 frame time, draw calls, initial/zone-load timing. | No uncaught error/memory-growth pattern; targets met or documented as a release blocker. |

**Passing bar:** 90/100 or higher *after* penalties, every critical line evidenced, zero
unresolved blocker, and visual review of each screenshot at the same 90% standard.
Scores cannot be rounded up to 90.

## Critical scenarios and future Playwright IDs

| ID | Scenario | Minimum state assertions | Screenshots |
|---|---|---|---|
| `C01-camera-pointer-lock` | Start, lock, yaw/pitch sweep, unlock/relock. | `locked`, yaw changes, pitch remains within limits. | locked facing A / facing B / re-locked |
| `C02-walk-sprint-collision` | Walk and sprint same straight route; test diagonal/doorframe/wall. | distance(sprint) > distance(walk); grounded; position stays outside static colliders. | route start / sprint / doorway |
| `C03-door-zone-transition` | Attempt locked door, satisfy requirement, open, cross, return and close. | ordered door state events; target zone ready before open; mission state unchanged. | denied / open threshold / interior / return |
| `C04-weapon-<id>` | One test generated for each shipped weapon ID. | equip→ready→fire→impact→ammo decrement→reload→ready. | equipped / impact / reload complete |
| `C05-objective-ending` | Complete required objective and take valid exit/ending. | objective transition ledger, persistent inventory/door state, end state. | objective / resolved / end screen |
| `C06-soak-and-console` | Ten-minute automated route / repeated interactions. | zero uncaught/page errors; metrics captured. | start / midpoint / completion |

The game must expose a narrowly scoped **test-only read probe** in development builds
(e.g. `window.__fpsTestProbe.snapshot()`), returning positions, camera angles, selected
weapon/ammo/state, door/objective states, zone readiness and timing counters. Tests must
never call methods that alter state through that probe.

## Severe deductions and hard caps

Deductions apply **in addition to** lost row points. They prevent presentation quality
from hiding functional failures.

| Finding | Deduction / cap |
|---|---|
| Missing real Playwright evidence for any critical scenario | −25 each; final score capped at 60 until evidence exists. |
| Claim contradicted by the browser run, screenshot, trace or console | −30 each; final score capped at 50 and claim must be withdrawn. |
| Crash, blank canvas, unrecoverable pointer lock, fall-through, soft lock, closed-door pass-through, or nonfunctional required weapon | −35 each unresolved; release **BLOCKED** regardless of arithmetic. |
| A previously fixed critical bug reproduces on re-run | −20 each recurrence; must include regression test before scoring again. |
| Any console/page error during critical path | −10 each unique error (or release blocker when fatal). |
| A weapon/door/zone is only statically inspected or unit-tested, not browser-driven | −15 each; no credit for its full row. |
| Screenshot does not correspond to recorded browser run or is generated/staged | invalidates associated evidence; −30 integrity penalty. |
| Room visual review below the 90% standard (monotony, visible seams, incoherent props, unreadable lighting, broken composition) | −5 to −20 per room; room cannot be signed off. |
| Kenney asset, unlicensed asset, unclear third-party provenance, or uncredited reuse | release **BLOCKED** until removed/replaced/cleared; −30 provenance penalty. |
| Performance metric omitted or target missed with no recorded triage | −10; no final 90+ verdict. |

## Test implementation protocol

1. Start app bound to `0.0.0.0` and use the Arena preview host, not browser-side
   `localhost`.
2. Create an evidence directory by revision/run ID, such as
   `qa/playwright/<revision>/<scenario>/`. Store `.png`, trace/video (when used), JSON
   result, metric sample, and console/page-error log together; do not call this directory
   “passed” until reviewed.
3. Configure Playwright’s project to use a fixed desktop viewport first (1440×900), then
   a narrow viewport regression pass. Browser uses a real hardware-independent WebGL
   fallback policy that is recorded, not silently ignored.
4. Trigger pointer lock by actual canvas click. Drive keyboard/mouse and wait for observed
   state transitions with explicit timeouts; do not use arbitrary sleeps as proof.
5. For every screenshot, inspect it at full size: geometry seams, z-fighting, clipping,
   darkness, UI overlap, texture errors, misplaced props and empty/monotonous rooms are
   defects, not cosmetic notes.
6. Re-run C01–C05 after changes to camera, player motor, collision, doors, maps, weapons,
   renderer, asset manifest or loading system. Re-run C06 for a release candidate.

## Current score

**Not scored — no playable implementation exists, and an actual 2026-09-04 Playwright Chromium provisioning attempt was blocked by secure TLS connection resets. The evidence log is `qa/browser-prerequisite-2026-09-04.log`; no screenshot was fabricated.** Assigning a numeric quality score now would violate this rubric.
