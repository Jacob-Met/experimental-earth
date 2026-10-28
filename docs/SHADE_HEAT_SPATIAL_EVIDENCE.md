# Two original readings, one shared sky

Open **Use two original readings to constrain one shared sky** in the existing temperature-band inquiry, or open `sky-spatial-evidence.html` from the ordinary Earth runtime. The independent page uses two original saved ground points to constrain one explicitly shared static directional sky. It compares the existing and proposed designs at the point you choose.

## Work with original evidence

1. Save an original reading-input file from the existing one-band inquiry for each of two distinct receivers. Each reading must describe the existing ground surface at that original investigation's final UTC. Each file retains its site, dated forcing, fixed thermal properties, starting temperatures, reading band and attribution.
2. Choose both files together. Select the point where the paired design consequence should be reported. Each source card shows its own original temperature, band, point, time and source.
3. Choose 4, 8 or 16 common equal-azimuth sky bins, and state the basis for sharing one static sky across both original courses. The original bin choice inside each input remains unchanged; the new common choice belongs to this inquiry.
4. Select **Compare both readings**. Inspect the surface and lower-store ranges, compare them with the first reading alone, and inspect either endpoint's shared profile. The witness table shows both reading checks, the same nonzero sky masses and the paired design temperatures at the comparison point.
5. **Download original inputs** retains both original reading envelopes and the common-sky question. Reopening recomputes the complete investigation. It saves no calculated profiles or verdicts.

The original nonthermal site records, obstruction geometry, orientation, dated forcing, raw weather and original sky declaration must agree exactly after the maintained source parser. Matching titles do not establish that two places or courses are the same. The receiver and thermal declarations can differ: each point retains its own fixed surface and lower-store properties and initial temperatures. The common-sky attribution records a user assumption; the application does not authenticate common conditions.

The standalone page leaves the working site unchanged. A failed pair or bundle replacement retains the previous accepted inquiry. An edit retires pending file batches and worker results. Changing the comparison point reorders the two complete original envelopes rather than relabeling an old result. Downloads remain disabled while work is pending.

## What the authored courtyard demonstrates

**Try an authored courtyard** opens a source-only example with a four-by-four grid of two-metre cells. The existing mapped column is at A2 and the proposed column at C2, each three metres high. The paired consequence is initially requested at B2. The two authored existing-surface bands are:

| Original receiver | Final temperature band |
| --- | --- |
| B2 | 23.286786013034295 ± 0.1 °C |
| A3 | 24.56935628175834 ± 0.1 °C |

For the eight-bin family, B2 alone permits a final proposal-minus-existing surface difference of approximately **−0.2 to +2.66514054 °C**. Including A3 changes the range to approximately **+0.98257027 to +2.66514054 °C**. Under these declared assumptions, the additional observation rules out the small-cooling part of the first family.

All **64** joint vertices in this control have **three nonzero bin masses**. No one-bin or two-bin vertex meets both bands. Checking only the one-band edge mixtures would therefore incorrectly report an empty family. Replaying all 64 mixtures through both original thermal courses gives a maximum observed endpoint difference of 7.11e−15 °C from the affine calculation on this control. That comparison is numerical evidence for this implementation, not a bound on physical accuracy or on every input.

A different point can add no consequence information. An independently exercised original A1 control leaves the first reading's surface range unchanged. The interface reports the computed ranges without promising that a second reading will narrow them. A band outside the common family produces a completed incompatible result, retaining both originals and offering no surviving range.

These are authored software controls. No field temperature or sky data were acquired for this example.

## Complete two-band mechanism

Let λ contain the nonnegative common bin masses, with sum one. The two original one-bin bases give represented final existing-surface coefficients aᵢ and bᵢ. The common family satisfies

```math
L_1 \leq \sum_i a_i\lambda_i \leq U_1,\qquad
L_2 \leq \sum_i b_i\lambda_i \leq U_2,\qquad
\lambda_i\geq0,\qquad \sum_i\lambda_i=1.
```

