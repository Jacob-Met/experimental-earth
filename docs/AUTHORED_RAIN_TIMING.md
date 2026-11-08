# Why rainfall timing can change a standing-water decision

Knowing exactly how much rain fell in each half-hour does not always determine how much water remains on a surface at the end. In this authored example, three schedules each deliver 5 mm in the first half-hour and 5 mm in the second. With the same soil assumption, two meet a terminal surface-water target of at most 5 mm and one misses it. Averaging the rain within each half-hour would hide that disagreement.

This is a fixed computational experiment, not an observed rainfall record or a calibrated site. It uses an initially dry isolated surface, constant uptake capacity K = 6 mm/hour, zero capillary drive, unlimited receiving capacity below the surface, and no routing, outlet or evaporation. A declared 20 mm/hour rain-rate cap is an assumption, not something inferred from the two totals.

## Run the example

From the repository root:

```sh
node examples/inspect-authored-rain-timing.mjs examples/authored-rain-timing.json
```

The executable accepts this fixed fixture: three named schedules, four quarter-hour segments, the parameters above and the inclusive terminal target. It refuses changed numerical choices or extra fields rather than presenting a general rainfall-schedule API. A nonblank source statement identifies the authored declaration; it does not authenticate measurements.

The result retains the complete declaration, input SHA256 and byte length, the reviewed implementation identity, all segment inputs and returned states, rainfall totals, mass-balance residuals and target decisions. It writes JSON to stdout without changing the input. The input and unchanged implementation are checked before and after calculation. A changed implementation pin requires renewed qualification rather than silently accepting different numerical behavior.

## Carry both states through the same event

Each schedule begins with cumulative infiltration F = 0 mm and surface water W = 0 mm. Within a schedule, both returned `cumulativeMm` and `surfaceWaterMm` become the next segment's inputs. Drying the surface does not reset cumulative infiltration. Each row below starts from the preceding row's end state; only the start of a different schedule resets both values.

The following are the independently derived control values. Rain rates are in mm/hour; segment rain, infiltration F and surface water W are in mm.

### Uniform rain

| Minutes | Rate | Segment rain | F before → after | W before → after |
|---|---:|---:|---:|---:|
| 0–15 | 10 | 2.5 | 0 → 1.5 | 0 → 1 |
| 15–30 | 10 | 2.5 | 1.5 → 3 | 1 → 2 |
| 30–45 | 10 | 2.5 | 3 → 4.5 | 2 → 3 |
| 45–60 | 10 | 2.5 | 4.5 → 6 | 3 → 4 |

Terminal W = 4 mm: **meets** the target.

### Earliest allowed rain in each half-hour

| Minutes | Rate | Segment rain | F before → after | W before → after |
|---|---:|---:|---:|---:|
| 0–15 | 20 | 5 | 0 → 1.5 | 0 → 3.5 |
| 15–30 | 0 | 0 | 1.5 → 3 | 3.5 → 2 |
| 30–45 | 20 | 5 | 3 → 4.5 | 2 → 5.5 |
| 45–60 | 0 | 0 | 4.5 → 6 | 5.5 → 4 |

Terminal W = 4 mm: **meets** the target. The earlier peak of 5.5 mm does not change this terminal-only decision; a peak-water objective would be a different question.

### Latest allowed rain in each half-hour

| Minutes | Rate | Segment rain | F before → after | W before → after |
|---|---:|---:|---:|---:|
| 0–15 | 0 | 0 | 0 → 0 | 0 → 0 |
| 15–30 | 20 | 5 | 0 → 1.5 | 0 → 3.5 |
| 30–45 | 0 | 0 | 1.5 → 3 | 3.5 → 2 |
| 45–60 | 20 | 5 | 3 → 4.5 | 2 → 5.5 |

Terminal W = 5.5 mm: **misses** the target. The initial dry quarter-hour cannot provide uptake capacity that can be saved for later. In every row, cumulative rainfall equals F + W; no water disappears during a dry segment.

## Existing model and ownership boundary

