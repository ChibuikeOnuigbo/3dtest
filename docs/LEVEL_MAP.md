# Vector Run: Skyline Relay — level map

**Game identity:** fast first-person parkour, target action and time-trial mastery.
**Not this game:** horror, bunker exploration, abandoned-facility story, slow walking
simulator or a copied map from any reference repository.

## Reference synthesis

The level combines independently implemented design lessons from the user-supplied
Three.js projects:

- **Enari:** a landmark-led, layered playable space rather than anonymous boxes.
- **CSS-3D-Dungeon:** an explicit readable sequence—enter area, understand challenge,
  act, receive feedback, unlock the next space.
- **FPS2:** distinct silhouette and sightline for each combat/traversal zone, while
  rejecting bulk eager asset loading and map copying.
- **Triomonnezza:** strong gate/checkpoint logic with a central return orientation.
- **Liminality:** environmental state shifts and a clearly defined exit; no horror style
  or maze is adopted.
- **Starter / LUMECraft / Combat Craft:** a clean separation of input, player state,
  world collision and game state, without importing source systems wholesale.

## 3D course tree

```text
SKYLINE RELAY COURSE
│
├── 01 Launch Dock (Y 0)
│   ├── orange crane landmark
│   ├── acceleration lane
│   └── ramp → cyan kinetic prism
│
├── 02 Prism Rise (Y 0–3)
│   ├── DOUBLE-JUMP power-up
│   ├── short teaching gap
│   └── blue checkpoint tower
│
├── 03 Split Route (Y 3–7)
│   ├── west / Wall Shaft
│   │   ├── explicitly WALL_JUMPABLE panels
│   │   └── limited three-contact ascent
│   └── east / Dash Span
│       ├── bright DASH_ROUTE rails
│       └── long velocity gap
│
├── 04 Target Court (Y 6)
│   ├── magenta crane-halo landmark
│   ├── three designed mechanical targets
│   ├── raised rails, cover and alternate catwalks
│   └── checkpoint return path
│
└── 05 Sunrise Gate (Y 10)
    ├── final upward mixed-movement route
    ├── finish emitter
    └── fast restart / personal best result
```

## Critical route

```text
SPAWN → learn ground jump → take DOUBLE JUMP → prove it at a gap
→ CHECKPOINT → choose wall-jump or dash route → TARGET COURT
→ clear 3 targets → reach SUNRISE GATE
```

## Surface and support rules

- Major platforms are attached to crane trusses, concrete piers, bridge supports or
  visible gantries—never unexplained floating slabs.
- Only marked vertical panels are `WALL_JUMPABLE`.
- Low, striped tunnel segments are the only intended slide/crouch spaces.
- UI remains screen-space and does not enter the collision world.
- Ordinary static props are mounted to a platform, wall, frame or rail. Hovering targets
  are marked intentional exceptions.

Machine-readable topology: [`../game/data/level_map.json`](../game/data/level_map.json).
