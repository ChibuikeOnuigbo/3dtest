# 3D blockout specification — *Pale Beacon* v0.1

The actual first blockout is `src/world/Environment.js`, made only from original simple
geometry and procedural materials. It is intentionally not presented as final art:
no external environment model/texture is currently admitted, and no browser visual review
has occurred. Its purpose is to validate the critical path before asset accumulation.

## Deliberate geometry allocation

| Component | Blockout representation | Why it exists now | Decoration gate |
|---|---|---|---|
| Floors/walls/ceilings | Individual bays/boxes with 3.9 m walls and room-specific footprint | Establish collision, camera scale, sightlines and portals. | No repainting/trim until door/collision QA passes. |
| Doors | Four sliding panels with labels, frame presentation and own collider | Test lock/unlock/open/close and no invisible portals. | A future approved door mesh must preserve its proxy/clearance contract. |
| Receiver/cabinet/isolator/radio/beacon | One distinct primitive assembly and semantic focus proxy each | Make all mission verbs navigable/observable now. | Replace only after its content/source/license review and player-height screenshot. |
| Sentries | Original compact mesh groups with patrol/alert/disabled feedback | Prove a finite threat/tool interaction without imported characters. | Do not substitute unrelated robotic/cartoon props. |
| Rain/water/tower/horizon | Lightweight ambience/background geometry | Establish exterior stakes/atmosphere and final payoff. | Must meet measured draw/particle budget and never hide navigation. |

## Blockout pass/fail list

- [x] Original Five-zone geometry is modular/data-oriented rather than an imported map.
- [x] Spawn, receiver, door, cabinet, sentry, isolator, radio and beacon have concrete
  spatial positions and gameplay IDs.
- [x] Node-level collision test proves circle proxy blocks/permits a door volume.
- [x] Node reducer test reaches exact ending state through valid ordered events.
- [ ] Real browser movement collision through every room.
- [ ] Real player-height screenshot review of all five spaces.
- [ ] Performance/draw-call/particle verification on a browser/device.
- [ ] Final materials, approved asset load, light polish and prop placement.

These unchecked items are blockers, not implied passes.
