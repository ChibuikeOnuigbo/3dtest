# Ariadne Signal Conservatory — authored 3D map

The machine-readable coordinate map is [`3d_map.json`](./3d_map.json). The complete
reference-informed hierarchy, room-purpose swaps, source-pattern boundary and 3D tree are
in [`COMBINED_REFERENCE_MAP_3D_TREE.md`](./COMBINED_REFERENCE_MAP_3D_TREE.md).

The playable sequence is:

```text
R1 Arrival Jetty → R2 Keeper's Hall → R3 Signal Court and Orrery
                                      ├─ R4 Generator Bay → returns to R3
                                      └─ R5 Radio Workshop → R6 Lantern Gallery → beacon ending
```

This deliberately combines a return hub, distinct gate rooms, sightline landmarks and a
single final reveal. It is based on independently authored **patterns** studied from the
supplied references; it does not copy repository map geometry, GLTFs, textures or media.

**Validation status:** the declarative spatial validator passes its current checks, but
browser movement, collision, rendered intersections and the complete objective route are
not approved until a real browser run is available.
