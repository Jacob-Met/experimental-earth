# Choose a reading that can resolve the original proposal target

Two explanations can fit the existing observations and still disagree about whether a proposed place meets its target. Another depth reading is not always the useful next observation: a rainfall record may distinguish the relevant explanations, or a later depth reading may become informative after the storm ends.

This headless consumer connects the existing [original mechanism/proposal investigation](RAIN_MECHANISM_PROPOSAL.md) to a finite menu of measurements the investigator declares obtainable. It evaluates each offered readout against **every pair of calibration-compatible explanations with opposite target outcomes**. It reports the options that separate all such pairs and preserves the unresolved pairs for every other eligible option. It does not choose a new model, fit another parameter, operate an instrument or change the project.

## Run on original inputs

Use the existing workbench's **Download original mechanism-proposal investigation** action to obtain `mechanism-proposal-originals.json`. This is the original-input envelope with schema `experimental-earth-joint-mechanism-proposal/1`, including the original project, finite rainfall/duration/soil/receiver hypotheses, interval gauge, proposal target and transfer basis. A saved derived result is not accepted as a replacement.

Supply a separate acquisition menu and run:

```sh
node plan-mechanism-acquisition.mjs mechanism-proposal-originals.json acquisition-menu.json
```

The committed authored example is runnable without editing a workbench project:

```sh
node plan-mechanism-acquisition.mjs examples/mechanism-acquisition-original.json examples/mechanism-acquisition-menu.json
```

The example is fictional. Its geometry, observations, parameter offers, error bands, target and purported logger availability are declared controls, not measurements from a real site.

The command writes one complete JSON envelope with schema `experimental-earth-mechanism-acquisition-cli/1`. `inputs.originalProposal` and `inputs.acquisitionMenu` identify the exact input bytes by SHA-256 and length; `report` contains the recomputed result. Both files remain unchanged. A refused input or computation exits with status 1, a stderr explanation and empty stdout. The adapter admits nonempty regular UTF-8 files without a BOM, up to 4 MiB for the original proposal and 128 KiB for the menu. It refuses symlinks, devices and observed changes during admission or the final reread. The adapter supports Linux and macOS; this contribution's receiving evidence exercises Linux with Node v24.22.1. Complete serialization before writing is not a guarantee of atomic delivery through an external stdout pipe.

## What the example establishes

The original event lasts 90 minutes; all offered storms end at minute 60. A 20 mm existing-site depth at minute 60 and a broad original rain-gauge total retain seven calibration-compatible explanations. Four predict 0 L of final proposed storage, while three predict 64 L. The **absolute proposed-storage target is at most 32 L at the original 90-minute horizon**. This is not a target on proposal-minus-existing change.

The seven retained rows include constant infiltration with unlimited, closed and draining receivers, plus a zero-capillary wetting-front control. All seven remain in the report, in their maintained order. The four meeting rows and three missing rows form twelve opposite-target pairs. No held-aside observations are supplied in this example; the absence of a contradiction is not empirical validation.

The menu sets a minute-60 planning point and a minute-90 decision deadline:

| Offered readout | Predictions for the two target-outcome groups | Result under the declared ±2 mm error |
|---|---|---|
| Existing-site depth at minute 75 | 17.5 mm and 15 mm | Bands overlap; all twelve decision pairs remain unresolved |
| Existing-site depth at minute 90 | 15 mm and 10 mm | All twelve decision pairs are separated |
| New rain-gauge total over minutes 60–90 | 0 mm and 0 mm | No decision separation after every retained storm has ended |
| A newly started measurement covering minutes 0–60 | Past interval | Excluded: a new gauge cannot be installed retrospectively |
| Reuse of the original `wide-total` gauge reading | Already supplied record | Excluded; renaming or re-exporting evidence is not a new observation |
| A separately declared, existing second logger's 0–60 record | 30 mm and 40 mm | All twelve pairs are separated, conditional on that distinct record and error declaration actually being valid |
| Minute-90 depth available only at minute 95 | After the declared deadline | Excluded |

Predictions also carry separately printed numerical guards. Minute 75 uses the maintained linear depth interpolation between minutes 60 and 90; minute 90 is a retained model snapshot. These distinctions remain visible in each prediction. The planner does not extend the original event to manufacture a later question. Changing the original horizon can change the proposal outcome and requires recomputing the original target investigation.

## Declare what can actually be obtained

The menu has exactly these top-level fields:

| Field | Meaning |
|---|---|
| `schema` | `experimental-earth-mechanism-acquisition-menu/1` |
| `eventRef` | Must equal the original gauge's event reference |
| `planningMinute` | Declared planning point on the original modeled event clock |
| `decisionMinute` | Deadline, at or after the planning point |
| `options` | One to 64 explicitly offered readouts, retained in this order |

Original calibration readings must finish by the planning point. Held-aside values remain separate contradiction evidence and never determine the family, target labels or option scores. Recorded locations and times can affect whether an option is already available; that exclusion does not use their measured values.

Each option needs `id`, `kind`, `mode`, `availableMinute`, `uncertaintyMm`, `source`, `availabilityBasis` and `associationBasis`. The three descriptive fields state where the measurement comes from, why it is obtainable by the declared time, and why its site, event and clock match the original investigation. A matching event label alone does not establish those facts. The bounded descriptive fields must be nonempty and at most 600 characters. Measurement uncertainty is a nonnegative half-width in millimeters, at most 10,000 mm.

