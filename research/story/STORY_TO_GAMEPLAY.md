# *Pale Beacon* — story-to-gameplay state map

## Finite state progression

```text
arrival
  └─ use R1 receiver → diagnosed
       └─ acquire R2 emergency tool → equipped
            └─ resolve R3 sentry / service path → generator-access
                 └─ reseat R4 isolator → powered
                      └─ configure R5 route → route-ready
                           └─ arm/start gallery beacon → ending-active → completed
```

Each arrow is a guarded interaction with an immediately observable consequence. There is
no hidden auto-completion from crossing a trigger volume.

## Gameplay mapping

| Story beat | Player action | Required state/asset/sound feedback | Test assertion |
|---|---|---|---|
| See the danger | Move through R1 and focus receiver | `diagnosed`; objective changes; tower remains dark; receiver click/radio line | Prompt only appears in range/line of sight; objective visible. |
| Accept responsibility | Open hall tool cabinet / take tool | `equipped`; held-tool UI state; cabinet door collision changes | Tool cannot be acquired through wall or twice. |
| Regain access | Avoid or pulse-disable R3 sentry | sentry `patrol → alert → disabled`; short pulse/impact audio; service door unlocks | AI never clips door/wall; disabled state is finite and visible. |
| Restore power | Hold deliberate `E` at R4 isolator | `powered`; generator lamp/audio changes; workshop lock releases | Door collision and objective change in same state event. |
| Route signal | Operate R5 panel in a short two-step check | `route-ready`; radio confirmation; lens control active | Wrong/early use reports specific reason, does not trap player. |
| Complete mission | Arm and start beacon at gallery | `ending-active`, rotating/elevated beam, ferry response, end screen | Ending only once; reset/reload cannot leave player in a dead state. |

## Rough room graph and traversal rhythm

```text
                 [R5 workshop / gallery]
                    ^             |
                    |  powered    | completed
[R1 jetty] → [R2 hall] → [R3 skylit signal court]
                                  | \
                                  |  \ service route
                             [R4 generator] ───────┘
```

The open skylit R3 court creates a short choice: use/avoid the sentry on the main stair, or
open the service route after understanding its condition. R4 rejoins the same compact
mission rather than creating a sprawling branch. Players repeatedly see the dark beacon
until its final visual transformation, creating clear spatial/story continuity.

## Interaction/door inventory

| ID | Type | Preconditions | State result | Collision result |
|---|---|---|---|---|
| D-R1-R2 | Weather door | arrival | opens once entered | slider/hinge slab moves out of passage. |
| I-R1-receiver | console | arrival | diagnosed | none. |
| I-R2-cabinet | pickup cabinet | diagnosed | equipped | cabinet door no longer blocks tool. |
| S-R3-01..03 | finite sentries | equipped for pulse | disabled / path-safe | never supplies an invisible barrier. |
| I-R4-isolator | mechanical switch | generator-access | powered | unlock condition for workshop door. |
| D-R4-R5 | service door | powered | opens | collision proxy changes atomically. |
| I-R5-route | radio panel | powered | route-ready | none. |
| I-R5-beacon | arming control | route-ready | ending-active/completed | locks subsequent gameplay only after ending sequence. |
