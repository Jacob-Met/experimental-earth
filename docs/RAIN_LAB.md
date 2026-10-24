# Experimental Earth / Rain Lab

A local-first, deliberately **illustrative** surface-water comparison workbench. This is the first runnable product slice of [EXPERIMENTAL EARTH](PRODUCT_SEED.md): turn an authored place into an inspectable experiment; alter an intervention while preserving an immutable baseline; compare modeled rain, surface absorption, outlet discharge, and water remaining; ask which uncertain infiltration assumption is worth investigating.

## Run it

Requires Node 22+ for tests, but the browser application itself has **no dependencies, no build, and no network calls**. Use the included **local-only server**, which supplies the strict JavaScript module MIME type even on systems where Python's static server treats `.mjs` as plain text:

```sh
node tools/serve.mjs        # or: npm start
# open http://127.0.0.1:8060/
```

Tests: `node --test test/*.test.mjs`.

Try selecting *Planting bed*, painting the middle of the **proposal** grid, changing rainfall, inspecting the time slider, and pressing **Find a consequential unknown**. Export the session JSON; reload or open a separate browser and import to recover the comparison. The reference grid is never overwritten by painting.

## What the model does, and does not

- Cells are **2 Ãƒâ€” 2 metres** in the authored demo; baseline surfaces and gentle elevations are invented, not surveyed. Surface labels have fixed illustrative infiltration rates and wide alternative ranges.
- Uniform rainfall (`mm/h Ãƒâ€” hours`) enters every cell. Surface infiltration (`mm/h`) takes only water available in each cell. A single identified outlet discharges up to its stated capacity. The remainder is surface storage.
- Four-neighbor routing uses a limited transfer fraction proportional to the difference in *terrain elevation plus standing-water depth*. Transfers are simultaneous, scaled to available source water, and mass conserving. Closed outer edges cannot lose water except at explicit outlets.
- The interface shows end-of-event **surface water, infiltration, and outlet totals** in liters, along with the model's internal water-balance residual. Scrub through the calculated storm. No automatic permanent browser storage or telemetry.
- The suggested observation reruns the *same storm* twice for each cell, changing **only that cell's** infiltration rate between an authored low and high bound. It reports the largest difference in modeled unabsorbed water (outlet + stored) among the evaluated inputs. For the 126-cell demo it evaluates all cells; imports over 160 cells use an explicitly labeled 36-cell heuristic shortlist. This is not an optimized sampling strategy, a probability interval, or a genuine field measurement.
- No evapotranspiration, dynamic subsurface storage, variable rainfall, physically calibrated discharge coefficients, erosion, building/sewer systems, soil saturation over repeated storms, or boundary inflows are modeled. A single storm cannot establish long-term flooding or safety. **Do not use these values for engineering, flood-risk, property, environmental, or land-use decisions.**

Inputs are limited by schema (grid Ã¢â€°Â¤640 cells, rainfall 0Ã¢â‚¬â€œ250 mm/h, duration 1Ã¢â‚¬â€œ240 minutes, optional per-cell surfaces). No external site data are imported by default. JSON import rejects invalid grids, material identifiers, elevations, duplicate outlets, incompatible reference/proposal geometry, nonfinite values, and invalid storm settings. The document is data, never executed code.

## Next evidence-based work

Compare the simplified model against an independently measured or established hydrologic reference, then determine whether its lateral transfer rule should be replaced. Build a provenance-aware terrain and infiltration measurement importer and real-site authorized observation path. Investigate whether a Nebius/NVIDIA inference component can materially improve the *choice or interpretation of observations*, but do not claim cloud use or contest eligibility from this local implementation alone.
