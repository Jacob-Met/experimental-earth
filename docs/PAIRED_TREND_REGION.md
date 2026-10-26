# All earlier linear trends from original paired bands

In the original paired-series investigation, open **What do all compatible
earlier linear trends imply?**. State why a continued linear between-place
relation is worth investigating, then infer its complete support. The existing
constant-gap and explicitly offered finite-slope investigations stay available.
This path removes the need to guess a finite list of plausible slopes.

Original pre-intervention pairs alone constrain one common intercept and slope.
Every later pair receives a conditional residual envelope over that complete
joint region. The computation does not pick a best line, use later values to
fit the earlier history, or adopt a parameter. A continued linear relation is
an extrapolation assumption; its compatibility cannot establish a causal
intervention effect, absence of confounding, or physical validity.

## Mechanism and exact boundary

Let original gap bands be [L_i,U_i] at elapsed days t_i, with the earliest
pre-observation at zero. A linear gap a+b*t is admitted when every original
pre band contains it. For each earlier/later pre pair i,j, the admissible
slope obeys (L_j-U_i)/(t_j-t_i) <= b <= (U_j-L_i)/(t_j-t_i).
The intersection of all such bounds is exact: at a fixed slope, all shifted
baseline intervals share a point if and only if every pair overlaps.

An empty slope intersection rejects the declared linear history and produces
no later residual. Otherwise its finite endpoints and the earliest original
gap band bound an initial intercept/slope rectangle. The unchanged maintained
Chronos exact half-plane clipper intersects that rectangle with every original
pre band. This retains a polygon, a segment, or a point without a guessed
parameter box or grid. The original pair indices attaining both slope bounds
remain visible. A boundary result is not unique physical identification.

At each later time, affine predicted gaps attain their extrema at joint-region
vertices. Subtract those extrema from the original later gap band. Independently
combining marginal intercept and slope ranges would lose their dependence and
can give unnecessarily wide bounds. For pre bands [0,2] at days 0 and 1,
day-20 prediction is [-38,40], whereas independent marginals give [-40,42].
These numbers are an authored software control, not a measured study.

The unchanged [vendored exact implementation](../vendor/chronos/PROVENANCE.md)
operates on the exact supplied binary64 values and integer UTC milliseconds.
Every expanded endpoint includes exact numerator/denominator and outward
binary64 enclosures. Overview numbers are rounded and never decide feasibility
or sign. This does not recover original decimal text, verify observation sources,
or infer correlated sensor error. Original bands remain independently permitted
values, not probability distributions or confidence intervals.

Admission reuses the maintained original-series validation: 2 or more pre
pairs, at least one later pair and at most 64 total. Pair comparison is bounded
by 1953 checks, exact polygon clipping by 200000 constraint checks and the
maintained 4096-bit arithmetic ceiling. Capacity failures return no partial
region. No observation is dropped to obtain a successful result.

## Original-source receiving

The child uses the current accepted paired series by default. Source/draft
changes retire its displayed result. Download contains the original workspace,
series and explicit continuation basis, with no derived polygon or verdict.
Reopening recomputes independently and preserves the active workspace. Its
source label states **own reopened source**; switching back to the current
accepted series is explicit. A late file read cannot replace a newer draft.
The original-input bundle shares the maintained 4 MiB file ceiling.

## Verification

`node tests/paired-trend-region.test.mjs` checks omitted finite-slope support,
point/segment/empty regions, joint versus marginal envelopes, later-value
independence, original-source immutability, unsorted inputs, replay and complete
work refusal. An independent Python Fraction oracle enumerates intersections
of every pair of original constraint lines for 80 unfamiliar courses and checks
complete vertex sets and later bounds. Python is only a test oracle.

`node tests/paired-trend-region.browser.mjs` exercises the actual maintained
paired-series consumer, keyboard inference without slope entry, changed
original bands, incompatible histories, raw download/reopen, active-site
preservation, draft retirement, delayed-read exclusion and desktop/narrow fit.
Use the existing PLAYWRIGHT_MODULE, BROWSER_EXECUTABLE_PATH and
BROWSER_ARTIFACT_DIR receiving controls with a sandboxed supported browser.
Execution receipts and published-source verification belong in the native PR;
the commands here do not assert an unrun browser or field result.
