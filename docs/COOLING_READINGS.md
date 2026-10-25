# Test a constant cooling fraction with original surface readings

The cooling investigation connects retained rain, plant water use and an explicitly
declared thermal surface. Its latent fraction states how much of the plant's latent
energy is supplied by that surface. A temperature comparison can now constrain
that **conditional fraction**, while every other original declaration stays fixed.

## Use the investigation

1. Compare an original cooling investigation in the main workbench, or explore the
   separate fictional example. Select **Use compared cooling source** in the reading
   section. This explicitly retains the original site, rain, heat and water inputs.
2. Select the represented surface and declare a fraction range within 0–1, with its
   source or hypothetical basis. Explain how the original readings belong to that
   exact effective surface and exposure. Air temperature, a point probe, ground
   temperature and a transpiring surface are not silently interchangeable.
3. Enter each original temperature, half-width, time and source. An interval mean
   needs its complete start/end window. Declare calibration or held-aside use;
   these labels do not establish independent acquisition.
4. Compare constant fractions. The consumer retains the full calibration interval
   and the interval remaining after every held-aside reading. It does not pick a
   fraction or write one back into the cooling model.
5. Inspect the conditional temperature range at an exact elapsed time. Save the
   original reading investigation and reopen it to recompute from its source.

Later edits in the cooling form leave the reading investigation attached to its
retained original. The source label explains this difference. Selecting **Use
compared cooling source** again explicitly begins a new association. Reopening a
reading investigation preserves the active site and the separate cooling form.

## Why two endpoint responses cover a continuum

Let `f` be one constant surface latent fraction. Under the existing model, plant
water supply depends on retained water and prescribed demand, not temperature or
`f`. The surface/lower thermal equations are linear, and their latent forcing is
`f` times one fixed supplied-water course. Therefore, for declared endpoints `a`
and `b`, every intermediate `f = a + u(b-a)` has

```
T(f,t) = T(a,t) + u [T(b,t) - T(a,t)],   0 <= u <= 1.
```

The same relation holds for a complete interval mean. Each original reading band
therefore defines an interval of compatible fractions. Intersect all calibration
intervals, retain that result unchanged, then intersect it with the complete
held-aside constraints. Different readings cannot each choose a different fraction.
No statistical independence, likelihood or posterior probability is assumed.

The endpoints are the person's declared range, which may be a single value. The
implementation does not extrapolate outside that range just to obtain a 0/1 basis.
Zero response preserves the whole range when its common prediction fits and rejects
the whole range when it does not. A fixed-point range is reported distinctly.

The shared heat propagator supplies analytic segment means. An averaging window
starts at its actual coupled water/thermal state and splits at original forcing
boundaries and the water-stress switch. Positive duration weights combine those
means. The implementation neither interpolates the displayed minute samples nor
subtracts nearly equal cumulative integrals for a short window. The original
two-store reading contract is extracted into `surface-temperature-readings.js`
without changing its admission rules.

## Authored separating and nonseparating controls

In the fictional courtyard, proposal temperature at minute 60 is about 43.766631°C
at fraction 0 and 25.509674°C at fraction 1. An authored fraction-0.4 temperature
with a ±0.2°C band retains approximately **0.389045–0.410955**. At minute 480,
fraction 0.4 predicts 30.525621°C, whereas fraction 0.8 predicts 27.423860°C. A
held-aside ±0.2°C reading around the latter challenges the original calibration
interval; it does not silently refit that interval. With zero water, zero demand
or zero latent heat, the fraction has no thermal effect.

These are numerical controls calculated from the model, not acquired temperatures,
independent biological evidence or field calibration. The example button labels
every generated reading accordingly.

## Source custody and computation bounds

The saved versioned input contains only `project`, `study` and `evidence`, plus its
schema. It retains complete original heat/cell/lower-store identity, rooted stores,
latent source, demand and original readings. Reopening validates those declarations
and recomputes the result. A saved derived result at top level is refused. Source
text is rendered literally; a later form edit supersedes a pending asynchronous
file read. Failed file admission preserves the previously accepted investigation.

Existing 5 MiB file and rain-work limits apply. At most 100 original readings are
admitted. Instantaneous and mean readings retain their distinct identities; duplicate
operator/time supports are refused. The target evaluator admits at most 2,000
requested time endpoints. Original recharge is computed once for both thermal
endpoint evaluations. No alternate hydrology, root-water or heat solver is added.

The separate arithmetic guard scales with temperature and accumulated thermal
transfers. It is an engineering roundoff convention, **not a certified numerical
enclosure, measurement uncertainty or physical error model**. The retained interval
is conditional on fixed original soil, demand, material, exposure and association
assumptions. A compatible interval does not establish a unique physical cause or
justify automatic adoption. Trajectory inspection concerns the chosen exact time;
no continuous-extrema enclosure is added for the extra latent exponential mode.

## Reproduce qualification

```sh
node tests/cooling-fraction-evidence.test.mjs
node --test tests/*.test.mjs
CHROME_BIN=/opt/google/chrome/chrome node tests/cooling-fraction.receiving.mjs
```

The eight focused native groups cover direct intermediate-fraction equivalence,
independent Simpson integration split at known forcing/stress transitions, mean
partition and tiny-window limits, one common fraction across conflicting readings,
unchanged calibration under changed challenge values, zero-response controls,
point/restricted ranges and strict source-only replay. The existing latent kernel
also retains its independently checked augmented-matrix response controls.

The browser receiver uses the maintained HAMON process owner and sandbox admission.
It checks explicit original-source retention, authored comparison, exact-time and
keyboard inspection, held-aside rejection, source edits, actual download and fresh
file upload, complete mean inputs, literal source strings and pending-read
invalidation, with desktop and 390-pixel captures. Compact exact-run evidence is
retained in the associated verification receipt; raw profiles and logs are not
committed.
