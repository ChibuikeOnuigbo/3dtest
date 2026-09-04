# Asset research, provenance and disposition ledger

**Rule:** a candidate is not an asset in the game. Nothing listed here has been downloaded,
converted, copied into `public/`, or used by production code. Searches used public model
pages only; no Sketchfab API key is present/used and no login, payment, access or security
control was bypassed.

## Environment strategy

The selected location will be authored as a small original modular coastal signal-station
layout: walls, floors, stairs, doors, rails, cables and key interaction housings must have
separate gameplay/collision proxies. This avoids importing an uninspectable turnkey
location and lets room purpose drive layout. External media, if later approved, is
restricted to a small coherent material/prop set with a documented original source.

## Primary search: Sketchfab public candidate review

| Asset ID | Candidate / creator / original page | License stated on page at review | Technical facts stated by page | Visual/provenance result | Status / reason |
|---|---|---|---|---|---|
| SF-ENV-001 | [Modular Inside Building Kit — Gustavo Cambraia](https://sketchfab.com/3d-models/modular-inside-building-kit-ba5e083bde2440cab0f448c0e8e20867) | CC BY 4.0 | 48 four-by-four-metre pieces; 528.3k triangles/276.2k vertices for listing | Modular doors/walls may fit the room plan, but complete-kit triangle count is too high and model viewer did not render in this environment. | **HOLD** — must inspect downloaded contents, license text/creator credit, actual per-piece triangle/material/texture budget, and visual fit. Never import whole kit. |
| SF-PROP-001 | [Old Pipes Bundle — Alex Krush](https://sketchfab.com/3d-models/old-pipes-bundle-modular-industrial-pack-fbe3129ea77243ca92c8219f269ac5cf) | CC BY 4.0 | 19.2k triangles/9.8k vertices; page claims PBR maps and modular pieces | Could support one purposeful generator/relay cluster, but tags lean steampunk/factory and model viewer was unavailable. | **HOLD** — not decorative filler; admit only after selective visual/format/license review and written attribution. |
| SF-PROP-002 | [CC0 - Antenna — plaggy](https://sketchfab.com/3d-models/cc0-antenna-6bc0ff4565db46ab8f7d229a5d272c12) | **Conflicting:** description contains CC0 text but page's displayed License section says CC BY 4.0 | 446 triangles/261 vertices; 2048² PBR textures claimed | The provenance display inconsistency means it cannot be treated as CC0. | **BLOCKED** — do not download/adopt unless the authoritative license is unambiguously resolved; even then test texture budget/visual fit. |
| SF-ENV-002 | [Hirtshals lighthouse interior — Daniel Olaizola](https://sketchfab.com/3d-models/hirtshals-lighthouse-interior-02645b49503c40f7bd6941d683cd789f) | CC BY-SA 4.0 | Scanned cultural site; 338k triangles/179.4k vertices | It is a named real lighthouse scan, is too heavy for this target, and share-alike would complicate distribution. | **REJECTED** — do not use a real scan or source art for the original setting. |

No candidate earns a visual-quality score: source-page viewers themselves reported a
connection/display error in this research environment, so static metadata is not a fair
substitute for reviewing a real downloaded model in the target renderer.

## Secondary search: itch.io

Search result pages for free 3D modular/environment/beach collections were reviewed as
marketplace leads, not asset proof. The results prominently included voxel/low-poly/pixel
and generic packs, which conflict with the coherent believable target. No individual
itch.io pack with complete creator, exact license, downloadable contents, technical budget
and visual fit was found/selected in this pass. **No itch.io asset is a candidate yet.**

## Material candidates (not yet downloaded)

[ambientCG's public material index](https://ambientcg.com/list?type=Material) exposes
individual material records, including concrete, corrugated steel, metal, asphalt, wood
and ground examples that align with the target’s material vocabulary. The fps-asset-kit
README is *not* provenance for these. Before any admission, record the exact ambientCG
asset page, visible license/version, chosen resolution, channel set, source archive hash,
size and in-game use. Start with only three to five materials to protect coherence and
load budget.

## Intake gate — required before status becomes APPROVED

1. Original creator/source URL and date checked; exact license link/text recorded.
2. Creator/title/license credit line prepared; share-alike/non-commercial/no-derivatives
   licenses are rejected unless distribution obligations are deliberately accepted.
3. Legal download obtained normally; archive/file SHA-256 and source filename recorded.
4. Inspect in Blender/asset viewer and actual game renderer: scale, origins, normals, UVs,
   material slots, texture dimensions, triangles, animation/skeleton and visible defects.
5. Test at player height in its intended room with target lighting. Reject visual mismatch,
   toy-like style, duplicated visual language, bad texture scale, clipping or implausible
   function.
6. Add one manifest entry with byte/triangle/draw-call budget and a failure fallback;
   add credit to final `CREDITS.md`.
7. Include it in browser performance and visual QA. Approval can be revoked by either test.

## Explicit exclusions

- Every Kenney asset, texture, UI, model, sound, font and derivative style.
- All media in the five GitHub research checkouts.
- FPS Asset Kit Flat Guns, despite README CC0 claims: stylized/toy-like presentation.
- Bulk asset bundles, unlicensed uploads, attribution-ambiguous records, copy-protected
  downloads, full world scans, assets requiring bypassed access, and generic random props.
