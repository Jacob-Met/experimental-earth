# Decide whether a second offered reading is still needed

An explicitly obtainable pair of readings may settle a proposal target even when neither reading alone always does. The first reading can sometimes leave only explanations with the same target label, making the second unnecessary for this particular finite-family question. This headless forecast describes that conditional stopping rule while preserving all original explanations and acquisition declarations.

It builds on [acquisition collections](MECHANISM_ACQUISITION_COLLECTIONS.md). It is a bounded application of existing finite-alternative band reasoning, not a new general adaptive-design method, probability model or instrument controller. It neither observes the first value nor performs an acquisition.

## Run with four original files

```sh
node plan-mechanism-acquisition.mjs examples/mechanism-collection-original.json examples/mechanism-collection-menu.json examples/mechanism-collection-choices.json examples/mechanism-conditional-sequences.json
```

The existing two- and three-input commands retain their successful output formats and bytes. Four-input mode adds `inputs.conditionalSequences` with the fourth file's exact SHA256 and byte length to the existing CLI envelope. Its `report` is the conditional report. The sequence declaration is limited to128KiB and uses the maintained regular UTF-8 file admission and final reread rules. One selected planner is invoked; complete serialization precedes stdout. Refusals have empty stdout.

The nested `collectionReport` is the complete authoritative collection report computed once from original inputs. No additional model replay is needed for the conditional geometry. Calibration-compatible rows, original order, target labels, numerical guards and held-aside contradiction labels remain intact. A contradicted explanation is not silently removed to make a policy look complete.

## Offer a feasible order, not just a pair

The declaration has exactly `schema`, `eventRef` and `sequences`. The schema is `experimental-earth-mechanism-acquisition-sequences/1`, and the event reference must match the acquisition menu. Offer one to32 ordered sequences. Each has exactly:

| Field | Meaning |
|---|---|
| `id` | Unique sequence identifier, distinct from all option and collection IDs |
| `collectionId` | An explicitly offered original collection |
| `firstOptionId`, `secondOptionId` | Its two distinct member IDs, in the proposed order |
| `minimumDecisionMinutes` | Finite nonnegative response allowance, at most1,000,000 minutes |
| `responseBasis` | Why that allowance supports reading, interpretation and a decision |
| `conditionalAvailabilityBasis` | Why the second reading remains obtainable after that decision |

Identifiers and declarations are nonempty and bounded to600 characters. Several declarations may use the same ordered pair with different response arrangements; each is retained and reserved. Do not supply an observed first value or a cached result.

Both members must be prospective. The entire second measurement must start strictly after the first measurement ends, and no earlier than the first reading's declared **availability time plus the response allowance**. Availability is not interchangeable with a measurement timestamp. Exclusion of a member or its collection excludes the complete sequence. Infeasible timing remains an explicit exclusion; it is not silently reduced to a singleton.

The example names `gauge-then-optional-depth`, using collection `rain-then-depth`: first `rain10to30`, then `depth60`. The gauge is available at minute30. A five-minute response allowance gives a minute35 decision-ready time, preceding the depth at minute60. A30-minute allowance reaches minute60 exactly and satisfies the response-time inequality; the second support must still start strictly after the first ends. Zero delay does not permit coincident measurement supports.

These are declared arrangements. The software does not verify travel, staffing, equipment readiness, access, clock synchronization or the ability to cancel an unnecessary measurement. A process requiring depth setup before the first result is known would need a different, truthful availability declaration.

## Read the exact first-value regions

The planner partitions the whole nonnegative first-readout domain at every distinct closed-band endpoint and at zero. It retains each endpoint as a separate `point`, plus the intervening `open-interval` regions. Point bounds are equal and both inclusive; finite open intervals have both endpoints exclusive. The final open interval has `upperMm: null`, meaning unbounded above, not zero or missing data.

The representation preserves symbolic real open intervals even between adjacent binary64 endpoints. It does not invent a midpoint witness, merge nearby endpoints with an epsilon, or round an observed value into a neighboring region. At an endpoint, compatibility uses the original closed-band inequalities. Within an open cell, compatible bands cover that entire cell. `compatibleCandidateIndices` always refers to the unchanged original row order.

Each region has one of four actions:

- `outside-family`: no explanation has a compatible first band. There is no target verdict; investigate the family, association and error assumptions.
- `stop-meet`: a nonempty compatible subset has only meeting target labels.
- `stop-miss`: a nonempty compatible subset has only missing target labels.
- `take-second`: both target labels remain, so examine the offered second readout.

Only `take-second` regions carry `secondSeparation`. Its separated and unresolved indices refer to the original global `crossTargetPairs`; it asks whether the second bands separate every opposite-target pair still compatible with the first region. The stopping criterion is Boolean target agreement, not identification of a unique parameter or explanation. Several physically different explanations may remain at a valid stop.

