# Compare saved alternative rain proposals against one original site

Use the maintained workbench's **Export project** action to save two or more explicitly authored proposed surface plans. The existing `inspect-rain-project.mjs` command recomputes one file. This complementary read-only command compares 2–16 separate local exports:

```sh
node compare-rain-proposals.mjs courtyard-garden.json courtyard-paving.json courtyard-mixed.json > comparison.json
```

Each file is read through the same strict 4 MiB original-file intake, schema validator and unchanged `compare` model as the single-project CLI. A valid result requires **identical source site, weather, original grid, evidence, and retained optional investigation fields** across every file. Only the prospective `proposal` cells, display `title`, and UI `selectedIndex` may differ. JSON property order does not matter. Incompatible originals, invalid projects and unreadable files refuse the entire command with a nonzero exit status and **no stdout**. Original files are never modified.

The versioned JSON receipt includes SHA-256 of every exact original file, a SHA-256 of the unchanged fields' canonical semantic JSON, the common existing-scenario water budget, each proposed budget and each proposal-minus-existing difference. It also gives an explicitly **limited** two-objective nondominated set: maximize modeled absorbed liters and minimize maximum modeled local water depth (mm). A candidate is removed from this named frontier only if another candidate is at least as good on both objectives and materially better on one (relative numerical tolerance 1e-9). A tradeoff leaves both on the frontier. The report does **not** rank economic cost, actual flood risk, habitat effects, constructability or physical safety; it does not claim a universally best intervention. Similar results within tolerance remain separate candidate records.

Only the existing conceptual base-rain scenario is recomputed. Attached observation records and optional studies are held identical across files, **not independently recalibrated or interpreted**. The underlying simulation is not a measured hydrologic forecast. Compare an actual field intervention with real observations and local expertise before drawing site-safety conclusions. This command does not upload data or trigger deployment.
