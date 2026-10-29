# Challenge soil explanations with another event

The soil investigation can retain several conductivity and capillary-drive explanations that agree with the first event. A separately identified second event tests whether those original explanations predict held-aside readings under its declared rain and starting conditions.

## Use the comparison

1. In **What changes as the soil wets?**, compare and save a first-event investigation with calibration readings and a stated basis for its finite soil hypotheses.
2. Prepare the second event in the working site. Keep the observed grid, cell declarations, material assignments, calculation interval, cell size and routing assumptions the same. Declare its own rain intensity, storm length, run duration and held-aside readings.
3. Under **Do these soil explanations survive another event?**, load the saved first investigation. Give the events distinct references. Each second-event capillary drive starts blank; enter one for every original hypothesis and explain the basis. The copy button explicitly copies first-event values as an assumption.
4. Compare. The table retains every original hypothesis and first-event calibration order. Select an explanation to inspect both curves, exact modeled values, original sources and residuals. The second event can reject an explanation; it cannot restore one rejected by the first event.
5. Save the two-event inputs. Reopening recomputes those saved projects and declarations in a separate view. The working site stays in place, and the result identifies each saved site's rain and duration.

## Meaning and limits

Conductivity **K** stays with its original explanation. Each event has its own explicitly declared **A**, the product of wetting-front suction and initial moisture deficit. This comparison does not infer either factor, estimate moisture recovery between events, or fit the second readings. Both modeled events start with zero cumulative infiltration and zero standing water. They are separate event calculations, with no simulated drying or carryover between them.

The two-event investigation uses the homogeneous sharp-front model that neglects standing-water pressure. The separate [pressure-head investigation](pressure-head.md) admits an additional explicit moisture-deficit parameter and has its own input format. A saved pressure-head investigation is therefore not a first-event input to this comparison.

The first event must contain calibration readings for the investigated scenario. The second must contain held-aside readings for that scenario and cannot contain calibration readings for it. Other-scenario or unused readings remain visible as context. The selected material must be present in the observed site. Comparing unrelated geometry or numerical assumptions is refused.

One surviving explanation means one of the declared finite choices agrees with the assigned bands under these assumptions. It does not establish unique soil properties or field accuracy. Empty or broad bands can leave several explanations compatible. Original source descriptions remain declarations rather than independent verification of a measurement.

## Portable input contract

The `experimental-earth-wetting-front-events/1` envelope contains exactly `schema`, `calibrationProject`, `challengeProject`, `study`, `references` and `initialConditions`. The two references must be nonempty and distinct. Initial conditions contain a nonempty `basis` and an ordered `challengeDrivesMm` array, indexed by original hypothesis identity. Each drive is finite and within 0–5000 mm.

Files are limited to 5 MiB. The combined first- and second-event comparison is admitted before any model run, within the existing one-million-cell-step budget. Saved conclusions are refused. Changing the working event or declarations retires live findings and the download until a new comparison is made. A malformed first-event replacement preserves the previously accepted first source and its explicit declarations; an older asynchronous failure cannot overwrite a newer accepted source.

## Verification

The event core, fixture and study exports were recovered byte for byte from the previously qualified implementation. The current composition preserves those identities, uses a small parent-panel mount/refresh integration, and adds saved-source context and readable mobile labels. Its native controls independently check constant-rate water balances at every saved time, full water conservation, all source-order permutations of three hypotheses, first-event contradiction retention, strict admission, the combined work boundary and input-only recomputation. The browser course exercises real file import, keyboard comparison, actual download, a fresh-document reopen, stale input handling, literal source text and desktop/mobile presentation.

These are software and authored mathematical controls. They are not field validation or a simulated moisture-recovery model.
