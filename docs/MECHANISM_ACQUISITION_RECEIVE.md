# Receive a selected acquisition without rewriting its evidence

An acquisition plan predicts what offered readings could distinguish. Receiving a reading is a different step: the selected location, interval and original inputs must match, and the actual measurement uncertainty may differ from the planned precision. This headless consumer appends selected readings as **challenge evidence**, reopens the complete original investigation through its maintained importer, and reports which original explanations remain uncontradicted.

It preserves the [single-readout plan](MECHANISM_ACQUISITION.md) or [explicit collection plan](MECHANISM_ACQUISITION_COLLECTIONS.md), the original calibration family, and the original proposal target. It does not refit the family to obtain a desired outcome, operate an instrument or verify a physical observation's provenance.

## Run with a new output path

For a single selected readout, use four arguments:

```sh
node receive-mechanism-acquisition.mjs original-proposal.json acquisition-menu.json received-readings.json output-original.json
```

For a collection, supply its complete original declaration as the fifth argument:

```sh
node receive-mechanism-acquisition.mjs examples/mechanism-collection-original.json examples/mechanism-collection-menu.json examples/mechanism-acquisition-receipt-meet.json received-meet-original.json examples/mechanism-collection-choices.json
```

Choose a fresh output path for each invocation. The command creates the output exclusively; it never replaces an existing input or output. Inputs must be regular UTF-8 files without a BOM, under the maintained file-admission and reread rules. Limits are 4 MiB for the original, 128 KiB each for the acquisition and collection menus, and 64 KiB for the receipt.

The output file is a complete original mechanism-proposal envelope, with only the selected challenge readings appended. It can be reopened as an original investigation; it is not a cached derived result. Input files remain unchanged. The CLI serializes the new original and report before writing, hashes and verifies its output, and emits a JSON envelope with schema `experimental-earth-mechanism-acquisition-receive-cli/1`. That envelope includes input SHA256/byte identities, `outputOriginal` identity and `report`. A refusal exits1 with empty stdout and a `RECEIVE REFUSAL` explanation on stderr. Output-file creation is exclusive, not a promise that every later filesystem or stdout failure is transactionally rolled back; inspect retained artifacts before any retry.

## Bind the receipt to exact inputs and selection

The receipt has exactly these top-level fields:

| Field | Required meaning |
|---|---|
| `schema` | `experimental-earth-mechanism-acquisition-receipt/1` |
| `inputs` | Exact raw UTF-8 SHA256 identities described below |
| `eventRef` | The original event association |
| `choice` | Exactly `{ "kind": "single" or "collection", "id": "selected-id" }` |
| `receivedMinute` | Actual declared receipt time on the original event clock |
| `receiptBasis` | Nonempty event/location/clock association declaration, at most600 characters |
| `readings` | Every selected member exactly once, each as `{ "optionId": "id", "reading": {...} }` |

`inputs` contains exactly `originalProposalSha256`, `acquisitionMenuSha256` and `acquisitionCollectionsSha256`. All are lowercase SHA256 strings for the exact supplied bytes, except that the collection identity is `null` when no collection file is supplied. Formatting changes also change an identity. A receipt must not be silently rebound to different source files. Identity mismatch refuses before model work.

The collection examples bind these exact existing files:

| Input | SHA256 |
|---|---|
| `examples/mechanism-collection-original.json` | `0726ec5eb623ba8de996404ebc70352d4b053c8369a24ea2f4d781e9923c9ecf` |
| `examples/mechanism-collection-menu.json` | `9a96ae5f8199b985bbedd015d73fa67b61e1b1b53b2dc0a52f16f91ce404982a` |
| `examples/mechanism-collection-choices.json` | `9fb641968f35f061c45ccd8e1ec1a354fbd1ebf12ec278aeca004b9ee77b353f` |

All supplied menus are admitted completely. A selected option need not have been a successful or minimum choice: an uninformative measurement is still a measurement that can challenge the family. A collection requires every declared member, with no extra, missing or duplicate option IDs. Receipt array order can differ; append order follows the declared selection.

This version receives **prospective offers only**. It refuses archived `existing-record` offers; persistence of a distinct external archived record's identity is outside this interface's scope. This limitation does not say archived evidence is scientifically invalid.

## Preserve actual reading fields

A depth reading has exactly `scenario`, `use`, `cellIndex`, `minute`, `depthMm`, `uncertaintyMm` and `source`. Its role must be `challenge`; scenario must equal the original request target, and cell and time must exactly match the selected offer. Millimeters are explicit in the numeric field names.

A gauge reading has exactly `id`, `startMinute`, `endMinute`, `depth`, `uncertainty`, `unit`, `source` and `use`. Its role is also `challenge`; its interval must exactly match the selected offer, and its ID must be fresh. The maintained gauge validator checks the complete appended original gauge. Actual source, unit and uncertainty remain in the new original.

The examples select collection `rain-then-depth`: gauge `rain10to30` over minutes10–30 and existing-site `depth60` at **cell0, minute60**. Cell3 is not interchangeable with cell0, even on this flat authored site where the predicted depths coincide. Numerical agreement does not establish measurement identity.

