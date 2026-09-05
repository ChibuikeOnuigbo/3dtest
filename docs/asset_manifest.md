# Shipped asset manifest

## Policy

Every imported/created runtime asset must have source, creator, licence,
technical review, material/scale context, performance notes and intended use
recorded before it is shipped. Asset candidates are not accepted merely because
a public URL exists. No user-supplied secret is recorded or used.

## Runtime assets currently shipped

| Asset | Source / creator | Licence | Technical review | Use | Status |
|---|---|---|---|---|---|
| `public/textures/sunlit-concrete-tile.png` | original local raster, project production | project-owned original work | 1024×1024 PNG; hash/dimensions recorded in `research/assets/vector_run_texture_manifest.json`; colour/albedo only, no normal/roughness map | concrete roofs/facades | shipped interim |
| `public/textures/painted-route-metal.png` | original local raster, project production | project-owned original work | 1024×1024 PNG; hash/dimensions recorded in the same manifest; colour/albedo only | coated steel, route surfaces | shipped interim |
| Three.js `0.185.1` | Three.js contributors | MIT | bundled library, package lock pins version; used for renderer/scene only | runtime rendering | shipped |

## Reviewed but **not shipped**

| Candidate | Source / creator | Licence / known terms | Review | Outcome |
|---|---|---|---|---|
| `aerial_asphalt_01` | Poly Haven / Rob Tuytel | Poly Haven CC0 collection; verify source licence at import | Public metadata describes a 30m weathered asphalt texture with 8K maximum resolution. Official file manifest exposes diffuse/normal files. Normal TLS acquisition to `dl.polyhaven.org` returned `SSL_ERROR_SYSCALL` on 2026-09-05; no file was downloaded. | not imported; retry only through normal TLS when infrastructure permits |
| Sketchfab collection/models supplied in conversation | assorted | not yet re-verified | Supplied credential was compromised in chat. No authenticated endpoint was contacted. No model metadata/materials/scale/licence review can be completed safely yet. | not imported |
| P3D public-gallery models | assorted P3D users | creator-specific, not inferred | Platform review identifies WebGL sharing/viewing but does not grant blanket asset re-use rights. | not imported |
| GitHub reference-repository assets | assorted | repository / asset-specific | Reference code and assets are not assumed reusable; all downloaded study repositories are excluded from production. | not imported |

## Required acceptance before any external model/material enters runtime

1. Record immutable source URL, creator and exact licence.
2. Inspect preview/model materials, UVs, scale, mesh/poly cost, normals, maps,
   LODs, file validity and stylistic/contextual fit.
3. Verify it has a believable mounted/supported placement in Highline District.
4. Record mobile/browser performance expectation and fallback/LOD strategy.
5. Update `CREDITS.md`, `LICENSES.md`, this manifest, source research record and
   visual QA context before import.

Until then, external shipped asset count is **zero**.
