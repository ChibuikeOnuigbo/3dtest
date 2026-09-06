# FPS2 — systems record

## Observed systems

Pointer lock and input paths, weapons/loading comparison, fog/sky/HUD, but repetitive per-frame Box3/name collision is a technical anti-pattern.

## Independent adoption boundary

A useful system is a principle to independently implement, test and inspect in Rivet Run—not permission to transplant source, dependencies, maps, or runtime assumptions. Any adoption must have its own task, tests and player-height evidence.
