# Timed ponding-route inspection (conditional model only)

The existing **Inspect a connected route** workbench reports depth along every
declared adjacent cell **at the same modeled time**. The new **Test a moving
traversal** subsection asks a separate question: given the same modeled rain,
depth limit and original route, what departure periods keep every cell at or
below that threshold **at its hypothetical arrival minute**?

Choose one positive duration in minutes (repeated for every step), or one
comma-separated duration for each of the N-1 steps. Choose an earliest and
latest departure, fully inside the modeled replay after the final step.
The evaluator translates each cell's source-derived threshold exceedance
interval backward by cumulative step time; the intersection of all remaining
allowed departures yields explicit intervals for the original and proposal.
The first failed cell/time at the requested earliest departure is sampled
directly from the same retained replay. No original site, inferred geometry,
saved project, rainfall, or source observation is mutated by the query.

This is a **conditional model-depth experiment**, not a physical traversal
forecast, personal mobility estimate, accessibility decision, or flood safety
certification. Step durations are declarations, not measured speeds. The
interpolated replay may miss events between retained solver snapshots, and
isolated threshold-equality instants are not counted as duration windows.

## Receiving

Run:

```sh
node --test tests/route-traversal.test.mjs tests/route-ponding.test.mjs
npm test
CHROME_BIN=/usr/bin/chromium node tests/route-traversal.receiving.mjs
```

The last command uses the project's protected Chrome/CDP receiving owner. It
must refuse to run if the Chromium sandbox is inactive. Inspect its original
sandbox receipt instead of disabling this admission check or claiming a browser
pass. On systems where Chrome is installed elsewhere, change only
`CHROME_BIN` to its existing binary; sandbox admission remains required.

Controls: a staggered course where no positive-duration simultaneous-clear
window exists but a timed arrival can qualify; the reverse course where a
simultaneously clear departure arrives at a wet cell; step-speed and threshold
changes; invalid/overlong departures; original rain versus a dry control;
source immutability.
