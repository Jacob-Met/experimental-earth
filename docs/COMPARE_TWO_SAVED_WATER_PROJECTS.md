# Compare two saved water-history investigations

Experimental Earth models a proposed surface intervention against an existing site. When two different saved projects have the same existing site, grid and weather, this command asks how the complete modeled water history of proposal B differs from proposal A at each original retained time.

## Compare and download a field sheet in the browser

In Experimental Earth's workbench, export one original project JSON for each proposed
intervention. Choose **Compare saved proposals**, select **exactly two** exported JSON
files, and click **Compare proposals**. The existing comparison of modeled totals,
per-cell depths, original sources and trade-offs appears as before. Once the comparison
passes, choose **Download offline water field sheet (HTML)** for the two original
retained-water courses and their signed B−A difference. Open the downloaded HTML
locally: it is self-contained, interactive, keyboard accessible and print-ready
on a single A4 sheet. This route requires no installed Node.js CLI or special
filesystem access by the user, beyond the browser's ordinary file selection
and download capabilities.

The browser recomputes from the selected original files without changing either
file or the active workbench. It checks the *complete unchanged source context*
(including evidence and study declarations, not only the simulation baseline);
only proposed changes, display titles and selection position may differ. This
can refuse a pair that the narrower native CLI permits. The original-file SHA-256
identities appear in the sheet. The retained numerical samples and HTML
presentation use the same implementation as the native CLI; the browser
report is not a new physical model.

The field sheet is available for **two** files. The general proposal comparison
still accepts 2–16 alternatives, but does not create a two-project sheet for
larger selections. Changing or clearing the selected inputs retires the previous
download link; complete the new comparison before downloading again. If the
optional HTML template is unavailable, the existing comparison JSON remains
usable and the page reports that the optional sheet could not be created.

## Run

On Linux or macOS with Node.js >=20, from the repository root (verified on Linux Node 22 and macOS arm64 Node 26):

    node compare-saved-water-histories.mjs /path/to/project-A.json /path/to/project-B.json /path/to/fresh-result

The output directory must not already exist. The command never modifies either input. It creates four files:

- project-a.original.json and project-b.original.json: exact original UTF-8 bytes, including any optional notes or original investigation declarations.
- paired-water-history.csv: one line at each retained model time, with original file SHA-256 identities, the common existing stored-water total, proposals A/B and B minus A in litres.
- receipt.json: SHA-256 and lengths of original inputs and CSV, model-time coverage, extreme signed differences and their tied minutes.

To verify reproducibility, run the same command again on the two output originals using a different fresh output directory, and byte-compare all four resulting files.

## What the result means

The command accepts only matching normalized dimensions, weather and existing modeled cell arrays; it separately checks both computed existing-water trajectories and exact retained model timestamps. It refuses different baseline sites and different weather rather than silently comparing inequivalent conditions. Project titles, optional notes, proposal surfaces and other non-solver declarations may differ. Optional analyses are preserved but not executed.

Positive B minus A means proposal B has more modeled stored water at that exact model instant; negative means less. The receipt reports numbers of sampled instants above/below/equal, minimum/maximum signed differences and their times, and whether the signs cross. These are sampled model instants, not durations inferred between samples. More water is not uniformly good or bad (it could reflect intentional capture).

The existing compare-rain-proposals.mjs command and browser comparison already compare 2–16 complete intervention budgets and an individual cell at shared times. This command is narrower but different: it exports the full original whole-site stored-water timeline of exactly two proposals directly into one reproducible CSV. It does not duplicate the existing budget/frontier interpretation or local-depth inspection.

This is a conceptual runoff/workbench simulation, not measurement, calibrated flood prediction or an independent environmental outcome. A shared baseline only makes the model comparison meaningful. Interpretation still depends on measured conditions and intervention purpose.

## Safety and refusal

Both inputs must be ordinary, nonempty, non-symlink files within the maintained 4 MiB project bound. The command checks file identities and contents immediately before output creation; refuses malformed/BOM input, incompatible baselines and nonfresh output directories; writes restrictive fresh files and reads each back. A write failure may leave a partial fresh directory, deliberately preserved for inspection. Its presence never signals success.

Export each project separately with export-water-history.mjs when investigating a single authored proposal. This command compares two separately authored proposal scenarios without a server, network, account or additional model service.

## Optional offline field sheet for two saved investigations

With the same admissible, already-exported original projects, add --report:

node compare-saved-water-histories.mjs ORIGINAL_A.json ORIGINAL_B.json NEW_OUTPUT_DIRECTORY --report

The default three-argument command remains unchanged and produces the same original JSON files, complete CSV, and receipt as before. The optional flag adds paired-water-report.html as a fifth file and includes its byte length and SHA-256 in receipt.json. Open the HTML in a browser with no network required; scripts, layout and model data are embedded, and a restrictive content-security policy prevents external requests. Keep the HTML with the two original JSON files and receipt for reproducibility.

The original modeled data are not changed or resampled. The field sheet shows the shared baseline and both proposed whole-site storage series, plus the signed B-minus-A course on a separate zero-referenced chart. Select a retained model instant with the native keyboard-operable slider, step buttons, or a deliberate pointer selection on either chart. Pointer selection is by nearest retained model time; an exact midpoint tie chooses the earlier sample. All detailed readouts and CSV rows retain the model's original shortest round-trip decimal spelling, including signed positive differences and negative zero where applicable. Chart strokes between snapshots are visual guides only: no interpolation or continuous-time sign change is inferred.

The sheet distinguishes exact values from approximate summary formatting, and dynamically labels a mixed-sign, one-direction or all-equal course. Untrusted project titles are rendered as text, not markup. The standalone file deliberately does not adopt a new scientific model, calibrate against observations, or assert that a larger stored-water quantity is automatically better or worse.

Validation: node --test tests/compare-saved-water-histories.test.mjs tests/paired-water-report.test.mjs. For actual Chromium receiving: set PLAYWRIGHT_MODULE to a local playwright-core entry point and CHROME_BIN to Chromium, then run node tests/browser.paired-water-report.mjs. The browser course checks original samples, keyboard and pointer selection, 1440/390 layouts, mixed and all-equal course, no offsite requests, script errors or mobile horizontal overflow. The browser fixture serves only its generated local HTML via ephemeral localhost because this host's confined Chromium cannot read arbitrary /var/lib paths through file://. That host limitation does not establish that every user's file:// opening is tested.
