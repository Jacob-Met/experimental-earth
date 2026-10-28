# Authored directional diffuse brightness

The shade and heat investigation can ask how an explicitly authored distribution of diffuse brightness changes the result. Choose **Authored directional brightness** under the mapped diffuse-sky settings, then enter 4, 8 or 16 comma-separated nonnegative weights. At least one weight must be positive. The original weather supplies the diffuse horizontal total; the weights specify which directions supply it.

This is a declared numerical scenario. It does not infer a measured sky from the weather file, sun position, location or obstacles. Direct beam keeps the maintained midpoint calculation and its original grazing convention. The brightness profile is static across all intervals and is shared by existing and proposal geometry and by both roof-height endpoints.

## Headings and weights

Bins have equal angular width and cover a complete turn. Zero is increasing grid X, and angles increase toward grid Y: grid +Y is 90 degrees, grid −X is 180 degrees and grid −Y is 270 degrees. These are grid headings, not geographic bearings. No north-bearing transformation is applied to the profile.

With eight weights, entries describe 0–45°, 45–90°, 90–135°, and so on through 315–360°. Boundaries use the following bin, except that the final boundary closes the turn; a point boundary has zero angular measure. A zero weight excludes that bin's diffuse contribution. Multiplying every weight by the same positive finite factor preserves the model whenever the represented ratios remain supported. Equal positive weights reproduce the isotropic continuous method.

For example, the following declaration places all diffuse brightness in the two sectors adjoining grid +X:

```json
{
  "method": "weighted-continuous-columns",
  "azimuthWeights": [1, 0, 0, 0, 0, 0, 0, 1]
}
```

The result inspector lists the original weights against their grid-heading intervals. Its skyline selector retains existing/proposal and minimum/maximum roofs. Each angular sector shows its controlling mapped source, brightness relative to the brightest bin, and visible contribution to the original unobstructed diffuse input. The keyboard-operated sector slider uses the same maintained inspection path as the isotropic calculation.

## Integral and numerical scope

The retained continuous kernel supplies the maximum roof slope h(θ) along each horizontal azimuth ray from the original saved ground point. The visible projected-elevation fraction remains 1 / (1 + h(θ)²). For authored piecewise-constant azimuth brightness w(θ), the transmission is

```text
T = ∫₀²π w(θ) / (1 + h(θ)²) dθ  /  ∫₀²π w(θ) dθ.
```

The denominator preserves the declared diffuse horizontal total: an unobstructed sky has transmission one for every supported profile. The existing analytic entering-face primitive is reused. Profile boundaries are added to the original corner, cardinal and controlling-face boundaries, so a varying-weight sector never spans a profile transition. Existing cut vectors are preserved at coincident boundaries. Uniform profiles use the original cuts and preserve the original transmission exactly.

Before summation, weights are divided by their maximum to avoid overflow when several large finite weights are supplied. The original declared weights remain in the saved source. Sparse arrays, unsupported counts, negative or nonfinite weights, zero total brightness, and positive ratios that underflow to zero are refused. Compensated sums are used for normalization and transmitted contributions. The work admission includes additional profile sectors in all four endpoint skylines; it retains the complete coupled geometry budget.

Bin classification compares each sector's start against the explicit profile boundaries. It does not divide an angle by bin width or classify a rounded midpoint: either operation can move a one-ulp sector into the adjacent bin. A regression preserves the positive contribution of a sector immediately below π/8. Collapsed-sector width and omitted normalized brightness mass remain diagnostic outputs. Binary64 rounding, omitted geometry and physical prediction error are not certified by these diagnostics.

The geometry assumptions remain opaque ground-filled rectangular columns, a horizontal original ground receiver, and no opening beneath a column. This option adds authored azimuth variation; it does not add elevation-dependent brightness, reflected light, foliage transmission, off-map objects or field calibration.

## Authored thermal example

For the existing authored courtyard, with direct beam zero and diffuse horizontal input 80 W/m², the concentrated grid +X profile above places more light behind the declared eastern column:

| Diffuse declaration | Proposal transmission | Final proposal surface °C |
| --- | ---: | ---: |
| Uniform input without mapped sky | 1 | 25.85192655 |
| Isotropic continuous columns | 0.7808293973514892 | 24.56935628 |
| Authored grid +X brightness | 0.12331758940595655 | 20.72164548 |

The clear existing geometry retains transmission one and the original temperature in all three courses. These are authored model outputs, not measured cooling predictions. The weighted thermal course is independently checked against the maintained thermal solver with diffuse input scaled by the known transmission. Zero diffuse input retains the original beam-only thermal course, and equal weights retain the isotropic course.

## Original-input replay and coexistence

Directional investigations save `experimental-earth/shade-heat-inputs/5` with a distinct authored-azimuth model identifier. Constant weather and original hourly weather both retain the complete original project and declaration. The save contains the raw weights, not derived sky sectors, transmissions or thermal results. Reopening validates the exact model and recomputes through the actual worker. Unknown or cross-version model envelopes, injected result fields and malformed profiles refuse transactionally.

The original v1/v2/v3/v4 source formats, serialized bytes and complete reports retain their existing behavior. Editing weights retires the accepted result, disables export and prevents a delayed old file from reviving the prior declaration. A refused imported file retains the prior accepted investigation; a changed live draft requires a fresh calculation.

The separate solar-sampling and cooling-window investigations retain their own uniform-diffuse model. Mapped sky, including the authored profile, is refused as a source for derived 60/30/15-minute grids. Original uniform-diffuse sampling inputs may still reopen independently. The parent listener is scoped to the shade form, including its new textarea, so editing a child cooling-window form does not accidentally retire the parent or another child.

## Verification

To ask how the final paired result could change across all shared brightness profiles, use the separate [shared-profile final temperature inquiry](SHADE_HEAT_PROFILE_RANGE.md). It retains this original declaration and supplies a separate source-only query and witness profiles.

The new core tests cover an independent vertical-plane integral, extreme uniform weights, clear-sky normalization, positive scaling, profile refinement, joint geometry/profile rotation, nonnegative roof and added-column ordering, malformed input and the one-ulp boundary regression. Thermal tests cover independently scaled diffuse forcing, direct-beam invariance, source-only constant/hourly v5 replay, coherent roof endpoints, cross-model refusal and the separate solar-grid boundary.

Independent review also checks convex mixtures of one-hot profiles, additive-profile linearity, zero-weight obstacles and complete legacy report parity. A separately authored AABB slab-ray and adaptive-quadrature oracle agrees on its supported cases. Its explicit depth-limit refusals remain unqualified; a separate convergence study is not a certified error enclosure. The maintained browser session verifies the actual module worker, real downloads and fresh reopening, malformed profiles, delayed-read retirement, keyboard skyline inspection, source preservation and narrow layouts. Source identities and exact results are recorded in the associated qualification receipt and normal private pull request.