The example calls the unchanged `advanceWettingFront` interface in `wetting-front.js` exactly once per segment, for 12 calls. It passes the explicit cumulative and surface state, rain rate, duration, conductivity and capillary drive. Its A = 0 branch supplies the constant-capacity control. The maintained [wetting-front guide](WETTING_FRONT.md) explains the broader sharp-front hypothesis, numerical treatment and omitted processes.

This local interface was delivered through [PR 109](https://github.com/Jacob-Met/experimental-earth/pull/109) and the soil work associated with issue 103. The [rainfall timeline discussion, issue 7](https://github.com/Jacob-Met/experimental-earth/issues/7), explicitly identifies same-state segment advancement as the relevant integration seam. This example does not implement that timeline, change project/weather schemas or UI, or alter the event preparation and reopening work in [issue 25](https://github.com/Jacob-Met/experimental-earth/issues/25).

In particular, it does not stitch together fresh `runRain` executions: those initialize a new modeled event rather than continue this local state. It does not qualify a coupled grid, boundary outflow, tracer transport or whole-site intervention. The fixed rates and quarter-hour durations have exact dyadic arithmetic in this control; that is not a general claim that arbitrary binary64 model outputs equal rational arithmetic.

## Separate analytical result: the full range under these assumptions

The three schedules demonstrate disagreement, but three calculations alone do not establish the complete range of all possible histories. The following argument supplies that separate result for the isolated constant-capacity model.

Let time t be in hours, C(t) be cumulative rainfall, C(0) = 0, C(1/2) = 5 mm and C(1) = 10 mm. Assume nonnegative integrable rain rate, so C is absolutely continuous; instantaneous rainfall atoms are excluded. Starting dry with K = 6 mm/hour, reflected storage is

\[
W(1)=\max_{0\le s\le1}\{10-C(s)-6(1-s)\}.
\]

The expression includes s = 1, giving zero. It follows from subtracting cumulative potential uptake and reflecting at zero: unused uptake while dry cannot be banked. With fixed terminal total, this expression decreases when the intermediate cumulative rainfall C(s) increases.

**With cap 20 mm/hour**, the earliest allowed pulses maximize C pointwise within each half-hour; the latest allowed pulses minimize it. They therefore attain the minimum and maximum terminal storage. Evaluating those schedules gives 4 and 5.5 mm. All intermediate values occur: convex interpolation of admissible cumulative histories preserves their two totals and rate cap, while reflected terminal storage varies continuously. The full range is consequently **[4, 5.5] mm**, with both endpoints attained.

**With cap 10 mm/hour**, each half-hour must deliver its maximum possible 5 mm. The rain rate is therefore 10 almost everywhere, and the range is the singleton **{4 mm}**. This more restrictive cap is a different assumption, not a conclusion obtained from the same totals.

**Without a finite rate cap**, the range is **[4, 7) mm**. To see the upper limit, for s ≤ 1/2 the reflection expression is at most 4 + 6s ≤ 7; for s > 1/2, C(s) ≥ 5 makes it at most 6s − 1 ≤ 5. Equality at 7 would require C(1/2) = 0 in the first bound, contradicting C(1/2) = 5 and continuity. The continuous expression attains a maximum on the compact time interval, so every particular admissible history stays strictly below 7.

Latest finite-rate pulses with increasingly large cap R have terminal values approaching 7: their first-bin contribution is 7 − 30/R. Thus 7 is a supremum, not an attainable terminal value under ordinary integrable rain. Uniform rain attains 4; continuity under interpolation supplies every intermediate value below 7. Allowing instantaneous atoms would change the endpoint question and is outside this statement.

The target is inclusive. A threshold of 5 mm leaves both meeting and missing histories under cap 20 or no cap; a threshold equal to the unattained supremum 7 would be met by every history in the uncapped class. Neither this proof nor the executable decides whether a physical site's conductivity, rate cap, initial moisture or omitted flows satisfy these assumptions.

## Qualification

The executable passed its bounded receiving course: all three authored schedules and 12 returned segment states matched an independent exact-rational reflection calculation. The checks also verified carried state, rainfall integrals, mass balance and terminal target decisions. The full-range argument above remains a separate analytical proof, not a conclusion from sampling three schedules. No acquired-data or field-validation claim is made.