## Authored example and executed qualification

The existing three source files remain unchanged. They describe a fictional flat16m² site, a half-turf/half-garden proposal, offered rainfall and soil/receiver/front alternatives, and an absolute proposal-storage target of at most200L. The broad original0–10 minute gauge and minute0 depth retain20 calibration-compatible rows: six meet and fourteen miss. Planning is at minute10, with a minute60 deadline. The future gauge10–30 and cell0 depth60 each have planned ±1mm uncertainty, with separately reported numerical guards.

The documented four-file CLI command was executed on the complete authored originals and returned exactly ten point/open regions:

| Region group | Original compatible indices | Target labels | Action |
|---|---|---|---|
| Low guarded gauge band: lower endpoint, interior, upper endpoint | 0–8 and18 | 6 meet / 4 miss | Take depth; all24 remaining opposite-target pairs are separated |
| High guarded gauge band: lower endpoint, interior, upper endpoint | 9–17 and19 | 0 meet / 10 miss | Stop after gauge |
| Four remaining regions, including point0 and the unbounded tail | None | No target verdict | Outside family |

There are six consistent regions: three stop and three continue. All continuing regions have complete second-readout separation, so this finite policy is decision-complete with maximum readout count2. The result is conditional on the model, offered family, transfer assumptions, declared bounds and availability.

All 22 scoped tests passed, with no failures or skipped tests. The documented four-file command exited successfully with empty stderr, retained all 20 original rows and all four exact input hashes and byte lengths, and returned the ten regions summarized above. Each of the three continuing regions retained all 24 remaining opposite-target pairs with complete second-readout separation. Source, input and runtime endguards passed.

The existing two-input 90-minute example and three-input collection example also exited successfully with empty stderr and produced stdout byte-identical to their previously received outputs. These are scoped finite authored tests and actual headless CLI receiving, not a full-repository or browser qualification. No field reading was acquired, and the example does not establish physical benefit, expected cost or actual time saved. Actual late receipt or uncertainty wider than the planned bound can still invalidate use of the policy.

## Completeness is not expected savings

`summary` reports consistent, stopping, continuing and outside-family region counts, `decisionComplete` and `maximumReadoutCount`. Completeness requires every nonempty region either to stop unanimously or to have every remaining opposite-target pair separated by the second readout. Maximum count is1 if every nonempty region stops, otherwise2; it is not an expected number of measurements.

Region counts are not probabilities. Three stopping regions out of six consistent regions do not imply a50% chance of stopping, and widths of regions do not supply probabilities either. No expected cost, probability-weighted saving or global optimality follows. Each explicitly offered sequence remains in input order. Excluded and not-needed sequences are not successful geometry. Empty or unanimous original target families remain not-needed; the top-level status preserves an evidence-challenged family rather than presenting conditional geometry as empirical support.

## Actual readings must satisfy the policy's premises

Both planned deterministic error bounds must hold simultaneously for the joint reasoning to apply. Statistical independence is neither required nor inferred. Shared systematic bias can violate the declarations. A first reading outside all bands challenges the finite family; it does not justify choosing an intervention by extrapolating the stopping rule.

Actual uncertainty wider than the planned bound invalidates direct use of this precomputed policy: more first-compatible explanations may remain, or second bands may no longer separate them. Likewise, a late actual receipt can invalidate continuation timing. Do not substitute planned precision for actual uncertainty or a forecast availability time for the actual receipt time.

Use the [selected acquisition receiver](MECHANISM_ACQUISITION_RECEIVE.md) to retain subsequent actual readings as challenge evidence with exact source and selected-coordinate identities. Its single-choice form can receive the first selected option alone; its collection form requires both selected members. The receiver does not execute this conditional policy, schedule the second reading, or accept an incomplete collection. Reopening and any subsequent planning must use the new complete original and its exact identity, preserve already consumed readings, and declare a causally valid new menu. This forecast-only sequence declaration accepts no observed value and is not an adaptive-execution session.

## Reserve complete work before inference

The preflight combines the existing collection reservation with every offered sequence's complete endpoint sorting, membership visits, opposite-pair checks and output items, including sequences later excluded by timing. It reserves from the full offered family before the sole authoritative planner inference. Combined pair work remains limited to100,000 and output work to150,000 items; existing cell-step limits remain unchanged. The pure band classifier applies a corresponding single-geometry bound without model execution.

A request that exceeds a bound is refused completely. No processed prefix is presented as an exhaustive policy. These conservative work units are not hard CPU, memory or serialized-byte guarantees. This addition changes no original inference/search, physical solver, workbench UI or measurement hardware.

For an actual first reading, use [conditional acquisition receiving](MECHANISM_CONDITIONAL_RECEIVE.md) to assess actual uncertainty and response timing before treating the forecast as a stopping or continuation decision.
