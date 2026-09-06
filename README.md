# Rivet Run: Highline District

A first-person browser parkour/action prototype set in a connected late-afternoon
harbour utility district. The route starts on a dispatch roof, crosses a switch
house, splits into a wall-jump shaft or dash viaduct, activates relays in a
boiler court, slides beneath a maintenance bridge, and ends at Sunline Exit.

## Run locally

```bash
npm ci
npm run dev
```

Open the displayed Vite URL, click **START RUN**, then use mouse look plus:

- `WASD` move
- `SPACE` jump / double jump once the Kinetic Permit is collected
- `SHIFT` dash
- `CTRL` crouch/slide, or ground-slam while airborne
- Click to pulse the three mounted boiler-court relays
- `R` reset to the latest checkpoint; `ESC` pause

Use `?seed=your-label` for a deterministic secondary-world variant: roof-edge
service dressing, peripheral skyline/warehouse silhouette, pipe racks, window
occupancy and distant lighting change while the authored primary route geometry,
objectives and critical collision surfaces stay fixed.

## Verification

```bash
npm run test:logic
python3 qa/spatial_validator.py
npm run build
```

These checks do **not** establish visual completion. The local browser executable
is currently unavailable, so player-height capture and semantic visual review
remain blocked. See `docs/qa_report.md` and `qa/visual/README.md`.

## Design records

- `docs/3d_map.md` — world/route spatial contract
- `docs/level_design.md` — pacing, choices and recovery design
- `docs/visual_style.md` — material, support, lighting and critic standard
- `game/data/highline_segments.json` — 40 authored segment contracts
- `docs/asset_manifest.md` — source/licence/technical asset decisions
- `research/visual_reference/ATTACHED_BEFORE_FAILURE_ANALYSIS.md` — supplied
  image set analysed as failure evidence, not target art
