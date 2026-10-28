# Constrain a shared sky with an original temperature band

The shared-profile inquiry can now use one attributed **instantaneous existing-surface temperature band** at its original saved receiver and final UTC. It retains every compatible static sky mixture and reports the final proposal-minus-existing range under those same mixtures. The original site, weather, material declarations, starting temperatures and authored parent profile remain attached.

## Use the inquiry

1. Complete a shared-profile comparison in the shade-and-heat panel, or reopen an original reading-inquiry file.
2. Enter the original final surface temperature, its nonnegative half-width and its source. The interface identifies the existing receiver and final UTC to which this reading will be attached. Label authored controls as authored controls.
3. Select **Compare supplied band**. Inspect each component bound and its shared mixture; the mixture table gives the nonzero bin masses, both designs’ endpoints and exact represented-coefficient fractions.

The result distinguishes a compatible family from an empty family. An empty family is a completed comparison with the supplied reading retained. Unresolved observation endpoints, a failed original thermal course or exhausted arithmetic capacity refuse the inquiry instead of dropping unsupported cases. A failed file replacement retains the prior accepted source and result.

The original existing final surface must have one computed value under both maintained forcing endpoints in every one-bin course. This avoids silently selecting a favorable existing roof or beam endpoint for the reading. Proposal and other-store envelopes retain their original conservative interpretation.

## An observation can change the comparison

The authored opposite-column control puts a three-metre obstruction west of the existing receiver and east of the proposal receiver. The original eight-bin shared family has final surface differences of approximately −5.130281 to +5.130281 °C. An authored existing reading of **22 ± 0.1 °C** excludes every original one-bin profile, but admits **24 two-bin intersection vertices**. Its compatible surface range is approximately **+2.373572 to +3.951927 °C**.

Filtering only the one-bin courses would incorrectly report no compatible sky. The new intersection preserves the mixtures. Replaying every mixture through the original full thermal comparison gives a maximum observed endpoint residual of 7.11e−15 °C in this control. This is a numerical comparison on an authored example, not a physical accuracy bound or a field observation.

A broad band restores the original range. A 40 ± 0.1 °C band is incompatible with the original family. Zero-width bands can still admit mixtures. Identical designs retain a zero paired difference rather than combining different skies. The coarser four-bin family does not admit the same 22 ± 0.1 °C control: changing the profile resolution changes the allowed model family, so compatibility is recomputed.

## Complete intersection and paired optimization

Let λ be the nonnegative bin masses with sum one, and let aᵢ be the represented existing final-surface temperature for one-bin course i. The observation permits

```math
L \leq \sum_i a_i\lambda_i \leq U, \qquad \lambda_i\geq0, \qquad \sum_i\lambda_i=1.
```

L and U are the exact rational difference and sum of the supplied binary64 reading centre and half-width. A vertex of this intersected simplex either is an admitted original one-bin vertex, or has two positive masses where an original edge meets one of the observation boundaries. The two parallel observation boundaries add at most one independent active constraint, including a zero-width band. Consequently the complete enumeration needs at most N² candidates: 256 for 16 bins.

For each candidate, both designs’ thermal endpoints use its same exact weights. The paired lower objective is proposal lower minus existing upper; the paired upper objective is proposal upper minus existing lower. These differences are formed from the represented final-temperature coefficients using the existing exact rational primitives. Surface and lower-store minima and maxima are selected separately. Exact ties retain the first deterministic candidate: admitted bins in increasing order, then increasing bin pairs and lower/upper observation edges.

This is exact arithmetic for the finite affine coefficient problem. The coefficients themselves come from binary64 geometry and thermal integration. Exact fractions do not certify those calculations, omitted geometry, sensor interpretation or physical model validity. Displayed table values are explicitly approximate; the witness details expose exact fractions and adjacent outward binary64 endpoints.

## Bounded work and retained failures

The inquiry first runs the complete maintained shared-profile basis: one geometry/forcing pass and 4N complete thermal courses, with the existing 16-million geometry allowance, at most 64 courses and 1,536 course intervals. Every vertex must succeed before the observation is applied, even if the observation might exclude that vertex.

The intersection examines at most 120 bin pairs and at most 256 candidates. It reuses `vendor/chronos/exact-halfplanes.mjs` unchanged, including its 4,096-bit rational capacity refusal. All exact candidates are evaluated before a result is returned; no partial range is accepted after failure. Work counts are declared algorithmic counts, not wall-clock guarantees.

The single reading constrains one static profile across every original weather interval. It does not estimate a time-varying sky, change material parameters or initial states, optimize a daily peak, identify the actual sky, or validate a physical intervention. Incompatibility concerns the supplied band and this declared coefficient family; it does not establish which physical assumption or observation is wrong.

Two original saved receiver files can also be used in the separate [two-point shared-sky inquiry](SHADE_HEAT_SPATIAL_EVIDENCE.md). Its link opens an independent page, retains both original records and asks explicitly why one static sky should be shared. The one-band inquiry and its input format remain unchanged.

## Original-source replay and interaction

The separate `experimental-earth/shared-sky-final-reading-inputs/1` envelope contains only `kind`, `model`, `source` and `query`. The source is the original strict v1–v5 shade-and-heat envelope, including raw uploaded weather and original authored sky weights. The query contains the bin count and one exact reading record: target, store, instantaneous aggregation, saved cell, canonical final UTC, temperature, half-width and attribution. Saved results, mixture vertices and altered receiver/time roles are rejected.

A fresh page can reopen this child without a parent comparison. Editing its reading or bins recomputes its retained original source. Changing either ancestor’s source/query retires the dependent reading and clears its attachment; a newer child action cancels older pending ancestor work. Superseded file loads and actual worker completions cannot restore obsolete results or downloads. The working site remains unchanged.

## Verification

The native course covers mixed-profile admission, full original thermal replay, zero-width/wide/incompatible bands, degenerate and subnormal coefficients, paired identical-design controls, unresolved observation endpoints, whole-basis refusal, original weather and all parent formats, and strict saved-source admission.

An independent Python Fraction review projects the simplex into observation/objective space and clips its convex hull, using a different construction from candidate-edge enumeration. It checks 416 cases and 7,100 candidate witnesses, exact objective extrema, simplex/band membership and minimal outward binary64 displays. Its cases include duplicate coefficients, 2/4/8/16 bins, zero-width and incompatible bands, subnormals and large signed coefficients.

`tests/shade-heat-profile-evidence.browser.mjs` runs the actual worker, original-file downloads and fresh-page replay, keyboard mixture inspection, changed-bin incompatibility, forged/unsupported input refusals, delayed files from both ancestors, a held real worker response, original hourly weather, and desktop/390px layouts. The maintained shared-profile browser course separately checks that the parent inquiry still works.
