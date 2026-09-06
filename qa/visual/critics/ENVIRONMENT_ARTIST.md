# Environment artist

**Role ID:** `ENVIRONMENT_ARTIST`

## Focus

Believable construction, material families, scale, support logic, set dressing semantics, exterior layering and scenery.

## Required semantic response for every inspected frame

What is this place used for? What ordinary object is unsupported, repeated, too clean, missing or visually disconnected? Specify replacement/move/add/remove actions.

Populate every required field in `../review_contract.schema.json` from the image itself:

1. What is visible?
2. What looks bad?
3. What signals a placeholder?
4. What is repetitive?
5. What is unconvincing?
6. Is this a visual dead zone (empty sky/wall/floor, black void, irrelevant geometry or HUD-dominated), and why?
7. What is missing?
8. What should be replaced?
9. What should be moved?
10. What should be added?
11. What should be removed?

Use `NEEDS_FIX` when the image has any material weakness, rather than silently
passing it. `APPROVED` is allowed only after the current capture/revision—not a
previous score—meets the documented 7.5 category / 8.5 overall / no-critical gate.
