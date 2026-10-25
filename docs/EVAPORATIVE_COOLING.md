# Retained rain and conditional evaporative cooling

## Use the maintained workbench

**Can retained rain sustain a cooler surface?** connects the original modeled
rain infiltration, a declared rooted-water store and the saved two-store heat
experiment. Follow available water, supplied transpiration, surface and lower
temperatures, and the distinct water and energy accounts.

Open the local workbench using the README launch instructions. The panel is
near the root-zone investigation, before the notebook.

1. Save a source-bound surface heat exposure and lower heat store using the
   existing heat investigations. Select **Use saved heat investigation**.
2. Enter sourced rooted-store properties for each place: field capacity,
   wilting point, rooting depth, initial available water and depletion fraction.
3. Explain why each cell's modeled infiltration supplies this effective thermal
   surface. Declare the fraction of latent heat taken from it; the remaining
   fraction comes from unresolved surroundings.
4. Enter a constant latent heat with its source and approximation, and one
   potential plant-transpiration demand for each original heat interval. Both
   places receive the same demand; soil evaporation is excluded.
5. Compare, inspect any time, and save the original investigation. Reopening
   recomputes from its complete inputs without replacing the working site.

**Explore fictional cooling example** opens a separate authored courtyard and
thermal declaration. It preserves the active project and demonstrates a
mechanism, not observed weather, soil or vegetation.

## Retained mechanisms and physical association

The maintained rain solver and local water budget supply each selected cell's
whole-event modeled infiltration. The rooted store begins with declared
available water, admits recharge up to its field-capacity inventory, and records
the remainder as immediate excess drainage. This retains the pulse-at-event-end
assumption. The newer during-event root-zone investigation remains separate;
its timing is not silently substituted here.

`advanceRootZoneDry` supplies modeled transpiration. Its latent-energy
consequence enters the maintained capacity-scaled two-store heat propagator.
The model still has one uniform surface store, one uniform lower store, linear
ambient exchange, internal conductance and an insulated bottom. No parallel
rainfall or thermal solver was introduced.

The association is explicit because transpiring plants and a measured ground
surface are not interchangeable. Attribute the effective thermal surface and
the fraction of latent energy drawn from it. Changing that fraction changes
temperature while leaving prescribed demand and water consumption unchanged.
This is a model assumption, not an inferred or fitted physical relationship.

## Equations and sources

Let `S` be available rooted water in mm, `Cw` its capacity, `p` the depletion
fraction and `W = (1 − p) Cw` the stress threshold. Potential demand `D` is
converted from mm/day to mm/second. Above the threshold, supplied demand is
`D`; below it, supplied demand is `D S/W`. The `W = 0` limit supplies full demand
until empty and then none. A constant-demand interval therefore has a linear
full-demand phase followed by exponential dry-down. The calculation splits at
the constitutive switch and reuses the maintained water law.

Under the retained unit conversion, 1 mm over 1 m² corresponds to 1 kg of water.
For constant latent heat `L` in J/kg and declared surface fraction `f`:

`qL = f L D min(1, S/W)`

with the explicit empty/full-demand limit above. The heat equations are:

`Cs dTs/dt = a I − h (Ts − Ta) − g (Ts − Tl) − qL`

`Cl dTl/dt = g (Ts − Tl)`

Here `I` is incident input, `a` absorptivity, `h` ambient exchange and `g`
internal conductance. Original capacities, temperatures, irradiance, ambient
reservoir and attributed intervals remain in the source file.

