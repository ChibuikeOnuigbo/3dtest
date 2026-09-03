# Agent Knowledge

- Treat reference games as principles, not as asset/layout sources.
- A capsule-like player body and camera must be separate; move the body, then derive camera position.
- Keep collision geometry independent from visual detail. Authored AABBs are preferable to automatic trimeshes for a compact orthogonal game.
- A repair interaction should visibly alter at least one of route, light, sound or objective state.
- Mechanical props need transform animations, not skeletal rigs.
- Keep a browser payload intentional: selected 1K PBR maps are more valuable than a 1GB “just in case” library.
- Never record a failed media fetch as completed visual evidence.
- Reuse geometry/material instances and bound `delta` to prevent control instability and excessive allocations.
