# Staged composition review — 2026-09-07 (local SwiftShader, rebuilt scene)

**Evidence class: `STAGED_COMPOSITION` — NOT gameplay evidence. VISUAL APPROVAL = FALSE.**

These frames were produced by `tools/qa/capture_visual_views.mjs` in `staged` mode: the real
game renders in a real (software-GL) Chromium, the player controller is placed on an authored
walkable solid with the probe `teleport()`, the camera is the real first-person rig at eye
height 1.62 m, and the frame is the actual `<canvas>` output. No movement input was used to
reach these positions, so they prove *what the built world looks like from the player's eye*
but do **not** prove the route is traversable — that is what the CI `gameplay` mode is for.

Local renderer: SwiftShader (0.7 fps at 480×270). Frames are 960×540 JPEG canvas captures. All
findings below are from opening the image and describing what is in it — no pixel metric,
brightness gradient or file-existence check stands in for a finding.

| frame | support solid | camera (feet y) | seed | status |
|---|---|---|---|---|
| 01-dispatch-spawn (staged-04) | shed-floor | 0, 0.1, 50.5 yaw 0 | rivet-run-highline-01 | INSPECTED — NEEDS_FIX |
| 05-transfer-kiosk (staged-04) | transfer-roof | 0, -1.6, 21.5 yaw 0 | rivet-run-highline-01 | INSPECTED — NEEDS_FIX |
| 15-turbine-hall (staged-04) | hall-catwalk-n | 3.4, -3.4, -64 yaw -0.55 | rivet-run-highline-01 | INSPECTED — NEEDS_FIX |
| 10-boiler-court (staged-02) | boiler-roof | 9, 8.6, -31.5 yaw π/2 | rivet-run-highline-01 | INSPECTED — NEEDS_FIX |
| 18-sunline-gantry (staged-03) | gantry-a | 0, -0.4, -96 yaw 0 | rivet-run-highline-01 | INSPECTED — NEEDS_FIX (best frame) |

Records: `capture_record_staged-0{2,3,4}.json` (schema `rivet-run-player-height-capture/v3`).

## Per-frame semantic findings (A–J)

### 01-dispatch-spawn
- **A visible:** corrugated-steel shed doorway framing the roof; painted-concrete deck running to the
  pipe-rack gate; three brick stacks, a rack platform and the skyline behind; warm evening sky.
- **B bad:** the door lamp housing rendered as an over-scaled bright slab over the door (fixed:
  lens 0.22 m, housing 0.5 m); the deck still reads as a long empty plane.
- **C placeholder:** none of the old bare boxes remain in frame; deck is still texture-only.
- **D repetitive:** corrugation stripes on both jambs identical; deck texture visibly tiled in
  the far third (macro-noise pass added after this capture — must re-verify).
- **E unconvincing:** the doorway has no threshold plate, hinge side or sign edge.
- **F missing:** kinetic content between door and gate (added: route paint lines, drain grate,
  step-over steam line at z 38.5 — uncaptured yet).
- **G replace / H move / I add / J remove:** nothing to remove; add a foreground prop line
  (crates, reel, bollards added east/west of the lane — off-axis, not visible in this frame).
- **Layering check:** foreground (jambs) → playable (deck) → adjacent (rack gate, stacks) →
  distant (skyline) → sky. Lower world not visible from here (by design, it opens at the parapet).

### 05-transfer-kiosk
- **A visible:** kiosk with steel posts, transparent glazing (now see-through), terminal with
  lit screen, painted fascia; the conveyor-gallery mouth with stairs and the CONVEYOR GALLERY sign
  straight ahead; harbour bridge cables to the west; stacks and tanks to the east.
- **B bad:** kiosk interior is a flat brown box (roof underside untextured, no ceiling grid or
  cable tray); the sill panels are plain slabs.
