# A declared surface-layer heat experiment

Experimental Earth can compare the time response of two explicitly declared,
uniform thermal layers at one retained site cell. This implements the heat
investigation direction in the product seed alongside the existing rain and
sun-obstruction work. It does not automatically turn a surface label, colour,
rainfall rate or ray-visibility result into a thermal material or heat input.

## Use the actual workbench

Open **How does a surface warm up and cool down?**, select a cell, and declare
each layer's absorbed fraction, heat capacity per square metre, linear exchange
coefficient and initial temperature. Give the basis or source of those values.
Supply a consecutive exposure CSV using the columns
`minutes,incident_w_m2,reservoir_c,source`. A row starts at the end of the previous
row. The two alternatives receive the same incident input and reservoir
temperature. Quoted commas, escaped quotes and multiline sources use the
existing maintained CSV record reader.

**Load fictional heating / cooling draft** provides an explicitly authored
experiment. It changes only the draft. **Save heat declaration** validates the
whole declaration and a supported trajectory before replacing the saved study.
**Compare saved layers** shows the two temperature curves, exact interval-boundary
extrema, and an interactive time inspection with input, exchange and stored
energy per square metre. Sources are rendered as literal text.

The example deliberately has a consequential tradeoff: its proposed layer
absorbs less input and has four times the heat capacity. It is cooler during
the heating interval but warmer during late cooling. Changing its capacity to
match the existing layer reverses that late-time comparison. These are model
controls with fictional inputs, not observations of a paving product.

Ordinary project export/reopen retains the inputs and their original place
context. Predictions are computed again. Changes to that selected cell, grid
scale/dimensions or site source retire the comparison; saving cannot silently
reattach the old declaration. Export the prior project before clearing and
declaring another place. Reimporting the same saved project explicitly clears
an unsaved draft. A draft change cancels an in-flight comparison.

## Equation, units and exact propagation

The sole modeled state is the layer temperature `T` in °C. Temperature
differences have the same magnitude in kelvin. For each supplied constant
interval:

`C_A dT/dt = q - h (T - T_r)`, with `q = alpha I`.

`C_A` is the constant areal heat capacity in J/(m²·K), `h` is a declared linear
exchange conductance in W/(m²·K), `I` is the incident input in W/m², `alpha` is
its absorbed fraction, `T_r` is the supplied reservoir temperature, and `t` is
seconds. No cell-area multiplication is hidden: results remain per square metre.

For duration `dt`, let `x=h dt/C_A` and `phi=(1-exp(-x))/x`, with `phi(0)=1`.
The exact interval update is:

`T_end = T_start + [q - h(T_start-T_r)] dt/C_A * phi`.

`expm1` preserves small exponential differences. A small-x series evaluates
`1-phi` without subtracting nearly equal numbers. The zero-exchange limit is
linear accumulation of absorbed energy. There is no numerical ODE time step
in the production calculation; displayed samples are evaluated from the saved
interval starts. Interval endpoints establish extrema because a solution is
monotone within each constant interval. Display samples are not crossing-time
or physical-resolution claims.

The independently evaluated analytic exchange integral is:

`E_out = h(T_start-T_r) dt phi + q dt (1-phi)`.

Positive exchange leaves the layer; a warmer reservoir can make it negative.
Input energy is `q dt`, and stored change is `C_A (T_end-T_start)`. Their residual
checks arithmetic bookkeeping. It is not independent physical conservation
evidence or a measurement of this place. The verification suite separately
integrates the temperature and flux equations with an RK4 oracle.

## Applicability and omitted processes

This is a homogeneous layer with constant properties and a single prescribed
thermal reservoir for linear exchange. It omits nonlinear thermal radiation,
evaporation, internal temperature gradients, spatial conduction, moisture
coupling, changing coefficients and the reservoir's own heat capacity. It
does not predict comfort, contact injury, ambient air temperature, a full
outdoor surface energy balance, or the effect of a physical intervention.
No heat-property uncertainty or physical calibration is claimed in this version.

The [COMSOL thermal-capacitance theory](https://doc.comsol.com/6.3/doc/com.comsol.help.heat/heat_ug_theory.07.045.html)
describes the uniform-temperature and constant-property conditions of a lumped
thermal model. The [EnergyPlus engineering reference](https://energyplus.net/assets/nrel_custom/pdfs/pdfs_v24.2.0/EngineeringReference.pdf)
distinguishes absorbed shortwave input, longwave exchange, convection and
conduction in an outdoor surface balance. Those additional mechanisms are
not supplied by this simpler declared linear model.

## Reuse and implementation choice

Before implementation, the Engine #405 radiation source and its maintained
convection companion were inspected at engine source
`282bede7f5aafea4e32a37331715177e182ed292`:

- `tools/science/mesh_radiative_cooling_ad4cad229e2e/cooling.py`
- `tools/science/mesh-radiative-convection-sixth-c8c1617afcb0/convection.py`

Those consumers use Python/SciPy for nonlinear unforced radiation/convection
against a common fixed ambient, with pinned mesh-area contracts. They do not
provide the browser's forced, piecewise-reservoir workload. They and their
owners remain unchanged. This exact linear specialization stays with its real
Earth consumer and adopts explicit capacity/area and signed-energy conventions.
The native test independently checks the pure-convection reduction after area
normalization. No duplicate generic ODE solver, mesh subsystem or language
migration is introduced. Source parsing and project portability directly reuse
the existing Earth components.

## Software bounds and reproducible checks

The study accepts 1–24 intervals, each 0.1–720 minutes, totaling at most 1440
minutes; input 0–2000 W/m²; absorption 0–1; capacity 1000–10000000 J/(m²·K);
exchange 0–1000 W/(m²·K); initial/reservoir −100–200 °C. Computed temperatures
outside −100–500 °C are refused. These are bounded software inputs, not validated
material ranges. Sources are required declarations, not acquisition authentication.

Run `npm test` for native regression and
`CHROME_BIN=/opt/google/chrome/chrome node tests/surface-heat.browser.mjs` for the
actual standalone browser course. The maintained browser owner and its
same-browser Linux sandbox admission are reused unchanged. The course covers
the changed material conclusion, invalid-input transaction, actual download and
native-file reopen, source literal rendering, changed-place refusal, same-project
reimport, stale asynchronous results, real pointer interaction and 390px layout.

During development the first browser course found that reimporting identical
project bytes left an unsaved draft active; refresh now distinguishes object
replacement from unchanged state. The first pointer/screenshot course also
sampled coordinates before the page's smooth scroll completed; the receiver
now requests an instant scroll before reading actual control coordinates.
Neither failed attempt is counted as successful receiving.
