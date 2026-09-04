# Independent technical pattern library

This is a clean-room design response to reference findings. Names below describe
responsibilities, not copied classes/functions. No reference code is used.

## 1. Boot and recovery

`AppBoot → CapabilityCheck → AssetManifest → MissionLoad → TitleState → PlayState`

- Load only a small shell before title/start. Asset manifest records ID, URL/local path,
  license state, byte budget, required zone and fallback status.
- A failed non-critical asset creates a visible controlled fallback; a failed critical
  asset keeps play disabled with an actionable error. No silent missing meshes/audio.
- Audio context is created/unlocked only by a player gesture. Input lock, resize and
  pointer-lock loss have single ownership.

**Evidence:** Enari's central loading manager is useful; its hard-coded serial preloading
is not. The web browser test will cover start, pointer lock denied/lost, and asset error
handling.

## 2. Game-state ownership

A serializable `MissionState` holds only game facts: `phase`, objectives, door states,
interaction flags, inventory, weapon state, ending status and checkpoint. Room visuals,
colliders, UI and audio subscribe to state changes; they do not separately decide truth.

```text
input → interaction/weapon intent → reducer/guard → MissionState event
      → door/collider + objective/UI + audio/visual feedback
```

Every command has a precondition and named failure feedback. Door state alters both the
render animation and collision slab on the same event. This avoids the duplicate
controller/state systems found risky in large inline examples.

## 3. Player and camera contract

- Fixed 1/120-second simulation accumulator with bounded catch-up; rendering interpolates
  or samples the authoritative player pose.
- Kinematic vertical capsule: gravity, grounded/slope test, jump (only if design uses it),
  walk/sprint modes, slide/step resolution and a spawn-reset safety plane.
- Collision queries only authored static hulls / primitives. A door contributes a separate
  closed/open collider; decorative meshes are not collision truth.
- First-person yaw/pitch is camera owned; player motor receives yaw-relative planar
  intent. No second competing controller. First-person is chosen initially; third-person
  camera obstruction costs nothing because it is not shipped without a story need.

**Tests later:** wall/corner slide, edge/no fall-through, doorway open/closed, sprint,
frame spike, staircase/ramp, pointer-lock pause and respawn.

## 4. Data-driven place and interactions

`RoomDefinition`, `DoorDefinition`, `InteractionDefinition`, `ObjectiveDefinition`,
`AudioZoneDefinition` and `LightDefinition` are data records keyed by stable IDs.
A room must define: purpose, visual identity, entrances/exits, collision, landmark,
lighting, interaction, objective/state consequences, audio zone, screenshot test and
performance budget before décor is admitted.

Interaction focus uses a camera ray plus distance and explicit semantic proxy. It cannot
be satisfied through a wall. Flow is `available → focused → prompted → performed →
resolved/failed`. CSS-Dungeon supplies the conceptual model; no bundle code/assets do.

## 5. Rendering and zone lifetime

One Three.js renderer, one world scene, and (only if final held equipment needs it) a
small separately rendered viewmodel scene with controlled depth clearing. Lighting starts
with a few shadow-casting sources, baked-looking ambient fill and emissive practical
fixtures; postprocessing is opt-in after a measured budget. Portal-connected room zones
activate rendering/audio/interactive detail only when near or visible. They do **not**
reset mission state.

## 6. Weapon, animation, audio and UI limits

- Weapons are a small data table (`idle`, `fire`, `cooldown`, `reload`, `empty`,
  `disabled`), with cooldown/ammo authoritative before visuals. The game will not promise
  a reload/inspect/hand animation until its approved asset supports it.
- Animation mixer actions use semantic state names and deliberate transition times;
  missing clips degrade safely, never fake an animation result.
- Audio mixer categories: ambience, world, interaction, weapon, UI; positional sounds
  have range/rolloff; subtitles/event text accompany important progression sounds.
- HUD exposes objective, focused prompt, health/ammo only if gameplay makes them meaningful;
  UI is DOM/accessibility-backed and never copied reference chrome.

## 7. Performance and test architecture

Instrumentation records frame time percentiles, active room count, draw calls/triangles
when available, texture/model byte totals and asset errors in development. Production
quality tiers reduce shadows/scale rather than deleting collision or objective feedback.

Playwright future critical path: launch/start → lock pointer → move/sprint/collide →
focus/use each required interaction → verify door/collider/objective transitions →
complete ending → assert no page/console/request failures → capture real browser images
for each required location. A test cannot be marked passed while no usable browser exists.
