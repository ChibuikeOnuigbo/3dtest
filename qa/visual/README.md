# Vector Run visual inspection loop

## Evidence gate

A visual approval requires three independent layers:

1. **Mechanical QA** — world bounds, traversal surfaces, navigation graph, state and
   collision tests.
2. **Image QA** — meaningful player-height captures after actual input/movement.
3. **Visual-reasoning QA** — image inspection against room purpose, expected focal point,
   route, lighting, assets, scale and the level map.

No area receives a visual score or PASS until all three have evidence. Pixel differences,
file existence, scene coordinates and build output alone cannot grant approval.

## Capture contract

When a supported browser is available, `tools/qa/capture_visual_views.mjs` launches it
using an existing executable only. It captures player-height views following real game
input and stores action/console context. Its target views are entry, focal point, path,
interaction, exit, secondary and vertical relationship where relevant.

The visual critic must identify a primary focal point, secondary focal point and navigation
target, then report only `PASS` or `FAIL` with issue severity/location/recommended fix.
No generic “looks good” result is accepted.

## Current status

`qa/visual/*/room_context.json` contains the intended review inputs. Screenshots and
semantic visual review are **BLOCKED_NO_BROWSER_BINARY**, so the reports use null scores
and make no claim about how the rendered course looks.
