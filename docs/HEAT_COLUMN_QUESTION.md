# A prospective surface reading for hidden heat stores

The panel below saved two-store surface evidence asks when another explicitly instantaneous or interval-mean surface-temperature reading could distinguish the retained lower-capacity/conductance alternatives. Declare a window, 2–241 evenly spaced candidate times and a prospective temperature-band half-width. The saved exposure and original source association stay fixed.

Calibration readings select the offered alternatives. Challenge values and widths do not rank the question or remove alternatives. Every recorded instantaneous time and every recorded averaging support (including challenge supports) excludes any intersecting prospective support, including touching endpoints. There must be at least two calibration-compatible alternatives and an unrecorded candidate time. A different precision or window can produce a different question or no separation.

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

## Plan a sensor averaging window

Interval-mean questions reuse the maintained analytic observation operator introduced
by #144. Original readings retain their own operators; choosing a prospective
operator does not reinterpret recorded evidence.

Choose **Instantaneous surface temperature** or **Mean surface temperature over
a window**. A mean question additionally requires a positive averaging duration.
The candidate grid names **report/end times**; each mean covers the full interval
from `report time − averaging duration` through the report time. The complete
support must be within the original exposure. Choosing the mean operator visibly
raises the earliest report time to at least the entered averaging duration when
necessary; it does not change the original project or exposure. Inspect that
query field before calculating. A later duration edit may require updating the
earliest report time; unsupported windows refuse explicitly. Candidate grids that collapse distinct
requested report times at floating-point precision also refuse; widen the query
window or request fewer samples.

The mean is computed by the maintained analytic integrator across every forcing
segment in the window. It is not the temperature at the final timestamp, an
average of plotted snapshots or a silently converted instantaneous reading.
Calibration records retain their original operator: a recorded mean is compared
with the matching modeled mean, while an instantaneous reading remains a point
comparison. Challenge values never select the question or change calibration
support. Planning does not add, modify or relabel any recorded observation.

### Conservative support exclusion

The declared policy treats both retained and prospective time
supports as closed intervals. A question whose support intersects a retained
support is excluded, including contact at a single endpoint. An instantaneous
record has a point support; an interval-mean record retains its complete declared
averaging support. Both calibration and challenge supports are excluded without
using challenge values.

This is an explicitly conservative planning policy. It does **not** establish
statistical independence, prove reuse of a measured sample, or equate an interval
mean with an instantaneous value at its endpoint. Two continuous interval means
can share a zero-duration boundary without sharing positive averaging duration;
this policy still excludes that touching case. The excluded-candidate count
makes the effect inspectable. An alternative policy would need an explicit
choice and new receiving, rather than silently changing the meaning of a saved
question or observed record.

### Grounded operator contrast

For the authored five-explanation pulse, an instantaneous 132-minute question
separates all ten pairs at ±0.6 °C. A 60-minute mean ending at 132 minutes separates
nine pairs, with minimum gap about 1.01551677 °C. Under the closed-support exclusion
policy and a three-minute report-time grid, the selected 123–183 minute mean
separates ten pairs, with minimum gap about 1.20655620 °C. A separately explored
open-boundary policy would instead permit 120–180 minutes; that is a different
planning question and is not silently substituted.

A 0–60 minute calibration mean of 37.4792076729 ±0.01 °C retains only the reference
alternative. Incorrectly treating that same quantity as the 60-minute endpoint
rejects the entire offered set. The original correctly typed 60-minute endpoint
control retains all five. These executed authored controls demonstrate why the
observation operator must remain explicit; they do not identify a physical soil
or material from acquired field evidence.

Run `node tests/heat-column-average-question.test.mjs` for averaging-window, typed-calibration, support-boundary and numerical-admission controls alongside the original question suite. The dedicated browser course remains `node tests/heat-column-question.browser.mjs`; it includes keyboard mean selection and full-support result inspection.
