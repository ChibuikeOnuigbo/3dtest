# Story-to-Gameplay Traceability — The Last Signal

| Story event | Location | Player interaction | Required asset/system | Animation/sound | State | Player knowledge | QA proof |
|---|---|---|---|---|---|---|---|
| Relay fault arrival | Airlock | Look at inactive console | Console mesh, interaction ray, objective UI | Wind; red lamp pulse | `introSeen` | “The station needs power.” | Spawn sees console; prompt works. |
| Maintenance instruction | Duty office | Read clipped work order | Note/desk interaction | Paper click | `noteRead` | “Fuse → breaker; dial order 3-1-4.” | Objective advances only after read. |
| Recover proper part | Service passage | Take labelled thermal fuse | Fuse mesh + pickup interaction | Case lid/fuse chime | `fuseCollected` | “I have a thermal fuse.” | Pickup cannot duplicate; case changes. |
| Make repair | Power room | Fit fuse into socket | Socket interaction conditioned on `fuseCollected` | Socket slide; red→amber lamp | `fuseInstalled` | “Breaker can now reset.” | Socket rejects when no fuse, accepts once. |
| Restore power/access | Power room | Pull breaker | Breaker interaction condition | Lever rotation; thump; hum; lights raise | `powerOn`, `galleryUnlocked` | “Transmitter gallery is open.” | Door unlocks and collision opens. |
| Tune warning channel | Transmitter gallery | Rotate three dials | Three dial interactions, data target `[3,1,4]` | Ticks; cyan intensity by correctness | `frequencySet` | “Channel ready to arm.” | Wrong dial keeps transmit disabled; correct sequence enables it. |
| Send warning | Transmitter gallery | Press transmit | Button interaction condition | Button press; transmission tone; beacon stabilizes | `transmitted`, `ended` | “Warning acknowledged.” | End card only after requirements are true. |
