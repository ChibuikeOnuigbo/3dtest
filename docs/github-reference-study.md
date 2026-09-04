# GitHub reference study — decision summary

Five shallow repositories were cloned under ignored `research/github_repos/` and read as
reference specimens only. The game has not imported or merged their code or media.

## Findings that change the new game's plan

1. **Player/collision:** a fixed-step kinematic capsule with authored static collision is
   the viable small-game direction. The Three.js starter demonstrates capsule/octree
   querying; Enari illustrates a physics-backed capsule. FPS2's per-frame render-object
   bounds and mesh-name heuristics are rejected.
2. **Interactions:** CSS-3D-Dungeon shows a useful compact contract: a spatial focus zone
   enables an explicit prompt; an intentional key action causes state change and feedback;
   changing state changes route/objective. This will be independently authored in 3D.
3. **World topology:** FPS2's initial URL-selected maps are inappropriate for a short
   cohesive story. The new game should keep one persistent mission and activate
   lightweight room/portal zones, with doors as actual stateful colliders.
4. **Presentation:** a separate viewmodel/world render approach can keep first-person
   equipment legible without corrupting world depth. It is a future pattern, not a reason
   to import Enari weapons or effects.
5. **Scope/licensing:** source MIT licenses do not clear separately attributed art.
   FPS2's 26 models/134 images/39 audio files and the 908 MB asset aggregate are *not*
   an asset library for this game. Explicitly stylized Flat Guns are rejected on visual
   grounds even before their per-item provenance is complete.

## Studied references

- [Enari Engine source report](../research/github/repo_enari-engine.md)
- [FPS2 source report and complete model disposition](../research/github/repo_FPS2.md)
- [CSS-3D-Dungeon source report](../research/github/repo_CSS-3D-Dungeon.md)
- [Three.js starter source report](../research/github/repo_threejs-fps-tps-starterkit-advanced.md)
- [FPS Asset Kit provenance report](../research/github/repo_fps-asset-kit.md)
- [Comparison/rationale](../research/github/COMPARISON.md)

These are source-reading reports, not benchmark results. Each report identifies what was
actually observed, what remains unverified, and why no third-party file was adopted.