For `kind: "depth"`, supply `cellIndex` and `minute`. The scenario is the original investigation's `request.target`; the planner does not substitute another map. For `kind: "rain-gauge"`, supply a positive interval through `startMinute` and `endMinute`. A gauge prediction is the original constant rain rate multiplied by the interval's overlap with the candidate's storm support, divided by 60. No invented rainfall history or observed gauge value is supplied to inference.

### Prospective measurements

Use `mode: "prospective"` only when the reading can still be made. Its depth time or gauge start must be at or after the planning point. It must be available no earlier than its measurement finishes and no later than the decision deadline. A timestamp equality does not demonstrate instantaneous setup, access or processing; the availability declaration must support it.

The consumer conservatively excludes original depth cell/time coordinates and original gauge intervals already present in the supplied investigation. Coordinate matching uses the maintained planner's `1e-7` minute clock resolution. This is an exclusion rule for this prospective interface, not a scientific claim that separate instruments at the same location and time are identical.

### Existing records

Use `mode: "existing-record"` only for a record declared already to exist. Its measurement must finish by the planning point, and it must be accessible by the deadline. Add `recordRef` and `distinctRecordBasis`; do not add its observed value to the menu.

The report lists canonical aliases for original supplied readings: `depth:<original observation index>` and `rain-gauge:<original reading id>`. These aliases are scoped to the exact original input identified by the CLI's source hash. An archived offer using one of these references is excluded. This covers calibration, held-aside and unassigned records already supplied in the original file; it does not promote unassigned values into calibration.

A different original measurement uses an `external:` reference, for example `external:logger-b-total`. Its non-reuse declaration must explain that this is a separate underlying measurement, not a renamed file, another export or a copy of evidence already used to choose the family, parameters or uncertainty. Archived depth and gauge records use the same rule. A genuinely separate archived record is not excluded solely because its cell/time or interval matches another record.

The prefix and declaration do not verify provenance. The consumer cannot detect an undisclosed alias or establish that a claimed record exists. It reports **declared distinctness**, not verified distinctness or independent instrument errors. Shared systematic error can invalidate a narrow uncertainty declaration even when two records have different origins. Keeping the archived value out of the menu avoids choosing a purported next observation by first inspecting its answer.

Unavailable but otherwise well-formed options remain in the output with explicit exclusion reasons. Malformed menus are refused as a whole.

## Read the decision certificate

`report.proposal` is the maintained proposal comparison, including every calibration-compatible row, its original metrics, `meets` classification, target numerical guard and held-aside contradiction labels. No row is dropped because it failed a challenge reading. The existing absolute proposal target and transfer assumptions are reused unchanged.

`crossTargetPairs` contains row-index pairs with opposite `meets` values. An eligible option contains one prediction per row, `separatedPairIndices`, `unresolvedPairIndices` and `allPairsSeparated`. Both pair-index arrays refer to that common pair list. `decisionSeparatingOptionIds` lists every offered option whose bands separate all pairs, preserving menu order. There is no vote, posterior probability, cost ranking or maximum-span shortcut.

For each prediction, the closed readout band includes its declared `uncertaintyMm` and a separate conservative `numericalGuardMm`. The guard is `2 * epsilon / (1 - epsilon) * max(1, predictedMm + uncertaintyMm)`, with the maintained depth tolerance's `epsilon = 1e-9` or the rainfall tolerance's `epsilon = 64 * Number.EPSILON`. This includes the maintained admission tolerance's dependence on a yet-unknown observed value. The lower band endpoint is clipped at zero. The numerical expansion is not extra physical measurement uncertainty.

Two closed bands must be strictly disjoint to count as separated. Touching endpoints remain unresolved. If every opposite-target pair is separated, any readout inside at least one retained band leaves a unanimous target classification among the explanations compatible with that readout. A readout outside every band challenges the family instead. This is conditional on the finite offered family, model predictions and declared error bounds; it is not proof about unmodeled explanations or a real intervention's benefit.

`decisionStatus` distinguishes no compatible explanations, no target disagreement, at least one separating option, and no separating option. Empty or unanimous families do not count as successful acquisition. If all retained explanations are contradicted by held-aside evidence, the primary `status` remains `evidence-challenged`; the conditional pair calculation stays visible without making that family supported.

## Complete work, without a partial search

The original-input importer runs exactly once. The planner reserves the complete unfiltered offered family before invoking it, including its existing inference and paired-map work and one additional target-scenario trajectory per possible candidate when depth prediction is needed. Each compatible trajectory is reused across its offered depth times. Gauge readout calculations preserve candidate identities even when predictions coincide.

Admission limits are 3,000,000 cell steps, 512 offered hypotheses, 100,000 pair checks, 10,000 predictions and 150,000 report work items. The pair reservation includes unconditional pair construction and the returned pair list even when no measurement is eligible. Report work items include retained error rows, prediction rows, cross-target pairs and per-option pair-membership indices; this is not a serialized-byte or hard-memory measurement. These conservative bounds can refuse a large offered family even if calibration would later reject many members. The full request is refused; the consumer never presents a processed prefix as an optimum.

This contribution adds the headless planner, CLI, examples and tests. It does not change the workbench interface, original inference/search producers, soil-test protocols, placement or outlet models, or the physical solver.

When no single offered reading resolves every opposite-target pair, an explicitly declared two-readout collection may do so. See [complementary acquisition collections](MECHANISM_ACQUISITION_COLLECTIONS.md) for the optional third CLI input, joint availability declarations and minimum offered readout-count interpretation. The existing two-input command and single-readout report remain unchanged.
