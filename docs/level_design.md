# Level design — Highline District

## Intent

The map is a compact speed route through a working harbour highline, not a
sequence of detached stunt blocks. Each region has its own light/material
identity, a place function, adjacent context, destination landmark and framed
transition. `game/data/highline_segments.json` defines 40 non-filler segment
contracts. The total is deliberately bounded: varied enough for route mastery
without becoming a giant empty course.

## Pacing arc

1. **Dispatch Bay / Intake:** orient, accelerate and learn short gaps without
   visual overload. The Switch House and Sunline Bridge form early goals.
2. **Switch House:** collect double jump from a mounted terminal, see both
   branches under a covered utility canopy, set a safe checkpoint.
3. **Route split:**
   - **West Shaft (skill):** limited wall jumps with a real mid shelf and a
     visible cap exit; precise, vertical and potentially faster.
   - **East Span (fast):** dash across a fully trussed gap, then brake/slide on
     a protected roof; direct but timing sensitive.
   - **Recovery:** lower/side decks return to a broad transfer platform instead
     of requiring a void reset for every early miss.
4. **Boiler Court:** open lateral play changes rhythm. Three relays encourage
   short reposition/aim actions with mounted machinery for cover and context.
5. **Control Bridge:** framed, short crouch/slide passage gives a deliberate
   compression before the broad bridge vista.
6. **Sunline Bridge:** a fast exposed finish with a rail-protected safer line
   and a clear physical endpoint.

## Movement contracts

| Mechanic | Purpose | Legibility / safety |
|---|---|---|
| Ground jump | roof seam, intake rise, bridge seam | ochre take-off mark, visible supported landing |
| Double jump | achieve the transfer/bridge rise | acquired at a mounted terminal, not an abstract pickup |
| Dash | East Span speed line | painted run-up, truss and landing are visible before commitment |
| Wall jump | West Shaft vertical line | coated steel wall panels, mid shelf, cap-door destination |
| Slide / crouch | Control Bridge low maintenance frame | unequivocal low canopy with side ribs and recovery deck |
| Slam / air control | recovery / precision | allowed by controller, must receive player-height interaction testing |
| Pulse | activate mounted Boiler Court relays | small amber sensor panels and short, local feedback |

## Deterministic variation

One master seed (`rivet-run-highline-01`, configurable via `?seed=`) controls
only safe presentation variation: some distant window lamps, roof mast placement
and ridge stepping. Route deck coordinates, gap widths, collision, objectives,
route options and transition framing remain human-authored and invariant. This
prevents procedural dumps from changing level fairness.

## Non-negotiable verification

The static graph can prove only declared relationships. Player-height run
capture must verify actual take-off/landing, coyote/buffer edges, route choice,
wall contacts, dash gap, low-ceiling crouch, recovery, visibility, light,
proportions and transitions. No map segment changes from `BLOCKED...` to
approved without those frames and a hostile visual review.
