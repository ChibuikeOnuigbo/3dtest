# Decision Log

## 2026-09-03 — Build an original coastal weather relay, not a bunker
- **Alternatives:** underground bunker, archive, greenhouse, forest lookout.
- **Why chosen:** highest feasibility/visual-coherence score (82/90); no characters, AI or large outdoor environment needed; mechanical objectives map directly to authored objects.
- **Evidence:** public video research stresses physical systems, clear arrival motivation and stateful repairs; GitHub study supports small modular systems.
- **Consequences:** five-room cap, no combat, no enemy, transform-only animation.

## 2026-09-03 — Use authored AABB collision, not a physics engine or render-mesh collision
- **Alternatives:** Ammo/Rapier integration, automatic trimesh colliders, Three.js Octree.
- **Why chosen:** five orthogonal rooms/doors benefit from inspectable deterministic collision; eliminates heavyweight dependency and expensive dynamic mesh colliders.
- **Evidence:** Enari illustrates module separation but builds per-mesh trimesh colliders; starterkit validates capsule collision concepts but has a monolithic architecture.
- **Consequences:** collision registry must be tested room-by-room; no slopes/complex terrain in final level.

## 2026-09-03 — Reject currently discovered Sketchfab environments
- **Alternatives:** meteorological blocking model, 276k-triangle weather station, low-poly ocean scene.
- **Why chosen:** final PBR/technical inspection gate failed or could not be completed without a download path; blockouts and incompatible stylization are forbidden.
- **Evidence:** `research/assets/sketchfab_candidates.json` and rejection log.
- **Consequences:** custom structural geometry plus verified CC0 PBR surfaces form the backbone.
