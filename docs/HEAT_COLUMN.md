# Two declared heat stores

The two-layer study asks whether a lower heat store can keep warming after the surface begins cooling. It extends a saved, sourced surface exposure with a second internally uniform store. It does not infer depth, material conductivity or a spatial temperature profile from the site map.

## Actual workflow

1. Save the original surface heat experiment for a selected place, including the existing/proposed surface properties and sourced exposure intervals.
2. In **Can heat keep building below the surface?**, declare each place's lower-store capacity, surface-to-lower conductance, initial temperature and source. **Fill authored lower-store draft** is an illustrative draft, not measured material data.
3. **Save two-layer declaration**, then **Compare saved heat stores**. Draft edits clear displayed results and require saving before another comparison.
4. Select existing or proposed place. Orange shows the surface; blue shows the lower store. The dashed grey comparison is the original surface model without the added store, using its original capacity. It is not a combined-capacity approximation.
5. **Inspect lower-store maximum** selects the computed peak, including a peak inside an exposure interval. The elapsed-time slider inspects temperatures and cumulative energy. Original sources, assumptions and arithmetic residuals are available in expandable details.
6. Export the whole project to retain the declaration. Importing it restores inputs; comparison recomputes the response. Clear the two-layer study explicitly before associating a retained study with a different exposure.

## Governing model

For surface temperature T₁, lower temperature T₂, reservoir temperature Tₐ and elapsed time t in seconds:

```text
C₁ dT₁/dt = α I − h (T₁ − Tₐ) − g (T₁ − T₂)
C₂ dT₂/dt =                         g (T₁ − T₂)
```

C₁ and C₂ are capacities per unit area, in J/(m²·K). I is incident input in W/m², α is dimensionless absorptivity, and h and g are conductances in W/(m²·K). αI is absorbed input. The original surface declaration supplies C₁, α, h and T₁(0); the added lower declaration supplies C₂, g and T₂(0). The reservoir and incident input are constant within each retained exposure interval. Both stores keep their temperatures continuously across interval boundaries.

The lower boundary is insulated. Only the surface exchanges heat with the reservoir or receives incident input. Each store has one temperature, with constant properties over the course. A temperature difference in Celsius has the same numerical value as a difference in kelvin in these linear equations.

`heat-column-step.js` evaluates the two-rate linear response using capacity scaling to a symmetric decay matrix and its spectral projections. Small-argument series and divided power differences limit cancellation. It integrates temperatures to obtain external and internal transfers. For g=0 it directly reuses `advanceSurfaceHeat`; the lower store remains at its initial temperature. This is a bounded two-state propagator, not a new arbitrary-cell conduction solver.

The formulas describe the exact-real constant-forcing model; their JavaScript evaluation is floating point. Neither the series choices nor reported residuals provide certified error bounds.

## Interior peaks and the plot

Within an interval, each temperature derivative is a sum of two decaying modes. When their coefficients have opposite signs, the implementation computes their possible zero from the logarithms of the coefficient magnitudes and the difference of decay rates. Only finite stationary times strictly inside the interval are retained. Exposure boundaries and these stationary times are evaluated to find each store's extrema. The old uniform-layer assumption that interval endpoints suffice does not apply here.

The chart uses one-minute samples, exposure boundaries and stationary times. Connecting lines help inspection; they are not measured depth profiles or continuous error enclosures. Flat or degenerate cases do not require invented isolated turning points. Reported extrema and stationary times remain engineering numerical results.

## Energy accounting

All internal quantities below are per unit area; the consumer displays cumulative energies in kJ/m².

| Quantity | Definition and positive direction |
| --- | --- |
| Absorbed input | Integral of αI; energy entering the surface |
| Ambient exchange out | Integral of h(T₁−Tₐ); positive leaves the surface, negative means the reservoir supplies heat |
| Internal transfer down | Integral of g(T₁−T₂); positive enters the lower store, negative returns to the surface |
| Surface stored change | C₁[T₁(t)−T₁(0)] |
| Lower stored change | C₂[T₂(t)−T₂(0)] |

The surface balance is absorbed input minus ambient exchange minus internal transfer minus surface stored change. The lower balance is internal transfer minus lower stored change. Adding them cancels internal transfer: absorbed input minus ambient exchange minus total stored change should be zero up to numerical residuals. Internal transfer is not another external energy input. No temperature clipping or balance correction is used to manufacture agreement.

