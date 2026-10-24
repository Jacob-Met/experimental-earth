# One-sided depth evidence

A sourced observation may bound depth without measuring it exactly. This consumer retains **at least** and **at most** bounds; both include equality. It does not accept a strict greater-than/less-than claim or infer an exact depth from a threshold crossing.

For a declared bound T and explicit nonnegative bound uncertainty U:

- At least T permits modeled depth ≥ max(0, T − U).
- At most T permits modeled depth ≤ T + U.

Uncertainty expands the admissible side. It is not a probability distribution, symmetric observed depth band, or reason to invent an upper limit on a lower-bound observation. A separately disclosed arithmetic guard of 1e-9 × max(1, predicted depth, effective bound) mm handles equality near rounding precision.

Each record retains an event reference, observed scenario, original geometry/forcing context and source/role for every reading. Context comparison uses maintained canonical serialization. Numerical step can change for an explicitly recomputed comparison; changes to observed geometry, forcing, source identity or selected study target refuse rather than reassign evidence. The independent unobserved scenario can change without invalidating the observed record.

The saved infiltration rate set is evaluated through the maintained rain solver and depth interpolation. Every calibration bound must be compatible; held-aside bounds can reject but never improve calibration support; unassigned bounds do not filter. There is no closest-rate fallback or RMSE ranking. The numeric-depth notebook and its comparisons remain unchanged and are not silently associated with this separate record. Export/import uses ordinary project persistence; saved outcomes are not trusted.

## Authored numerical control

A closed, immobile four-cell turf grid receives 30 mm rain in an hour. At 120 minutes, rates 3/9/22 mm/h yield depths 24/12/0 mm; at 180 minutes they yield 21/3/0 mm. At least 5 mm at 120 plus at most 5 mm at 180 retains rate 9. A 15 mm lower bound at 120 contradicts all three jointly. These are authored analytic software controls, not measured environmental evidence or a physically identified soil capacity.

The endpoints do not establish a unique crossing, absence of rewetting or continuous monitoring between observations. Marker placement and uncertainty need an actual measurement basis; photographs alone do not establish a numerical depth threshold.

## Bounds and verification

At most 80 readings, 2–9 maintained study rates and 3 million estimated cell-steps. Invalid records reject on project import. Six focused native groups cover the analytic mechanism, equality/uncertainty, role separation, exact source binding, numeric-depth compatibility, roundtrip recomputation and resource refusal. Actual browser qualification is recorded separately.
