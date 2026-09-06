# Movement design — Rivet Run

## Controller target

Rivet Run aims for deliberate, momentum-friendly first-person movement: immediate
inputs, predictable landing/edge behavior, enough air control for recovery, and
clear hazards without arbitrary physics surprises. It is inspired by movement
principles researched from Bevy Ahoy, not copied code.

## Current runtime contracts

| System | Current implementation | Player-facing purpose | Test status |
|---|---|---|---|
| Walk / sprint | grounded target speed with damped acceleration | readable roof traversal / quick line | logic-covered |
| Ground jump | buffered jump, jump velocity, gravity | clean roof gaps | logic-covered |
| Coyote time | 120ms post-edge grace | avoids brittle edge misses | controller-coded; visual run pending |
| Input buffer | 130ms queued jump | preserves intentional landing input | controller-coded; visual run pending |
| Air control | lower air damping than ground | correction without flightiness | controller-coded; visual run pending |
| Double jump | one gated air jump after terminal | second-level traversal choice | logic-covered |
| Wall jump | bounded, normal-based 3-jump chain | West Shaft skill route | controller-coded; player-height collision pending |
| Dash | 170ms directional speed burst / cooldown | East Span fast route | logic-covered |
| Crouch / slide | lower capsule + speed-dependent slide | maintenance-passage compression | logic-covered |
| Slam | air crouch applies immediate downwards velocity | quick recovery / landing expression | logic-covered |

## Bevy Ahoy research record

`research/github/bevy_ahoy/` will hold the per-source record. Its published
feature/design description was checked on 2026-09-05: stair stepping, ramp
walking, ground snapping, Quake/Source air movement, coyote time, input
buffering, moving-body interaction and first-person camera are useful principles.
Porting means independently implementing the behavior in Three.js and validating
it against our AABB route—not copying its Rust/engine code.

## Official Three.js FPS bounded reference

The official `games_fps` example was studied in
`research/threejs_fps_example.md`. Its Octree/static-triangle collision,
`Capsule`, YXZ camera, fixed substeps, gravity/damping and collision-response
pattern inform only our validation vocabulary. Rivet Run retains an independent
AABB controller and must not copy example source wholesale or imply that a demo
proves its player-facing parkour quality.

## Remaining movement validation

Browser evidence is currently blocked by no lawful local browser executable.
Once available, player-height captures must include: full-speed approach,
late edge jump, buffered pre-landing jump, north/south/east/west air steer,
West Shaft wall contacts, East Span dash, slide ceiling, airborne slam, recovery
and final bridge landing. The controller must be tuned from observed captures,
not declared finished from static tests.
