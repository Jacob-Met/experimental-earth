# When two obtainable readings answer a decision that one cannot

A rainfall total can distinguish forcing alternatives while leaving different soil responses unresolved. A site-depth reading can distinguish those responses while confusing different combinations of rainfall and soil. This headless extension evaluates **explicitly offered two-readout collections** against the original proposal target. It uses the same finite explanations and readout bands as the [single-readout acquisition planner](MECHANISM_ACQUISITION.md).

Here, a collection means a declared bundle of two readings. It does not mean collecting outlet water, operating an instrument, or acquiring observations. The investigator must declare that the two readings can actually be obtained together; separate availability declarations do not establish that.

## Run with an optional third input

The existing two-file command remains unchanged:

```sh
node plan-mechanism-acquisition.mjs mechanism-proposal-originals.json acquisition-menu.json
```

To evaluate offered collections, supply a third JSON file:

```sh
node plan-mechanism-acquisition.mjs examples/mechanism-collection-original.json examples/mechanism-collection-menu.json examples/mechanism-collection-choices.json
```

The third file is limited to 128 KiB. The CLI retains the existing original-file admission and reread checks, identifies all three input byte sequences, and adds `inputs.acquisitionCollections`. Its envelope's `report` is the collection report. The two-input path retains its existing report format and identity behavior.

The original mechanism/proposal importer runs once. `singleReadoutReport` retains the unchanged version-1 single-readout report, including all original proposal rows, target guards, challenge labels, pair identities, predictions, exclusions and individual options. Collections combine those already computed separation sets; they do not rerun inference or replace the absolute proposal target with an effect-sign test.

## Declare a jointly obtainable pair

The collection menu has exactly `schema`, `eventRef` and `collections`:

```json
{
  "schema": "experimental-earth-mechanism-acquisition-collection-menu/1",
  "eventRef": "authored full-family arithmetic event",
  "collections": [
    {
      "id": "rain-then-depth",
      "optionIds": ["rain10to30", "depth60"],
      "jointAvailabilityBasis": "The prepared gauge can be read at minute30 and the site depth obtained by minute60; neither action prevents the other. This is an authored availability declaration, not an acquisition."
    }
  ]
}
```

Offer one to 64 collections. Each needs a unique collection ID, exactly two distinct known option IDs from the acquisition menu, and a nonempty `jointAvailabilityBasis` of at most 600 characters. Collection IDs must differ from option IDs. Duplicate unordered pairs are refused, so reversing two option IDs does not create another choice. The event reference must match the original acquisition menu. No acquired values belong in this file, and the planner does not automatically pair all individually available readings.

Explain practical joint feasibility: access, setup, travel, shared equipment, staffing and processing time can prevent two individually obtainable readings from being obtainable together. The declaration is retained for inspection; the software does not verify it. All existing individual timing, provenance and non-reuse rules still apply. An excluded member excludes the whole offered pair, with explicit reasons; the pair is not silently reduced to its other member.

## Authored causal example

The example uses a flat 2×2 grid of four 2 m × 2 m cells: 16 m² total. The existing map is turf; the proposal is half turf and half garden. The original event and offered storms last 60 minutes, with no lateral mobility or boundary outflow. Offered rainfall rates are 30 and 40 mm/h; offered constant turf rates are 10, 20 and 30 mm/h. Closed, draining and unlimited receiver alternatives and a zero-capillary wetting-front alternative remain in the original family. Garden retains its maintained default.

The original calibration consists of an uninformative dry depth at minute0 and a broad gauge total over minutes0–10 of 35/6 mm ±1 mm. Planning occurs at minute10. The absolute goal is **proposed stored water at most 200 L at minute60**. These are explicitly authored inputs, not observations from a physical site.

An unchanged-source probe retains 20 alternatives: six meet the target and fourteen miss it, forming 84 opposite-target pairs. For example, rain30/turf20 predicts 128 L proposal storage, while rain40/turf30 predicts 208 L; both predict 10 mm existing-site depth. Rain30/turf10 also predicts 208 L, so rainfall alone does not settle the target either.

| Offered readout, with ±1 mm declared error | Available by | Separated opposite-target pairs | Unresolved pairs |
|---|---:|---:|---:|
| Existing-site depth at minute60 | Minute60 | 75 | 9 |
| Rain-gauge total over minutes10–30 | Minute30 | 60 | 24 |
| Both readings, under the declared joint availability | Minute60 | 84 | 0 |

