# A prospective reading for inferred lower-store peak spread

Issue #339 adds a separate acquisition objective to the inferred-proposal search. It uses every distinct calibration-compatible proposal returned by either maintained bounded search, without transcribing a selected few into the editable alternative list. The existing offered-alternative question planner keeps its settings, pair-count objective and panel. Its existing engineering guard is exposed through one additive export alias and reused unchanged.

## Ordinary path

1. Save the original place, two-store exposure and sourced surface readings.
2. Infer proposals using either search method and a sourced capacity/conductance domain.
3. In **Which reading could narrow the hidden-store peak?**, declare an available acquisition window, 2–241 sampled times, a prospective temperature half-width, instantaneous or interval-mean operator, and a source/plan for access and precision.
4. **Find a reading for peak uncertainty** recomputes the bounded search and evaluates all distinct compatible proposals. The page reports the before and worst-after conditional peak spreads, selected time/window, excluded original supports and every sampled time's result.
5. Download original planning inputs. The peak-question reopen control is available directly on a fresh page; it recomputes without replacing the working place, measurements or offered alternatives.

An earlier unrecorded exposure time is not automatically available for a future observation. The default starts after the latest retained reading where the exposure permits it. Users must source their allowed acquisition window; an earlier time requires an appropriate repeat exposure or archival source. No sensor action, new measurement or adoption occurs.

## Objective and finite-set identity

For proposal i, let pᵢ be its computed maximum lower-store temperature over the complete retained exposure, including the maintained interior-extremum checks. At sampled time t, let Bᵢ(t) be its prospective surface-reading interval: the maintained point or interval-mean prediction, plus/minus the declared half-width and existing separate engineering allowance.

For a possible reading y, the conditional set contains every proposal with y in Bᵢ(t). Its peak spread is the maximum p minus the minimum p. The worst conditional spread equals the largest |pᵢ−pⱼ| among pairs whose closed prospective intervals overlap. Single-proposal conditional sets have spread zero.

This equality follows in both directions: the extreme pair in any conditional set shares its reading y, and any overlapping pair has a possible shared reading. It does not assume all pairwise relationships are transitive. Exact touching endpoints remain compatible.

Choose the sampled time with the smallest worst conditional spread; ties retain the earliest requested time. The before range uses all distinct compatible proposals. Duplicates cannot weight or improve this objective. The implementation deduplicates exact capacity/conductance pairs before prospective course evaluation. It does not average candidate predictions or assign them probabilities.

A separated-pair-count objective can make a different decision: an independently tested four-proposal example has one time separating five pairs but leaving a possible peak spread of 100, while another separates only three pairs but leaves a worst spread of 2. Both objectives can be valid for different purposes; the original pair-count planner remains available unchanged.

## Conditional boundaries

The search is finite, budgeted and incomplete. Its compatible proposals do not enclose the continuous parameter domain. The reported range and reduction concern only that finite proposal set, under the fixed original surface properties, initial temperatures, exposure, search method/domain and assumed future precision. They are not probabilities, certified numerical bounds, physical guarantees or a globally optimal measurement time.

The peak is a numerical maximum under the existing model. The prospective engineering allowance is not a statistical uncertainty model. A future reading outside all proposed bands would challenge this finite set; it would not count as successful narrowing. No-compatible and no-calibration inputs produce no recommendation. Broad precision, identical target peaks or a single compatible proposal can truthfully produce no range reduction. Unsupported arithmetic, collapsed sample times and work beyond the shared budget refuse before partial answers are presented.

Calibration compatibility alone chooses proposals. Held-aside values never rank proposals or prospective times. All original observation supports, including held-aside and interval-mean windows, are excluded from prospective supports without examining their values. Changing those supports can legitimately change which times are available. Neither role labels nor nonoverlap establish physical acquisition independence.

## Work and source identity

The planner preflights the maintained search reservation plus the worst prospective workload for 400 proposals and the requested time/window grid against 2,000,000 course-samples. Pair comparisons are separately bounded by at most 400 proposals and 241 times. It evaluates the complete requested finite set or refuses; it never silently truncates proposals or times.

Raw source format `inferred-heat-peak-minimax/1` contains only method, original project, search query and planning settings. Settings retain the exact acquisition source (up to 600 characters), search method, acquisition window, grid, operator and assumed precision. The existing project retains original reading sources and association; the query retains the domain source. Files with added derived results, another method or more than 6 MiB refuse. Editing a planning field or changing the parent search/place retires the output. Reopen uses isolated original inputs and never replaces the saved working project.

## Evidence

All values below are authored software/model controls, not acquired physical observations.

- The unequal-band control from #335 yields 67 distinct compatible proposals spanning 6.0739124813°C in lower-store peak. On the sourced future window145–420 after the latest original143-minute reading, prospective ±0.25°C precision selects145minutes and leaves worst conditional spread1.5448059271°C. At ±100°C, no sampled time reduces the range.
- A broader allowed5–420window selects85minutes and leaves0.8054753458°C. That earlier time is only usable with an appropriate acquisition basis; it is not asserted available after143minutes.
- 1,000 seeded finite interval sets match independent enumeration at every endpoint and between endpoints. Duplicate and permutation controls preserve objective values. Closed boundaries and nontransitive overlaps are covered.
- Maintained-operator tests cover original source immutability, all compatible candidates, held-aside value independence, existing point/mean support exclusion, prospective interval means, contradiction/no-calibration/no-unrecorded-time,600-character source replay and cost/format refusals.
- Actual sandboxed browser receiving covers original import→inference→future-window planning, source-only download and direct fresh reopen, broad-band no-reduction, forged result rejection, averaging operator, desktop/narrow layout and keyboard, and contradictory original evidence without working-source mutation.
- Existing offered-question native and browser courses and the original search/editable-handoff browser course remain regression gates.

Run `node tests/heat-column-peak-range.test.mjs`, `node tests/heat-column-peak-question.test.mjs`, and `node tests/heat-column-question.test.mjs`. The new browser course is `tests/heat-column-peak-question.browser.mjs`; it uses the maintained owned-process sandbox qualification and accepts `CHROME_BIN` and `BROWSER_RUN_DIRECTORY`.
