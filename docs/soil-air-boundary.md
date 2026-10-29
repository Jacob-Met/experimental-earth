# Constant-head water and connected-air limits

## Investigative outcome

A constant surface-water depth and a sealed column base do not specify the gas boundary. This inquiry compares two explicit limits: ambient-pressure venting and retention of the entire initial connected gas amount. For each declared capillary head it reports the fixed-gas equilibrium front, then asks how much of the original gas amount must have left that pocket to avoid a negative water-driving head at a separate target depth.

This is a static mechanism inquiry. It does not estimate conductivity, a release history, a front-arrival time, or any measured soil property. In particular, meeting the reported removal threshold is necessary for nonnegative pressure drive, not a sufficient dynamic history. Beyond the closed-air limit, equality at the positive removal threshold means zero drive; positive infiltration requires a stricter condition. Before that limit, the clamped zero-removal bound can coexist with positive drive. The assumed conductivity is positive but its value is unnecessary for this static calculation.

The entry is on the maintained local batch-water page. The new inquiry has its own original declarations; an existing batch course is not converted into an invented constant-head experiment. It does not alter the working site or existing solvers.

## Motivation from original sources

[Cheng et al. (2025)](https://doi.org/10.3390/app152212200), with [original records on Zenodo](https://doi.org/10.5281/zenodo.17538413), describe constant ponding over a sealed-bottom sand column, with air compression, counterflow and changing pressure regimes. This does not establish fixed gas mass. The records do not independently supply all the parameters and observation mapping needed here, so none are admitted as validation of this model. The example is authored throughout, including its initial front, atmospheric head, suction choices and target.

[Mizrahi et al. (2016)](https://doi.org/10.2136/vzj2016.04.0034), especially the theoretical background, distinguish confined connected air from residual gas behind a wetting front and include air pressure in a Green–Ampt Darcy balance. The present static derivation below is an explicit restricted alternative, not an implementation of their bubbling, inclined-surface or elapsed-time model.

## Explicit assumptions and variables

Depth z increases downward from the soil surface. Packed depth is L; the initially wet front is at z0 with 0 < z0 < L. Ponding depth h0 remains positive and constant. The declared nonnegative capillary head is psi. Atmospheric absolute pressure, divided by water density and gravity, is H. All calculations use millimetres of length or water head after an explicit mm/cm/m conversion.

The column is rigid, uniform and one dimensional. Behind the sharp front, pores become fully water filled; ahead of it, the initial gas-space fraction is uniform. The connected gas has uniform pressure, begins at ambient absolute pressure and obeys an isothermal ideal-gas law. There is no additional connected gas volume, residual gas behind the front, dissolution, changing composition or gas input. Any decrease of connected gas amount is interpreted as release only under these exclusions. A real pressure tube, disconnected bubbles or incompletely wetted region can violate them.

Let area be S and the common storage/gas-space contrast be beta > 0. Gas volume is S beta (L-z); original volume is S beta (L-z0). Area and beta cancel from the pressure and relative gas-amount balance. They are not estimated. Water supplied at the surface equals S beta (z-z0), with constant surface storage and no other losses; the experiment is not a finite initial pool.

## Derivation from pressure and gas conservation

Retaining all the original gas gives

    Pabs(z) * S beta (L-z) = rho g H * S beta (L-z0)
    hair(z) = H * (z-z0)/(L-z).

Here hair is gauge head; Pabs/(rho g) = H + hair. With a = h0 + psi, the Darcy flux under the assumed positive conductivity is

    q = K * (z+a-hair)/z.

The nonnegative-drive condition is hair <= z+a. Multiplying by the positive remaining gas depth gives

    N(z) = (z+a)(L-z) - H(z-z0)
         = -z² + (L-a-H)z + aL + Hz0.

N(z0) > 0 and N(L) < 0. Its constant term is positive, so exactly one positive root r lies inside (z0,L); the other root is negative. With K > 0 the fixed-gas trajectory approaches r asymptotically. We report the equilibrium without integrating that trajectory or claiming finite-time arrival. We never continue a receding-front solution beyond r.

For a target z, remaining gas amount relative to the initial amount is

    f = (1+hair/H)(L-z)/(L-z0).

The greatest remaining amount compatible with nonnegative drive is

    fmax = (1+(z+a)/H)(L-z)/(L-z0).

Under removal-only exchange, the necessary removed fraction is max(0,1-fmax). It is a fraction of moles, or mass at fixed composition, not geometric pore volume. The condition is zero before the fixed-gas root and increases toward one beyond it as z approaches L. The exact base has no positive gas volume and is outside the finite-pressure model.

The freely vented comparison has hair = 0 and positive drive throughout the admitted region. This does not predict behavior after the front reaches a sealed water boundary. Neither idealization is asserted to bracket all real counterflow experiments, which may also change capillarity, effective conductivity and residual saturation.

## Numerical implementation and limits

The code computes advancement delta = r-z0 directly. Set g=L-z0, D=L-2z0-a-H, E=(z0+a)g and Q=hypot(D,2 sqrt(E)). Use delta=2E/(Q-D) for D<0 and delta=(D+Q)/2 otherwise. This avoids cancellation of a short advancement and preserves it separately from the total front depth.

For d=z-z0, the polynomial factorization is

    N(z) = (delta-d)(delta+d-D).

Beyond the computed root, evaluate the removed fraction as

    (d-delta)(delta+d-D)/(H g).

This avoids subtracting a gas-amount fraction very close to one. The implementation also retains the pressure-balance residual and a numerical contact half-width of 64 EPS (L+z0+r+delta+a). Inside that guard it reports the minimum removed fraction as unresolved (`null`), not as a proven positive number or physical zero. This is a practical floating-point guard, not certified interval arithmetic or measurement uncertainty.

Admitted converted bounds are L from 1 to 100000 mm, positive initial depth at least 1e-6 mm, positive ponding head from 1e-6 to 100000 mm, atmospheric absolute head from 1000 to 20000 mm, and capillary head from 0 to 100000 mm. Both initial and target fronts must leave at least 1e-8 L as positive gas depth. The target cannot precede the initial front. These are software bounds, not empirical suitability criteria. No invalid depth, pressure, uncertainty or missing source is clipped or filled in.

One to nine named capillary alternatives are preserved in original order. The chart connects sampled static values with the computed equilibrium and target added explicitly; the final 100% value at L is separately identified as a mathematical limit. Read the numeric target result for the actual query, not an interpolated chart value.

## Original inputs and receiving

`experimental-earth-soil-air-boundary/1` saves only the title, column, boundary, target, capillary alternatives and explicit assumptions. Original numerical values, units, source strings and order remain available at full precision. Imported conclusions or unsupported fields refuse. A failed import preserves the accepted inquiry; a late old import cannot replace newer input or acceptance. Edits retire the old result and its download.

The hand-constructed native control has L=100 mm, z0=10 mm, h0=5 mm, psi=15 mm and H=1408 mm. Its equilibrium is exactly 12 mm: absolute gas head 1440 mm times the remaining 88 mm equals original 1408 mm times 90 mm. At target 20 mm the minimum removed gas fraction is 17/198. Substitution into the independent pressure-volume relation gives the exact 40 mm zero-flow gauge head.

The browser course must use the maintained entry, actual original-input download, independent reopening, literal sources, input edits and numerical-contact/before/after cases at desktop and 390 px. The completed receiving record identifies the exact executing sources; test code alone is not execution evidence. Independent high-precision checks use the original gas law and pressure-volume ratio rather than the implementation's quadratic.
