# Incoming rain can carry sensible heat

The maintained **Does the rain itself warm or cool this surface?** investigation
uses the original project's constant rain pulse and retained two-store heat study.
Declare incoming liquid-water temperature, volumetric heat capacity, the fraction
that contacts each surface, the property source and an explicit shared event clock.
Compare both places with their unchanged no-contact baseline. The original place
is preserved. A separate authored example makes a short rain pulse visible at its
end and shows how the temperature difference subsequently decays.

The model is an idealized flowing contact. A declared fraction of incoming water
reaches the surface, equilibrates to its instantaneous temperature and departs.
The remaining rain does not exchange sensible heat in this thermal model. The
hydraulic model is unchanged; the contact fraction does not remove rainfall from
its water balance. There is no thermal water inventory, runoff heat transport,
soil advection, evaporation or phase-change calculation. This mechanism is separate
from the maintained root-water/latent-loss, longwave and lateral-conduction models.

## Conserved calculation and reuse

Let R be the original rain rate in mm/h, f the declared contact fraction and Cw the
declared volumetric heat capacity in J/(m³ K). The additional exchange coefficient is

`hr = f R Cw / 3,600,000` in W/(m² K).

With surface temperature Ts, lower-store temperature Tb, original boundary Ta,
incoming-water temperature Tw, capacities Cs/Cb, original exchange h, conductance g
and original absorbed input q:

```
Cs dTs/dt = q - h(Ts-Ta) - hr(Ts-Tw) - g(Ts-Tb)
Cb dTb/dt = g(Ts-Tb)
```

This is the same maintained `advanceHeatColumn` operator with combined exchange
`h + hr` and reservoir `(h Ta + hr Tw)/(h + hr)`. No new heat solver is introduced.
For the zero-exchange case, the original reservoir is retained. The original
analytic surface mean then separates signed original-reservoir and flowing-water energy:

```
Qboundary = h Δt (mean(Ts)-Ta)
Qwater = hr Δt (mean(Ts)-Tw)
Qinput - Qboundary - Qwater = Cs ΔTs + Cb ΔTb
```

Positive Qwater leaves the heat stores; negative Qwater enters from warmer rain.
Internal surface/lower transfer cancels in the combined energy account. Reported
residuals are numerical closure checks, not measurement error bounds. Rain depth
is separately retained from the same original pulse.

The timeline splits at every original exposure boundary and at the actual rain
end, including a nonaligned fractional minute. Nothing averages a wet and dry
interval into one boundary coefficient. Tables show exact boundary samples, not
continuous maxima or inferred observations. Underlying propagator limits remain,
including the bound on combined exchange. Active contact is refused if initial,
final or analytic interior stationary surface temperatures reach 0 or 100 °C:
liquid-only exchange cannot silently stand in for freezing or boiling.

## Sources and interaction

A current source-bound heat study is required. Changes to its retained site
context refuse the calculation. Each comparison retains the complete original
project, property/contact declarations and clock basis. Original rain and heat
sources can be inspected in the panel. Changing a declaration or the working
project retires its displayed result. An imported or authored investigation stays
separate from the active project.

Download contains original inputs with schema `experimental-earth-rain-sensible/1`,
not calculated response tables. Fresh reopen recomputes. A stale delayed file read
cannot overwrite a newer declaration. Reopen is limited to 5 MiB and valid UTF-8.

The current hydraulic forcing is the retained constant-intensity rain pulse.
This does not implement or claim the separate variable-storm ownership #7. Water
properties and contact fractions are supplied assumptions, not parameters inferred
from photographs or field readings. No field accuracy, safety, physical operation
or platform qualification is claimed.

## Executed falsifiable controls

Final receiving composed main `561c7df79825d5ccd895e162568978541b512f92` (tree `670d669562660c213b41d13132a09def7128c5b9`) with this candidate. Upstream dependencies were Git-blob verified by the integrator. Linux 6.18.55, Node 24.22.1 and sandboxed Chrome 156.0.8078.47 ran the native and full-app receiving. Original screenshots and browser/native receipts are in `docs/receipts/rain-sensible-4f4650/`.

`node tests/rain-sensible.test.mjs` runs six focused groups. A single-store closed
form independently checks the decoupled case. A separate fixed-step RK4 integrates
two temperatures and separate original-boundary/water energy flows: surface difference is about
3.6e−14 °C and water-account difference about 3.2e−8 J/m². Dry and zero-contact
responses reproduce the previous maintained operator exactly; splitting 3600 s
into 1234 + 2366 s preserves response and signed energy. Source mutation, forged
cached results, invalid assumptions and phase crossings are challenged directly.

An authored one-hour control with Cs=100000, Cb=200000 J/(m² K), h=10 and
g=5 W/(m² K), absorbed input 400 W/m², initial 50/40 °C and original reservoir 30 °C ends at
54.2497 °C without contact. Incoming 60 mm/h water at 10 °C gives 20.3034 °C;
independently changed 70 °C water gives 67.4384 °C and reverses the water-energy sign.
These are conditional computations, not measurements.

The maintained source example, changed to 30 mm/h rain ending at 17.5 min, retains
8.75 mm and exact boundaries 0/17.5/240/480 min. At rain end the existing surface
changes from 35.3308 to 25.7172 °C; at 480 min the difference is only −0.2122 °C.
This distinguishes the transient effect from the late result without fabricating
a measurement or claiming a physical intervention benefit.

Actual full-app receiving is in `tests/rain-sensible.browser.mjs`, using
PLAYWRIGHT_MODULE, BROWSER_EXECUTABLE_PATH and BROWSER_ARTIFACT_DIR overrides.
It exercises source example, cold/warm sign reversal, source-only download and
fresh reopen, invalid-input retirement, desktop/narrow layout and external-request
and page-error controls with sandboxed Chromium. Inputs are authored controls.