The root-zone stress coefficient is based on
[FAO56, chapter 8](https://www.fao.org/4/x0490e/x0490e0e.htm).
The continuous dry-down is the existing project's adaptation, not FAO's complete
daily crop/weather model. The latent-energy conversion and the distinction
between evaporation and transpiration are described in
[FAO56, chapter 1](https://www.fao.org/4/x0490e/x0490e04.htm).
The example holds `L = 2.45 MJ/kg` constant, approximately the value there at
20 °C. Neither temperature-dependent latent heat nor potential transpiration
is inferred from saved weather.

### Analytic heat response

During stress, `qL` declines exponentially. The additional
`advanceHeatColumnWithLoss` entry point receives a nonnegative constant or
exponentially declining surface loss. Existing callers retain the original
`advanceHeatColumn` entry point and its zero-loss behavior.

The response reuses the existing capacity-scaled symmetric spectrum. For heat
mode rate `k`, loss decay rate `r` and elapsed seconds `t`, the convolution is:

`G(k,r,t) = (exp(−r t) − exp(−k t))/(k − r)`

Stable divided expressions include zero-rate and equal-rate limits. The
response is independently integrated for ambient and internal energy transfer;
the declining loss is not averaged over a chosen simulation step. Partition
controls preserve results within floating-point tolerance.

Plots join one-minute samples and original forcing boundaries. Inspection
evaluates the analytic course at the exact selected time. Interior extrema of
the additional exponential mode are not searched, so plotted values are not
claimed as exact continuous maxima or minima.

### Distinct accounts

The result retains initial water, original infiltration, retained recharge,
drainage, remaining water, supplied demand and unmet demand. It separately
retains gross absorbed incident energy, latent loss from the surface, latent
supply from unresolved surroundings, signed ambient exchange, internal transfer
and the change in both heat stores.

Total latent energy is `L × supplied water`; only its declared fraction enters
the thermal account. Water, latent-conversion and heat residuals are calculated
through separate paths. A small residual is not field validation. Incident
energy and net stored heat are not relabeled as evaporated water.

## Source custody and bounds

The `experimental-earth-cooling-investigation/1` file contains only its schema,
`project` and versioned `study`: complete original project, heat column, rooted
stores, attributed demands, latent-heat source and the explicit association.
The file is limited to 5 MiB. Unknown top-level result fields are refused.
Reopening validates and recomputes while preserving the active site.

The study must match the retained source cell, heat exposure and lower layers.
Current-site edits retire a current-site comparison. A separate reopened
investigation remains tied to its original source. Newer drafts invalidate
pending file reads, and source strings render as literal text.

Existing root, heat, rainfall-budget and duration bounds remain. Potential
transpiration is 0–30 mm/day, surface fractions are 0–1, and constant latent heat
is 0–3 MJ/kg. Zero values are negative controls, not assertions about physical
latent heat. The kernel admits 0–5000 W/m² initial loss and bounded nonnegative
decay. Existing supported temperature bounds remain enforced.

## Example and verification

In the authored example, existing/proposed infiltration is about 4 / 73.7634 mm.
Both stores hold at most 5 mm, so most of the proposed infiltration becomes
excess drainage. Over eight hours, existing/proposed transpiration is about
2.89636 / 3.45975 mm and final surface temperature 30.0551 / 28.9747 °C under
the authored shared 0.6 surface fraction. These are conditional computations on
invented inputs, not measured intervention benefits.

```sh
npm test
python3 tests/cooling-matrix-oracle.py
CHROME_BIN=/opt/google/chrome/chrome node tests/evaporative-cooling.receiving.mjs
```

The optional independent oracle requires NumPy/SciPy; the browser runtime stays
dependency-free. Its augmented matrix exponential covers 108 cases, including
disparate capacities, zero coupling/exchange, equal rates and short intervals.
Maximum observed disagreement was approximately `5.1e−13 °C` in temperature
and `4.3e−7 J/m²` in integrated energy, describing calculation agreement only.

The composed native suite passed 690 tests on `511f1301` plus this change.
The maintained Linux sandboxed browser owner received the actual comparison,
arbitrary-time/keyboard inspection, zero-coupling control, real download,
fresh-profile actual-file reopening, literal sources, delayed-read cancellation
and 390-pixel layout. Visual review found small axis labels and overlong tiny
residuals; responsive chart coordinates and scientific formatting corrected
them, and the 13-group course passed again. Exact evidence accompanies the PR.

## Physical limits

Demand is supplied independently of temperature, humidity and stomatal or
aerodynamic resistance. Soil evaporation, further rain/irrigation during the
heat exposure, root growth, capillary rise, spatial heat exchange, nonlinear
longwave radiation, human comfort and crop suitability are omitted. Recharge
association, effective thermal stores and latent fraction need independent
qualification for a real place. No field validation, physical intervention,
Nebius execution or deployment is claimed.