- **C placeholder:** sill panels and terminal body are flat single-colour boxes.
- **D repetitive:** none significant.
- **E unconvincing:** the kiosk floats on the roof with no plinth/kerb.
- **F missing:** a reason to stand here (posters, a map board, a ticket printer, cabling).
- **I add:** ceiling cable tray, a notice board on the west sill, kerb plate around the kiosk.
- **Layering check:** good — playable roof → kiosk → gallery mouth → skyline both sides.

### 15-turbine-hall (after high-bay lighting)
- **A visible:** brick hall, red roof trusses, mullioned window wall (now actually reads as
  windows with light panes), turbine casing with oxide bands, steam pipe, floor with yellow
  lane paint, the far gallery with the SUNLINE GANTRY sign, arrival catwalk railing.
- **B bad:** lighting is flat — the high-bay lamps light the walls evenly but the floor is dim
  and the turbine casing has no specular highlight; a grey box (crate) sits alone on the floor.
- **C placeholder:** the crate; the pulpit cabinet is barely readable.
- **D repetitive:** window panes on the east wall repeat with identical spacing — acceptable for
  a factory, but every pane is equally lit; the mullion material already varies pane brightness
  in-canvas, so the repetition is the geometry, not the texture.
- **E unconvincing:** the steam pipe terminates in mid air (elbow not connected to the casing).
- **F missing:** overhead crane bridge visible from here, floor clutter (pallets, drums), a
  second light colour (the skylight should give a cool wash).
- **G replace:** the pipe stub with a proper header connected to the casing.
- **I add:** cool skylight fill, drums/pallets along the plinths, a crane bridge under the rails.

### 10-boiler-court
- **A visible:** two corrugated tanks with dark caps, three brick stacks with steel bands, a
  pipe bridge on stanchions, ladder, container yard beyond, harbour bridge and sky.
- **B bad:** the shortcut pipe dominated the bottom of the frame as a flat maroon slab (moved to
  x 5.2 / z −39.5 with saddles — not yet re-captured); the roof deck is otherwise empty.
- **C placeholder:** the pipe stub (fixed), the far right dark cabinets.
- **D repetitive:** three identical stacks at identical spacing; tank corrugation identical.
- **E unconvincing:** stacks stand directly on the roof with no plinth/breeching.
- **F missing:** breeching ducts into the stacks, a header tank plinth, floor drains, cable trays.
- **I add:** stack plinths + breeching, vary stack heights/caps, a second tank size.

### 18-sunline-gantry
- **A visible:** grating catwalk with rails, red truss portal, the MISSING PANEL · DOUBLE JUMP
  sign (now legible), the gap and the lower recovery catwalk with ladder, the finish crane
  portal framing the cab landing ahead, quay cranes, tug on the water, harbour bridge cables.
- **B bad:** the far-right harbour is flat light grey (fog + water with no reflection detail);
  the two pale blocks top-left (crane cab / machinery house) are untextured.
- **C placeholder:** crane cab boxes, the light-grey water plane.
- **D repetitive:** lamp posts evenly spaced (acceptable), truss modules identical.
- **E unconvincing:** the red frame's beam ends are unfinished (no gusset plates).
- **F missing:** water normal/reflection, harbour lights for depth, hazard chevrons on the gap edge.
- **Layering check:** best in set — foreground rail → playable catwalk → gap/lower catwalk →
  finish crane → quay cranes → harbour + bridge → sky.

## Actions taken from this pass (committed)
- Camera eye height 1.62 m (was 0 → frames read from the floor).
- Sign canvas text auto-fits its plate (was clipped: "G PANEL · DOUBL").
- Glazing is now transparent (`glass` material) — kiosk and cab windows read as windows.
- Mullioned window canvas material with per-pane variation (`windowLit` / `windowDim`).
- Macro world-space noise on all textured and flat steel families (anti-tiling).
- Turbine hall: three high-bay lamps, floor lane paint, MCC cabinets, drop pipe moved out of the
  arrival sightline.
- Dispatch: run-lane paint, drain grate, step-over steam line, door dressing, split pipe rack
  with a gate on the route axis, finish crane moved onto the route axis so the cab landing sits
  in its portal.
