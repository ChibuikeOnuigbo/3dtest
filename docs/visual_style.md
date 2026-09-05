# Rivet Run — visual style contract

## North star

**Rivet Run: Highline District** is a stylised-realistic, late-afternoon harbour
utility district. It is an elevated first-person parkour route through working
roofs, a rail viaduct, a boiler yard, and a bridge. The player should read a
credible place before they read a challenge course.

The camera is strictly first person. The player sees a small practical pulse
emitter, never a third-person mascot or body that can obscure the camera.

## Rejected language

The attached before images establish the following as unacceptable:

- cyan/infinite world voids and unframed long falls;
- detached grass/rock obstacle islands;
- toy portals, giant rings, coin trails, mascot-character framing;
- neon-pink focal clutter and one-colour material repetition;
- unsupported obstacles, arbitrary hero primitives and disconnected scenery;
- bright HUD panels that compete with navigation.

See `research/visual_reference/ATTACHED_BEFORE_FAILURE_ANALYSIS.md` for the
semantic visual review. It is a failure analysis, not a reference art pack.

## Built-world grammar

| System | Rule |
|---|---|
| Support | A route deck belongs to a building, pier, truss, crane or stair. HVAC, masts, relays and lights mount to a roof/facade. Ordinary scenic pieces never hover. |
| Silhouette | Deep parapets, cornices, facade window bays, rectangular gantries, truss chords, bridge piers and stacked roof machinery carry silhouettes. Curves are not used as toy hero geometry. |
| Transition | Every change of region has a doorway, framed gateway, short covered section or bridge header. The player can see the receiving space/landmark before committing. |
| Depth | Roof foreground, adjacent facades, lower rail belt, dense city blocks, distant stepped harbour ridge and warm haze must be present in a vista. |
| Route readability | Reserved ochre paint appears only at take-offs, transition thresholds and recovery direction. It is not scattered as decoration. |

## Material families

| Region | Primary | Secondary | Accent | Desired condition |
|---|---|---|---|---|
| Yard Roof | dark weathered roof membrane | aged brick | muted brass/ochre route paint | soot, seams, active ventilation |
| Switch House | warm concrete | dark painted steel | amber terminal/glass glow | maintained electrical transfer station |
| West Shaft | blue-grey coated steel | shadowed concrete | restrained safety ochre | hard-wearing vertical maintenance bay |
| East Span | oxidised/painted steel | truss steel | route ochre | exposed, engineered rail viaduct |
| Boiler Court | dusty concrete and brick | charcoal stacks | amber relay faces | working heat/utility yard |
| Sunline Bridge | painted steel | concrete piers | pale amber endpoint signal | public-facing elevated infrastructure |

The currently shipped original 1024px base-colour maps are an interim local
material layer, recorded under `research/assets/vector_run_texture_manifest.json`.
They are not represented as equivalent to a full captured PBR pack.

## Poly Haven benchmark record

A 2026-09-05 technical review of Poly Haven's published documentation is logged
at `research/polyhaven/RESEARCH_LOG.md`. The review uses their standards as a
quality bar: coherent complete PBR map sets, calibrated scale, non-repetitive
seamless tiling, correct physical dimensions, and silhouette-preserving asset
budgets. The public `aerial_asphalt_01` material metadata/files were reviewed,
but normal TLS download to the official delivery endpoint failed in this sandbox;
therefore it is **not shipped**. No claimed Poly Haven asset is in the game.

## Lighting and post-processing

- Late-afternoon sun: warm highlights from camera-left; cool slate fill from the
  city/harbour side.
- Fog is warm and low density; it creates distance falloff but cannot erase the
  city boundary or turn the view into a void.
- Emission is constrained to small utility lamps, relay screens and endpoint
  signal. There is no full-screen bloom field or neon-pink landmark.
- ACES tone mapping is used with a restrained exposure. Per-region lighting
  must remain readable before any post effect is added.

## Approval gate

No region is visually approved based on code, generated geometry, FPS, a
screenshot count, or pixel metrics. Genuine player-height frames must be
captured and semantic-reviewed against this contract. A whole-run review needs
no critical finding, every category at least 7.5/10, and an average at least
8.5/10 before claiming visual completion.
