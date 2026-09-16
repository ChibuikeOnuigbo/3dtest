# Timed asset hunt — how it runs and what it proves

`tools/assets/asset_hunt.py` is the 2-hour, timer-driven hunt the brief asked for. It runs only in
GitHub Actions (`workflow_dispatch` → input `asset_hunt_hours`, e.g. `2`) because the development
sandbox has no network egress (every `curl` to sketchfab.com / polyhaven.com / opengameart.org returns
`000`; only text endpoints reachable through the reader tool work, and those cannot carry GLB bytes).

Order per pass (the loop repeats with mutated queries until the timer expires, 40 assets are approved,
or six mutation passes in a row add nothing):

1. **Sketchfab** — public search API, 29 base queries ("industrial props pack", "industrial scene
   modular", "industrial map", "roller shutter door", "oil drum barrel", … ) × modifiers
   (pbr / game ready / photogrammetry / scan / 4k / realistic) with synonym swaps and word drops on
   zero-yield passes. Triage before any download: licence ∈ {CC0, CC-BY, CC-BY-SA}; no
   low-poly/voxel/cartoon/stylised/Kenney/isometric in name, description or tags; 300 ≤ faces ≤ 150 000;
   glb ≤ 25 MB; textured; textures ≥ 1024 px. Download through the official
   `GET /v3/models/<uid>/download` with `SKETCHFAB_API_TOKEN`, or through the Cloudflare worker when
   `SKETCHFAB_PROXY_URL` is set (same path on the worker). A 401/403/timeout marks the download path
   dead with the exact status in the ledger — the search/triage results are still written.
2. **Poly Haven** (CC0) — every model whose tags match the industrial vocabulary and is not yet in the
   roster (`tools/assets/polyhaven_dimensions.json`), 1k glTF + includes.
3. **OpenGameArt** 3D art (CC0 / CC-BY / CC-BY-SA filters) — only items with glb/gltf (or zips with
   them) are accepted, because the game loads glTF; blend/fbx-only items are recorded as rejected.

Every fetched file is parsed (GLB header/JSON or glTF), root-node bounds are transformed by the node
matrices, triangles and material textures are counted, and the asset is APPROVED or
REJECTED_AFTER_INSPECTION (scale 0.05–40 m, ≥ 300 triangles, textured). The result is a
`manifest.json` with the Poly Haven manifest schema; `PropLibrary` merges `/models/hunt/manifest.json`
and `/models/sketchfab/manifest.json` into the same id space, so approved assets are placeable with
`world.props.place(id, …)` and are covered by the placement validator (no floating / no overlap).

Ledger: `research/asset_hunt/latest.json` — every query with status/result counts, every candidate
with its verdict and reasons, every failure with the HTTP status. The credential is never printed
(`credential_logged: false` is asserted in the ledger header).

Status (2026-09-07): written and unit-checked offline (inspector on a synthetic glTF, query mutator,
triage rules). Not yet executed against the live sites — the first live run needs a dispatch with
`asset_hunt_hours=2` and the `SKETCHFAB_API_TOKEN` (or `SKETCHFAB_PROXY_URL`) repository secret.
