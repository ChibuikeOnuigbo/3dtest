# OpenGameArt audio curation — Highline District

**Status:** candidate metadata reviewed; no source audio imported yet.

## Candidate ledger

| Cue group | Candidate | Creator / source | Published licence | Technical/source facts inspected | Decision |
|---|---|---|---|---|---|
| hard roof/steel footsteps | [Fantozzi's Footsteps](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone) | Fantozzi, submitted by qubodup | CC0 | 12 individual steps; 16-bit 44.1kHz FLAC/OGG described; 476.4kB archive | **PENDING_DOWNLOAD_AND_AUDITION** — strong variation base, but must be listened to, split/normalized and surface-tested before import |
| light land / jump | [Jump Landing Sound](https://opengameart.org/content/jump-landing-sound) | MentalSanityOff, submitted by qubodup | CC0 | `jumpland.wav` 39.3kB; MP3 alternatives listed | **PENDING_DOWNLOAD_AND_AUDITION** — possible light landing only, not a replacement for surface-specific impacts |
| heavy land / slam | [Jump Landing](https://opengameart.org/content/jump-landing) | Macro; page asks to credit Dan Knoflicek | CC0 shown on source page | three WAV files, 98.7–119.9kB; jump/pound/fall/land tags | **PENDING_TERM_CONFIRMATION_AND_AUDITION** — resolve the page's CC0/credit wording in credits record before ship |
| industry ambience | [Ambient Sound Effects](https://opengameart.org/content/ambient-sound-effects) | tcarisland | CC-BY 4.0 | eight WAV files; industrial/ambient/electronic tags; individual files from 587.9kB to 16.4MB | **PENDING_DOWNLOAD_AND_AUDITION** — may suit utility hum/wind bed; needs loop/noise/clipping and attribution review |

## Acquisition result

A normal-TLS attempt for the 3.6kB `jumpland48000.mp3` source URL on
2026-09-06 returned `SSL_ERROR_SYSCALL`. No TLS bypass, proxy/mirror or
download workaround was used. The unavailable file is not shipped. This is a
bounded network failure, not a licence rejection.

## Required final cue matrix

| System | Variation / behaviour required |
|---|---|
| Roof / concrete / painted steel footstep | 3+ variations per surface; weighted non-repeat selection and same-sample cooldown |
| Jump / air / wall kick | distinct movement cues that do not sound like UI alerts |
| Light land / hard land / slam | intensity-scaled selection, localised to player contact |
| Slide | onset, looping scrape with controlled stop, no clipping |
| Dash | short air displacement and cooldown-ready feedback |
| Yard ambience | wind, rail distant movement, utility hum; mix lower than footsteps/actions |
| Transition | portal/gate/relay state confirmation tied to local location |
| HUD / UI | quiet focus/select/pause cues; no alarm-fatigue |

No audio is considered curated simply because it has a search result or an
approved licence. It needs source file integrity, waveform/listening, loudness,
loop/variation, mobile/browser decode, in-game mix and attribution validation.
