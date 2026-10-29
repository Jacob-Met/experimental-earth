# Refinement of the original supported hypotheses

Mixed timestep sensitivity now evaluates its finer original baseline through the same fixed-rate interface used for hypothetical layouts. The original comparison still screens every declared rate against original observations. The finer comparison receives a private copy of that retained support; it does not recalibrate, change rates, or certify excluded hypotheses at the finer timestep. Receiving-hypothesis comparisons are unchanged.

The conservative estimated-work calculation and the actual profile event budget both count the work actually requested. Original comparison work remains charged, even if public report counters are modified. The combined limit remains three million; minimum timestep, stale-source/query and altered-support refusals remain enforced.

## Matched receiving

Against ef2e77afe8ac941ad0caa24d2ca628bde54a4e41, a nine-rate courtyard source retaining rate 1 could not complete the former finer comparison within actual work. The candidate completes all nine material layouts from two to one minute using 2,414,652 combined event-work units, and all nineteen layouts from four to two minutes using 2,229,863. All finer plan values exactly equal the prior implementation's successful two-declared-rate control retaining the same original rate. These are work/admission improvements, not a precision or convergence claim.

Run `node --test tests/mixed-placement.test.mjs tests/profile-mixed.test.mjs tests/finite-profile.test.mjs`. For the matched original-source refusal course, set `FIXED_REFINEMENT_BASELINE_ROOT` to the prior checkout and run `node tests/fixed-refinement-receive.mjs`. The real full-app browser course remains `tests/mixed-placement.browser.mjs` with explicit Chrome, Playwright and output paths. It refuses missing served assets and records each served JS/CSS hash.
