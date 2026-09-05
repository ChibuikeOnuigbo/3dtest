# Bevy Ahoy — source study record

| Field | Record |
|---|---|
| Repository | <https://github.com/janhohenheim/bevy_ahoy> |
| Local research commit | `630a4573725242d23260ca6c18602d037cb713c5` (depth-one clone, 2026-09-05) |
| Licence files observed | `license-mit.txt`, `license-apache.txt` (dual MIT / Apache-2.0 files present) |
| Runtime use | None. It is a Rust Bevy/Avian controller, not a Three.js dependency. No source or asset is copied. |

## Repository map inspected

| Path | What it covers | Reusable *principle*, not code |
|---|---|---|
| `src/kcc.rs` | core character-controller update, ground/air acceleration, move-and-slide, step/snap, crouch, wall/tic-tac, mantle and water logic | explicit fixed-step state/timers and separate ground/air movement branches |
| `src/dynamics.rs` | character/dynamic-body interaction | only introduce moving-body transfer when this level has a tested moving platform need |
| `src/camera.rs` | first-person camera relationship | camera needs its own clean controller relationship; it should not clip through a visible player body |
| `src/input.rs` | input actions and accumulation | keep input state/intents distinct from integration |
| `src/fixed_update_utils.rs` | fixed-timestep flagging | browser controller needs a bounded/fixed simulation cadence for repeatable feel |
| `examples/minimal.rs`, `playground.rs`, `surf.rs` | feature examples | use examples as behavior test ideas, never content/assets |
| `assets/maps/license.md` | map-specific asset rights note referenced by README | reference/demo map assets are not production assets |

## Principles adopted for Rivet Run

1. **Fun kinematic movement over accidental simulation.** The current controller
   owns velocity/integration rather than relying on renderer physics.
2. **Tight state windows.** 120ms coyote time and 130ms jump buffering preserve
   intent at roof edges; their actual values remain subject to player capture.
3. **Different ground and air control.** Ground acceleration is high; air damping
   is deliberately lower so correction is possible but flight is not.
4. **Crouch only when there is room.** The controller checks headroom before
   expanding after the Control Bridge passage.
5. **Terrain/step/snap are a future route need, not a checkbox.** The present
   Highline course uses intentional deck heights. Add step/snap/ramp handling
   only when player-height evidence shows it is needed.
6. **Feature parity is not the goal.** Ahoy lists mantle, water, moving platforms
   and tic-tacs, but Rivet Run must only add each feature where it has a designed
   segment, visuals, collision review and test coverage.

## Evidence / boundaries

README claims were verified against the source tree (including dedicated ground,
air, step, mantle and input areas), but source behavior has not been run in its
Rust engine in this task. The Highline controller is independently authored in
`src/systems/MovementController.js`; no implementation, models or maps are
port-copied. Browser player-height collision/feel is still unverified because a
lawful local executable is unavailable.
