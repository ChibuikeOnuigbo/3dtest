# Game Concept — The Last Signal

## One-line pitch
In a storm-darkened coastal weather relay, restore a failed emergency transmitter before the tide surge reaches nearby homes.

## Experience target
A focused **10–15 minute first-person environmental mystery** with no combat and no enemy AI. The player explores five compact service rooms, makes three meaningful system repairs, and sees/hears every change they cause. Completion is a clear transmission and sunrise-adjacent beacon, not an ambiguous fade-out.

## Core loop
**Orient → inspect → understand a physical fault → interact → observe an environmental change → access the next room → transmit.**

## Feasibility gate

| Requirement | Technical/asset path | Verdict |
|---|---|---|
| Believable environment | Authored modular Three.js structures + selected CC0 PBR concrete/metal/wood surface maps from ambientCG. | Feasible |
| Character animation | No humanoid/creature is needed. | Removed by design |
| Doors | One reusable hinge transform + collision gate. | Feasible |
| Puzzle | Fitting a labelled thermal fuse, toggling breaker, setting three contextual dials. | Feasible |
| Audio | Web Audio procedural wind/hum/tones, begun after user gesture; no unlicensed file dependency. | Feasible |
| Collision | Authored static AABBs and dynamic door AABB, player capsule approximation. | Feasible |
| Ending | State-driven status LEDs, beacon, transmission UI and final screen. | Feasible |
| Performance | Reused geometries/materials; five rooms; no expensive physics engine or skeletal meshes. | Feasible |

## Candidate concepts scored before selection

| Candidate | Assets | Environment | Animation | Interaction | Programming | Pacing | Visual coherence | Finishable ending | Total / 90 | Decision |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| **Coastal weather relay** | 9 | 9 | 10 | 9 | 9 | 9 | 9 | 9 | **82** | Selected |
| After-hours municipal archive | 7 | 6 | 10 | 7 | 9 | 7 | 7 | 8 | 68 | Rejected: convincing books/furniture and paper clutter would require more matching assets. |
| Remote greenhouse research station | 6 | 7 | 7 | 8 | 7 | 8 | 8 | 8 | 67 | Rejected: plant variety and glass/outdoor performance would dominate scope. |
| Underground industrial escape | 8 | 8 | 10 | 8 | 9 | 8 | 7 | 8 | 74 | Rejected: too close to the explicitly non-authoritative bunker direction and overrepresented in references. |
| Fire lookout in a forest | 5 | 6 | 10 | 7 | 7 | 8 | 8 | 8 | 59 | Rejected: a credible outdoor terrain/foliage backdrop exceeds available asset certainty. |

## Story quality score

| Dimension | Score | Why |
|---|---:|---|
| Coherence | 9/10 | A single storm and transmitter failure ties all rooms/actions together. |
| Implementability | 10/10 | Three mechanical interactions, no AI, no custom characters. |
| Environment fit | 9/10 | Concrete, steel, cables and control surfaces are logically unified. |
| Gameplay fit | 9/10 | Each interaction changes route/state, not just inventory count. |
| Pacing | 9/10 | Readable opening → constrained repair → open transmitter reveal → final action. |
| Player clarity | 9/10 | Physical light/status language and short objective text point forward. |
| Atmosphere | 9/10 | Storm, isolation, failing power and distant beacon create tension without a chase. |
| Originality | 8/10 | Uses a public-service weather relay and civic warning, not reference fiction. |
| Asset availability | 9/10 | Surface-driven modular architecture avoids unverified asset hoarding. |
| Technical feasibility | 10/10 | Vanilla Three.js, simple collision, procedural audio and transform animation. |
| **Total** | **90/100** | Meets the feasibility-first rule. |
