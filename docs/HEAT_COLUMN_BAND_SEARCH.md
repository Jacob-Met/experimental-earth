# Find proposals within original temperature bands

The hidden-store search now offers two explicit methods. **Normalized-residual
local search** retains the original Gauss–Newton behavior. **Find proposals within
original bands** offers a complementary finite search when the earlier method
finds no compatible explanation, particularly with sharply unequal supplied
reading widths. Both use the same original project and declared parameter domain.

Neither method alters a reading, source, band, role, initial temperature, surface
property or exposure. Every tested proposal remains inspectable, including failed
ones. The same **Edit this proposal as an alternative** action opens a numerical
proposal in the existing evidence draft; ordinary explicit save/compare remains
required. The domain source is copied exactly, including a full600-character
source, and the label identifies the proposal as inferred. A numerical proposal
is not a measurement.

## Bounded mechanism

`searchHeatColumnBands(project, query)` reuses `validateHeatSearch`, the original
25-point coarse grid and the maintained `evaluateHeatColumnHypothesis`. Thus it
uses the same complete-course temperature admission, original instantaneous or
interval-mean operator, signed energy accounts and separate arithmetic guards.
The maximum is400total evaluated proposals, with the same complete preflight
work bound as the original method.

Select the narrowest calibration reading; original order breaks width ties.
For each of nine log-capacity slices, evaluate conductance at normalized
0,1/64,1/16,1/4,1/2,3/4,1. Each detected anchor-center sign crossing is bisected at
most28times, retaining all tested points. Low-conductance probes help reveal the
nonmonotone cooling response observed in the maintained model. The original
calibration bands screen every proposal, not just the anchor reading.

After those slices, make at most eight local capacity-narrowing rounds around
the best original-band candidate, finding conductance crossings again at each
new capacity. Ranking uses the maximum normalized calibration residual. Local
ternary narrowing is a heuristic, not a proof of unimodality. The complete shared
400limit may end any stage; `stopReason` states whether finite sampling completed
or the evaluation budget stopped it. All original coarse proposals are preserved.

Challenge values, times and roles never select the calibration anchor, sampled
points, crossings or ranking. Each remains an independently visible check for
every offered proposal. Absence of calibration produces no search. No fitted
property is silently adopted.

## What this does not establish

Finite sign brackets can miss tangencies, multiple crossings inside one sampled
interval, feasible anchor values away from the sampled center, or unsampled
capacity regions. This does not enclose a continuous feasible set, establish a
global optimum or prove there is no explanation when no proposal is found.
Broad or uninformative readings can retain many alternatives. The retained
numerical guard is not a certified enclosure or measurement uncertainty.
A complete-course model refusal aborts the inquiry rather than being counted as
a rejected physical explanation.

## Evidence

An authored C91000J/(m²·K), G17.3W/(m²·K) control retains one ±0.001°C reading at
27minutes and two ±2°C bands at81/143minutes whose centers are shifted+1.5°C.
The original target remains feasible. The merged normalized-residual method
finds no compatible proposal; this method retains67among400evaluations in the
local Node course, with no coarse-grid compatible proposal. These are conditional
model/software controls, not acquired observations or identified material values.

Across40known-feasible point controls, normalized-residual search finds24;
a squared-hinge derivative prototype finds28; fixed capacity bracket sampling
finds39; bounded local capacity refinement finds40. On36separately seeded
interval-mean controls with the narrow anchor rotated among three windows,
the original method finds29and the new method finds36. All new-method courses
remain within400evaluations. A nonmonotone75-minute cooling control retains
compatible conductances on both sides of its interior temperature minimum,
rather than assuming the anchor has a unique root.

Independent review also exercised12much wider C1000–10000000/G0–1000domains,
replaying4723tested candidates through the maintained evaluator and checking
every original compatibility decision. Eleven found a compatible proposal; one
known-feasible point control atC1350.32286/G405.91900 exhausted400without finding
one. The original Gauss–Newton mode finds6compatible proposals in393evaluations
for that same case. The methods are complementary; the new mode does not dominate
the original. This informative miss is retained: the76/76result above applies to its
stated narrower cohorts, not every admitted domain. Twelve changed challenge
time/window controls preserved the exact proposal sequence and calibration.

Negative controls retain no-calibration nonexecution, exact initial-state
ambiguity, impossible initial readings, source-only replay and challenge
invariance. The original NOAA nine hourly means remain an informative failure:
the new method finds0compatible among175tested proposals in the declared
C10000–1000000/G0–100box, without changing original authored initial/surface
assumptions or the illustrative ±0.5°C bands. This is not a rejection of all
continuous parameter values or of the physical model class.

## Saved input and receiving

Downloads retain only original project, domain and explicit method identity.
The new method is `bounded-heat-band-brackets/1`; the earlier
`bounded-heat-gauss-newton-search/1` remains supported without reinterpretation.
Reopening restores that method and recomputes. Unknown method identities and
injected answers refuse; a failed reopen cannot report a prior result as success.

```
node tests/heat-column-band-search.test.mjs
node tests/heat-column-search.test.mjs
CHROME_BIN=/path/to/chrome node tests/heat-column-band-search.browser.mjs
CHROME_BIN=/path/to/chrome node tests/heat-column-search.browser.mjs
```

The new browser course exercises the same original input first with the prior
no-proposal result and then with band-compatible proposals, real download/fresh
reopen with method identity, source-preserving draft adoption and ordinary save,
invalid output/refusal controls and desktop/390px inspection. The earlier browser
course remains a separate regression of the merged original method.

## Optional combined family

The same consumer can [retain the complete focused family and add complementary sampling](HEAT_COMBINED_BANDS.md), at up to 800 actual evaluations. Every incumbent explanation is preserved. This broadens finite exploration without claiming continuous coverage; original methods remain unchanged.
