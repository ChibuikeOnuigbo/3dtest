# Rivet Run: Highline District — 3D map

**Status:** connected world reconstruction in progress; no player-height visual
approval yet.

## Orientation / scale

- World forward is **north / -Z**. Spawn at `[0, 0, 43]` faces the switch house.
- Roofs sit above an active low city/rail foundation. Adjacent buildings, harbour
  water and a stepped distant ridge establish a continuous exterior world.
- Route decks are collidable only where gameplay needs them. Their visible
  supporting buildings/trusses remain scene geometry so collision does not turn
  every distant facade into an invisible trap.

## Route diagram

```text
                         HARBOUR RIDGE / CITY BLOCKS
                                   north (-Z)
                                      |
                          [ SUNLINE EXIT RELAY ]
                                trussed bridge
                                      |
                          [ CONTROL BRIDGE ]
                      framed low maintenance passage
                                      |
              west cap --- [ BOILER COURT: 3 RELAYS ] --- east landing
                 |                        |                      |
          WEST SHAFT                  recovery deck         EAST SPAN
          wall-jump climb                                      dash gap
                 \                       |                     /
                       [ TRANSFER BEACON / SWITCH HOUSE ]
                              Kinetic Permit terminal
                                      |
                            [ INTAKE STEPS ]
                                      |
                            [ DISPATCH BAY ] spawn
                                   south (+Z)
```

## Spatial regions

| Region | Height / bounds | Meaningful player experience | Context / landmark | Transition |
|---|---|---|---|---|
| Dispatch Bay | roof top `0`, Z 35–51 | Start, acceleration and short-jump timing | yard roof with vents and dispatch frame | roof seam line to intake steps |
| Intake Steps | top `.78`, Z 27.5–34.5 | controlled first jump, fast/safe roof choice | visibly supported intake building | low roof-to-roof rise |
| Switch House | top `1.75`, Z 12.5–25.5 | receive double jump, establish recovery checkpoint | covered transfer canopy and signal mast | framed transfer portal |
| West Shaft | top `2.25 → 5.5`, X -12.3–-6.1 | bounded wall-jump vertical route, mid shelf recovery | steel maintenance shaft and cap door | gated cap exit into court |
| East Span | top `2.25 → 3.18`, X 6.5–11.9 | dash take-off, supported gap, landing brake | orange-grey trussed rail viaduct | framed span gate into court |
| Boiler Court | top `4.65`, Z -21.25–-5.75 | three mounted relay aim/pulse encounters | twin boiler houses, chimney stacks, side deck | exit frame activates the next route |
| Control Bridge | top `5.45`, Z -32.3–-23.3 | slide under a low, intentional canopy; recover | framed bridge and maintenance ribs | visible rise to bridge portal |
| Sunline Bridge | top `7.25`, Z -49.6–-35.4 | final straight, rail-protected alternate and endpoint | trussed bridge, concrete piers, harbour vista | physical exit frame / mounted relay |

## World-boundary policy

There are no intended void falls. A player who drops below the supported route
is reset at a checkpoint before reaching the below-grade district foundation.
This is a recovery system, not a visual substitute for a world. The horizon is
always composed from city blocks, rail infrastructure, harbour water and terrain
rather than a cyan background.

## Authoring data

- `game/data/level_map.json` declares navigation anchors and critical edges.
- `game/data/highline_segments.json` enumerates 40 authored segment contracts,
  including choice, mechanic and transition. They remain explicitly unapproved
  until their corresponding player-height review is added.
- `src/world/HighlineDistrict.js` contains the deterministic seed, supported
  architecture grammar and core collision/runtime construction.
