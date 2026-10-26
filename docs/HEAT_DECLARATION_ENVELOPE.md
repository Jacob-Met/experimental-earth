# Explain a necessary conflict before changing lower-store parameters

The original NOAA comparison and inferred heat-proposal consumer now distinguish
an unsuccessful finite search from a necessary conflict with fixed model
declarations. This diagnostic does not choose new parameters. It keeps the
original surface properties, both initial point temperatures, exposure and
reading bands unchanged. Initial-state inference remains a separate question.

## Original Tucson result

The archived nine-row Tucson source has SHA-256
`247bd26d2cdc1af26c933af2ced818d00dfbe629e4d1cdfae9a5a81b1b9547ac`.
Its first interval is 2025-01-01T15:00Z–16:00Z: air 11.2°C, solar 121 W/m²,
surface mean 4.5°C with the retained authored half-width 0.5°C. The explicit
illustrative point initial temperatures are 20°C; surface absorptivity is 0.8
and exchange is 10 W/(m²·K). The phase forcing equilibrium is
`air + absorptivity × solar / exchange`, approximately 20.88°C.

Consequently both model stores must remain at least 20°C throughout this phase,
for every positive lower capacity and nonnegative conductance. The original
band ends at 5°C, an exact 15°C separation. The first three calibration bands are
excluded by this bound; later challenge bands are not excluded by this loose
necessary envelope. Their non-exclusion does not establish a fit.

The NOAA [hourly source specification](https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/readme.txt)
identifies solar radiation as W/m², air/surface temperatures as Celsius, and
hourly values as the 60-minute interval ending at the original timestamp. These
conventions agree with the maintained intake and complete mean operator. The
original source was not shifted, rescaled, or tuned to get a different result.
The contradiction concerns this retained mathematical declaration, not NOAA
measurement validity, every two-store model, or physical impossibility.

## Necessary envelope and exact arithmetic

For fixed positive surface capacity C, exchange h≥0, nonnegative absorbed
forcing Q, and any lower capacity D>0/conductance G≥0, the equations are

`C dTs/dt = h(R − Ts) + Q + G(Tl − Ts)`

`D dTl/dt = G(Ts − Tl)`.

When h>0, write E=R+Q/h. If both initial states of a phase lie in an interval
containing E, neither component can leave it: at the lower edge both derivatives
point inward or are zero, and at the upper edge both point inward or are zero.
The phase envelope therefore extends the preceding interval to include E. At a
forcing boundary the states remain continuous; an instantaneous reading at the
boundary uses the completed phase bound. A subsequent positive-duration support
uses the new phase envelope.

For h=0, the lower edge stays invariant because Q≥0. A common upper supersolution
for both stores is `U(t)=U(start)+Q(t−start)/C`. At equality, the surface derivative
is Q/C and the lower derivative is zero; both remain below this shared upper
function. The implementation uses minutes and explicitly multiplies the slope
by 60. This covers zero exchange, zero conductance and zero forcing without
division by h. It is a necessary bound, not the fitted thermal trajectory.

An interval-mean bound integrates each intersected envelope segment over the
complete original support, including the linear upper function when h=0, then
divides by the exact duration. Original point readings at time zero retain the
exact declared surface initial value. Reading bands and all comparisons use the
maintained `vendor/chronos/exact-halfplanes.mjs` rational operations. Exact
fractions concern the supplied binary64 numbers; displayed intervals enclose
those fractions and do not restore decimal precision before JSON parsing.

Strict separation is a necessary conflict. Exact boundary touch is not excluded.
No engineering epsilon expands an original band. Existing numerical prediction
checks still use their separate arithmetic guards; this diagnostic is not a
certified error enclosure for that floating-point trajectory solver. If exact
arithmetic capacity or finite display enclosures are exhausted, the diagnostic
refuses and leaves the original comparison intact. A reading beyond the exact
sum of original binary64 phase durations also refuses; it is not silently
moved onto a rounded endpoint.

## Actual workflow and custody

Run the existing original NOAA comparison or inferred-proposal search. A new
section explains whether lower-parameter changes alone can reconcile an
original band. Calibration and challenge conflicts remain separate. The first
conflict is visible, and expandable records retain every original support,
source, exact interval and contributing phase. No conflict means only that this
necessary condition did not exclude the reading.

The existing downloads contain only original inputs. Fresh reopening recomputes
the diagnostic; no saved derived bound is trusted. Editing a source or model
draft retires it with the existing result. Changing offered lower parameters
cannot change this fixed-declaration envelope. Neither the active site nor the
original readings are replaced.

## Verification

`node tests/heat-declaration-envelope.test.mjs` checks the exact retained Tucson
source and 15°C gap, strict separation versus exact touch, calibration/challenge
roles, zero-exchange mean integration, zero conductance, cross-phase support and
irregular schedules. Maintained analytic point/mean predictions are challenged
against the envelope across 36 combinations of capacity, conductance and exchange.
Those numerical checks allow solver roundoff and are distinct from the exact
necessary-bound comparison. Rounded-outside supports refuse rather than return
a partial result.

`tests/heat-declaration-envelope.browser.mjs` exercises archived source intake,
actual original-only download/fresh reopen, changed lower parameters, role
changes, both consumer surfaces, keyboard access and 1440/390px presentation.
Receiving must keep the browser sandbox intact; browser passes are recorded only
after execution. Independent review and changed-input checks remain separate
from physical calibration or field validation.
