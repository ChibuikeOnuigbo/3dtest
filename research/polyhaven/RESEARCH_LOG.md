# Poly Haven review

**Review date:** 2026-09-05
**Role:** quality/technical benchmark and potential lawful material source, not an
automatic production asset catalogue.

## Sources checked

- <https://docs.polyhaven.com/en/technical-standards/textures>
- <https://docs.polyhaven.com/en/technical-standards/models>
- <https://polyhaven.com/models>
- <https://api.polyhaven.com/assets?t=textures>
- <https://api.polyhaven.com/files/aerial_asphalt_01>

## Adopted quality principles

The texture standard describes complete PBR workflows, seamless/non-repetitive
surface expectations, calibrated physical dimensions, diffuse/roughness/normal/
displacement/AO/metal maps and clear unlit base colour. The model standard
emphasises scale with a human reference, clean/UV-unwrapped geometry, no bad
floating/zero-area geometry, silhouette-aware budgets and sensible LODs. Our
browser scene must apply the principles proportionately rather than falsely call
its two original colour maps a complete Poly Haven-equivalent PBR source.

## Candidate review: Aerial Asphalt 01

| Field | Record |
|---|---|
| Source | official Poly Haven public API |
| Creator | Rob Tuytel (as returned by official asset metadata) |
| Context | weathered cracked outdoor asphalt; 30m x 30m, up to 8K; well suited as a roof/road variation after UV scale review |
| Technical availability | official file manifest exposes 1K–8K diffuse and OpenGL/DirectX normal files; public 1K diffuse is 635,143 bytes and normal 560,227 bytes |
| Performance plan | start with 1K diffuse/normal and repeat at real-world scale; test browser memory and anisotropy before wider use |
| Acquisition result | official normal-TLS `curl` to `dl.polyhaven.org` returned `SSL_ERROR_SYSCALL`; exact record is in `qa/asset_tests/polyhaven-aerial-asphalt-download-2026-09-05.log` |
| Decision | **not acquired / not shipped**; retry only through normal official TLS, no proxy, no certificate bypass |

No other Poly Haven asset has passed the required source/licence/material/scale/
poly/performance/context review.
