# Technical Debt / Known Limits

| Status | Limitation | Why | Follow-up |
|---|---|---|---|
| Open | YouTube temporal frames/captions could not be downloaded in this sandbox. | TLS connection closed for direct yt-dlp and thumbnail requests. | Re-run research tooling where YouTube media CDN access is available; do not alter implementation claims without review. |
| Intentional | No external complete GLB environment. | Public candidates were rejected for style/validation/performance. | Revisit only with a validated, licensed, visually compatible scene that reduces—not increases—scope. |
| Intentional | Collision is axis-aligned only. | Level is designed for it; it is robust and low-cost. | Add a tested slope/mesh-collision strategy only if level design changes. |
| Intentional | Audio is procedural Web Audio, not field-recorded. | Avoids unverified/unneeded asset download and guarantees a coherent state-driven soundscape. | Replace only with licensed, validated field recordings if needed. |
