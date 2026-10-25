# Rooted soil water after a modeled rain event

The **How long does water remain available to roots?** panel connects the existing
paired-site infiltration account to a declared rooted-soil store. Select one
original cell, attribute the infiltration-to-root association, supply both
soil/root declarations and a common piecewise plant-transpiration demand, then
compare. The fictional draft is explicitly requested; no material property is
inferred from the site's surface label.

The panel preserves the source site. **Save original investigation** exports
the full original project and declarations only. Reopening recomputes that file's
site independently of the currently edited workspace. **Use current site**
switches back explicitly. Changed source or draft inputs invalidate results;
failed imports preserve a valid accepted comparison; delayed file reads cannot
overwrite a newer draft.

## What is computed

For each source cell, the unchanged maintained `compareLocalWaterBudget`
consumer supplies `absorbedLiters`. Dividing by the original square cell area
gives millimetres of modeled infiltration. This uses the same default constant
surface capacities as the paired site maps. A separately retained infiltration
or wetting-front hypothesis is not implicitly adopted.

The complete modeled event is collapsed into **one recharge pulse** at day zero.
The entered available water is the quantity before that pulse. There is no
transpiration during the event in this coupling. Water above the declared
capacity drains immediately; it is not stored and cannot meet later demand.
This one-way coupling leaves the surface model unchanged, so rooted storage
does not feed back into surface infiltration or ponding.

Let field-capacity and wilting-point water fractions be `thetaFC` and
`thetaWP`, rooting depth be `Z` metres, and available water above wilting point
be `S` millimetres. The capacity and demand-reduction threshold are:

- `C = 1000 * (thetaFC - thetaWP) * Z`;
- `T = (1 - p) * C`, where `p` is the declared fraction depleted before
  transpiration begins to be limited;
- `Ks(S) = min(1, S / T)` for positive `T`.

