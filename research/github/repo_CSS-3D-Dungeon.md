# Repository study — CSS-3D-Dungeon

**Specimen:** `MeroVinggen/CSS-3D-Dungeon`, shallow checkout
`6544eb6a738ed81feba7a23ed24682c7ddf6235d`. **Scope:** static bundle inspection only;
it was not run. It is a native HTML/CSS transformed pseudo-3D puzzle dungeon, not a
Three.js game/runtime candidate.

| Aspect | Verified finding | Adoption decision |
|---|---|---|
| License/provenance | Root code license is MIT. Bundle assets are present but no item-by-item upstream/provenance ledger was found in this checkout. | No code or media adoption. |
| Build/entry | `index.html` points to fingerprinted built CSS/JS/media under `assets/`; source modules/package build files are not present. | Reject as a technical base; compiled bundle is not a maintainable source foundation. |
| Render/graphics | CSS transformed room planes, WebP textures and DOM effects create its pseudo-3D presentation. | Do not use for Three.js rendering or visual asset sourcing. |
| Camera/input | Document-body pointer lock and keyboard input are embedded in the bundle. | General pointer-lock lifecycle is relevant only as a conceptual check item. |
| Movement/collision | Movement is constrained by hand-authored X/Z activation bounds rather than 3D body collision. | Use as a warning: explicit spatial proxies are good, but replace 2D bounds with authored 3D interaction/collision volumes. |
| Interactions/objectives | Explicit activation/deactivation callbacks attach `E` prompts to spatial zones; scroll/spell/item actions change prompt, task and room behavior. | Strong pattern to independently recreate: entered/exited focus target → one clear prompt → state transition → perceptible feedback. |
| Levels/pacing | One linear multi-room puzzle route uses wall buttons, pickups, scroll explanation and portal/exit gating. | Borrow only the pacing principle: every short room needs a different purposeful state change. |
| Audio/UI/state | 23 local audio files; audio manager calls, volume cues, objective updates and overlay states are observable in the bundle. | No sound/UI asset reuse. Build gesture-safe audio channels and original UI. |
| Performance/QA | RequestAnimationFrame and an FPS throttle helper are in the bundle. No source-level profiling or automated QA was supplied/verified. | Treat throttling as an experiment needing measured verification, not a solution. |

## Asset / graphics ledger

Structural inventory: 57 files / 6,787,230 bytes / zero 3D models / 26 images / 23
audio files ([`css_3d_dungeon_inventory.json`](./css_3d_dungeon_inventory.json)). Content
includes texture WebPs, a font, UI images and music/effects. These are **BLOCKED**
because their original asset licenses, intended reuse terms and visual fit have not been
validated individually. The fantasy/cartoon visual language is also outside the
provisional realistic coastal target.

## Reusable reasoning, not source

The valuable finding is the interaction contract, not any file: trigger proximity must
not silently complete an action; it should focus the target, display a context-specific
verb, accept a deliberate action, update an objective/state, and deliver both aural and
visual confirmation. That contract will be independently implemented and tested.
