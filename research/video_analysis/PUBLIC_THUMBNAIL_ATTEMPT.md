# Public thumbnail / metadata-link attempt

Beautiful Soup (`beautifulsoup4 4.15.0`) and `yt-dlp 2026.08.19` are installed in an
isolated temporary research environment. The extraction tool
`tools/video_research/harvest_public_youtube_evidence.py` derives the canonical public
`hqdefault.jpg` URL for each of the 11 unique supplied IDs, performs one certificate-
verified thumbnail-CDN request per ID, and records the URL plus result in
[`public_thumbnail_evidence.json`](./public_thumbnail_evidence.json).

## Result

- **11 / 11 canonical thumbnail image links recorded**.
- **0 / 11 thumbnail downloads succeeded**. Each `i.ytimg.com` request ended with the
  same TLS EOF failure observed for yt-dlp’s YouTube requests.
- **0 full videos requested or retained.** No security, TLS or authentication control
  was weakened to change that result.
- The optional Beautiful Soup watch-page mode was deliberately not run: it would repeat
  the already blocked YouTube watch-page requests rather than create new evidence.

The canonical URLs are useful provenance links, not evidence of their visual content while
no image was received. Therefore the game/level redesign below does not claim any visual,
wireframe, pacing or gameplay trait came from a supplied video.
