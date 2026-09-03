# fps-asset-kit — Repository Study

- **Source:** https://github.com/petroulacl/fps-asset-kit
- **Pinned research head:** `a19b745` (shallow clone, 2026-09-03)
- **Repository footprint:** ~1.6 GB / 469 files
- **License:** No repository `LICENSE` file found. README claims listed upstream assets are CC0. This is insufficient to treat repository code/layout as a reusable licensed package; upstream source/license is recorded separately before any selected texture is used.
- **Rating for The Last Signal:** **5.8 / 10** — asset-source lead, not an architecture reference.

## Summary / architecture
No `package.json`, runtime source tree or game entry point. The root is a curated asset manifest plus Python fetchers. The README describes PBR texture, stylized Flat Guns, firearm SFX, footsteps and HDRI sources. The actual checkout has a large asset library despite the simple root listing.

## Player, camera, movement, collision, interaction, level, animation, UI
**Not implemented.** The README contains illustrative Three.js `GLTFLoader`, material, audio and HDRI snippets only. It does not provide a tested player controller or a reusable game system.

## Asset system / graphics
- Strong point: explicit PBR-map naming and intended metallic-roughness workflow.
- Relevant contents: ambientCG texture sets include `Color`, `NormalGL`, `Roughness`, AO and sometimes metalness. This supports realistic concrete/metal/painted-surface material response.
- Rejected for final art: Flat Guns are declared stylized and do not fit our non-combat, grounded atmosphere. Firearm assets have no gameplay purpose.
- Constraint: no bulk import. The reference directory is 1.6GB; only necessary maps will be copied into a small runtime asset folder after checking actual dimensions and files.

## Audio / performance / QA
Firearm/footstep recordings are potentially CC0 according to the README, but no room-tone/electrical/wind library is supplied. There are no tests, performance instrumentation or build configuration.

## What is good
1. PBR sets have a coherent upstream source and map conventions.
2. The source README records named upstream licenses and URLs.
3. `download_textures.py` documents 2K as a quality/size compromise and re-downloads by category.

## What is bad / should not copy
1. It is not a game framework.
2. It describes a 1.1GB+ payload, incompatible with web-game loading goals.
3. Its generated “agent prompt” and snippets are not evidence that a particular gameplay architecture is sound.
4. Its visual focus is weapons/FPS; that is outside the chosen game.

## Adaptation
Use no code. Use only selected CC0 ambientCG PBR surface maps after asset validation and credit the original upstream source. Do not use Kenney, weapons or other irrelevant library assets.
