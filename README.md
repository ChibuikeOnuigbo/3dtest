# Vector Run: Skyline Relay

A small, original first-person parkour and target-action game built with Three.js.

**Identity:** speed, momentum, vertical routes, precision jumps, target encounters, fast
checkpoints and personal-best runs. It is not a horror game, bunker, abandoned facility or
slow exploration game.

## Controls

| Action | Default binding | Behavior |
|---|---|---|
| Move | `W` `A` `S` `D` | Directional movement with air control. |
| Jump | `Space` | Ground jump, coyote/buffered response; second jump after the prism unlock. |
| Dash | `Shift` | Short directed dash with cooldown. |
| Crouch | `Ctrl` | Crouch; while fast on ground it slides, while airborne it ground-slams. |
| Pulse | mouse click | Clears mechanical targets in the Target Court. |
| Restart | `R` | Fast checkpoint restart. |
| Pause | `Escape` | Releases mouse capture. |

The runtime uses action identifiers rather than scattering key-code checks. The HUD reads
its displayed control labels from the binding map.

## Course

```text
Launch Dock → Kinetic Prism → Checkpoint / Split Route
                                ├─ Wall Link
                                └─ Dash Span
                              → Target Court → Sunrise Gate
```

The complete topology, 3D hierarchy, source-pattern synthesis and collision/traversal
intent are in [`docs/LEVEL_MAP.md`](./docs/LEVEL_MAP.md) and
[`game/data/level_map.json`](./game/data/level_map.json).

## Development

```bash
npm install
npm run dev
npm run test:logic
npm run build
```

`npm run test:logic` verifies core jump, double-jump, dash/collision, crouch-clearance and
level-map path declarations. Browser playthrough and screenshot evidence remain blocked
until an official Chromium binary can be securely installed in the sandbox; this is not a
claim that the movement course has passed player QA.

## Credits and provenance

The playable course uses original procedural Three.js geometry/materials and Web Audio
feedback. Repository studies remain in `research/`; they are design/technical references,
not bundled external scenes or media. Consult `CREDITS.md` and `LICENSES.md` before any
external asset is added.
