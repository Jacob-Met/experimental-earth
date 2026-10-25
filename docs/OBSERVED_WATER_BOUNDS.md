# Original one-sided water quantities

The original water-account form keeps **Require complete numeric endpoint
readings** as its default. The explicit **Allow one-sided or unmeasured endpoint
bands** choice can retain a useful one-sided residual when a complete account
is unavailable. It never inserts measured zeroes or a maximum unknown depth.

An unmeasured nonnegative water depth contributes a lower storage bound of zero
and no finite upper bound. Missing initial storage can therefore leave the
residual's upper side unbounded; missing final storage can leave its lower side
unbounded. The remaining finite side may still establish a sign. Missing cells
at both endpoints ordinarily leave both directions unbounded, which is reported
as no finite constraint rather than a calculated water loss.

For the authored four-cell control in the original account guide, remove one
initial reading: the residual still has a lower bound of approximately 4.9 L,
with no finite upper bound. Alternatively remove one final reading and retain
50±1 L collection: the residual has an upper bound of −9 L and no finite lower
bound. These conditional conclusions do not diagnose a physical cause.

## Associate an existing original threshold record

The separate threshold notebook already retains inclusive **at least** and
**at most** observations. They are not silently used by the account. Select the
association checkbox and state why that record and the collection refer to the
same event, location and clock. The retained threshold context and observed
scenario must match the original project. Both event references and the
association declaration remain visible and survive source-only reopening.

Only exact start/end readings at each original grid cell are used. Original
sources, roles, indices and inclusive relations remain visible. The adapter
reuses the maintained effective bound: at-least subtracts supplied uncertainty
and clamps at zero; at-most adds supplied uncertainty. It does not turn an
inequality into a midpoint, fit a model, or use the solver's numerical
compatibility guard as measurement uncertainty.

Numeric and one-sided bands are intersected. A lower-only source remains
unbounded above. A missing final numeric reading, for example, can receive an
original at-most 3.2 mm bound without becoming a 3.2 mm point observation.
In the authored account this bounds the residual to approximately [5.8,21] L.
Paired at-least and at-most statements can supply both ends without inventing
numeric notebook entries. Every conflicting original constraint remains in the
ledger. Contradictions or positive numerical contact gaps withhold the whole
account; no source is selected as correct or discarded.

## Interpretation and transfer

The original cell-mean, area-wide rainfall, event association and other-flow
declarations remain necessary. Bounds consider all assignments consistent with
only those supplied constraints. They are not probabilities, measured accuracy
or independently verified acquisition. Correlations not supplied by this
interface can narrow the possibilities. Residuals can reflect infiltration,
evaporation, unrepresented flows or source errors; no cause is identified.

Partial accounts export as `experimental-earth-observed-water-account/2` with
explicit `coverageMode: partial-endpoint-bands`, original project, association
choices and declarations. Older readers refuse this format. The strict
complete mode continues to export the original v1 format. Reopening recomputes
all bounds; supplied cached results have no authority. In returned account
arrays a null endpoint explicitly denotes **no finite bound** on that side,
not zero, a missing calculation or a JSON-serialized numeric infinity.

## Verification

`node tests/observed-water-partial-account.test.mjs` checks complete-account
parity, source nonmutation, original threshold reuse, exact event/time matching,
both kinds of one-sided input, cross-modality contradiction/contact and strict
old-reader refusal. Independent finite completions cover unknown depths of
0, 100 and 10,000 mm and attain the finite endpoint while demonstrating that the
other endpoint must not be replaced by the notebook input limit. These are
authored computational controls; actual browser qualification is separate.
