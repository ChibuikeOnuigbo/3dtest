# Asset Strategy

## Backbone decision
A complete downloaded environment was preferred during research, but the available public Sketchfab weather-station candidates failed the visual/technical acceptance gate: one was explicitly a blockout and the other was 276.1k triangles with unverified archive contents. `SKETCHFAB_API_KEY` is not set; this was checked without logging a value. Rather than pretend an unvalidated download is a production asset, the environment backbone is an authored modular relay station with a very limited, verified CC0 PBR surface palette.

This is a scope reduction, not a fake “asset integration” claim. The texture assets are real, license-recorded PBR materials; structures and purposeful mechanical props are custom meshes so their scale, collision and art direction remain deterministic.

## Accepted material palette
- **Concrete 034:** floors and structural panels.
- **Metal 049 A:** doors, stations, breaker cabinets, conduits and antennas.
- **Wood 092:** one duty desk, used only where a staffed workroom calls for it.

All source maps were downsized to max 1024px (preserving aspect ratio) for browser performance. `albedo`, `normal` and `roughness` maps are supplied for all three surfaces; metal additionally carries metalness.

## Selection rules enforced
1. No Kenney assets.
2. No low-poly/pixel-art/cartoon scene assets.
3. No unlicensed/unknown archive content.
4. No random prop scatter and no unused library payload.
5. Every mesh has a named room/function and an authored collision choice.

## Deliberate omissions
No weapons, humanoid models, monsters, vegetation packs or generic crates are used. They add visual inconsistency, animation requirements or payload without advancing the story.
