# Another reading with the same sensor

After a shared depth-offset comparison, the question panel can choose one explicitly offered reading that separates infiltration-rate explanations while retaining every calibration-compatible sensor zero. A saved question can also be reopened directly, without first comparing the active project. The panel names its original place and retains all associated source rows; reopening does not replace the active site or insert a prospective value into its notebook.

Declare available cells, an event-time window, a prospective reading half-width, the basis for availability, and why the same sensor zero would persist. Availability is reused from the maintained depth-planning contract. The original associated coordinates are excluded; an unassociated record from another instrument is not silently interpreted as a measurement by this instrument.

## Mechanism

For a candidate rate with a calibration-allowed offset interval `[b_min, b_max]`, a modeled depth `m` and a prospective half-width `u`, the complete possible reported-reading band is `[m + b_min - u, m + b_max + u]`. Calibration uncertainty is retained rather than replaced by one fitted sensor zero. A question separates two rates only when their complete bands are disjoint beyond the explicit floating-point guard. Touching bands and overlapping bands remain unresolved.

The calculation examines the complete offered subset of retained solver snapshots. It maximizes the number of separated rate pairs, then prefers the earliest minute and lowest cell index. It reports every unresolved pair and the number of examined, previously associated and out-of-range points. This is a finite conditional separation objective, not expected information gain, a probability, an optimum across continuous time, or physical access approval.

The current notebook admits reported values from 0 to 1000 mm. A question is not selected unless every candidate's complete predicted reported band lies inside that range. Negative or excessive reported predictions are not clipped or silently treated as censored observations. A broader future sensor interface would require a separate observation contract.

The one-million model-cell-step limit conservatively includes the entire original rate comparison plus another run for every offered rate, before support filtering. Two million prospective pair checks is the separate scan bound. Refusals return no partial optimum. Only calibration intervals choose the question; held-aside values retain their source-level outcome but never narrow the planning family or choose coordinates.

## Executed authored control

In the flat, closed 30 mm/h, one-hour storm control, an original 23 ± 0.1 mm reading at minute 60 permits rate 3 mm/h with offsets −4.1 to −3.9 mm and rate 9 mm/h with offsets 1.9 to 2.1 mm. With the same sensor, prospective ±0.1 mm, and offered cell A1 from minute 65 to 180, minute 65 has complete reported bands 22.55–22.95 and 22.05–22.45 mm. Their positive gap separates the offered rate families. Hypothetical readings of 22.75 or 22.25 mm through the unchanged inference module each retain the corresponding rate. These are model controls, not acquired field evidence or established sensor calibration.

## Original input files and verification

Download retains the original depth-offset source plus acquisition declarations, with no computed result. Reopening recomputes all support and selection. Editing source or question declarations retires the previous result, including a queued computation. Files are bounded to 4 MiB, and additional supplied result fields in the input envelope are refused.

Run `node --test tests/depth-offset-question.test.mjs` for complete-coordinate interval-overlap oracles, broad-offset and touching-band negative controls, source/role independence, budget refusal and raw-input reopening. Run `CHROME_BIN=/opt/google/chrome/chrome node tests/depth-offset-question.receiving.mjs` for the maintained sandbox-admitted app course, actual download/fresh File reopen, stale output retirement and desktop/narrow captures. Record actual execution receipts separately from these instructions.