## Source binding and saved inputs

The study schema is `experimental-earth-heat-column/1`, with model `two-uniform-stores-forced-surface-linear-exchange`. It retains a complete copy of the original surface study plus the two lower-store declarations.

The maintained heat-evidence identity binds the surface declaration to the selected cell, existing/proposed cell properties and provenance, grid dimensions, metric cell size and project source. It also compares the whole retained surface study with the current saved exposure. A changed place or exposure yields `context-changed`; the old declaration remains attached to its original inputs and cannot silently become a new study. Export it before explicit clearing and redeclaration.

Portable project validation checks the raw declaration. Numerical results are recomputed; arbitrary stored `report` or `trajectory` properties are not calculation authority. Source notes describe the basis supplied by the user; they do not authenticate a measurement, establish material identity or calibrate the model. The separate uniform-surface temperature and absorbed-energy evidence workflows retain their own models and contracts; this study does not automatically reinterpret those observations as two-layer calibration.

## Supported declaration ranges

| Input | Supported range |
| --- | --- |
| Surface and lower capacities | 1,000–10,000,000 J/(m²·K), each |
| Surface ambient exchange and internal conductance | 0–1,000 W/(m²·K), each |
| Absorptivity | 0–1 |
| Declared initial temperatures | −100–200 °C |
| Reservoir temperature | −100–200 °C |
| Incident input | 0–2,000 W/m² |
| Consecutive exposure intervals | 1–24 |
| Individual interval duration | 0.1–720 minutes |
| Total exposure | At most 1,440 minutes |
| Inspected elapsed time | Within the retained exposure |
| Calculated temperatures | −100–500 °C; out-of-range or nonfinite results refuse |

Surface/lower source notes must be nonempty and at most 600 characters; exposure source notes are nonempty and at most 400. The underlying surface study retains the existing selected-place admission. The direct step API also admits zero elapsed seconds and carries prior calculated temperatures within the calculation range; that does not expand the narrower initial-declaration range.

## Executed controls and receiving status

Six focused native groups have passed. They cover an independent augmented matrix-exponential pulse reference, unequal-capacity insulated equilibrium, the zero-conductance reduction to the maintained surface model, signed internal/ambient transfers, a small-time transfer control, interior-peak inclusion, raw portable reopening, changed-exposure refusal and invalid inputs.

For the independently authored pulse, C₁=20,000 and C₂=80,000 J/(m²·K), g=20 and h=10 W/(m²·K), both stores and the reservoir start at 20 °C. Incident input 700 W/m² with α=0.8 gives 560 W/m² absorbed for 60 minutes, followed by 360 dark minutes.

| Independent reference result | Value |
| --- | ---: |
| Surface at 60 minutes | 44.5309989664 °C |
| Lower store at 60 minutes | 31.2016068056 °C |
| Lower maximum | 32.3323836829 °C |
| Elapsed time of lower maximum | 75.0285166104 minutes |
| Lower temperature after the full dark interval | 22.7552132963 °C |
| Surface at 60 minutes with g=0 | 66.7432622596 °C |
| Lower temperature with g=0 | 20 °C throughout |

The peak occurs about 15 minutes after input switches off. These are authored numerical controls, not observed site temperatures or a material validation.

`tests/heat-column.browser.mjs` passed eight actual-consumer receiving groups using the maintained sandboxed browser helper: native import, sourced declarations, independent peak and zero-conductance controls, literal source text, real project download/reopening, forged-derived-result resistance, exposure/source refusal and desktop/390 px keyboard inspection. The complete current-source native suite passed 468 tests with no failures or skips. Actual desktop and narrow trace/ledger screenshots were inspected. [The versioned receipt](receipts/heat-column-20261024/verification.json) records the base, unchanged executable blobs, commands, environment and image hashes. Merged-consumer receiving remains a separate step.

## Interpretation limits

There is no resolved depth, lateral transport, groundwater or moisture coupling, nonlinear radiation, evaporation, phase change, variable material properties, imposed lower-boundary flux, physical actuator model or comfort assessment. Conductance is declared directly; it is not converted from an assumed thickness or inferred soil conductivity. The original incident input remains declared and is not synthesized from geometric shade. The model can explain conditional storage lag under its assumptions; it does not establish that the place has these properties or that an intervention will reproduce the predicted response.
