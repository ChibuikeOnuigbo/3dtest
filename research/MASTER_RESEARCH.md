# Master research ledger

## Evidence status (2026-09-04)

| Area | Status | Evidence | Decision effect |
|---|---|---|---|
| YouTube | BLOCKED | 11 unique URLs indexed; prior yt-dlp metadata/caption/thumbnail attempt and a fresh direct thumbnail-CDN attempt both terminated under default TLS verification. Canonical thumbnail links exist; no image/media arrived. | No visual/gameplay/video observation is valid. |
| Public Sketchfab discovery | PARTIAL | Public model pages can be read; no secure configured OAuth/API download token is present. | Candidate metadata only; no download, asset approval or credential use. |
| itch.io discovery | BLOCKED/PARTIAL | Two supplied pages return a request error to the reader. | No page contents/file licences inferred. |
| GitHub code study | PARTIAL | Nine reference repos were shallow-cloned in isolated ignored labs; architecture/assets analysed, including a 815-record current read-only scan. | Patterns only; no whole-repo merging. |
| GitHub assets | DISCOVERED | Models/images/audio/fonts/archives have hashes and available structural metadata. | Distinct legal/visual/performance checks still required per potential asset. |
| Current game blockout | PROTOTYPE | Original code blockout + Node test/build. | Must not be considered final art or validated level design. |
| Browser QA | BLOCKED | Official Playwright `--with-deps --only-shell chromium` and `--only-shell chromium` were attempted; deps/network and TLS reset failures prevented executable installation. | No E2E gameplay/screenshot/performance result may be claimed. |

## Research-driven constraints

- Never use the plaintext secret sent in chat. No Sketchfab credential is available in secure environment variables, so no API authorization call is made.
- Root code licences and third-party media licences remain separate. A source model with a hash/triangle count is **DISCOVERED**, not approved.
- Reference repositories are isolated under `research/github_repos/` due existing repository policy. This path is ignored and disappears from persisted snapshots; analyses generated from it are tracked here.
- The old “dark linear outpost” pass was rejected as a final level direction. The present bright Signal Court is a prototype response, not a locked final setting.

## Next quality-loop order

1. Complete standardized study/map/licence reports for all nine references.
2. Conduct public source candidate comparison; only authorized/legal asset downloads may enter a review cache.
3. Re-score setting/story concepts using the actual asset evidence; rebuild rather than preserve the current prototype if it loses.
4. Formalize world layout in JSON; run spatial/reachability validation before decoration.
5. Resolve Playwright provisioning or continue only non-browser validation under an explicit blocker.
