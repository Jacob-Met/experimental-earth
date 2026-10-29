# Compare explicit standing-water pressure hypotheses

The main Earth workspace includes **Does standing water change the soil explanation?** after the existing wetting-front comparison. Search for “standing water” in the investigation navigation to reach it.

This investigation compares finite, explicitly declared conductivity, capillary-drive and moisture-deficit choices against the same site, rain and original readings. The existing fixed-rate calculation remains the reference. A declared zero deficit selects the existing head-neglected mathematical control; positive deficits include the pressure exerted by surface water. The investigation does not adopt a candidate or replace the working project.

## Use the comparison

1. Choose the scenario whose readings will be scored and the material to investigate.
2. Supply 2–9 distinct hypotheses. Each contains conductivity K in mm/h, capillary drive A in mm, and a volumetric moisture deficit from 0 to 1. Deficits start blank and must be entered explicitly, including a deliberate zero for the control.
3. Record the source or authored assumption behind these choices. A alone cannot identify the moisture deficit.
4. Compare. Calibration readings alone determine candidate order. Held-aside readings can challenge candidates but never improve their rank. Every hypothesis remains visible, including contradicted choices.
5. Inspect a candidate's existing/proposal depth curves, exact modeled times and water totals, original reading sources, residuals and declared uncertainty bands.
6. Save the investigation to retain inputs. Reopening recalculates those inputs in a separate view. Editing the current project or draft retires its live result and export; it does not modify an accepted reopened investigation. An invalid replacement file leaves the prior accepted replay intact.

An absent investigated material cannot identify its parameters. With no calibration readings, the panel describes model consequences without claiming evidence support. Agreement with bands establishes conditional compatibility among the supplied hypotheses. It does not establish unique soil properties or predictive field accuracy.

## Physical model and source boundary

The homogeneous Green–Ampt idealization represents a sharp wetting front and fixed water contents on either side. Its conductivity, capillary potential and moisture deficit are declared properties. The EPA reference describes the conventional event-scale method and its assumptions; Selker and Assouline explicitly identify ponding depth and the change in volumetric water content in the ponded formulation. See [EPA SWMM Reference Manual, Volume I, section 4.4](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P100NYRA.TXT) and [Selker and Assouline (2017), section 1](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1002/2017WR021020).

For cumulative infiltration F, standing-water depth W, constant rain R, conductivity K, capillary drive A and explicit moisture deficit β, the implemented ponded equations are:

```text
dF/dt = K [1 + (A + βW) / F]
dW/dt = R - dF/dt
```

A represents suction multiplied by the initial moisture deficit. β is separately supplied. Setting β=0 while A is nonzero is a mathematical control that neglects surface head; it does not describe a physically inferred zero initial deficit. No drying, redistribution, biological effect, recovery between events or fitted moisture state is inferred.

The cited sources support the physical form and assumptions. The variable-pool derivation and numerical algorithm below are authored implementation work; this does not implement the explicit approximation proposed by Selker and Assouline or inherit that paper's accuracy claims.

## Segment solution

With no rain, define α=1−β and B=A+β(F₀+W₀). While ponded, F′=K[α+B/F]. The time to infiltrate an increment d is 1/K times the monotone integral of (F₀+x)/[α(F₀+x)+B] from 0 to d. The implementation evaluates a logarithmic remainder near zero to avoid cancellation and inverts within a bracket. β=1 has a square-root solution; depletion caps infiltration at the available pool.

For constant rain, water accounting gives W=F₀+W₀+Rt−F. Thus:

```text
F F′ = aF + c + bt
a = K(1−β), c = K[A+β(F₀+W₀)], b = KβR
λ−m = a, λm = b
U = c+bt+λF, V = c+bt−mF
λ log|V/V₀| + m log(U/U₀) = 0
```

The invariant follows from U′/U=λ/F and V′/V=−m/F. A scaled logarithmic remainder avoids cancellation of the linear terms. Constant-drive solutions using the initial and final total water bracket the answer. The implementation handles zero duration/conductivity, zero rain, β=1, dry zero-capillary states and the linear invariant branch separately. Nonfinite and unresolved implicit calculations refuse.

