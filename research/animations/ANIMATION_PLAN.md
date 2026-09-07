# Animation and feedback plan — *Pale Beacon*

**Status:** planning/research only. There are no cleared external character, weapon,
drone or door animation assets. Nothing below may be described as implemented until it is
seen working in browser QA.

## Evidence and decision

The Three.js starter demonstrates `AnimationMixer` action crossfades; Enari demonstrates
viewmodel clip markers. Their models/clips are blocked. The new game uses a minimum viable
animation plan that can work with original primitive/blockout art and upgrade only if a
licensed asset passes the registry gate.

| System | Required feedback | Implementation route | Acceptance evidence |
|---|---|---|---|
| Doors | Closed/denied/opening/open/closing, synchronized collider. | Transform one authored door mesh/hinge or slider over a short eased duration; state event owns both transform/collider. | Browser capture + probe event order; cannot pass through closed state. |
| Pulse tool | Ready, single pulse, cooldown, impact. | Original viewmodel motion/material flash and a ray impact sprite/mesh; no fake reload/inspect clip promise. | Each state/audible event visible in Playwright run; cooldown/ammo logic independent. |
| Sentry | Patrol, detect, short alert, disabled. | Original simple body with rotation/bob and state-colour emission; no skeletal asset dependency. | State transitions, no wall/door clip, disabled route behaves. |
| Isolator / radio / beacon | Intentional use → mechanical feedback → state result. | Lever/switch transform, lamp emission, radio dial/indicator and final lens rotation/beam. | Interaction capture ties visual feedback to objective event. |
| Ambient life | Rain/wind light movement, indicator flicker within safe limits. | Shader/particle/transform only after frame-budget review; all can be disabled by quality tier. | Frame metrics show no unacceptable degradation. |

## Explicit non-goals

No generic third-person Soldier clip, no copied weapon reload timing, no procedural head
bob treated as character animation, no promised facial acting, no crowd animation, and no
“animated” label merely because an object teleports state. If a later approved glTF
requires skeletal animation, it gets one tested `idle/active/disabled` state mapping and
a failure fallback.
