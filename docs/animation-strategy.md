# Animation Strategy

## Required animations and evidence

| Object | Method | Need for skeleton/GLB clip | Validation |
|---|---|---|---|
| Security door | Rotate child panel about hinge pivot (0 → 92°) | No | Player cannot cross before open; collision disables only after clearance. |
| Fuse | Translate/scale into socket; case lid rotates | No | Cannot install without collection; socket lamp changes. |
| Breaker | Lever rotates to engaged stop | No | Single activation; power/light/door states change together. |
| Frequency dials | Rotate by discrete 30° increments | No | Values remain 0–9 and target `3-1-4` gates transmit. |
| Transmit button | Short depression + lamp sweep | No | Only plays after target channel. |
| Antenna beacon | Emissive intensity/beam rhythm state | No | Intermittent before transmission; steady after. |

No skeletal character is present, so no skeletal source is invented. This follows the fallback hierarchy: existing clip → compatible licensed clip → retarget → **procedural mechanical transform** → simplify. The selected game reaches the fourth level for appropriate object types.
