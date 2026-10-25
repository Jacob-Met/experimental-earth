# Collected-volume calculation interval check

Retain original full-boundary collected-volume readings, assign calibration and optionally held-aside roles, and select **Check finer collection calculation intervals** in the collected-runoff panel. This comparison retains the explicitly entered candidate list for reproducible export/reopen and uses the current candidate coefficient field and the original collection record. Expand each calculation interval to inspect every coefficient, original quantity/source, modeled volume, signed residual and endpoint interpolation bracket.

The current step, half-step and quarter-step are clamped to the maintained one-minute minimum and duplicates removed. All calculations are reserved against one aggregate two-million cell-step budget before any solver runs. A one-minute source, absent calibration, changed source context or excessive work returns an explicit uncomputed result. No subset substitutes for a refused family.

Set agreement concerns calibration-compatible, surviving and closest-calibration candidate membership. Predictions may change even if memberships agree. Held-aside observations do not select or rank calibration candidates. This finite sensitivity comparison is neither a convergence estimate nor a field-accuracy certificate. It never adopts a numerical interval or an outlet coefficient. Original measurements retain their exact windows, units, values, sources and roles.

Project changes and candidate-field edits clear the diagnostic. Ordinary project export/reopen preserves original evidence; run the action again to recompute. No derived report is treated as acquired evidence.

Native receiving: `node --test tests/outlet-evidence.test.mjs tests/outlet-evidence-resolution.test.mjs`.


Actual browser receiving: `CHROME_BIN=/usr/bin/google-chrome-stable node tests/outlet-resolution-browser.mjs`. The maintained browser session checks active Linux namespace and Seccomp sandbox status before navigating the application. The course exercises keyboard activation, retained original readings and edited candidate rates, actual download/import, strict 390px layout and draft invalidation. The complete source manifest and receiving details are in [the retained receipt](receipts/outlet-resolution-b56d209b.json).