The receiver retains actual uncertainty. `precision` reports each option's planned and actual uncertainty in millimeters and whether the actual value exceeds the plan. A wider actual band is not clamped to a promised instrument precision; it can leave opposite outcomes unresolved. Neither the receipt's source string nor a matching hash verifies physical accuracy, clock synchronization, access or provenance.

`receivedMinute` must be finite and nonnegative, at or after planning and every selected measurement's end. A receipt after the decision deadline is retained with `receiptTiming.receivedByDecision: false`. Its evidence can still be examined, but it cannot be reported as information available for the earlier decision. The example's minute60 receipt is an authored declaration, not proof of instantaneous access or processing.

## Four authored controls

All examples keep the fictional 20-row calibration family and its absolute proposed-storage target of at most200 L. Six original rows meet the target and fourteen miss. They append challenge readings at the selected coordinates and declare receipt at minute60.

| Example receipt | Depth at cell0/minute60 | Gauge over minutes10–30 | Uncontradicted original indices | Meet / miss among those indices |
|---|---:|---:|---|---:|
| `mechanism-acquisition-receipt-meet.json` | 10 ±1 mm | 10 ±1 mm | 1,4,7 | 3 / 0 |
| `mechanism-acquisition-receipt-miss.json` | 10 ±1 mm | 40/3 ±1 mm | 11,14,17 | 0 / 3 |
| `mechanism-acquisition-receipt-wide.json` | 10 ±1 mm | 35/3 ±2 mm | 1,4,7,11,14,17 | 3 / 3 |
| `mechanism-acquisition-receipt-challenged.json` | 100 ±1 mm | 10 ±1 mm | None | 0 / 0 |

These survivor outcomes were first established through the unchanged original importer on separately frozen, complete authored originals with exact selected coordinates. All four outcomes then passed through the new receiver in its ten independent tests, run together with the eight unchanged single-readout and seven unchanged collection tests: 25 tests passed under Node 24.22.1 on Linux. The wide example deliberately uses ±2 mm actual gauge uncertainty instead of the planned ±1 mm. The controls are fictional; none represents acquired physical data.

The documented collection-receipt command also executed on the actual complete input files and wrote a fresh 4,402-byte original investigation. Its output identity and all four input identities matched the actual bytes. A separate reopening through the unchanged original importer retained the 20-row, six-meet/fourteen-miss calibration result and the three uncontradicted meeting rows. The old and new collection-planning CLI outputs remained byte-identical. These are scoped computational and file-consumer checks; they do not qualify a physical instrument, field accuracy, browser behavior or the full repository.

## Whole family and surviving subset are different results

`forecast` retains the complete original single-readout or collection report. `receivedProposal` retains the recomputed whole-family proposal result: every calibration-compatible row remains in original order with its metrics, target classification and numerical guard. Challenge readings label contradictions; they do not delete rows or become calibration evidence.

`baselineOutcome` and `receivedOutcome` summarize target labels among uncontradicted rows, with original indices and counts. Their statuses distinguish:

- `no-calibration-compatible-explanations`: no original compatible family;
- `family-challenged`: compatible explanations exist, but none remains uncontradicted;
- `unresolved`: uncontradicted explanations still contain both target labels;
- `all-uncontradicted-meet` or `all-uncontradicted-miss`: unanimous target labels within the uncontradicted subset.

In the authored meet and miss cases, the whole-family target result remains `conditional`, even though the surviving subset is unanimous. Zero survivors is not a successful target certificate or a failed intervention: the reading challenges the family, measurement association, bounds or other assumptions. `newlyContradictedCandidateIndices` preserves which original explanations acquired a contradiction.

These are deterministic finite-family statements under actual declared error bounds and maintained numerical guards. They are not posterior probabilities, confidence intervals, independent-error claims, field validation, permission to intervene or evidence that unmodeled explanations are impossible.

## Reopen without acquiring the same reading twice

`receivedRecords` maps selected option IDs to canonical appended references such as `depth:<index>` and `rain-gauge:<id>`. Reopening `receivedOriginalText` through the maintained planner makes those prospective coordinates already recorded, even if an offer is renamed. This prevents the same prospective acquisition being suggested again through a changed label. It does not verify that an undisclosed external record is genuinely distinct.

Replanning requires a temporally valid menu: the new planning point must be consistent with the evidence already in the original. Preserve the output's exact input identity when creating a subsequent receipt. Do not reuse a receipt bound to the pre-acquisition original as though it were bound to the new file.

## Bound both computations before starting

Receiving deliberately performs two complete original inference/proposal computations: the forecast and the appended-challenge comparison. Their combined reservation is checked before the first model execution. It includes the complete forecast work, another three passes over every offered hypothesis/cell/step, both reports, added challenge rows and outcome indices. Combined cell-step work must remain within3,000,000 and report work within150,000 items; existing forecast pair limits remain in force. Conservative work items are not measured memory or serialized-byte guarantees.

The receiver builds the new original directly and calls the maintained importer; it does not use an export helper that would silently run inference again. It changes neither original fitting/search nor the solver, workbench UI, measurement hardware or physical site.

For a first reading selected by an ordered conditional sequence, [conditional acquisition receiving](MECHANISM_CONDITIONAL_RECEIVE.md) preserves this receiver report and additionally evaluates actual decision readiness and remaining second-readout separation.