Each band endpoint is the exact rational sum or difference of the supplied binary64 center and half-width. Each slab contributes at most one independent active boundary. A vertex with k positive masses has k−1 free simplex dimensions, so k is at most three after these two independent restrictions. The complete construction therefore includes:

- Admitted original one-bin vertices.
- Two-bin edge intersections with every distinct boundary of either slab, checked against both slabs.
- Three-bin triangle intersections with one boundary from each slab, found by an exact two-by-two determinant and checked for positive masses and both bands.

Dependent or constant observation rows do not create independent triangle constraints. Their lower-support vertices are covered by the preceding cases. Zero-width bands retain one distinct boundary. Exact support-and-mass deduplication removes repeated vertices without merging different represented profiles.

For N bins with two nonzero-width bands, the conservative candidate ceiling is `N + 4·choose(N,2) + 4·choose(N,3)`: **2,736** at 16 bins. The course checks at most 120 pairs and 560 triangles. This bound covers all admitted vertices, rather than truncating a larger candidate list.

For each candidate, both design endpoints use that same shared profile. The paired lower objective is proposal lower minus existing upper; the upper objective is proposal upper minus existing lower. Surface and lower-store extrema are selected separately. All candidates enter all objectives. The inspector retains only the distinct extremal witnesses, whose deterministic IDs may be noncontiguous. Different component extrema need not occur under the same profile.

## Original courses, admission and limits

Both complete original shared-profile bases run before either reading is applied. Every existing final-surface observation endpoint must agree exactly under the maintained lower and upper forcing courses at both points. If any endpoint remains unresolved, the whole inquiry refuses rather than selecting a favorable endpoint. A failed original basis likewise refuses the whole inquiry.

Each original retains the existing course limits. The two-source admission accounts for the combined geometry under the unchanged 16-million allowance, at most **128** complete thermal courses and **3,072** course intervals. It retains the **5 MiB** original-input limit and unchanged **4,096-bit** rational capacity guard. Work counts are bounded algorithmic counts, not elapsed-time guarantees. No partial surviving range is accepted after a refusal.

The source-only format is `experimental-earth/shared-sky-spatial-reading-inputs/1`, with exactly `kind`, `model`, `readings` and `query`. `readings` contains two complete original `experimental-earth/shared-sky-final-reading-inputs/1` envelopes. `query` contains only `bins` and `sharingSource`. Unknown fields, saved reports, altered observation roles, wrong original receivers or times, duplicate receivers and different site/forcing records refuse.

Exact fractions solve the finite represented-coefficient problem. Geometry and thermal integration remain the existing binary64 computations. This does not certify their errors, authenticate the two sources, identify the actual sky, infer new materials or initial states, or establish physical intervention performance. The same static profile applies over the entire original dated course; there is no time-varying sky inference, lateral transfer or peak-over-time optimization here.

## Verification

The portable native course checks the required three-bin mechanism; constant/dependent/empty families; source-only roundtrip and nonmutation; original-bin and receiver retention; complete thermal witness replay; strict source and report refusal; unresolved endpoints; and original work admission. Run:

```sh
node --test tests/shade-heat-spatial-evidence.test.mjs
python3 tests/shade-heat-spatial-evidence-independent.py
```

The independent Python Fraction oracle uses full-dimensional active inequalities and Gaussian elimination, rather than the production pair/triangle construction. It reproduces all 412 vertices over 125 cases and 384 objective pairs, including degenerate rows, subnormal and widely scaled coefficients. A separate independent review of the actual authored source bases reproduces all 64 joint vertices and all four paired extrema. The source-prototype qualification also retains a no-gain point and replays every joint mixture through both original thermal courses.

`tests/shade-heat-spatial-evidence.browser.mjs` exercises the actual maintained sandboxed browser and worker, two original file inputs, original-bin history, comparison-point changes, noncontiguous witness selection with the keyboard, real downloads and fresh-document reopen, delayed files and held worker responses, incompatible and malformed-source behavior, and desktop/390px layouts. The original one-band browser course remains a separate receiving gate for the small discovery link.
