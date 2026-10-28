# Compare saved alternative rain proposals against one original site

## Compare in the browser

Run `python3 serve.py` in the source checkout or extracted runtime, then open its printed local URL.

1. Give the workspace a useful name and use **Export project** to save your first proposal.
2. Try a different proposed layout, give it a distinguishable name, and export again. Keep the existing site, storm, observations and other investigation declarations unchanged.
3. Select **Compare saved proposals** in the workbench. It opens a separate tab, keeping the editor and any unfinished reading open.
4. Choose 2–16 original project files, then select **Compare proposals**.

The page shows the one common existing-site result, each proposal's water outcomes and changes from that reference, and the two existing trade-off comparisons described below. File names, original byte counts and SHA-256 identifiers identify the actual inputs. Wide result tables can be scrolled horizontally; keyboard users can focus each table region.

**Download comparison JSON** saves the same report produced by the command-line comparison. It is a result record, not a replacement for the original project exports; retain those projects to reopen or recompute the alternatives.

Files are read locally in a browser worker. Comparing does not replace or write the workbench, adopt a proposal, or change the original files. Selecting another set or clearing the selection removes the previous result and stops its worker. An incompatible or invalid input refuses the complete comparison; no previous result remains available as though it belonged to the new files.

The browser uses the same original-project validator, source identity rules, calculation receipt and comparison algorithm as the CLI. Its file picker supplies browser File objects; the CLI additionally checks native filesystem identity, regular-file status and changes during reading.

### Inspect one cell at the same time

Whole-site totals and maximum depths do not show where water moves. A proposal can improve the totals while leaving a particular path or entrance cell wetter.

After comparing the files, use **Inspect one cell**:

1. Choose the grid column and row, such as **B1**, then select **Inspect cell**.
2. Read the existing-site depth and every saved proposal's depth, surface material and change from that reference. A positive change means deeper water at this same cell and time; a negative change means shallower water.
3. Move the shared time slider or use **Previous snapshot** and **Next snapshot**. All rows use the same actual retained solver time, including minute zero and any shorter final interval. No interpolation is applied.

The first inspection starts at the final modeled time. Changing the cell clears its old result; select **Inspect cell** to calculate the new location. Changing only the time uses the already calculated cell course. Coordinate labels refer to the shared project grid, not geographic coordinates, and values are rounded for display.

This local view rereads and verifies the original files against the comparison. If a file or its original context no longer matches, compare the files again. A new file selection or **Clear selection** removes both the aggregate and local results. The workbench and original project files remain unchanged.

**Download comparison JSON** continues to save the aggregate CLI-compatible report. The supplementary local view is recomputed from the original project exports; it is not added to that report. These selected-cell results use the same conceptual base-rain model, not observed depths, local peak depths, terrain hypotheses, or independently recalibrated studies.

### Find changes across the retained times

Open **Across the retained times** beneath the local depth table to find each proposal's greatest sampled increase and decrease from the existing site at this cell. Use **View** at a finding's time to focus and reveal the existing shared time control and inspect all the original scenario depths together. If an extreme is tied, the action selects the earliest tied snapshot and the summary gives the number of tied samples.

The section also identifies opposite directions at consecutive nonzero samples. Equal-depth samples between them are retained as neutral evidence. A positive change followed by zero and another positive change is not a direction reversal; positive and negative samples on either side of zeros form one sampled bracket. These findings do not assign an exact crossing time, infer values between snapshots, or measure a continuous duration.

Signs and ties use the full retained numerical differences, before display rounding. Zero is exact; no numerical tolerance or physical-significance threshold is introduced. An absent direction is reported explicitly, such as **No retained sample is deeper than the existing site.** A very small modeled difference is still a numerical difference and does not establish a measurable field effect.

This summary uses the already calculated selected-cell course. Opening it or selecting a finding performs no additional model run or file read. Cell changes, replacement files and **Clear selection** retire the summary with the local results, while the original files and aggregate report remain unchanged.

## Compare with the command line

Use the maintained workbench's **Export project** action to save two or more explicitly authored proposed surface plans. The existing `inspect-rain-project.mjs` command recomputes one file. This complementary read-only command compares 2–16 separate local exports:

```sh
node compare-rain-proposals.mjs courtyard-garden.json courtyard-paving.json courtyard-mixed.json > comparison.json
```

Each file is read through the same strict 4 MiB original-file intake, schema validator and unchanged `compare` model as the single-project CLI. A valid result requires **identical source site, weather, original grid, evidence, and retained optional investigation fields** across every file. Only the prospective `proposal` cells, display `title`, and UI `selectedIndex` may differ. JSON property order does not matter. Incompatible originals, invalid projects and unreadable files refuse the entire command with a nonzero exit status and **no stdout**. Original files are never modified.

The versioned JSON receipt includes SHA-256 of every exact original file, a SHA-256 of the unchanged fields' canonical semantic JSON, the common existing-scenario water budget, each proposed budget and each proposal-minus-existing difference. It also gives an explicitly **limited** two-objective nondominated set: maximize modeled absorbed liters and minimize maximum modeled local water depth (mm). A candidate is removed from this named frontier only if another candidate is at least as good on both objectives and materially better on one (relative numerical tolerance 1e-9). A tradeoff leaves both on the frontier. The report does **not** rank economic cost, actual flood risk, habitat effects, constructability or physical safety; it does not claim a universally best intervention. Similar results within tolerance remain separate candidate records.

**Intervention footprint and a separate tradeoff:** Each candidate additionally reports its modeledFootprint.changedCellCount and sorted changedCellIndices. This counts modeled cells whose surface or elevation differs from the retained original, plus *both adjoining cells* for an altered internal hydraulic edge. Source wording or cell provenance alone never increases the count. The extra footprintAwareFrontier minimizes that count **alongside** the two modeled rain objectives. It intentionally does not replace the original namedObjectiveFrontier or its fields, and it is not a measure of construction cost, land ownership, true treated area, habitat impact, labor or safety. An authored 6-cell garden may be worth considering even if an extensive 48-cell garden dominates it in the original two rain metrics, because changing 48 original cells is a substantially different declared intervention. The new frontier answers this narrower modeled-decision question, not what a landowner should build.

Only the existing conceptual base-rain scenario is recomputed. Attached observation records and optional studies are held identical across files, **not independently recalibrated or interpreted**. The underlying simulation is not a measured hydrologic forecast. Compare an actual field intervention with real observations and local expertise before drawing site-safety conclusions. This command does not upload data or trigger deployment.

