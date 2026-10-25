# Closed below-surface receiving capacity

## Use the comparison

In the Rain Experiment Lab, open **What changes when the ground has no more room?**
Use the current site or the separately labeled fictional shallow-bed example.
Choose a surface, enter the space remaining at event start in millimeters over
each affected cell, and give its source or explicit hypothetical basis. Compare
the unchanged and proposed maps under the same storm, with and without that limit.

The table, standing-water curves and paired final-depth maps expose the resulting
surface consequences. Select an original cell to inspect infiltration, neighbor
transfers, boundary outflow and retained receiving space. Save the original
investigation to keep the complete source project and capacity declaration.
Reopening recomputes from those inputs and does not replace the working site.
Edits retire the previous result; a late file read cannot replace a newer draft.

## Mechanism and boundaries

The optional maintained runRain input is options.infiltrationStorage:

    {
      "schema": "experimental-earth-closed-infiltration-store/1",
      "surface": "garden",
      "remainingCapacityMm": 5,
      "source": "Explicit hypothetical closed receiving layer"
    }

For each affected cell, let C be the declared receiving space at event start and
F the infiltration accepted so far. The maintained rate or wetting-front model
offers a nonnegative infiltration increment I. The accepted amount is

    accepted = min(I, max(0, C - F))
    F_new = F + accepted

The rejected amount remains in the existing surface state before neighbor and
boundary routing. Local/global accounts and passive forward/reverse rainfall
tracers receive the same accepted amount. A wetting-front model likewise advances
its cumulative infiltration only by that accepted amount. Other surfaces keep
their existing behavior. The source declaration never changes the original cells.

C is **remaining receiving space**, not total porosity, root-zone available water,
a fitted soil parameter, or an automatically inferred property of “garden.”
Each affected cell has its own equal declared capacity; it is not a shared tank.
The layer is closed for this event: no drainage, recovery, evaporation or lateral
groundwater exchange. An ordinary permeable deep soil with ongoing drainage need
not behave this way. Existing rooted-water consumers retain their distinct,
post-infiltration drainage assumptions. This study does not silently feed them a
capacity-limited source or adopt a soil hypothesis.

The browser comparison uses the source maps' default constant surface rates.
The lower-level solver can combine the cap with its existing explicit rate
overrides or wetting-front option. Original depth observations are retained as
source inputs, but this comparison does not fit the capacity or score a model
against those readings.

The baseline solver, time grid and routing approximation are unchanged.
Time-step sensitivity, omitted processes and lack of physical calibration remain.
The four-run consumer admits at most one million cell-steps and a 5 MiB original
input file. These are computational limits, not an environmental validity claim.

## Independently calculated example

Four closed, flat 1 m² cells receive 36 mm/h for one hour and are followed for
four hours. Existing sealed cells accept 1 mm/h; proposed garden cells accept
24 mm/h. With unlimited receiving space, the proposed cells absorb all 144 L.
With 5 mm remaining space per proposed cell, they can accept only 20 L, leaving
124 L above ground. Existing standing water is 128 L. The modeled proposal
therefore reduces final standing water by 4 L under the closed-store declaration,
versus 128 L under unlimited receiving. No boundary water exits this authored case.

Changing the declared capacity to 20 mm gives 80 L accepted and 64 L standing.
Zero space agrees with zero infiltration on the selected surface. A sufficiently
large unused capacity reproduces all pre-existing water results bit for bit.

These numbers are analytic controls and implemented model outputs, not field
measurements or evidence that a real intervention will produce the same effect.

## Verification

- Run node --test tests/infiltration-storage.test.mjs for 192 independent
  closed-column supply/rate/capacity cases, the proposal consequence, zero/large
  and absent/dry controls, wetting-front state, routed local/global conservation,
  forward/reverse tracer agreement, source immutability, input-only replay and
  malformed/over-budget refusals.
- Run node --test --test-concurrency=2 tests/*.test.mjs for existing consumers.
- Run CHROME_BIN=/opt/google/chrome/chrome node tests/infiltration-storage.receiving.mjs
  through the maintained sandbox-verified Linux browser owner. It exercises original
  site use, analytic displayed values, real download and fresh-page file reopen,
  changed capacity, forged saved results, a delayed-file negative control,
  source changes, inert attribution text and desktop/390 px captures.

Source implementation and passing model tests establish bounded computational
behavior. They do not establish independently measured physical accuracy.
