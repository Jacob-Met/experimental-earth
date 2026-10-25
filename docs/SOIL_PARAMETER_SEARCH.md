# Search soil parameters from recorded depths

Open **Search soil parameters from recorded depths** inside the maintained soil
response panel. Declare the observed scenario, its material, a basis and minimum,
maximum and number of evenly spaced values for conductivity K and capillary
drive A. Each axis accepts 2–9 values; every Cartesian pair is evaluated with
the original site, rain, numerical interval and unchanged Green–Ampt solver.
The aggregate limit is one million cell-steps. A source material and at least
one assigned calibration depth are required before fitting.

The table retains every tested pair. Only calibration RMSE determines order;
all original uncertainty bands determine compatibility. Held-aside readings
show contradictions without selecting, removing or reordering alternatives.
Inspect each pair to see original source readings, signed residuals and the
maintained interpolation brackets. Source descriptions are user declarations.
There is no probability model, continuous optimization or claim of unique
physical soil identification. A finite grid can miss compatible intermediate
values. Boundary-compatible pairs explicitly expose possible truncation by the
chosen bounds; they do not prove that exterior values are compatible.

Select 2–9 pairs explicitly and use them in the existing comparison draft.
This copies the declared alternatives only. The normal **Compare soil
explanations** action then computes their consequences in both original site
scenarios. It never installs fitted soil properties. Selecting a subset does
not reject the other compatible grid pairs; keep the full original search file.

**Save original search** retains the original project and query, without any
computed verdict. Reopening recomputes that source separately and leaves the
working site unchanged. Replayed pairs cannot be copied into a different site's
draft. Search input edits or project refresh invalidate the result. Files have
a 5 MiB ceiling.

## Computational controls

`node tests/wetting-front-search.test.mjs` exercises ten groups: analytical
constant-rate inverse, exhaustive maintained-solver parity, equal-endpoint K/A
ambiguity followed by a separating time, dry nonidentifiability, held-aside
invariance, absent evidence/material, rejected fit retention, explicit selection,
input-only replay and computational admission. The closed flat 30 mm/h control
has K=10/A=20 and K=24.595279111565403/A=0 at the same 60-minute depth
5.404720888 mm. A 30-minute reading distinguishes these finite choices.
These are authored mathematical observations, not acquired field data.

`node tests/wetting-front-search.browser.mjs` receives the keyboard search,
explicit selection into the real paired consumer, original-input download and
native file replay, stale result invalidation and 390-pixel viewport through
the maintained sandboxed browser harness. Executed receipt details belong on
the integration PR; an authored test is not an execution claim.
