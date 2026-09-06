# Poly Haven standards and candidate review

**Review date:** 2026-09-06
**Role:** material/lighting/asset quality benchmark and potential lawful CC0 source,
not an automatic asset dump.

## Sources inspected

- <https://polyhaven.com/>
- <https://polyhaven.com/models>
- <https://polyhaven.com/collections>
- <https://polyhaven.com/hdris>
- <https://polyhaven.com/license>
- <https://docs.polyhaven.com/en/technical-standards/textures>
- <https://docs.polyhaven.com/en/technical-standards/models>
- <https://api.polyhaven.com/assets?t=textures>
- <https://api.polyhaven.com/files/aerial_asphalt_01>

## Verified standards adopted by Rivet Run

| Topic | Published reference | Highline application |
|---|---|---|
| Texture workflow | Poly Haven describes seamless photo-based PBR material sets (base colour, roughness, OpenGL normal, displacement, AO and metalness where applicable), calibrated real-world dimensions and non-obvious repetition. | Treat the two current original base-colour maps as interim only. Any future imported material needs correctly scaled tiling, colour-space/map-role validation and a visible anti-repetition review. |
| Model workflow | Its standards stress applied metric scale, human reference, clean UVs/normals, no bad geometry and silhouette-aware poly budgets/LODs. | Design modular structures at human scale; prefer façade/truss/pier silhouettes over arbitrary primitives and add LOD-like low-cost distant context. |
| HDRI/environment | The HDRI catalogue includes industrial, coast/water, streets/town, mountains/hills and afternoon/sunset filters; the site describes 16K+ unclipped lighting reference. | Use the category/lighting lesson: Highline needs a warm industrial/coastal horizon, directional sun, cool fill and haze. Do not use a cyan void as lighting/environment. |
| Collections | Collections group models, materials and HDRIs into coherent packs, demonstrating that assets must be selected as a contextual family. | Select future rooftop/utility assets as coherent material/scale families, not isolated attractive downloads. |
| Rights | Poly Haven states its asset catalogue is CC0; site/API terms still govern service use. | Preserve source/creator/asset URL and use normal lawful acquisition; do not crawl, bypass protection or claim assets not locally received. |

## Candidate review — Aerial Asphalt 01

| Field | Record |
|---|---|
| Source / creator | official Poly Haven metadata / Rob Tuytel |
| Context | 30m × 30m weathered cracked outdoor asphalt, suitable for secondary road/roof surface investigation |
| Technical offer | public manifest provides diffuse and GL/DX normal files from 1K through 8K; 1K diffuse is listed as 635,143 bytes and 1K GL normal as 560,227 bytes |
| Intake plan | first use a 1K diffuse + OpenGL normal trial at real-world scale, then inspect texel density/repetition/browser memory before considering higher fidelity |
| Acquisition | public normal-TLS attempts to `api.polyhaven.com` and `dl.polyhaven.org` returned `SSL_ERROR_SYSCALL` on 2026-09-05 |
| Decision | **NOT_ACQUIRED / NOT_SHIPPED**. This is an infrastructure result, not a rejection of the asset or a reason to bypass TLS. |

## Candidate family outlook

Industrial HDRIs and Project Lighthouse utility props are appropriate discovery
areas, but they are **not accepted candidates yet**. Each specific asset must
have creator/source/CC0 verification, preview/material/scale/poly/performance
review, a Highline semantic placement, and a full asset-manifest entry before
an actual download/import decision.
