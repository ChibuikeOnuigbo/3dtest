# Reference Study — Evidence to Design Decisions

**Date:** 2026-09-03  
**Purpose:** Extract transferable environmental, progression, interaction, and implementation principles for an original, finishable Three.js game. This document is not a scene-recreation plan.

## Evidence and limitations

All eleven distinct supplied YouTube URLs were processed once using the local `yt-dlp` pipeline. `yt-dlp` metadata, caption, and low-resolution temporary-frame requests failed in this sandbox with a TLS connection closure; the full command evidence is retained in `qa/video-metadata-attempt.log` and `qa/video-extraction-attempt.log`. No video was retained. Public YouTube page extraction supplied titles, durations, descriptions, timestamps and, for several sources, captions/transcript text. Since direct thumbnail downloads failed under the same TLS constraint, **there are no local video frames to claim as inspected**. The game does not rely on an unverified visual observation.

The limitation is recorded rather than hidden. Re-run `tools/video_research/` in an environment with YouTube media access to add frame-specific composition notes. Titles, public descriptions, public chapter timestamps, and accessible transcript sections below are actual obtained evidence.

## Source register

| ID | Source | Obtained evidence | Design knowledge used | Not copied |
|---|---|---|---|---|
| GoVNCfBSxPA | [INFRA Act 1](https://www.youtube.com/watch?v=GoVNCfBSxPA), 4:30:49 | Public description identifies a gun-free infrastructure survey, mechanical/electrical puzzles, hazards, detailed locations and chapter timestamps. | Everyday systems can make legible, grounded puzzles; distinct facilities can carry navigation. | Its city, characters, map, plots and puzzles. |
| hFf9FB8F0dc | [SOMA](https://www.youtube.com/watch?v=hFf9FB8F0dc), 6:55:14 | Public page transcript includes an ordinary apartment opening with object interaction and a simple, contextual first objective. | Start in a readable small space; teach inspection through story-relevant objects. | Its narrative, dialogue, creatures, locations and philosophy. |
| jBDJ5VUi0gs | [Amnesia: The Bunker](https://www.youtube.com/watch?v=jBDJ5VUi0gs), 1:43:49 | Public title/description identifies the game and no-commentary walkthrough format. | Use restricted light as a navigation resource and make a central objective readable; this is general comparison context, not frame-derived fact. | Its bunker, monster, inventory and gameplay loop. |
| CGYuUc9pPtQ | [SCP Containment Breach](https://www.youtube.com/watch?v=CGYuUc9pPtQ), 1:18:00 | Public transcript contains evacuation, failed door control and restore/door-access language. | A world-state repair can change route access; feedback should announce state change. | SCP fiction, containment entities, rooms and controls. |
| C3upVqVOgrM | [Black Mesa](https://www.youtube.com/watch?v=C3upVqVOgrM), 10:18:54 | Public description describes chaptered research-facility progress, varied environments, scientific prototypes and detailed environments. | Interleave landmark rooms and narrow connectors so spaces are memorable. | Half-Life story, enemies, weapons, assets and level layouts. |
| mHu6vcsDVL0 | [Portal 2](https://www.youtube.com/watch?v=mHu6vcsDVL0), 3:29:54 | Accessible public page states the full game has extended/hidden dialogue. | Optional material should enrich context rather than block critical progression. | Portal technology, voice, characters, test chambers and puzzle rules. |
| R8gzbOtyodM | [Outlast 2](https://www.youtube.com/watch?v=R8gzbOtyodM), 4:06:20 | Public description foregrounds vulnerability, atmosphere, sound, chases and potential pacing frustration. | Tension can come from audio, distance and restricted information; avoid frustrating trial-and-error chases in this small game. | Its content, chase mechanics and story. |
| jPU-mvM_OSQ | [Outlast opening](https://www.youtube.com/watch?v=jPU-mvM_OSQ), 5:00 | Public transcript explicitly notes car arrival, sign, badge focus, ambient animals, creaks, flicker and a silhouette. | Let a short arrival sequence establish place, tool and mood through sound/light rather than a text dump. | Asylum, protagonist, camera mechanics and scare sequence. |
| goJaqtAnJFQ | [Alien: Isolation opening](https://www.youtube.com/watch?v=goJaqtAnJFQ), 55:25 | Public transcript supplies a clear personal goal, damaged-station reveal, navigation through a broken arrival, maintenance messages and sound cues. | Begin with a human reason to enter a place; visual damage and maintenance communication explain objectives economically. | IP, characters, settings and stealth systems. |
| bz4MuYw8FBA | [Phasmophobia](https://www.youtube.com/watch?v=bz4MuYw8FBA), 1:04:03 | Public page identifies gameplay/no-commentary horror reference. | Separate optional discovery from required route; use clear equipment/interaction feedback. | Ghost systems, co-op loop and visual identity. |
| to032deYr-Q | [Making Counter Strike in JavaScript because why not](https://youtu.be/to032deYr-Q), 26:31 | Public chapter list and transcript cover empty Vite start, Pointer Lock, camera/player separation, capsule collision, world collision, animation, asset-memory leak, texture reduction and particle optimization. | Use a player body, capped delta time, focused assets, transform animation and explicit lifetime/disposal. | Its Kenney environment assets (explicitly prohibited here), weapons, project code and CSS. |

## Transferable design principles

1. **A repair changes the world, not merely a checklist.** A power or relay interaction should visibly change lighting, sound and a previously blocked route. This turns the objective into a spatial event (INFRA/SCP/Alien evidence).
2. **A small room teaches through context.** The first room should make a player discover movement, looking and one simple interaction before asking for navigation (SOMA and Outlast-opening transcript evidence).
3. **Landmarks do the navigation work.** A glowing control table, orange service lamp or tall antenna silhouette carries more route information than arrows on every wall (cross-reference design principle).
4. **Lighting is selective information.** Keep a readable low ambient baseline. Reserve brighter pools for interactables and exits; darkness creates hierarchy only when movement remains safe (horror-reference comparison).
5. **Sound makes a place function.** Wind against a weather station, a failing transformer, one nearby relay tone and a resolved transmission are contextual feedback—not random scares (Alien/Outlast-opening transcript evidence).
6. **Optional information must not strand the player.** Notes may give emotional context and tuning logic, while objective state and visual affordance remain enough to finish (Portal 2 reference).
7. **Scope determines tension.** No enemy AI, weapons, or chase sequence is needed for a tense first-person story space. Removing them protects collision, clarity and performance.
8. **Movement and camera must be foundations.** The camera follows a player body; collision constrains the body, and the simulation uses a bounded frame delta (Enari tutorial transcript plus code study).

## What the final game deliberately avoids

- A copied bunker, laboratory, asylum, station, portal chamber, gunfight, monster or copyrighted narrative.
- Random fetch-quest keys and arbitrary numeric codes.
- A pitch-black level, jump-scare timer, combat, enemy AI, skeletal-character animation or a large inventory.
- A giant map with many unrelated rooms.

## Direct implementation consequences

The selected original concept is **The Last Signal**: a compact, storm-bound coastal weather relay. The critical path is: inspect the inactive console → locate a heat fuse via a small staff room → fit the fuse → reset the breaker → enter the now-powered transmitter room → set a frequency from the contextual maintenance sheet → transmit a warning. Every required animation is a simple, inspectable mechanical transform. The game needs five purposeful rooms, no external character models, and a small PBR material palette.
