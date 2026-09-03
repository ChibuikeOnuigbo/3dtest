# FPS2 — source-level study and suitability decision

**Research-only record.** Inspected local shallow checkout `Parking-Master/FPS2` at
`f8a2997798a969deb546ef5b6014cc031b04b01d` (commit date 2026-06-04). This is not a
runtime approval, an asset approval, or a claim that a reference feature works. The
reference remains ignored under `research/github_repos/FPS2/`.

## What it is

FPS2 is a browser FPS whose game runtime is overwhelmingly in a 3,032-line inline
script in `src.html`, backed by remote Three.js/GLTFLoader scripts, local glTF/GLB
media, DOM UI, and Gametime.js multiplayer messaging. The repository `LICENSE` is MIT
for code (copyright Parking Master), but its README identifies multiple third-party
models, characters, animations, sky, and UI source relationships. This means the MIT
file **does not clear bundled media for reuse**.

### Observed boot and world behavior

- The default loadout is Assault Rifle + Desert Eagle; a `LoadingManager` eagerly loads
  all named weapon GLBs, a map chosen by `?map=` (defaults `CARGO`), selected character,
  effects, and vehicle ([`src.html:1279–1337`](https://github.com/Parking-Master/FPS2/blob/f8a2997798a969deb546ef5b6014cc031b04b01d/src.html#L1279-L1337), [`src.html:1683–1815`](https://github.com/Parking-Master/FPS2/blob/f8a2997798a969deb546ef5b6014cc031b04b01d/src.html#L1683-L1815)).
- The four maps are independent `scene.gltf` documents. The selected map is scaled 1.6
  and moved down Y=−300. No source path was found that changes the active map without a
  fresh startup ([`src.html:1702–1708`](https://github.com/Parking-Master/FPS2/blob/f8a2997798a969deb546ef5b6014cc031b04b01d/src.html#L1702-L1708)).
- Collision is repeated `Box3.setFromObject()` overlap during map traversal, largely
  keyed on names such as `Container` and `Cube`; this is unsuitable as a new game’s
  high-frequency collision architecture ([`src.html:1524–1545`](https://github.com/Parking-Master/FPS2/blob/f8a2997798a969deb546ef5b6014cc031b04b01d/src.html#L1524-L1545)).
- A per-frame function updates camera-followed lights, player representation, raycast
  target, weapon transforms, all mixers, HUD, and then renders. It is an example of
  tightly coupled code to avoid, not a code transplant ([`src.html:1524–1668`](https://github.com/Parking-Master/FPS2/blob/f8a2997798a969deb546ef5b6014cc031b04b01d/src.html#L1524-L1668)).
- Weapon behavior exists: model mixer, fire sound, fire delay table, ammo/clips,
  easy/empty reload choices, view transforms, pickups, projectiles/effects, grenade,
  punch, zoom, HUD. The data is spread over mutable globals and index-dependent
  animation arrays. The clean lesson is a data-driven weapon state machine, *not* the
  source’s global-variable/index-array organization.
- It uses remote scripts, `localStorage` preference wiring and Gametime event messages
  (including rotation/action data) rather than a self-contained modern app build. New
  game should use a pinned local dependency lock, explicit transport boundary, and no
  anonymous remote runtime scripts.

## Asset / model evidence

`fps2_inventory.json` was regenerated with JSON glTF support. The source tree contains
26 model-format entries, 134 image files and 39 audio files, occupying 979,866,236 bytes
among inventoried files. In particular, `sounds/ambience.mp3` is 41.0 MB; character
source images reach 39.9 MB each. This strongly rules out wholesale reuse or eager
loading for a compact browser FPS.

### Maps actually selected by the source

| Key | README name | glTF structure | Indexed triangles | Study conclusion |
|---|---|---:|---:|---|
| `CARGO` | Cargo Port | 75 nodes, 4 meshes, 4 materials, 8 textures | 1,290 | Container/port composition; map-specific source geometry; blocked. |
| `CITY` | Abandoned City | 2,267 nodes, 920 meshes, 23 materials, 13 textures | 23,950 | Large scene graph; not an indoor building model; blocked. |
| `GHOST` | Ghost City | 75 nodes, 28 meshes, 28 materials, 81 textures | 46,860 | Building/road scene nodes; names include `Cube`; blocked. |
| `VERTEX` | Vertex | 129 nodes, 6 meshes, 5 materials, 10 textures | 125,914 | Farm/exterior composition; 125k triangles; blocked. |

All embedded data URI maps report no external URI dependencies in their raw glTF JSON,
but that is not a provenance clearance. The exact model structures are captured in
[`fps2_runtime_registry.json`](./fps2_runtime_registry.json).

### Weapons actually loaded

The source startup loader has 11 named weapon GLBs: Assault Rifle, Desert Eagle, Sniper
Rifle, Rail Gun, P90 SMG, Grenade Launcher, Remington Shotgun, Rocket Launcher, Nuke
Launcher, 9mm Pistol, and Odd Ball. All have arms/skins and named animation clips (12
for each except Odd Ball’s 13) and total **204,946,908 bytes** before separate effect,
character, and audio payload. The Desert Eagle alone is 29.58 MB / 486,104 indexed
triangles.

Do not confuse startup loading with current player usage:

- default loadout: `Assault_Rifle`, `Desert_Eagle`;
- Slayer pickup spawns: `Rocket_Launcher`, `P90_SMG`, `Grenade_Launcher`,
  `Remington_Shotgun` ([`src.html:2969–2977`](https://github.com/Parking-Master/FPS2/blob/f8a2997798a969deb546ef5b6014cc031b04b01d/src.html#L2969-L2977));
- Oddball pickup only in Oddball mode; it is an objective/melee-style item, not a normal
  firearm; and
- `frag.glb` is a separate grenade model, not part of the weapon-GLB count.

The complete repeatable register includes exact byte counts, mesh/skin/material/texture
counts, clip names, source loading evidence, game-mode use classification, and a
per-item blocked provenance state:

- [`fps2_runtime_registry.json`](./fps2_runtime_registry.json)
- generator: [`build_fps2_registry.py`](../../tools/repo_research/build_fps2_registry.py)
- raw structural inventory: [`fps2_inventory.json`](./fps2_inventory.json)

## Credit and license assessment

The FPS2 README links some model sources as “CC 4.0” (AK arms/rifle, Desert Eagle,
Sniper, Remington, P90, M32, Rocket Launcher, Humvee, Weapon Box); it does not name an
exact CC deed/version for that phrase, does not tie the packaged GLBs cryptographically
to those pages, and has no matching visible credit for Rail Gun, Nuke Launcher, 9mm
Pistol, Odd Ball, maps, effects, or gun audio. It also labels Mixamo characters and
animations and Canva website design as “No License.” All reference assets therefore
remain **BLOCKED**. This explicitly includes assets that might happen to be usable under
a subsequent exact-license investigation.

The reference contains no Kenney attribution in code/README searches. That is not a
positive clearance: our project’s Kenney ban still applies independently, and no FPS2
asset may be used without provenance review.

## Combine / reject decision

| Candidate lesson | Decision | Reason and planned independent replacement |
|---|---|---|
| GlTF weapon loader with per-weapon animation mixer | **Adapt concept only** | New manifest loads only equipped cleared assets, validates clips by semantic names, disposes unused resources, and supplies fallback geometry. |
| Two-slot loadout, ammo, clips, reload-state gates, pickup state | **Adapt concept only** | Use typed weapon/entity state and testable event transitions instead of globals, DOM handlers, index tables, or reference animation clips. |
| Crosshair, ammo/health HUD and hit feedback | **Adapt concept only** | New accessible, authored UI; no images/CSS/audio copied. |
| URL-selected independent map documents | **Reject as mission flow** | Map param confirms map selection only; it cannot preserve mission state across interior/exterior. New build will use one logical mission with zone roots/portals. |
| `Box3` every-frame map traversal/name filtering | **Reject** | New static collider registry uses coarse author-authored volume/bounds candidates and narrow interaction rays. |
| Eager load all 11 weapon GLBs + extremely large media | **Reject** | Violates startup/performance budget and makes a source asset transplant likely. |
| Map/weapon/character/audio/media files | **Reject / blocked** | Visual fit and licenses not proven; some provenance visibly absent or ambiguous. |
| Multiplayer sync mechanics | **Out of current scope** | The first playable prototype is single-player and should not inherit opaque Gametime coupling. |

## Resulting map-composition direction

FPS2’s independent map selection establishes an anti-pattern to improve: an exterior
and building should be one mission state with a **persistent player + objectives** and
separately activatable visual/AI/audio zones. The planned research blockout has a
courtyard/exterior buffer, one secure threshold, and dense enclosed rooms behind it.
Portal doors operate in the same state graph; a full mission selector only occurs between
missions, not at a normal doorway. See the authored diagrams and detailed strategy in
[`docs/research/architecture-map-strategy.md`](../../docs/research/architecture-map-strategy.md).
