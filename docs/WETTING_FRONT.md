# Investigate changing soil absorption

The **What changes as the soil wets?** panel compares finite, explicitly declared
soil explanations against the same site, rain and recorded observations. It adds
an event-scale Green–Ampt hypothesis to the maintained runoff calculation. The
ordinary site maps and constant-rate reference retain their existing behavior.

Choose the material and the scenario whose readings should be scored. Enter
2–9 distinct pairs of conductivity **K** (mm/hour) and capillary drive **A** (mm),
with a basis for those choices. A is wetting-front suction multiplied by initial
moisture deficit; the comparison cannot recover those two quantities separately.
A = 0 supplies a constant-rate control at the declared K. The starting choices
are illustrative assumptions, not recommended field parameters.

**Compare soil explanations** applies each same pair to matching material cells
in both the existing and proposed site. Every other surface and routing input
stays fixed. Each card shows calibration and held-aside agreement separately,
plus the proposed-minus-existing change in standing water and boundary outflow.
Select a card to inspect the chosen map cell's depth curves, exact modeled times,
whole-event water totals, original readings and signed residuals. Use the map to
select a different cell, then compare again. Changing the site or the draft
choices retires the old results.

Calibration root-mean-square error alone orders the candidates. Held-aside
values can challenge an explanation without changing its rank. Missing evidence
does not support a parameter; an absent source material cannot identify one.
Dry readings may agree with every explanation. A single surviving declared pair
does not establish uniqueness outside the tested set or physical accuracy.

## Mechanism and numerical treatment

This implementation uses the sharp-front capacity with surface ponding head
neglected:

\[
f(F)=K(1+A/F),\qquad
K\Delta t=d-A\log\left(1+\frac{d}{F_0+A}\right),
\]

where F is cumulative infiltrated depth and d is its ponded increment. The
integrated equation remains usable at the singular dry start F₀ = 0. K = 0
admits no infiltration. A = 0 reduces to the constant rate K.

The formulation and its integrated ponded equation follow the EPA
[SWMM Hydrology Reference Manual, section 4.4](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P100NYRA.TXT).
The [HEC-RAS Green–Ampt reference](https://www.hec.usace.army.mil/confluence/rasdocs/ras1dtechref/6.5/overview-of-optional-capabilities/modeling-precipitation-and-infiltration/green-ampt)
also describes the capacity and supply distinction. This code is an independent
implementation of that event hypothesis, not a port or qualification of SWMM or
HEC-RAS.

For constant rain R > K, the capacity equals rain at Fp = KA/(R−K). Before
ponding, only the available rain infiltrates. A previously ponded cell may empty
before Fp and later repond; checking its minimum hypothetical ponded depth
distinguishes that case. After depletion, mass balance determines when the
continuously supplied water reaches Fp. Using only the minimum of full-step
ponded capacity and total supply gives the wrong result for this transition.

The ponded root is bracketed and bisected. A cancellation-resistant series
evaluates small `x - log1p(x)` terms. The decreasing instantaneous capacity
provides a tighter upper bound when initial cumulative depth is large. The
independent tiny-increment reference exposed insufficient precision from using
only the much wider dry-start bracket; the tighter bound repaired that failure
without loosening the reference tolerance.

The maintained solver splits a local step at the end of the constant storm,
advances local infiltration through its rainy and dry portions, then passes the
accepted absorption through the existing water-budget and passive-tracer hooks.
Neighbor routing still occurs at the existing step boundaries. Local exactness
for a constant-rain segment is not convergence of the coupled spatial solver.
Tracers retain the existing complete-step mixing assumption. This change does
not estimate rainfall, terrain, outlet conditions or source authenticity.

The model assumes a homogeneous sharp wetting front within an event. It omits
ponding-head correction, layered soils, finite soil-column depth, redistribution,
evaporation and inter-event moisture recovery. Cumulative infiltration starts
at zero for each modeled event; A declares its initial soil condition. Compare
calculation intervals and independent observations before interpreting a result
as a real-site explanation. The result is not an engineering approval.

## Save and reopen

**Save investigation** downloads the complete source project, original notebook
and declared soil study as JSON. It contains no accepted computed verdict.
**Reopen an investigation** validates and recomputes those inputs in a separate
view without replacing the working site. Explicit saved-conclusion fields are
refused. A delayed file read cannot overwrite newer site or draft choices.
The file limit is 5 MiB; comparisons are bounded at one million estimated
cell-steps, including the unchanged reference pair. Oversized or invalid work
is refused before changing accepted project state.

The ordinary project export also retains `wettingFrontStudy` inputs. Source
descriptions remain authored declarations, rendered literally as text. A
consistent input file is not an authenticated measurement record.

## Verification

- `node --test tests/wetting-front.test.mjs`: independent 90-digit Decimal
  references, analytical ponding/depletion/reponding controls, 500 deterministic
  time-subdivision cases, dry/impermeable controls, partial storm steps, existing
  routing, local/whole water balance, passive tracing, held-aside independence,
  indistinguishable evidence, input replay and work admission.
- `python3 tests/reference/wetting_front_decimal.py` regenerates the numerical
  oracle without importing any product implementation.
- `CHROME_BIN=/opt/google/chrome/chrome node tests/wetting-front.browser.mjs`
  runs actual keyboard comparison, candidate inspection, save/reopen, literal
  source rendering, stale input/file refusal and narrow-screen receiving through
  the maintained same-browser Linux sandbox admission.
- `npm test` and `npm run browser-receive` exercise the maintained application.

Authored analytical observations establish computational controls only. No
field validation, measured soil identification, provider execution, deployment
or physical intervention is implied by these checks.
