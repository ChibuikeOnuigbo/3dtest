# Research architecture and blockout diagrams

These files are **authored research diagrams**, not browser screenshots and not
substitutes for Playwright gameplay QA. They preserve evidence from the Enari Engine and
FPS2 local source studies while avoiding any source-asset reuse.

| File | Type | Purpose |
|---|---|---|
| [architecture-map-strategy.md](./architecture-map-strategy.md) | Evidence-led design decision | Selective combination plan, map composition, collision, state, and performance gates. |
| [runtime-system-study.svg](./diagrams/runtime-system-study.svg) | 3D FPS runtime/system diagram | Proposed independent modules informed by source patterns. |
| [interior-exterior-axonometric.svg](./diagrams/interior-exterior-axonometric.svg) | Axonometric map-composition diagram | One logical mission with exterior/interior zones, portals, and collision layers. |
| [blockout-plan.svg](./diagrams/blockout-plan.svg) | 2D candidate plan | Small, inspectable interior/exterior critical-path blockout topology. |
| [../../qa/strict-fps-qa-rubric.md](../../qa/strict-fps-qa-rubric.md) | QA policy | Evidence requirements and severe scoring model for future real browser validation. |

No file in this directory establishes that a game feature has been implemented or tested.
