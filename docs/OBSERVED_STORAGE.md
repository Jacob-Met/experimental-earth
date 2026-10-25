# Original depth evidence and standing-water inventory

The evidence map includes **How much standing water do these readings represent?** Select a scenario and evidence role above the map, choose an exact recorded minute, and declare why each reading can represent its entire grid cell. Compare observed volume bounds. No physical cell average is inferred from a point measurement.

Only readings at that exact minute and scenario enter the inventory; nearby times are not interpolated. Repeated readings in a cell contribute the intersection of their closed nonnegative depth bands, and the cell is counted once. Any disjoint bands, even a tiny positive gap, refuse the whole aggregate. Sources, original notebook indices and roles remain inspectable. Empty evidence does not produce zero water.

With declared square cells, depth in millimetres times cell area in square metres is volume in litres. Sum lower and upper bounds over the observed footprint. The whole-site lower bound is that observed lower bound because unobserved depths are nonnegative. Its upper bound is explicitly unknown whenever any cell lacks matching evidence. The notebook's maximum admitted depth is an input limit, not a physical bound on an unobserved cell.

The maintained model is sampled using interpolateDepth at the same minute on that same footprint; a separate total reports the entire modeled site. No modeled depth fills the observation inventory. The displayed relation uses a disclosed roundoff guard of 32 machine epsilons times the largest magnitude among one litre, the two observed bounds and the modeled footprint volume. That comparison guard does not widen original bands or resolve contradictions.

An aggregate overlap can hide opposite local errors: two exact observed depths of 1 and 4 mm sum to the same volume as a modeled 2.5 mm in each cell. The individual evidence map therefore remains essential. Aggregate overlap is neither calibration nor field validation, and the declaration does not establish event identity, spatial representativeness, source authenticity or statistical independence.

Source edits, role/scenario changes, minute changes and declaration edits retire the comparison. The declaration is an unsaved query; original observations survive ordinary project export and reopening. Reenter the declaration to recompute after reload.

Run node --test tests/observed-storage.test.mjs for analytic unit/area, intersection, unknown coverage, contradiction, exact filtering, source replay and negative controls. Run CHROME_BIN=/absolute/path/to/chrome node tests/observed-storage.browser.mjs for the maintained sandbox-admitted browser course, including ordinary export/reopen, invalidation, keyboard and narrow-screen checks. The tests use authored software controls, not acquired field measurements.
