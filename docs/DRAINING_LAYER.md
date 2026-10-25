# A finite receiving layer that drains

## Investigate the same place under three receiving assumptions

In the Rain Experiment Lab, open **Can drainage keep receiving space available?**
Use the current site or the separately labeled fictional draining-bed example.
Declare the surface above the layer, its total storage, the water already retained
at event start, a drainage coefficient and the source or hypothetical basis.

The consumer runs both original maps under three assumptions: unlimited receiving,
a closed layer with the same initial remaining space, and the declared draining
layer. Inspect the surface-water table and course, the separate below-ground
accounts, and any original cell. A proposed reduction in standing water is not
the same quantity as reduced surface boundary outflow or below-ground drainage.

**Save original investigation** keeps the complete original project and layer
declaration, without saved results. Reopening recomputes those inputs independently
of the working site. Changing a declaration or its current source retires results;
a late file read cannot overwrite a newer draft. A separately reopened original
site stays independent of subsequent working-site edits.

## Declared equations and exact local transitions

The optional maintained input is `runRain(..., {drainingLayer: declaration})`:

```json
{
  "schema": "experimental-earth-draining-layer/1",
  "surface": "garden",
  "capacityMm": 5,
  "initialStoredMm": 0,
  "drainagePerHour": 1,
  "source": "Explicit hypothetical layer; no measured calibration"
}
```

Each affected cell has an independent receiver. Let H be surface depth, S retained
receiver water, C total receiver capacity, R rainfall rate, f the maintained
constant infiltration capacity and k the declared drainage coefficient. Depths
are millimeters over the cell, rates are millimeters/hour, and k is in 1/hour.

    dH/dt = R - q
    dS/dt = q - kS
    dD/dt = kS

The infiltration transfer q cannot exceed f. At an empty surface it cannot exceed
R; at a full receiver it cannot exceed kC. This prevents infiltration into space
that does not exist, while allowing drainage to free space continuously. Refused
water stays above ground and enters the maintained neighbor/boundary routing.
Other surfaces retain their original behavior.

For a constant q on a segment:

    S(t) = S(0) exp(-kt) + (q/k)(1 - exp(-kt))
    H(t) = H(0) + (R-q)t

The k=0 limit is handled directly. The algorithm advances to the earliest surface
emptying or receiver filling event, then updates the admissible transfer rate.
It uses `log1p`, `expm1` and a small-argument integral series to retain tiny positive
drainage. It splits a native step at the actual end of the constant storm, so rain
is not spread into the subsequent dry part of that step.

The linear storage/discharge concept is established, for example in the US Army
Corps of Engineers [HEC-HMS linear-reservoir reference](https://www.hec.usace.army.mil/confluence/hmsdocs/hmstrm/baseflow/linear-reservoir-model).
This implementation is an explicitly chosen finite receiving-layer adaptation,
not HEC-HMS, its groundwater/baseflow model, or a validated soil constitutive law.
Its equations and coupling are the declared assumptions being compared.

## Conservation and existing consumers

The original surface account remains:

    rain = accepted infiltration + surface boundary outflow + final surface water

For the affected receiving layers, a separate account is retained:

    initial below-ground water + accepted infiltration = retained water + drainage

Drainage may include water present below ground before this storm. It is therefore
not presented as all originating from this rainfall. Existing local budgets and
forward/reverse rainfall tracers receive the same accepted infiltration flux as
the surface solver. They trace rainfall up to entry into the receiver; the model
does not infer the rainfall origin of its subsequent subsurface discharge.

The legacy default and closed-layer option stay unchanged. Explicit per-cell or
surface constant-rate overrides can be used with the new mechanism. Combining it
with the existing closed-store or Green–Ampt wetting-front option is refused: those
combinations need a qualified shared constitutive model, not an unreported choice
of which restriction wins. The browser comparison uses default surface rates.

## Independently calculated fictional example

Four flat, closed, immobile 1 m² garden cells receive 36 mm/hour for one hour,
followed by three dry hours. Their infiltration capacity is 24 mm/hour. An initially
empty 5 mm receiver with k=1/hour fills at `ln(24/19)` hours. It then accepts and
drains 5 mm/hour while surface water remains available.

Across the four cells, accepted infiltration is
`4 × (20 + 19 ln(24/19)) = 97.7547286898 L`. The receiver retains 20 L and drains
77.7547286898 L, leaving 46.2452713102 L on the surface. The same closed receiver
accepts 20 L and leaves 124 L above ground. Unlimited receiving absorbs the entire
144 L by the end of the course. These are authored mathematical controls, not
acquired observations or estimates for an actual bed.

At zero drainage the new receiver reproduces the closed layer, including a
nonempty initial inventory. A dry source can drain its initial receiver water
without inventing rain, surface water or infiltration. An absent selected surface
does not change the original calculation.

## Scope and numerical limits

The local constant-forcing receiver equations are solved across their state
transitions. Horizontal routing remains the maintained explicit, split finite-volume
approximation: an exact local receiver does not make the entire site calculation
exact, time-step independent, or environmentally calibrated. Neighbor water arrives
at the end of a routing step and can infiltrate during the following step.

The layer has no groundwater backpressure, lateral subsurface flow, capillary rise,
roots, evapotranspiration, nonlinear soil moisture law or inferred parameter values.
Original observations remain in the source file but are not used to fit or validate
this declaration. The comparison does not alter a saved site or authorize a
physical intervention. Total storage is bounded at 10,000 mm and k at 100/hour;
the six-run consumer admits at most one million cell-steps and a 5 MiB input file.
These are computational bounds, not a physical support envelope.

## Verification

`node tests/draining-layer.test.mjs` exercises analytic filling/emptying courses,
144 zero-drain supply/rate/capacity cases, tiny drainage, 150 unfamiliar subdivision
cases, 48 independently stepped conservative ODE references, original-site routing
and local accounts, passive tracer receiving, absent surfaces, a nonaligned rain
stop, original-only replay and admission/refusal controls. The explicit numerical
oracle uses no production transition functions or exponential solutions.

Run the complete maintained native suite after composition. Use
`CHROME_BIN=/opt/google/chrome/chrome node tests/draining-layer.receiving.mjs`
for the actual application, changed inputs, separate original inventory, keyboard
inspection, real download/fresh reopening, forged-result and late-file controls,
current-source retirement, desktop and 390px receiving. The browser course uses
the maintained sandbox-verifying harness. Passing these checks qualifies modeled
software behavior, not environmental accuracy.
