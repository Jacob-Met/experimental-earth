# Final paired heat range across shared sky profiles

The shade-and-heat panel can now ask whether its final design comparison depends on directional diffuse brightness. Accept an original shade-and-heat comparison, choose 4, 8 or 16 equal grid-heading bins, then select **Investigate all shared profiles**. This is a separate inquiry: the parent’s original sky declaration, weather, site and working project are preserved.

The query allows any nonnegative brightness masses summing to one across the chosen bins. One static profile applies to both designs, both roof endpoints and every original weather interval. It redistributes the original diffuse-horizontal irradiance without changing its total, direct beam, materials, initial temperatures or time grid. The retained elevation law stays unchanged. Bin zero starts at grid +X and headings increase toward grid +Y; these are not geographic bearings.

## What the result means

The result gives the minimum and maximum **final proposal-minus-existing** temperature separately for the ground surface and lower heat store. Negative means cooler in the proposal; positive means warmer. Each bound names its own one-bin witness. Inspecting a witness shows the complete shared profile, both designs’ diffuse transmissions and final endpoint temperatures. Different stores or bounds need not have the same witness. Exact ties select the first bin.

An authored control places the same three-metre column west of the existing receiver and east of the proposal receiver. With diffuse-only forcing, an equally bright sky gives zero difference. Eight-bin shared profiles instead produce surface differences from −5.130281074896182 to +5.130281074896182 °C and lower-store differences from −4.925886730730049 to +4.925886730730049 °C. This is a declared numerical-model control, not an observed sky or a physical performance claim.

With identical scenarios the shared-profile difference is zero. Independently minimizing proposal temperature and maximizing existing temperature would use different skies and can invent a nonzero difference; this inquiry pairs the designs under each common profile before taking extrema.

## Why every profile can be covered

For equal-width bins, normalized masses are λᵢ = wᵢ / Σwⱼ. At a fixed scenario and roof endpoint, diffuse transmission is ΣλᵢTᵢ, where Tᵢ is the one-bin transmission. Every interval’s irradiance is its original direct-beam term plus DHI × ΣλᵢTᵢ.

The maintained two-store terminal response is affine in this forcing schedule. Because Σλᵢ = 1, the initial-state, reservoir and direct-beam terms are retained in the same convex combination. The final paired difference is therefore ΣλᵢΔTᵢ, even when the two designs have different fixed materials and initial temperatures. Its component extrema occur among the complete one-bin courses.

This argument concerns final temperatures and fixed-time linear observables. It does not establish the minimum over profiles of a daily peak, a changing profile over time, or a jointly attainable pair of surface/lower-store extrema.

## Reuse, work and refusals

The implementation calls the maintained geometry/forcing API once with a positive nonuniform internal scaffold so that all requested bin boundaries are present. It uses the returned **unweighted** analytic sector integrals; scaffold weights are neither saved nor used as thermal results. Explicit arc-start comparisons preserve sectors immediately below a bin boundary. Compensated sums retain the original arc order, including zero contributions, and use the maintained transmission support check and clamp convention.

Each bin reconstructs its original interval forcing through `mappedSkyHorizontalIrradiance`. Four complete `evaluateHeatColumnTarget` courses retain the original thermal solver and its stationary-point checks. The paired lower endpoint is proposal lower minus existing upper; the upper endpoint is proposal upper minus existing lower. These pairs are formed within the same bin.

For C original cells, I original intervals and N bins, preflight reserves:

- Direct rays: 6(C − 1)I.
- Four endpoint skylines: 4[4(C − 1) + N](C − 1).
- Thermal courses: 4N, at most 64.
- Thermal course intervals: 4NI, at most 1,536.

The shared 16-million geometry-work limit and maintained source, footprint, temperature and numerical admission remain in force. Reported course counts are not total CPU-operation counts. Collapsed-sector and omitted-angle diagnostics remain available for all four skylines, with raw/clamped transmissions for every vertex.

**Every required vertex must succeed.** An independent control admits a shaded one-bin course and a 99:1 mixture while refusing a clear one-bin course above the maintained thermal range. The complete inquiry refuses that source; it never drops an unsupported vertex and reports extrema from survivors. A failed file replacement visibly retains only the prior accepted inquiry.

Roof/beam uncertainty retains the original conservative forcing-envelope meaning. It does not become a joint physical roof realization, certified floating-point enclosure or bound on unknown geometry. Reflection, nonlinear radiation, moisture, lateral heat flow, off-map objects and physical calibration remain outside this model.

## Original inputs and consumer behavior

The separate `experimental-earth/shared-sky-final-range-inputs/1` envelope stores exactly `kind`, `model`, `source` and `query`. The source is the original strict v1–v5 shade-and-heat envelope, including the complete uploaded weather text and any original authored brightness weights. The query stores only the chosen bin count. Derived vertices, ranges and reports are rejected on reopening and recomputed in an owned worker.

A child-only reopen identifies its own original title, grid, saved receiver and final UTC. Changing bins recomputes that retained source even when no parent result is open. Parent source/input changes retire the child; a newer child action retires older pending parent loads. Superseded workers and delayed file reads cannot restore an obsolete result or download. Source-only downloads do not replace the working site.

## Verification

Run the native receiving with the maintained Node runtime:

```sh
node --test --test-isolation=none --test-reporter=tap tests/shade-heat-profile-range.test.mjs
```

`tests/shade-heat-profile-range.browser.mjs` exercises the actual worker, opposite-sign result, separate witness buttons and keyboard selection, real download/fresh reopening, strict source custody, stale parent/child imports, whole-query refusal, original hourly bytes and desktop/390px layout with the maintained active Chromium sandbox.

Independent review uses full original `compareShadeHeat` one-bin and mixed-profile replays rather than the optimized basis. Its 217-call oracle covers 4/8/16 bins, original hourly and direct forcing, unequal materials, uncertain roofs and the identical-scenario negative control; three further calls establish the refused-vertex counterexample. The maximum observed affine residual is 1.4210854715202004e-14 °C for these fixtures, not a global error guarantee.
