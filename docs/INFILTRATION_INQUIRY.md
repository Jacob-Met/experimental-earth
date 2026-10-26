# Complete-grid infiltration inquiry

In **Test it against a reading**, choose **Complete grid** and **Find infiltration
check** to compare each proposed cell's two authored material-range endpoints.
The selected location maximizes the modeled change in final stored water plus
edge outflow, retaining the existing deterministic 1e-9 litre tie rule. It does
not estimate information gain, measured soil properties, physical accuracy or
effects between those endpoints. The separate depth form still records actual
water depth, not an infiltration-rate measurement.

The old 36-cell heuristic could return no location on grids larger than 96 cells
even when an omitted cell changed the model. A 12 by 12 flat course with 143
garden cells, one sealed cell at index 78, and 10 mm/h rain for 15 minutes over
45 minutes is one concrete example. The old shortlist returns null. Complete
evaluation finds index 78, whose two authored rates change the modeled output
by 0.6345256532362199 litres. This is an authored numerical counterexample,
not a measured site or a hydrologic accuracy result.

## Coverage, work and cancellation

Complete coverage is the default. **Quick shortlist** is an explicit optional
choice preserving the existing heuristic and its ordering. Every result,
including a no-effect result, reports evaluated and total cells. A partial
no-effect result leaves untested cells unknown. A completed full result only
addresses the tested endpoints and output quantity.

Both modes admit at most 12,000,000 nominal cell-steps. The bound is
`(2 * candidates + referenceRuns) * cells * (ceil(duration / step) + 1)`;
the shortlist uses one reference run on grids above 96 cells. The extra step
covers floating step accumulation. This is a work-admission proxy, not a
latency, CPU-operation or memory guarantee. An over-budget inquiry evaluates
zero cells and never silently switches coverage. Shortening the modeled event
changes the question; choosing a shortlist changes the coverage.

The ordinary browser runs the inquiry in an owned module Worker using an
immutable project snapshot. Progress is visible beside the action. **Cancel
inquiry**, a changed coverage choice, or any project rerun terminates the worker
and retires its result. Serial/worker identity checks also reject late messages.
An unavailable worker is an explicit failure; there is no blocking main-thread
fallback. Only a completed current result selects a cell. Inferred results are
not written into the portable source project.

The existing `chooseInfiltrationObservation(project, target)` API retains its
shortlist/null behavior. `infiltrationObservationSteps` shares the unchanged
per-cell endpoint mechanism. The new `createInfiltrationInquiry` and
`runInfiltrationInquiry` wrappers retain complete/partial coverage and a distinct
capacity disposition, including when no winner exists.

## Reproduce the evidence

```sh
node --test tests/core.test.mjs tests/infiltration-inquiry.test.mjs
CHROME_BIN=/usr/bin/google-chrome-stable \
BROWSER_RUN_DIRECTORY=/tmp/my-new-infiltration-receiving \
node evaluation/infiltration-inquiry-browser.mjs .
```

Use a fresh receiving directory and a Chrome binary preserving its sandbox.
The unchanged maintained admission helper verifies active Linux namespace and
seccomp protections before the actual browser course.

Six focused native groups cover the omitted-cell counterexample, ten unfamiliar
rain/material/location/slope courses against an independent complete original
solver oracle, the largest admitted grid, work refusal, source snapshot/edit
isolation, both scenario targets, dry/full/partial outcomes and tie semantics.
Independent team review additionally found eight misses among thirteen authored
legacy-shortlist courses; failures and genuine dry/no-effect controls were
retained separately from capability gains.

The maintained browser course checks the changed ordinary action, explicit
partial no-effect reporting, a new original that changes the visible winner,
dry results, cancellation after real progress while the map remains interactive,
edit retirement, capacity without worker startup, unavailable-worker refusal,
and 390px keyboard operation. Original material/weather/observation inputs stay
unchanged. Desktop/narrow screenshots and active-sandbox receipts accompany
each run. One observed 144-cell receiving inquiry took about 234 ms including
browser coordination; that single diagnostic is not a benchmark guarantee.

An initial browser receiver failed its final synthetic keyboard step after
eight successful groups. The receiver now fences a genuinely fresh document
after reload and sends the Enter character as well as its key event. No product
fallback or assertion was weakened. Visual inspection then moved the inquiry
status beside its action, ahead of the independent measured-depth form.
Exact publication and final receiving identities are recorded with the PR.
