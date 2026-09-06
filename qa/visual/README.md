# Rivet Run player-height visual inspection loop

## Hard evidence rule

There is no visual pass without genuine rendered first-person frames from a
lawfully available local browser. Builds, static geometry, test passes, traces
without frames, visual-source code, screenshot filenames, FPS and pixel metrics
cannot substitute for the review.

## Capture coverage

`tools/qa/capture_visual_views.mjs` must drive/capture Dispatch Bay, Intake
jump, Kinetic Permit, Switch House canopy/checkpoint, West Shaft, East Span,
Boiler Court, Control Bridge slide, Sunline Bridge, finish, lower boundary,
dash, wall contact, slam and landing. Capture default and one `?seed=` variant.

## Evidence states

A captured PNG begins as **`CAPTURED_UNINSPECTED`**. It becomes
**`INSPECTED`** or **`NEEDS_FIX`** only in a separate role review that cites the
immutable capture run/frame ID and exactly repeats the captured region, camera,
player state and seed. `APPROVED` is disallowed until all nine roles have reviewed
fresh frames after the last art/geometry change, no critical defect remains,
every category is at least 7.5 and combined average is at least 8.5. A capture,
trace, passing test, audit count, filename or pixel measurement cannot advance a
state by itself.

## Review procedure

1. Capture a run through real first-person pointer-lock entry, input, look and
   traversal. A label is a navigation miss unless grounded collision contact
   matches the requested authored region.
2. Each independent role in `critics/` writes a v1 record under `reviews/` for
   the matching capture run and answers every frame's visible/bad/placeholder/
   repetitive/unconvincing/missing assessment plus replace/move/add/remove action.
3. Run `node tools/qa/validate_visual_reviews.mjs` (set
   `VISUAL_CAPTURE_MANIFEST` for an evidence-folder `capture_record.json`). It
   validates metadata/coverage only; it is not image analysis.
4. Triage defects by exact region, make one concrete change set, then capture
   and review a new run. Three critique/fix cycles are required per major region;
   under-8.5 regions continue iterating.

## Review rule

For each region, semantic review must name visible strengths and failures in:
prototype signal, material quality/repetition, supported construction, accidental
floating/intersections, composition, scale, route clarity, lighting, colour,
distant depth, transition readability, environmental storytelling, HUD and
memorable identity. It must explicitly assess visual dead zones, distinguish
structural repetition from copy/paste monotony, and decide whether foreground →
playable structure → adjacent/lower world → distant world → atmosphere is present.
