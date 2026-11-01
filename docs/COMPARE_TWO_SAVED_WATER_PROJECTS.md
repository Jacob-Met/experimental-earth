# Compare two saved water-history investigations

Experimental Earth models a proposed surface intervention against an existing site. When two different saved projects have the same existing site, grid and weather, this command asks how the complete modeled water history of proposal B differs from proposal A at each original retained time.

## Run

On Linux with Node.js >=20, from the repository root:

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
