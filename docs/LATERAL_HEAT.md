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

The output shows both cells at every exposure boundary, signed lateral transfer,
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

The existing `advanceSurfaceHeat` computes each independent forced step.
Symmetric splitting applies half of that forcing, an exact passive pair
exchange, then the remaining forcing half. For the isolated exchange,

    reducedCapacity = C1 C2 / (C1 + C2)
    Q = (T1 - T2) reducedCapacity (1 - exp(-G dt / reducedCapacity))
    T1_new = T1 - Q / C1
    T2_new = T2 + Q / C2

The implementation uses `expm1` and a symmetric ratio form of reduced capacity to preserve
small transfers. Every forcing boundary is reached exactly; no split straddles
a forcing change. The input step is a maximum. It is additionally limited so
that each external decay rate and the pair-exchange decay rate times the step
is at most 0.25. This prevents two oversized, saturated split steps from giving
misleadingly similar answers while missing the coupled response. The halved
comparison uses half that effective step. A preflight work limit refuses stiff,
long exposures requiring more than 200000 paired steps before any course runs.
Each complete interval is
split into equal substeps no larger than it. The reported course uses half the
effective maximum step, alongside a comparison to that effective step. Maximum
schedule-boundary temperature disagreement is numerical sensitivity, **not an
error bound or convergence certification**. Schedule boundaries are samples,
not a search for interior extrema. The isolated comparison uses the maintained
exact forced layer response with zero exchange.

Each cell's energy residual is input minus ambient exchange minus/plus lateral
transfer minus stored change. All energies are total joules for the actual
declared grid-cell area. They are not J/m². The neighbor is identical in both
plans to isolate this particular intervention comparison; a separate neighbor
intervention is outside this first model.

## Original input custody

The declaration retains the complete surface heat study and both original cell
contexts. A changed cell, metric size, source, layer or exposure invalidates
comparison. The download contains the original project, raw lateral declaration
and requested split step, without treating a derived temperature as evidence.
Reopening recomputes against that frozen original project and explicitly labels
it; it does not replace the working map. **Use current workspace** leaves that
frozen investigation and returns to the active place. The lateral investigation
is not included in the ordinary site export; use its dedicated input download.

## Qualification and limitations

`node --test tests/lateral-heat.test.mjs` covers an independent unequal-capacity
analytic closed-pair reference, passive equilibration, reverse transfer, zero
coupling parity with the existing heat consumer, local and total energy balances,
an unchanged neighbor's response, an independently implemented unsplit RK4
reference, refinement, area dependence, input custody and work limits.

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
SciPy installation. The native test includes the original temperatures and
transfer integrals and challenges both splitting resolutions against them.
Temperature discrepancies are below 0.001 °C for these four authored cases; this
is qualification of these controls, not a universal accuracy guarantee. The
large-area case also checks residuals relative to total energy, since a tiny
temperature rounding difference multiplied by a large heat capacity need not
produce a universally tiny absolute joule residual.
