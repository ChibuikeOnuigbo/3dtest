# Audio design plan

## Intent

Audio should reinforce contact, commitment and place without turning every input
into the same synthetic beep. The harbour district needs an understated wind/rail
bed, distinct roof/steel/concrete footstep families, movement cues, local relay
feedback, and a short exit confirmation.

## Current state

The present build has only temporary Web Audio oscillator cues for dash, target
pulse, checkpoint and end-state feedback. These are functional placeholders,
not a curated final audio library. No OpenGameArt sound has been downloaded or
shipped yet.

## Curation plan

`research/opengameart/` must record each candidate's direct source, creator,
exact licence, attribution wording, sample rate/channels, duration, clipping/
noise check, intended cue, variation count and performance size. Candidates must
not be added in bulk. The following distinct groups are required:

1. Roof membrane / painted steel / concrete landing and step variations.
2. Jump, air dash, slide scrape, wall-kick and slam-impact cues.
3. Relay ready, relay switched, checkpoint and endpoint cues.
4. Low-volume harbour wind, distant rail and utility hum loops.
5. UI focus/select/pause feedback that is quieter than action cues.

At least 3 variations should exist for common footsteps/landings, with weighted
non-repeating selection and a short same-sample cooldown. All imported audio
must be credited in `CREDITS.md` and `LICENSES.md` before shipping.
