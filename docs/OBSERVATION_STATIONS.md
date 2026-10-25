# Import original logger station identifiers

In the ordinary measurement-table importer, open **Map original logger station
IDs** and enter a sourced JSON declaration:

```json
{"source":"placement notebook", "entries":[{"station":"logger-east","cell":"B2"}]}
```

Supply a CSV with `station` instead of `cell`; all ordinary quantity, role and
clock columns remain supported. Station IDs are case-sensitive, nonempty trimmed
strings; grid labels use uppercase letters. Every station used in the table must
be explicitly mapped. Multiple stations may share a cell. Duplicate station
entries, missing IDs and out-of-grid placements refuse the whole preview.
Clear the optional map for ordinary cell tables.

The exact parsed original station field is retained as `stationValue`, including whitespace; its trimmed identity must match the declared station on reopen. Preview shows that original token, each resolved station, chosen cell and placement source, alongside
original quantities, clock tokens and CSV record line. Editing the map retires the
preview. Commit uses the unchanged notebook transaction and original current-grid
check. Each reading retains the used station declaration and original grid size;
normal project save/reopen revalidates the resulting cell. Unused station entries
are not observation evidence and are not added to the notebook.

A remapped copy of the same original station/file/row observation is refused as a
duplicate rather than becoming another measurement. Correct a placement in its
source before preparing a new notebook; there is no automatic remapping of accepted
readings. Source labels and mappings remain user declarations, not independently
verified sensor identities or physical locations. No spatial inference or sensor
operation occurs.

## Executed receiving

Final full-application receiving composed main `ea4f00a363851b086afce5edfac52cfcc69d6826` (tree `701082d3f35afb5bca3688c5bf69b4293d5357cb`) with this candidate; fetched upstream files were Git-blob verified by the integrator. Candidate owned-file bases were unchanged in that main refresh.

Linux 6.18.55 / Node 24.22.1: direct `node tests/observation-stations.test.mjs` passes
six groups. The 12 existing table and 6 clock groups also pass. Original multiline
CSV record lines 2/4 survive; changing east B2→C2 changes only its derived cell;
missing/duplicate/foreign-grid mappings and inconsistent reopened cells refuse.
Mapped original rows produce exactly equal `compareInfiltration` calibration,
challenge, ranking and water results to independently prepared equivalent cell
rows. Reinterpreting the same station row does not create independent evidence.

Actual maintained app receiving uses `tests/observation-stations.browser.mjs` with
PLAYWRIGHT_MODULE, BROWSER_EXECUTABLE_PATH and BROWSER_ARTIFACT_DIR overrides.
Sandboxed Chrome 156 under nobody received the source CSV plus declared map,
retired a preview after a mapping edit, re-previewed, appended by keyboard,
downloaded/reopened the project, and refused malformed original timestamps without
removing the accepted notebook. Desktop 1440 and 390 previews have no horizontal
overflow or page errors/external requests. The narrow preview was visually
inspected. Receipts are in `docs/receipts/observation-stations-4f4650/`.

Inputs are authored software controls; no field accuracy, verified placement,
physical acquisition, or platform qualification is claimed.
