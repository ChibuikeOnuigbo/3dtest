# Sketchfab security and review status

A credential was supplied directly in conversation. It is treated as compromised.
It is not reproduced here, not persisted, not used, and not included in any
request/log/commit. The account owner must rotate it and, if needed, provide a
replacement only through approved environment/secret storage.

`tools/assets/sketchfab_intake.mjs` now supports the lawful per-candidate path.
It reads only `SKETCHFAB_API_TOKEN` (or `SKETCHFAB_TOKEN`) plus
`SKETCHFAB_CANDIDATE_URLS` from approved process/GitHub Actions secret storage;
uses an in-memory authorization header; records no credential; and blocks before
any request if either input is absent. The first local diagnostic on 2026-09-06
found neither an approved secret nor configured candidate URLs:
`research/sketchfab/latest_intake.json` reports
`BLOCKED_NO_APPROVED_SECRET_ENV`.

No supplied model is accepted or shipped. Before a model can be used, record
creator, exact licence, source, preview/mesh inspection, PBR maps, UV/normals,
poly count/LODs, scale, visual fit, physical support placement and browser
performance outcome.
