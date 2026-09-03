# FPS2 — Repository Study

- **Source:** https://github.com/Parking-Master/FPS2
- **Pinned research head:** `f8a2997`
- **Repository footprint:** ~1.5 GB / 266 files
- **License:** MIT, copyright 2022 Parking Master. This does not automatically clear every bundled asset or remote dependency; the README credits are incomplete for an adoption decision.
- **Rating for The Last Signal:** **2.8 / 10**

## Summary / architecture
A feature-heavy static HTML shooter/multiplayer project. Main gameplay in `src.html` is inline and highly monolithic. The repository includes legacy Three loaders, local assets, external script URLs, GamepadControls, multiplayer/game-time integration and a Node `server.js`.

## Player / camera / movement / collision
First-person behavior is implemented in a very large inline script. Collision uses `THREE.Box3.setFromObject` intersections for objects in multiple paths. This creates per-check bounding-box work and mixes game object, collision and weapon concerns; it is not an appropriate foundation for a small, reliable exploration game.

## Interaction / level / asset / animation
Includes map selection/loading, pickups, weapon switching, projectile logic, animated GLBs and a broad combat feature set. Import URLs point at external domains (including a `fps3` host and external CDNs). Runtime correctness and availability thus depend on remote services. Several maps/assets are large; the total checkout is ~1.5GB.

## Audio / UI / performance / QA
There is a complete shooter UI (health, rounds, clips, scopes, scoreboard), pause controls and many `audio` elements. These are purposeful for a shooter but explicitly exceed the final game's UI requirements. The project makes unmeasured performance claims in README but offers no automated QA. `setInterval` loops and DOM cloning occur in gameplay paths, and inline code makes lifetime management difficult to audit.

## What is good
- Shows the product value of pause/settings and feedback sounds.
- Uses GLTF assets and animation actions for weapons.
- A rich feature list helps identify systems we can deliberately exclude.

## What is bad / should not copy
- Huge inline script, remote runtime dependencies and duplicated collision code.
- Box3-per-frame collision and timer-heavy gameplay are poor fit.
- Overly combat-centric UI, maps and assets do not match The Last Signal.
- Asset provenance is not sufficiently granular for adoption.

## Adaptation
No code or asset adoption. Only retain the general review lesson: a pause/restart affordance and audio feedback matter, but implement both with a focused local architecture.