- Fog density reduced ~35% so the distant world is not erased.
- Rotated-cylinder colliders fixed (a horizontal pipe used to register a 9 m tall wall).

## Not yet done (carry forward)
- Re-capture 01/10/15 after the fixes above; capture 07-split-deck, 09-container-stack,
  13-control-corridor, 14-drop-room, 19-finish-cab.
- Gameplay-mode capture in CI with a trace (the only evidence that counts toward approval).
- Boiler court plinths/breeching, kiosk ceiling/kerb, hall crane bridge + skylight fill,
  water surface detail.

## Pass 12 (22:59 UTC) — `17d-hall-door-front.jpg` (STAGED, local SwiftShader, 960×540) — INSPECTED
Pose: south gallery deck of the turbine hall `[7.5,-0.4,-90.3]`, yaw π/2−0.05, pitch 0.1, player GROUND on `hall-gallery-s`.
- **A visible:** grated gallery walkway running west along the brick south wall; the hall roller door on the
  right — corrugated steel curtain in a REAL opening (dark reveal behind the jamb, guide track and side
  channel visible, yellow kick-plate band, hood/lintel above); left: rail, the hall's red truss and gantry
  girder, a hanging cage light, the lit mullioned windows of the north wall, two grey drums in the
  foreground corner.
- **B bad:** the curtain is uniformly lit and reads flat — the slat relief is only a texture; there is no
  drum/chain/motor visible from this angle (it is above the hood — see 17e) so from the front the door
  reads as a static shutter. Ceiling is a black void above the truss (skylight fill absent from this angle).
- **C placeholder:** the two drums bottom-left are the procedural cylinders (Poly Haven barrel models
  only appear with the CI manifest) — flagged, to be replaced by real models in the CI capture.
- **D repetitive:** window mullion pattern identical across the north wall; brick tile visibly repeats
  on the right wall at ~1.5 m period.
- **E unconvincing:** the truss bottom-chord ends float against the black ceiling; no gusset plates.
- **F missing:** door signage ("HALL 4 · KEEP CLEAR"), a push-button box by the jamb, warning strobe,
  floor hazard chevrons in front of the curtain; a ceiling plane / skylight glow behind the truss.
- **Layering:** foreground rail+drums → playable walkway → door/wall → hall interior (truss, windows)
  → NO distant world (correct for an interior, but the ceiling void needs to be closed).
- **Critic scores (staged, local; not approval):** art direction 6.0, environment art 6.0, level design
  7.0 (door reads as the exit), technical 6.5, hostile 5.5 ("black ceiling, flat door, procedural drums").
- **Defects logged:** D-17d-1 black ceiling void from the gallery; D-17d-2 door front dressing missing
  (signage, control box, chevrons); D-17d-3 curtain lighting flat (needs a lamp raking across the slats).
VISUAL APPROVAL remains FALSE.

### Pass 13 (23:04 UTC) — `17d-hall-door-front.jpg` re-captured after the D-17d fixes — INSPECTED
- D-17d-1 **fixed**: the ceiling now reads as a pale corrugated soffit with the dark skylight band between
  steel kerbs (no black void; truss chords now sit against a surface).
- D-17d-2 **fixed**: hazard chevrons on the deck in front of the curtain, control box with red/green
  push-buttons on the east jamb, jamb lamps either side; the header sign is above the frame at this pitch
  (will show in 17e / from the gantry side).
- D-17d-3 **partly fixed**: the west jamb lamp rakes light across the slats — the slat relief now reads
  near the lamp; the curtain centre is still dark (one real light per door because of the 24-point-light
  budget — the hood lamp was converted to emissive-only to pay for it).
- Remaining: procedural drums bottom-left (CI manifest → real models); brick tiling period on the right
  wall; the curtain material would benefit from a real Poly Haven `painted_metal_shutter` set in CI.
- Critic re-scores (staged, local; not approval): art 6.5 (+0.5), environment 6.5 (+0.5), level 7.0,
  technical 6.5, hostile 6.0 (+0.5). VISUAL APPROVAL remains FALSE.