[FAO Irrigation and Drainage Paper 56, chapter 8](https://www.fao.org/4/X0490E/x0490e0e.htm)
defines total/readily available water and the stress coefficient (equations
82–84). Its stress coefficient acts on plant transpiration. Soil evaporation
is a separate process and is excluded here.

This implementation is a **continuous dry-down adaptation**, not an
implementation of the complete FAO daily crop/weather model. Within each
constant-demand dry interval it solves `dS/dt = -demand * Ks(S)` analytically.
Above `T`, storage falls linearly. Once it reaches `T`, storage decays
exponentially. A store already below `T` starts in the exponential regime.
At `p=0`, the store follows the exponential regime from full capacity.
At `p=1`, it supplies the full demand until empty and then supplies none.
Zero-demand periods retain storage and do not count as periods of unmet demand.

The inspector evaluates the same exact piecewise trajectory at its selected
day. The line chart samples it for display and does not supply the numerical
answer. Dividing a constant-demand interval into smaller intervals preserves
the response to floating-point precision. A few arithmetic ulps are admitted
only when a decimal initial-water declaration lies at its computed capacity
boundary; the admitted working value is capped to that computed capacity.

Every comparison retains:

- original cell, surface/source declaration, model weather and infiltration
  budget in litres;
- declared capacity, initial water, modeled recharge, retained recharge and
  immediate excess drainage;
- supplied transpiration, unmet demand, remaining available water, the first
  demand-limited instant and total time with reduced supply;
- each complete dry interval and the water-account residual.

The account is `initial + recharge = drainage + supplied + remaining`.
Unmet demand is a comparison quantity, not water removed from the store.

## Limits and interpretation

The model omits later rain/irrigation, soil evaporation, capillary rise, lateral
soil flow, delayed drainage, salinity, changing root depth and plant adaptation.
No actual crop or soil is identified, no original sensor is calibrated, and no
irrigation or land intervention is authorized or recommended by this result.
The same nominal store can be associated with a paved source cell only as an
explicit user-supplied hypothesis; the app never infers that roots occupy it.

Capacity is limited to declared water fractions in [0,1], depths 0.001–10 m and
available water within capacity; `p` may span [0,1]. One to 60 attributed
intervals may cover at most 366 days, with plant-transpiration demand from
0 to 30 mm/day. These are computational admission limits, not a physical
validity envelope. The source calculation retains the existing
500,000-cell-step paired-budget limit. Original-input JSON has a 5 MiB limit.

## Executed verification

Source base: `51343fe0ff13d5dd5e73670b609c1ce4d9388e67`.
The numerical core has 19 focused native groups, including independent
closed-form wet/stressed controls, all endpoint cases, 500 changed-input states,
split-interval equivalence, source-budget composition, unchanged source
parity, input-only replay and whole-course refusal.

On the initial composed candidate, `npm test` passed 594/594 groups. The real
Chrome 156 course `node tests/root-zone.receiving.mjs` passed 12 consumer groups
under the maintained sandbox admission, including source-only download,
recomputed reopening while preserving the current workspace, failed import
retention, delayed-read invalidation, literal source text, keyboard inspection,
and 390 px layout with no document overflow. Exact integrated-source results
and independent review are recorded on issue #171 and its PR.

The authored D4 example gives original/proposed recharge of approximately
4.000/73.763 mm and, after the declared 14 dry days, available water of
0.851/29.180 mm. Both begin with 10 mm; rooted capacities are 45/108 mm.
These are repeatable outputs of the declared model, not observed environmental
benefits. The two changes in source infiltration and rooted capacity are
combined in this first comparison; a separate controlled decomposition is
needed to attribute their contributions.


## Separate recharge and rooted-store changes

The comparison also evaluates four conditional combinations using the same two original event budgets and the same dry schedule. It never runs a new hypothetical site map:

| Case | Original modeled recharge | Complete rooted-store declaration |
| --- | --- | --- |
| Existing | Existing cell | Existing store |
| Recharge change alone | Proposed cell | Existing store |
| Rooted-store change alone | Existing cell | Proposed store |
| Both changes | Proposed cell | Proposed store |

A rooted-store change carries its field-capacity/wilting fractions, root depth, initial available water, depletion fraction and attributed source together. Calling this a capacity-only effect would be incorrect unless the other declared values were held fixed. Crossed cases are numerical comparisons; the underlying landscape may couple infiltration and root-zone properties, so independently crossing them need not describe a realizable physical intervention.

For any displayed quantity q, the isolated recharge change is q(recharge alone) − q(existing), the isolated store change is q(store alone) − q(existing), and the combined change is q(both) − q(existing). Interaction is the combined change minus the two isolated changes. It can be positive or negative and is reported in the original units. It is not a fitted causal contribution, allocation of benefit, probability or proof that either change alone is preferable.

The authored example at D4 ends with 0.851340877, 3.719224985, 4.359645135 and 29.180238125 mm available in the four cases, respectively. The resulting interaction is 21.952708882 mm. Applying the proposed recharge to the existing 45 mm-capacity store drains 38.763413481 mm immediately. Applying the existing recharge to the proposed 108 mm-capacity store supplies less transpiration than the existing store: the unchanged 10 mm initial water occupies a smaller fraction of capacity, and the declared demand-reduction threshold is higher. The combined result therefore cannot be inferred by adding the isolated results. These are authored model controls, not measured field outcomes.

The matrix supports available water, supplied transpiration, unmet demand, immediate drainage and demand-limited days. Select any case to inspect its complete original water account and rooted-store source. The existing day controls evaluate all four exact histories at the selected day; plotted interpolation is not used. At every day, initial water + recharge = immediate drainage + supplied transpiration + remaining available water, apart from floating-point roundoff. The corresponding interactions in drainage, supplied transpiration and remaining water sum to zero because initial-water and recharge changes enter separately.

The investigation file remains the same input-only format. Reopening recomputes both original infiltration budgets and all four dry histories; derived cases and interactions are not accepted from a file. Changing an input invalidates the entire comparison.
