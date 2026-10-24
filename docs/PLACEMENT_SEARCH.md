# Compare small surface placements

**Where could a small surface change help?** enumerates explicit alternatives to
the current proposal using the maintained `compareIntervention` API. It does not
introduce a hydraulic solver or an outlet-rate model.

Choose a replacement surface, one or two permitted edits, an objective, a saved
infiltration-hypothesis subset, and 1–12 eligible cells. The eligibility grid does
not paint the project. **Select proposed sealed cells** is an explicit shortcut;
it refuses more than twelve instead of selecting an undisclosed shortlist.

The search includes the unchanged current proposal, every eligible single-cell
edit, and every eligible pair when two edits are allowed: at most 79 alternatives.
Existing authored proposal changes, elevations, declared internal barriers and
weather remain intact. Eligibility is a numerical input, not land permission,
physical feasibility, cost, or construction advice.

## Evidence is conditioned before hypothetical edits

The original project is evaluated once with the requested evidence filter through
`compareIntervention`. The resulting finite rates are retained unchanged. Each
hypothetical variant is then evaluated with the maintained comparator's full-rate
mode; only the original supported rates enter its placement summary. Original
readings are never refitted against a hypothetical edited geometry.

This matters when observations describe the proposal scenario. In an authored
courtyard control, a reading at cell 27, minute 60, supports the 1 mm/h sealed
surface rate on the source geometry. Reconditioning after converting that cell
to garden incorrectly gives no compatible rates. Carrying the original rate
instead permits the prospective comparison: about 19.021 L less edge outflow and
320.915 L less final storage. This is a solver-generated software control, not a
field measurement or evidence that such a real intervention would work.

Missing calibration or held-aside evidence, and a contradicted finite set, return
explicit uncomputed states. There is no closest-fit fallback. The maintained
comparison also refuses a studied surface absent from both scenarios. This
restriction is preserved: if an admitted variant removes the final occurrence,
the whole placement comparison refuses instead of ranking a partial search.

## Objective, tradeoffs and ties

For each retained rate, all changes are **hypothetical variant minus current
proposal**. The available objectives are water not absorbed (edge outflow plus
final storage), edge outflow, peak standing-water volume, final storage, or maximum
cell depth. The ranking minimizes the largest additional change across the fixed
finite rates. It does not mix unlike units or assign probabilities to hypotheses.

Every alternative remains inspectable. The chosen plan shows all metric ranges,
every per-rate current/prospective value, and all cells whose separate peak depth
increases under at least one retained rate. Peak times need not coincide. The
unchanged proposal has exactly zero additional change and can be best; dry or
otherwise indistinguishable alternatives remain explicit ties. Near-minimum
scores within `1e-8 * max(1, abs(minimumScore))` are labeled tied as a numerical
guard, not a physical uncertainty interval.

An authored 12-cell courtyard example enumerates 79 variants. Under sealed rates
0.2, 1 and 4 mm/h, minimizing worst additional unabsorbed water selects cells 27
and 36 (about −593.859 L at the worst rate). Minimizing edge outflow selects 34 and
35 (about −106.306 L outflow, but only −495.012 L unabsorbed water). Removing cell
36 from eligibility changes the first objective's choice to 28 and 35. The best
pair differs from the two individually best locations because the maintained
model couples cells. None of these results establish environmental accuracy.

## Explicit adoption and stale-source protection

**Apply these hypothetical surface edits** is a separate action. It validates
the complete source signature and eligible edit set before changing only the
chosen proposed surfaces and their hypothetical provenance. The existing site,
other authored proposal changes and retained readings are preserved. The normal
application persists the new proposal and retires the old comparison. Changes to
source assumptions, evidence, or search controls require a fresh comparison.

If any observations are assigned to the proposal, replacement is disabled. Those
readings must remain with their observed geometry; the candidate remains fully
inspectable. This diagnostic does not silently delete, reassign or relabel them.
Use a separately prepared evidence workspace for a prospective intervention.
Existing-site observations do not prevent ordinary hypothetical adoption.

## Work and qualification

The combined bound is variants × saved rates × three simulations × grid cells ×
modeled steps. Above three million estimated cell-steps, work refuses before
enumeration. The three-run allowance conservatively follows the maintained
intervention comparator, including original evidence evaluation. It bounds
interactive work, not numerical error or field validity.

On source `9f5ba933511c8c599a30fe45823e5fe5dff92422`, the composed candidate passes
238 native groups with `node --test --test-isolation=none tests/*.test.mjs`.
Nine added groups exercise enumeration/conservation, non-greedy pairs, changed
objectives and eligibility, original-geometry conditioning, held-aside separation,
empty evidence support, no-change/ties, bounded work, proposal preservation,
adoption/refusal, and the maintained absent-surface boundary.

Run `CHROME_BIN=/opt/google/chrome/chrome node tests/placement.browser.mjs` for the
actual consumer course through the maintained sandbox-admitted browser owner.
It composes the observation-map and consistency regressions with placement
selection, objective/eligibility changes, source-conditioned comparison, explicit
adoption, reload and narrow layout. Browser receipts are retained separately from
native qualification; neither implies field or cloud deployment.