β=0 delegates directly to the existing `advanceWettingFront` implementation. Rain supplied during the interval remains distinct from an initial pool. For R>K, the unponded onset threshold is Fₚ=KA/(R−K). A pre-existing pool may empty before that threshold, follow the rainfall supply, then pond again. Testing only the segment endpoint and clipping a free ponded trajectory would miss this transition.

An authored transition control uses F₀=0 mm, W₀=0.1 mm, R=60 mm/h, K=10 mm/h, A=20 mm, β=0.3 and a one-hour interval. The phased solution infiltrates 28.311774055541388 mm. End-only clipping would produce 28.69422032450125 mm, about 0.382446 mm too much. These are equation checks, not observations.

## Integration and portable inputs

`runPressureHeadRain(cells, width, height, weather, model, options)` requires a versioned model. Omitting it refuses. The ordinary `runRain` route accepts the same declaration as `options.surfacePressureHead`. It is mutually exclusive with the old wetting-front option, rate overrides and a draining layer.

The existing storm-end wet/dry split and step-boundary surface routing remain in use. A closed receiving store can cap accepted infiltration; only that accepted amount advances the front and enters the water budget and passive tracer. This closed capacity is not a rooted-water store. The new comparison does not infer initial ponding, a variable rainfall delivery protocol, or cross-event recovery.

| Declaration | Schema | Required content |
| --- | --- | --- |
| Core model | `experimental-earth-pressure-head-model/1` | Surface, conductivity, capillary drive, explicit deficit |
| Study | `experimental-earth-pressure-head-study/1` | Target scenario, surface, basis, 2–9 distinct K/A/deficit triples |
| Saved investigation | `experimental-earth-pressure-head-investigation/1` | Original project and study; no saved result |

K is bounded to 0–2000 mm/h, A to 0–5000 mm, and deficit to 0–1. Required model/study keys must be own properties with finite numeric values. Aggregate comparison work is limited to one million estimated cell-steps, including both scenarios and the fixed-rate reference. Input files are limited to 5 MiB. Unknown investigation versions and top-level saved conclusions refuse. Older wetting-front readers refuse the new investigation version, and the maintained legacy model validator refuses an explicit pressure-head declaration sent through the old option.

## Verification and practical limits

Run the native tests with `npm test`. The focused files are `tests/pressure-head.test.mjs` and `tests/pressure-head-integration.test.mjs`. The former covers 19,200 interval/water-account courses, including 3,840 exact legacy controls; 1,584 independent β=1 square-root controls; 648 independent no-rain quadratures; ten independently projected midpoint courses at three refinements; 6,000 parameter-limit courses; 140 tiny-value controls; and explicit admission/nonmutation.

The integration tests add 216 independent dry-start, zero-capillary analytical courses, nine partial-storm square-root courses, receiving-store and passive-tracer accounting, calibration/held-aside separation, absence and missing-evidence behavior, input-only recomputation, and strict refusal controls. `tests/pressure-head-routing.test.mjs` adds 18 sloped mixed-surface courses with an internal barrier, crest, boundary exits and optional closed store, checking the accepted front against local budgets and all-source passive tracing. A separate receiving comparison against pinned upstream commit `3b7f6bff95515339f0198b1edc714edb5b013b00` checks 270 complete legacy outputs for exact JSON equality and input immutability.

The independent numerical refinements demonstrate convergence for their authored courses; they are not a formal global error certificate. Surface-flow routing still uses the chosen calculation interval, and off-step readings interpolate retained snapshots. Conservation and equation checks do not establish field validity.

The actual-browser receiver is `tests/pressure-head.browser.mjs`. It uses the maintained sandbox-admitting browser-session helper, the real product server and an on-disk browser download. It exercises navigation, explicit blank admission, candidate comparison and original sources, stale live results, fresh input-only reopening, asynchronous import ordering, atomic rejection, and desktop/mobile result views. Browser qualification requires its completed receipt and inspection of its captured images; authoring this receiver alone is not a passing result.
