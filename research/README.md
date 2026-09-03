# Research Index

This directory is the evidence base for **The Last Signal**, a small first-person Three.js mystery game planned for this repository. It is intentionally separate from runtime source and external reference repositories.

## Research order and current status

1. **Video references** — tooling is installed under `tools/video_research/`. Metadata, caption, thumbnail/frame extraction, and structured observations are recorded per supplied URL. The work avoids retaining full videos; temporary clips are discarded after selected frame extraction.
2. **Story feasibility** — candidate concepts, scoring, selected concept, world map, and story-to-gameplay traceability are maintained in `story/`.
3. **GitHub references** — the user-ranked top three plus two additional repositories are cloned only under `github_repos/` and studied under `github/`. Their code is not copied into the game without a license and architecture review.
4. **Architecture** — selected patterns, limitations, and source evidence are documented under `architecture/`.
5. **Assets and animation** — candidates, licenses, validation results, and rejections belong under `assets/` and `animations/`; assets are only adopted after purpose and license are confirmed.
6. **QA** — phase logs and test evidence are under `qa/`.

## Evidence rules

- A failed network/caption/frame request is recorded as a failure; it is not treated as evidence that the feature worked.
- Observations record source, timestamp where available, category, importance, confidence, and a transferable design principle rather than copied dialogue.
- API credentials are never recorded. `SKETCHFAB_API_KEY` is currently unavailable, so asset discovery must use permitted public pages and explicitly document that limitation.
- **No Kenney assets or Kenney-derived art direction are permitted.**

## Key documents

- `VISUAL_TARGET.md` — visual constitution
- `video_analysis/MASTER_VIDEO_RESEARCH.md` — cross-video design principles
- `story/STORY_BIBLE.md`, `story/STORY_TO_GAMEPLAY.md`, `story/LEVEL_MAP.md`
- `github/` — per-repository notes and scored comparison
- `architecture/PATTERN_LIBRARY.md`
- `assets/LICENSE_MANIFEST.md`, `assets/REJECTED_ASSETS.md`
- `DECISIONS.md`, `TECHNICAL_DEBT.md`, `AGENT_KNOWLEDGE.md`
