# Infer a common later change in the paired gap

After inferring an original earlier linear region, open **Could one common
later gap shift explain the original readings?** and compare the stated response
model. All original earlier and later bands constrain one shared slope and one
constant added later gap. No list of candidate slopes or shifts is required.

This is a conditional descriptive model, not an intervention-effect estimator.
A change in the between-place gap can reflect weather, measurement, maintenance,
other changed conditions or an intervention. The source association and a
continued linear relation are assumptions. Compatibility does not establish
causation or physical validity, and incompatibility does not identify its cause.

## A shared response is stronger than separate residual overlap

In an authored control, earlier gaps are 0 at day 0 and [-1,1] at day 1.
Later gaps 3 and 4 at days 2 and 3 have separate residual envelopes [1,5]
and [1,7]. A single shared earlier slope and later shift narrow the common
shift to exactly 1: the later difference requires slope 1. If the last gap
becomes 1 instead, separate envelopes [1,5] and [-2,4] overlap, but no
constant shift with the same earlier slope explains both. The required later
slope would be -2, outside the earlier support. These controls are authored
software examples, not measured environmental outcomes.

## Exact projection with no parameter grid

The declared relation is a+b*t before the intervention and a+b*t+d afterwards,
where t is days since the earliest original pre observation. The earlier
intercept/slope region remains unchanged. Later observations constrain only
this separately compared response model; no fitted value replaces the earlier
support or its original residual envelopes.

The mechanism eliminates the common intercept a. Within either period, every
pair of bands constrains the shared slope b exactly as in the maintained
earlier-region inference. A pre band [L_i,U_i] and post band [L_j,U_j]
require L_j-U_i-b*(t_j-t_i) <= d <= U_j-L_i-b*(t_j-t_i).
All within-period and cross-period inequalities together are sufficient:
at fixed b,d the shifted intervals for a have a common point exactly when
every pair overlaps. This is a one-dimensional interval intersection fact,
not a statistical-independence assumption.

Finite earlier slope bounds and one original cross-period pair give a bounded
initial slope/shift rectangle. The unchanged Chronos exact half-plane clipper
intersects it with every original cross-period constraint. The complete
supported polygon, segment or point remains available; shift extrema are
taken over this joint region. A shared-slope contradiction or empty region
reports no supported shift. No guessed search box, grid truncation, least-squares
fit or automatic adoption is used.

Exactness concerns the supplied binary64 numbers and integer UTC times. Full
records retain rational endpoints and outward binary64 enclosures. Overview
labels are rounded; they do not decide status or sign. This does not recover
pre-JSON decimal text, authenticate sources, infer correlated errors or create
statistical confidence. The unchanged rational arithmetic limit still applies.

All original input admission comes from the existing paired-series/region
consumer. At most 1953 within-period pairs and 1024 cross-period pairs are
admitted. Earlier construction and subsequent projection share the 200000
constraint-check ceiling. A capacity failure refuses the entire response
result; no partial shift optimum is reported.

## Source custody and ordinary receiving

The default source is the current accepted original earlier region. A deliberate
button selects this constant-later-gap-shift model; it does not change the
working site. Parent edits retire the result. Download contains only the
original workspace, original region inputs and explicit response-model tag.
Reopen recomputes independently without changing the active workspace. Its
source label states **own reopened source**; switching to current source is
explicit. Late file reads cannot override a newer source choice. Original
inputs and the maintained 4 MiB transfer ceiling remain local to the browser.

## Proof and limits

`node tests/paired-trend-shift.test.mjs` exercises the shared-response positive
and overlapping-but-incompatible examples, source immutability, original-only
replay, original ordering, changed later readings with unchanged earlier
support, and complete pair/cross/constraint/model refusals. The independent
Python Fraction oracle enumerates intersections of three original constraint
planes in (a,b,d), without using the production projection or polygon clipper.
It checks feasibility and both shift extrema for 60 unfamiliar five-pair
courses with irregular times and nonzero comparison baselines (33 compatible).
Python is a test oracle only, not part of browser execution.

`node tests/paired-trend-shift.browser.mjs` exercises original series to region
to response inference, original-only download/fresh reopen, changed later
evidence, preserved active workspace, unsupported-model refusal, delayed-read
exclusion and desktop/narrow fit. Native and browser execution receipts belong
with the publication PR; test source alone does not establish receiving or
physical validity.
