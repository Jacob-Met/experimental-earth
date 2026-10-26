# Heat between neighboring places

The maintained **Does a surface change warm its neighbor?** investigation adds a
declared lateral connection to the saved surface heat experiment. It compares
the existing and proposed selected layer against the same unchanged neighboring
layer. Both cells receive the saved piecewise incident input and thermal
reservoir. This makes a spatial consequence inspectable without inferring
thermal properties from a surface label.

Save a surface heat declaration first. Select an edge-adjacent cell and supply
its absorption fraction, area-specific heat capacity, linear ambient exchange,
initial temperature and source in the labeled numeric fields. The connection
has its own numeric field and source note. Supply the **total edge conductance in W/K**
and its source separately. The fictional draft is explicitly an authored
example. A ground-cell edge does not by itself establish a measured thermal
connection or its magnitude.

The output shows both cells at every exposure boundary and interior stationary candidate, signed lateral transfer,
the same models with zero lateral conductance, and proposal-minus-existing final
temperatures. Expand the cell-energy accounting to inspect incoming energy,
signed exchange to the ambient reservoir, stored change and each residual.
Positive lateral transfer means heat traveled from the selected cell to its
neighbor; negative means the reverse. A reflective intervention can change its
unchanged neighbor's temperature when the declared connection is nonzero.

## Model and numerical method

Each cell has equal area A = cellSizeM², total capacity C_i = A c_i, incident
absorption A alpha_i I and ambient exchange A h_i (T_i - T_a). The supplied
edge conductance G produces internal transfer G(T_1 - T_2). That transfer leaves
one cell and enters the other, so it cancels the total energy balance.

The maintained heat-column spectral propagator integrates the coupled linear
system analytically over each constant exposure interval. Its new
`advanceCoupledHeatLayers` entry accepts separate absorbed inputs and ambient
exchange for both stores; it does not replace the neighbor's absorption with an
invented reservoir temperature. The existing heat-column, bottom-exchange and
loss wrappers retain their original arguments, output fields and admission
limits. Total edge conductance is divided by the declared cell area before
entering the area-specific kernel.

The maintained investigation uses `compareLateralHeatExact`. It reaches each
exposure boundary directly, with no time-step tuning or split-step work cap.
It also evaluates every interior stationary candidate from both temperature
trajectories. The displayed neighbor maximum considers those candidates and
all boundaries; an asterisk identifies interior candidates in the table. Both
cells are checked against the model's admitted temperature range at these
points. Exact here describes the constant-coefficient analytic model solution:
floating-point evaluation, eigenvalue separation and stationary-time calculations
are not certified error bounds. A constant trajectory needs no extra interior
sample to establish its maximum and minimum.

The earlier `compareLateralHeat` split implementation remains available as a
numerical baseline. It retains its rate-aware step restriction, refinement
comparison and 200000 paired-step preflight. It is not a fallback for the
maintained analytic investigation. The zero-conductance comparison uses the
same two-store analytic model with the internal connection removed.

Each cell's energy residual is input minus ambient exchange minus/plus lateral
transfer minus stored change. All energies are total joules for the actual
declared grid-cell area. They are not J/m². The neighbor is identical in both
plans to isolate this particular intervention comparison; a separate neighbor
intervention is outside this first model.

## Original input custody

The declaration retains the complete surface heat study and both original cell
contexts. A changed cell, metric size, source, layer or exposure invalidates
comparison. The download contains the original project, raw lateral declaration
and the analytic method identifier, without treating a derived temperature as evidence.
Reopening recomputes against that frozen original project and explicitly labels
it; it does not replace the working map. **Use current workspace** leaves that
frozen investigation and returns to the active place. The lateral investigation
is not included in the ordinary site export; use its dedicated input download.

New downloads use `experimental-earth-lateral-bundle/2` and record method
`two-forced-stores-spectral/1`. Version 1 original-input files remain readable:
their physical declarations are explicitly recomputed with the analytic method,
and their original split-step setting is retained in the next download as
`originalSplitMaxStepSeconds`. This does not claim byte-identical reproduction
of the old numerical results. Unknown method identifiers and malformed legacy
step settings refuse before replacing the current investigation.

## Qualification and limitations

`node --test tests/lateral-heat.test.mjs` covers an independent unequal-capacity
analytic closed-pair reference, passive equilibration, reverse transfer, zero
coupling parity with the existing heat consumer, local and total energy balances,
an unchanged neighbor's response, an independently implemented unsplit RK4
reference, refinement, area dependence, input custody and work limits.

`node --test tests/lateral-heat-exact.test.mjs` additionally checks all four
independent matrix-exponential references and energy integrals, old-wrapper
specialization, independent zero-coupling forced responses, a two-illuminated
closed pair, a stiff hour previously refused by the split work cap, preserved
admission/source checks, and semigroup/store-swap identities. The stiff-hour
control retains a short interior neighbor peak even though its final temperature
is below its initial temperature. The browser receiving course opens original
files through the native file input, exports the retained declarations, exercises
keyboard submission and narrow-screen table navigation, and receives that
stiff-hour experiment through the maintained interface.

These are authored numerical experiments. They do not establish environmental
accuracy, actual conductivity, observed spatial temperatures, comfort or safety.
The model omits within-cell gradients, other neighbors, nonlinear radiation,
evaporation and changing properties. Common incident forcing can be unsuitable
for differently shaded cells; supply a different model before making that claim.

### Independent two-forcing reference

The four cases in [`tests/fixtures/lateral-heat-matrix.json`](../tests/fixtures/lateral-heat-matrix.json)
use an independent SciPy matrix exponential of the unsplit equations, augmented
with signed internal-transfer and ambient-energy integrals. They vary cell area
between cases from 0.0625 to 10000 m², capacity and exchange between cells, initial
temperatures and both cells' absorbed input. This model still requires equal
areas within each pair. The fixtures include a stiff unequal-capacity pair and
a weak reverse-flow connection.

Regenerate the reference with Python, NumPy and SciPy (SciPy 1.17.0 used for the
retained fixture):

```sh
python3 tests/reference/lateral_heat_matrix.py
```

The generator prints JSON and does not overwrite the retained oracle. It is an
optional independent research check; ordinary Node tests need no Python or
SciPy installation. The split baseline tests challenge both splitting resolutions against the
retained oracle. The analytic tests compare temperatures, signed transfer and
both ambient-energy integrals directly. The large-area case checks residuals
relative to total energy, since a tiny temperature rounding difference multiplied
by a large heat capacity need not produce a universally tiny absolute joule
residual. These controls qualify the implementation for their declared cases;
they do not establish a universal floating-point bound or environmental accuracy.
