# A prospective surface reading for hidden heat stores

The panel below saved two-store surface evidence asks when another **instantaneous** surface-temperature reading could distinguish the retained lower-capacity/conductance alternatives. Declare a window, 2–241 evenly spaced candidate times and a prospective temperature-band half-width. The saved exposure and original source association stay fixed.

Calibration readings select the offered alternatives. Challenge values and widths do not rank the question or remove alternatives. Every recorded instantaneous time and every recorded averaging support (including challenge supports) excludes that candidate time. There must be at least two calibration-compatible alternatives and an unrecorded candidate time. A different precision or window can produce a different question or no separation.

For each candidate time, the maintained analytic two-store propagator supplies the original surface prediction for every retained alternative. The planner counts pairs whose prediction distance exceeds twice the prospective half-width plus the sum of two separately calculated engineering roundoff allowances. Touching bands stay unresolved. It maximizes that count, then the smallest guarded pair gap, then prefers the earliest time. It inspects a finite uniform grid, not a continuous optimum, global information gain or an experimental-design probability.

Every prediction, source and pair result remains inspectable, including unresolved pairs. This prospective band is a hypothetical measurement precision, not a bound on physical model error. No result fabricates a temperature, authenticates a source, identifies a unique physical material or authorizes sensor deployment. Use the existing surface-evidence form to record an actual measured value and source if one is obtained. The planner never modifies that form or the saved project.

Inputs to this question are session-only. Ordinary project reopen retains its original evidence and model; the question must be recomputed. Changed saved project or question settings clear derived results. The panel explicitly operates on **saved** alternatives, so unsaved drafts elsewhere do not replace their meaning.

## Verification

`node tests/heat-column-question.test.mjs` checks the five-alternative authored ambiguity, an independently enumerated finite pair oracle, order invariance, source nonmutation, challenge-value independence, an independent one-store exponential limit when coupling is zero, missing/stale/no-signal cases, work-size admission and touching-band boundaries.

`CHROME_BIN=/opt/google/chrome/chrome node tests/heat-column-question.browser.mjs` receives an imported source through the actual application, checks literal sources, unchanged original project, changed precision/no-signal, mobile width and independent reopening. The maintained browser owner must admit the browser sandbox before assertions. Passing these checks establishes software behavior, not field validity.

In the maintained authored five-alternative pulse control, a 0–420 minute window
with 141 times chooses 132 minutes. At ±0.25 °C it separates all 10 offered
pairs; its smallest guarded pair gap is about 1.23889016 °C. At ±1 °C the same
time separates 9 of 10 pairs; at ±100 °C none separates. All five alternatives
agree with the original 60-minute calibration band, and the recorded 120-minute
challenge remains excluded from the question regardless of its value. These
are executed authored model controls, not acquired field readings.
