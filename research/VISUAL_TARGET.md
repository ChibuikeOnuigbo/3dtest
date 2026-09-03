# Visual Target — The Last Signal

## Intent
A believable, weather-beaten **coastal emergency relay station** at blue-hour during a storm. It is neither a bunker nor an imitation of a reference game: it is a small public-service building with concrete, faded painted steel, safety glass, damp floor edges, functional wiring and a distant antenna beacon.

## Constitution

| Dimension | Target | Rejection condition |
|---|---|---|
| Architecture | Five connected, human-scale rooms: entry airlock, duty office, service passage, power room, transmitter gallery. 2.8–4.2m ceilings; doors 2.1m high. | Monumental or maze-like spaces without a service purpose. |
| Material quality | PBR concrete, rough painted metal, matte rubber, glass and paper. Imperfect but restrained wear. | Flat color plastic, glossy toy metal, noise-only grunge. |
| Palette | Desaturated blue-grey base; sodium amber for emergency guidance; restrained red only for alarm/fuse state; pale cyan only after transmission. | Saturated rainbow lighting or equal brightness everywhere. |
| Lighting | A low sky fill plus a few purpose-driven fixtures. Lit objects reveal route and room use. Shadows are soft and selective. | Blacked-out play space or a fully even showroom. |
| Prop density | Deliberate workstation clusters: console + chair + log; breaker + conduit + warning placard; transmitter + cable + status lamps. | Random barrels, crates, papers or prop scatter. |
| Storytelling | Wet entry, abandoned shift desk, a handled fuse case, power fault, then an active transmitter. | Long expository text or unexplained decorative clutter. |
| Camera | First-person at 1.65m, 68° FOV, responsive Pointer Lock with clamped pitch. | Fisheye, head bob, dramatic shake or third-person mode. |
| UI | Thin technical sans serif, small mission line, center reticle, contextual `E` prompt. On-screen signals mirror physical indicator lamps. | Health bars, ammo, minimap or persistent giant panels. |
| Animation | Doors, breaker, fuse socket, dial needles, status lamps and antenna beam use deterministic transforms. | Fake humanoid motion or overly elaborate skeletal rigs. |

## Asset standard
No Kenney assets. Adopt only assets with a verified license and a defined role. The first art backbone is a small set of CC0 ambientCG PBR texture maps already present in the locally cloned research kit; source provenance is preserved and assets are copied selectively, never referenced from `research/`. Structural meshes and mechanical props will be purpose-built in Three.js to keep scale, collision and art direction coherent.
