# Complementary depth readings

In the infiltration workbench, expand **Plan complementary depth readings** after retaining a candidate study and calibration readings. Supply a prospective ± depth tolerance and a budget of one to three readings. The planner retains only calibration-compatible rates and inspects the existing solver snapshots. Held-aside values cannot select questions, improve candidate support or rescue a calibration-rejected candidate. All previously recorded coordinates for that scenario are excluded regardless of their evidence role.

At each step, the planner selects the point distinguishing the greatest number of previously unresolved pairs. Two predictions distinguish a pair only if their prospective tolerance bands are disjoint beyond a numerical guard of `1e-9 × max(1, predicted depths, tolerance)` mm. Touching bands do not count. Earliest time, then lowest cell index, breaks ties. It stops when no additional pair can be distinguished or the budget is exhausted. A separate list retains every unresolved pair.

This is a deterministic greedy coverage heuristic, not a globally minimal experiment set, expected information gain, probability or an adaptive policy conditioned on future results. A pair can be distinguished at one point while other pairs require different points. Each question gives all candidate predictions and the extra distinctions it contributes. Nothing removes a candidate or supplies an actual measurement. **Prepare reading** reuses the notebook's existing action: scenario, cell, minute, held-aside role and tolerance are filled; old depth and source drafts are cleared. Enter the actual depth and source yourself.

The model's spatial/time discretization and physical errors are outside the prospective tolerance. Proposed observations may be practically unavailable. Distinguishing all finite alternatives does not establish a unique physical infiltration rate. The planner does not propagate terrain, forcing or outlet uncertainty. Questions are temporary and invalidated by changed project or query inputs; ordinary saved source can be reopened and recomputed.

## Executed-model control

On the maintained authored courtyard, set rain to 12 mm/h and turf candidates to 0, 3, 9, 22 mm/h. An authored zero-depth calibration control at minute 0 retains all four; it is not acquired field evidence. With ±4 mm prospective tolerance, F2 at 45 min distinguishes four pairs. The depths are approximately 16.0927, 13.2061, 4.48065, 0 mm. F2 at 235 min adds the 0/3 mm/h pair (8.22840 versus 0.170720 mm), taking coverage to five of six. The 9/22 pair remains unresolved. A single large-span question cannot substitute for the second time's additional distinction.

The combined calibration and question simulations are admitted conservatively before execution against one million estimated cell-steps. At most nine candidates and three questions are supported. Equal separation patterns keep their earliest coordinate, reducing repeated scanning without changing the defined greedy choice.

Run `node --test --test-isolation=none tests/complementary*.test.mjs` for independent synthetic coverage and actual maintained-solver controls. Run `CHROME_BIN=/path/to/chrome node tests/complementary-depth.browser.mjs` for source import, actual paired questions, keyboard notebook preparation, changed-input invalidation, reload and narrow layout. Browser execution must pass maintained sandbox admission.

## Jointly choose at most two readings

Choose **Best joint plan of at most two readings** in Planning method to compare
all singleton and unordered pairs of distinct separation patterns. The default
remains the original greedy one-to-three-reading method. The joint method
maximizes the number of hypothesis pairs having disjoint prospective bands at
at least one chosen coordinate. Equal coverage prefers fewer readings, then the
earlier ordered time/cell tuple. No weak differences are summed, no observations
are assumed statistically independent, and no rates are adopted.

Coordinates with exactly the same separated-pair set are equivalent for this
objective. Keeping their earliest coordinate preserves the optimum and tie rule;
it does not discard any separation pattern or shortlist locations. Two 32-bit
words retain all 36 possible pairs for nine hypotheses. The complete singleton
plus pair count must fit one million evaluations before enumeration begins.
An oversized family is explicitly refused; no partial search is called optimal.
This bound is separate from the existing complete trajectory and solver budgets.

On the authored courtyard, with existing turf rates
0, 1, 3, 6, 9, 15, 22, 40 and 60 mm/h, rain 24 mm/h and prospective tolerance
±2 mm, the greedy two-reading plan distinguishes 33/36 pairs. Joint selection
chooses F6 at 40 minutes and C2 at 120 minutes and distinguishes 34/36, examining
8,128 singleton/pair plans over 127 distinct patterns. Two pairs remain unresolved.
This is a software model experiment, not acquired environmental evidence.
The original four-rate, 12 mm/h example showed no coverage gain across eight
examined tolerances: the extra search is not automatically useful.

The optimum is conditional on this finite offered grid, model family, common
prospective tolerance and objective. It does not optimize physical access,
measurement travel or cost, continuous time, information gain, or identification.
Source edits and query edits retire the plan. Reopening original project inputs
requires recomputation; no saved result is trusted. Original calibration selects
the candidate population; held-aside measured values cannot select the questions.

## Offer only the readings you intend to consider

Enable **Use only explicitly offered cells and times**, enter original cell
labels, an earliest/latest event minute and a reason for the scope. A blank
latest time uses the original event end; a blank offered-cell list offers no
cells. Unchecked keeps the complete original candidate grid. The scope applies
to both greedy and exact methods before equivalent separation patterns are
compressed. Original cell IDs, native snapshot times and predictions are retained;
no interpolation, physical access inference, travel-time scheduling or measurement
is introduced. Time-zero remains outside the inherited prospective grid.

The same authored nine-rate example still distinguishes 34/36 pairs if only the
first three rows are offered, but chooses F2 at 50 minutes instead of F6 at 40.
Restricting those rows to minutes 40–80 gives F2 at 50 and C1 at 80, distinguishing
32/36 pairs. This evaluates 216 offered native points, leaves 2,088 other points
unavailable, and considers 1,275 exact singleton/pair plans over 50 patterns.
Unavailable points are not recorded observations or evidence of indistinguishability.
A scope containing no native points is explicitly distinct from a scope whose
points are all already recorded and from offered points that carry no separating
signal. No fallback question outside the scope is returned.

The scope is an ephemeral investigation query, as are the existing planning
controls. Editing its declarations retires the result. Original project exports
remain unchanged; after reopening original source, enter the desired scope and
recompute. A declared scope/basis is not verified acquisition feasibility.