Both individual offers pass the single-readout planner's admission checks. The future gauge interval starts at the planning point and does not reuse the original0–10 interval. The depth is available by the minute60 decision deadline. Equality of a setup or availability timestamp is a declaration that still requires practical justification.

The documented three-file command was executed on these complete authored inputs with Node 24.22.1 on Linux. Its result retained all 20 alternatives and 84 opposite-target pairs, reported individual separation counts of 75 and 60, and reported `rain-then-depth` as separating all 84 with a minimum offered readout count of 2. All three reported input hashes and byte lengths matched the actual files. The existing two-file command also produced byte-identical output before and after this extension on both the original 90-minute example and this 60-minute example.

The eight unchanged single-readout tests and seven collection tests passed together. They cover complementarity, shared unresolved pairs, touching bands, singleton preference with retained collections, exclusions and invalid declarations, held-aside invariance, empty and unanimous families, complete-work refusal and actual CLI input identities. This is scoped computational qualification; the authored inputs do not establish field accuracy, real access or instrument operation, and this course is not a full-repository or browser test.

## Interpret the report

The collection report uses schema `experimental-earth-mechanism-acquisition-collections/1`. Every offered collection remains in original order with its `offer`, `status` and `exclusionReasons`. Collections evaluated against opposing outcomes also contain `separatedPairIndices`, `unresolvedPairIndices` and `allPairsSeparated`; excluded and not-needed collections are not given a successful score. Pair indices refer to the common list in `singleReadoutReport.crossTargetPairs`; equivalent predictions do not collapse original explanations or identities.

A collection separates a pair of explanations if at least one of its two coordinates has strictly disjoint closed readout bands for those explanations. Touching bands remain unresolved. `decisionSeparatingCollectionIds` lists all successful offered collections in original order. Individual results remain available even when a collection succeeds, and all collection results remain visible even when an individual reading already suffices.

`minimumOfferedReadoutCount` is 1 if any eligible single readout separates every opposite-target pair, otherwise 2 if any eligible offered collection does, and otherwise `null`. `minimumOfferedChoices` retains all qualifying choices at that minimum, with `kind`, `id` and `optionIds`, using original input order for ties. This is a minimum number of readouts **among the explicitly offered choices**, not a cost ranking, a preferred intervention, a global measurement optimum or a search over unoffered combinations.

`selectionStatus` distinguishes no compatible explanations, no target disagreement, decision-separating choices and no choice. Empty or unanimous target families yield not-needed collections rather than a successful measurement certificate. The top-level `status` preserves the existing evidence-challenged override; conditional geometry does not rehabilitate a family contradicted by held-aside evidence.

## Why joint coverage works, and what it assumes

For each explanation, the two readout bands define a rectangular set of jointly compatible values. An opposite-target pair has disjoint rectangles whenever at least one coordinate has disjoint bands. If every opposite-target pair is separated this way, any observed vector lying in at least one explanation's rectangle leaves only one target classification among compatible explanations. A vector outside every rectangle instead challenges the retained family.

This reasoning assumes both declared deterministic error bounds hold **simultaneously**. It does not assume statistically independent errors, multiply probabilities or infer a confidence level. Shared bias can violate both bounds; different instruments or record names do not eliminate that risk. Numerical guards remain separate from physical measurement uncertainty. The conclusion is conditional on the finite supplied family, maintained model, original transfer assumptions and valid error declarations, including unmodeled explanations as an unresolved limitation.

## Complete admission before model execution

Before invoking the sole original inference, the implementation reserves the single-readout work plus the complete offered collection workload, including excluded collections. Each collection reserves two member lookups, conservative pair work and report entries for its members, selection and pair indices. With N offered hypotheses, the additional pair-work reservation is four times floor(N²/4) per collection.

Combined pair work must fit the existing 100,000 limit; combined report work must fit 150,000 items. The existing three-million-cell-step limit and other single-readout bounds remain. These are conservative work-item limits, not measured peak memory or serialized-byte guarantees. A request exceeding a bound is refused as a whole before model execution; no processed prefix is presented as a complete selection.

This interface does not change the physical solver, original inference, fitting/search, outlet collection, controlled soil-test protocols, placement or workbench UI.

## After obtaining the selected readings

The [selected acquisition receiver](MECHANISM_ACQUISITION_RECEIVE.md) accepts actual prospective readings with their own values, sources and uncertainty. It binds them to the selected original inputs, writes a new reopenable investigation with challenge readings appended, and distinguishes the original calibration-family outcome from the explanations left uncontradicted by the received values.
