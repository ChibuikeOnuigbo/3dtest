# Performance Report

Canonical run log: [`qa/performance.log`](../qa/performance.log).

The selected solution keeps a deliberate small budget: five rooms, three reusable PBR material sets (10 downscaled maps / 588KB total), shared primitive mesh construction, no imported character/creature, deterministic transform animation and authored AABB collision. The production build splits Three.js into its own vendor chunk (482.21KB raw / 120.78KB gzip) and the application code is 34.67KB raw.

Actual in-browser FPS/draw-call/GPU memory measurement is pending because Playwright Chromium could not be installed in this sandbox. This is an open final-verification item, not an asserted pass.
