# Challenge the same receiving explanations across two storms

The draining-layer investigation can now freeze its first event and the complete offered receiving hypotheses, then challenge them against original held-aside readings from a separately declared event. Open the receiving-layer evidence section and use **Do the same receiving explanations survive a separate storm?**

## Source workflow

Freeze the evidence source and hypotheses already loaded above, or open a first-event evidence investigation. Open a separate one-event investigation containing the second storm and its held-aside readings. Both files must declare the same observed scenario, receiving surface and complete ordered hypothesis list, including IDs, labels, source bases, capacity, initial retained water and drainage rate. A mismatched study is refused before either accepted source changes.

Supply distinct event references, the basis for evidence independence, and the basis for the same separately initialized starting water. Both original layout maps, dimensions, walls and transport/time assumptions must match. The second event must contain held-aside readings for the selected scenario and no calibration readings for it. The original project files retain all notebook rows and their roles.

These are explicit snapshots. Later edits to the active site or parent evidence form do not change either frozen event. Replacing the first source retires the separate event and old reference declarations. Replacing the separate source retires its old event/independence/starting-water declarations. A refused replacement retains accepted originals and declarations while retiring the old derived result.

## Unchanged hypotheses, separately initialized events

Every offered hypothesis is simulated on the original existing and proposed layouts under each event. A hypothesis survives only when it fits first-event calibration, is not rejected by any first-event holdout, and fits every second-event held-aside band. A second-event reading cannot refit a parameter or revive an earlier rejection. All candidate rows and original reading predictions remain inspectable, including rejected offers. An empty survivor set has no fallback consequence range.

Capacity, drainage and initial retained water are unchanged between the two simulations. Each event starts separately with that declared initial water. The first event's terminal receiving water is never carried forward. This course therefore applies to separately initialized events; it does not model consecutive storms with state carried between them. Matching starting water and independence are source declarations, not facts inferred from two filenames.

Consequences use proposed minus existing for each unchanged hypothesis. The panel shows separate ranges for the first and second event over the same final survivors. It does not subtract unrelated endpoints or select a preferred material estimate.

## Independent authored control

The fictional example supplies 36 mm/hour in the first event and 12 mm/hour in the second. A 5 mm store draining at 1/hour and a closed 9.438682172448598 mm store both reproduce the early first-event standing depth, approximately 26.5613178275514 mm. The lower-rainfall event separates them: the draining prediction at minute 60 is `7 * (1 - log(12/7))`, approximately 3.22702449487119 mm, while the closed store predicts approximately 2.56131782755140 mm. The difference is about 0.66570666732 mm.

The second value is independently derived rather than copied from the model output. Changing only its held-aside value can reverse which original offer survives without changing first-event calibration or either offer's modeled consequences. Tests also retain a first-event holdout veto, nonzero separate initial stores, original source roles, both-map mismatch refusals and the combined work limit. This is authored conditional arithmetic, not a field measurement or physical validation.

## Saving and execution limits

Save both original event sources to produce `experimental-earth-draining-events.json`. The closed source schema `experimental-earth-draining-event-challenge/1` carries only the two original projects, unchanged study and four declarations. Reopening validates and recomputes; cached conclusions are refused. Intake uses the existing 5 MiB UTF-8 limit and rejects invalid UTF-8. Delayed reads and comparisons cannot replace a newer accepted action, and a refused or canceled selection can immediately be retried.

The preflight counts both layout maps, both event durations and every hypothesis against the existing one-million-cell-step ceiling. It does not partially compute a larger investigation and present it as complete. The fictional example leaves the active site unchanged.
