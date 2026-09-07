# Combined-reference 3D map tree — Ariadne Signal Conservatory

**Status:** authored replacement plan for the current prototype.
**Evidence boundary:** The supplied repositories were inspected as reference implementations.
Their code may be MIT where a root licence says so; their media, GLTF maps, textures and
third-party assets are *not* automatically covered by that code licence. This document
therefore combines **spatial/gameplay ideas**, not copied scene geometry or asset files.

## What is being combined

| Reference | Actual inspected map/system evidence | Independent adoption in this game |
|---|---|---|
| Enari Engine | Baked pool-world and separate collision world; FPS world/viewmodel layering. | A readable landmark-first world, distinct non-combat spaces and authored collision rather than mesh-name logic. |
| CSS-3D-Dungeon | Explicit room activation bounds, one clear prompt, pickup/button/portal progression. | Every room has one readable objective role and a visible state change—no anonymous corridor filler. |
| FPS2 | Four separately selected map scenes, strong FPS sightline needs, heavy eager media boot. | A different landmark/silhouette per route, but one small connected mission—not URL map swaps or bulk boot loading. |
| Triomonnezza | Grid map classes; doors/key/goal, flashlight and room-state systems. | A central return hub, gated wings and clear door-to-objective relationships. |
| Liminality | Procedural maze chunks, power switches, exit goal, dramatic environmental events. | Power restoration changes the signal world; no copied maze, analogue effect or Backrooms scene. |
| Three.js FPS/TPS starter | Camera/player/collision architecture patterns. | Kinematic player plus authored collision zones; no asset/source import. |
| LUMECraft / Combat Craft | FPS state/gameplay boundaries and procedural-world scope examples. | Compact local state, no multiplayer/voxel sprawl. |
| FPS Asset Kit | Large aggregate media kit. | A warning against generic, unrelated asset dumping. |

## 3D scene tree

```text
ARIADNE_SIGNAL_CONSERVATORY  [one connected, first-person mission]
│
├── exterior / Tide Observatory (Y -0.24 to 4.6)
│   ├── R1 Arrival Jetty                 X -7..7,   Z 12..24
│   │   ├── emergency receiver            [objective: opens entry]
│   │   ├── compass ring + tidal mosaics  [arrival silhouette]
│   │   ├── rain / bay / distant beacon tower
│   │   └── KEEPERS_HALL_DOOR             [gate 01]
│   │
│   └── sky layer                         [moon, fog, rain; not collision]
│
├── lower mission floor (Y 0..4.6)
│   ├── R2 Keeper's Hall                  X -5..5,   Z 4..12
│   │   ├── star archive / brass pipe run
│   │   ├── pulse cabinet                  [objective: tool issued]
│   │   └── sightline → central orrery
│   │
│   ├── R3 Signal Court                   X -5..5,   Z -4..4
│   │   ├── three-axis signal orrery      [return landmark / relay encounter]
│   │   ├── left: generator gate           [gate 02 → power]
│   │   ├── right: workshop gate           [gate 03 → route]
│   │   ├── skylight + high copper pipes   [vertical read]
│   │   └── mosaics show wave / star / signal language
│   │
│   ├── R4 Generator Bay                  X -12..-5, Z -8..-1
│   │   ├── copper pressure system
│   │   ├── gauge / isolator               [objective: power]
│   │   └── visible pipe return → Signal Court
│   │
│   └── R5 Radio Workshop                 X 5..12,   Z -8..-1
│       ├── rotating receiver antenna
│       ├── backup channel console         [objective: route]
│       └── LANTERN_GALLERY_DOOR           [gate 04]
│
└── terminal gallery / Beacon Chamber (Y 0..4.6)
    └── R6 Lantern Gallery                X 2..12,   Z -16..-8
        ├── brass observatory arch
        ├── violet lanterns / tiled floor
        ├── rotating beacon lens           [objective: ending]
        └── rescue-beam sightline → bay
```

## Walkable flow tree

```text
R1 Receiver
 └─ R2 Pulse Cabinet
     └─ R3 Signal Court / sentry challenge
         ├─ R4 Generator Bay → Isolator
         │   └─ returns to R3 with workshop power enabled
         └─ R5 Radio Workshop → Backup Channel
             └─ R6 Lantern Gallery → Beacon ending
```

The tree is intentionally **branch-and-return**, not a row of identical rooms. It combines
the central-hub lesson from Triomonnezza, the one-purpose room rhythm from CSS-3D-Dungeon,
the environmental power-state lesson from Liminality and Enari's landmark-first FPS-space
reading.

## Explicit swaps from the old generic blockout

| Removed visual shorthand | Replacement | Player-facing reason |
|---|---|---|
| Repeated steel boxes | plaster/tile/copper/slate/brass material families | Each room reads from a doorway. |
| Empty central room | animated signal orrery, open skylight, branch doors, high pipes | The player always knows where they are and where routes lead. |
| Generic props | receiver, archive, tide compass, pressure system, receiver antenna, beacon | Objects explain the purpose of the room and objective. |
| Same light temperature everywhere | teal rain exterior; warm archive; cyan signal; copper generator; violet ending | The route gains a visual rhythm without random clutter. |
| Flat route | ceiling apertures, hanging lamps, vertical pipe routes, rings and arch silhouettes | Vertical hierarchy makes a small map feel designed rather than tiled. |

## Implementation rules

1. Each room must expose a unique landmark from its entrance and a return clue toward the hub.
2. No external map/model/texture enters the project until per-file provenance, technical review,
   visual-fit review and explicit approval are recorded.
3. Use small repeatable authored geometry; no random prop scattering.
4. The map needs a real browser collision/playthrough review before approval.
