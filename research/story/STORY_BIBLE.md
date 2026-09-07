# Story bible — *Pale Beacon*

**Status:** selected feasibility-first concept, pre-production. This is a finite game
specification, not a claim that any room or mechanic already exists.

## One-sentence premise

At bright but storm-swept dawn, an emergency maintenance operator reaches an unmanned coastal
signal outpost after its beacon goes dark; restore the warning transmission before an
inbound rescue ferry enters the shoals, while the storm-damaged security system mistakes
the operator for an intruder.

## Player / stakes / tone

- **Player:** Nia Okoro, the nearest on-call coastal communications technician—capable,
  not a soldier. Her tools have understandable maintenance purposes.
- **Stakes:** the beacon's lane signal is the ferry crew’s safe visual fallback. A status
  panel provides an unambiguous countdown-like urgency without forcing a literal timer
  fail state.
- **Tone:** bright, wet competence under pressure. The station is practical and cared for,
  not a haunted ruin. Information comes from equipment state and short radio transmissions,
  not lore collectibles.
- **Antagonist:** three storm-corrupted inspection sentries, a finite safety-system error.
  They patrol/alert/disable; they do not spawn, speak, or turn the story into a shooter
  arena.

## Beginning → middle → ending

1. **Arrival — “No light on the water.”** Nia reaches the jetty. The beacon is visibly
   dark, the receiver confirms the emergency relay is offline, and the outer door has
   emergency power but the inner systems are dead.
2. **Diagnosis — “Give the station a pulse.”** In the keeper’s hall she finds a manual
   reset instruction and emergency pulse tool. A sentry blocks the normal stair route;
   the tool temporarily disables it rather than killing an enemy for loot.
3. **Restoration — “Make a path for the signal.”** The generator bay needs a failed
   isolator reseated, powering the radio workshop. In the workshop Nia chooses/sets the
   backup route and receives confirmation that the lantern lens can now be armed.
4. **Commitment — “Keep the light.”** She climbs to the lantern gallery, clears the last
   safety lock, aligns the signal, and deliberately starts the broadcast. The visible
   beacon sweeps across the water; a calm ferry radio reply confirms the route.
5. **Ending — “Line held.”** Control returns briefly so the player can look from the
   gallery at the now-lit beacon and departing sentries. A concise final UI state and
   credits/end screen follows. There is no ambiguous fade-out before completion.

## Required playable spaces

| ID | Space | Purpose/identity | Entry / exit | Core interaction | Lighting/navigation landmark |
|---|---|---|---|---|---|
| R1 | Arrival Jetty | Wet external threshold; teach movement/prompt and show stakes. | Start → weather door | Receiver/status console | Dark tower silhouette; distant red emergency strip. |
| R2 | Keeper’s Hall | Human-scale operational heart; explains reset plan. | R1 → service door/R3 | Take emergency pulse tool; read one instruction panel | Warm desk lamp versus cool rain at windows. |
| R3 | Signal Court | Skylit navigational hub; first sentry and readable wing choice. | R2 → R4 stairs or R5 maintenance door | Disable/bypass one sentry; unlock service path | Central signal spindle and amber cable trunk point to the generator wing. |
| R4 | Generator Bay | Loud low-ceiling power room; physical cause/effect. | R3 ↔ R5 | Reseat isolator; power state visibly changes | Green generator indicator becomes active. |
| R5 | Radio Workshop + Lantern Gallery | Precise final signal work and open horizon payoff. | R3/R4 → gallery/ending | Configure backup route; arm and start beacon | Rotating lens becomes the final landmark. |

The tower gallery is a meaningful final part of R5, not a sixth empty room. Each space has
a distinct sound/light/material emphasis and a gameplay/state reason to enter.

## Content limits

One tool/weapon, three sentries maximum, four mandatory interactions, two doors with
visible states, one radio counterpart, no NPC model requirement, no gore, no collectible
currency, no random containers, no respawning combat, and no forced “find three keys”
chain. If animation assets do not clear, tool feedback may be authored procedurally but
the final game may not advertise sophisticated character animations it lacks.
