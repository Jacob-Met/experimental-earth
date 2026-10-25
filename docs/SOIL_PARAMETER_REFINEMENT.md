# Refine soil proposals between the declared grid values

The soil-parameter search now offers **Refine between grid values** after a grid
comparison. It uses the original calibration depths to propose additional
conductivity K and capillary-drive A pairs automatically, within the same declared
bounds. This removes the need to manually guess finer candidate values when the
coarse grid misses a compatible explanation. The material, bounds and their basis,
site, rainfall and evidence roles still come from the investigator.

Run the existing **Search declared grid**, then **Refine between grid values**.
The comparison retains every original grid pair and every additional evaluated
pair, including rejected proposals. Rows remain ordered only by calibration RMSE;
held-aside bands can challenge a proposal but never choose a location, seed,
direction, stopping decision or ranking. Select any 2–9 tested pairs for the
existing comparison draft. No soil parameter is applied to the site.

**Save original search** after refinement downloads the original project/query
and the versioned search method. Reopen through the same file control to recompute
both the coarse grid and refinement. Saved conclusions are not accepted. Reopened
investigations keep the working site unchanged and do not transfer candidates to
its comparison draft. Editing search declarations or the working project retires
the result. The ordinary grid file remains supported unchanged.

## Mechanism and bounded interpretation

The maintained `runRain` and `evaluateReadings` supply predictions and band
comparisons unchanged. A deterministic bounded Nelder–Mead simplex search starts
at the three closest coarse-grid pairs. In normalized K/A coordinates, the initial
simplex extends half the original grid spacing along each axis, toward the box
interior. Reflection, expansion, contraction and shrink steps compare calibration
RMSE only. Every proposal is clipped to the declared box, and previously evaluated
pairs are cached. Each seed has at most 200 additional evaluations and 100 simplex
iterations; normalized simplex diameter below 1e-7 stops that local search.
There are at most 600 additional solver
runs. Before any solver run, admission reserves the coarse grid plus all 600 runs
against a three-million cell-step limit. The reported cell-steps count actual
coarse and additional evaluations, not the reserved ceiling.

This finite local search is not a continuous parameter enclosure, global
optimization, posterior distribution, physical calibration or proof of unique
soil properties. Several nearby proposals may represent the same unresolved
family; their count is not probability or independent evidence. A rejected best
proposal cannot establish that the whole declared box is impossible. A compatible
proposal at the boundary can leave useful explanations outside the box. RMSE
minimization need not find every combination that passes unequal reading bands.
The separate original-grid calculation-interval diagnostic remains attached to
the grid comparison; it is not presented as a refinement diagnostic.

## Executed software controls

An authored 2×2 closed field with 50 mm/h rain for 60 minutes, a 90-minute
calculation and original readings at 17.5, 42.5 and 77.5 minutes illustrates the
missed-grid mechanism. The source solver uses K=17.3 mm/h and A=6.2 mm. A nine-pair
K={10,20,30}, A={0,10,20} grid has no compatible pair within ±0.03 mm and a closest
RMSE of 1.2701779 mm. Refinement evaluates 171 total pairs, retains 73 within all
bands and reaches an RMSE of 7.02e-8 mm. These are authored solver outputs, not field
measurements or an environmental accuracy claim.

The original eight-direction pattern-search prototype improved a routed 48-cell
example from 1.7067032 to 0.0975695 mm RMSE but found no candidate within ±0.05 mm
after 609 total runs. The simplex method on the same authored original readings
(K=13.7, A=11.3; cell/minute 10/30, 21/60, 35/90) reaches 2.35e-8 mm RMSE with
82 compatible proposals in 203 total runs. This informative failure motivated the
changed optimizer; it is not counted as an independent physical validation.

Three separately chosen off-grid controls (K,A)=(12.7,13.4), (23.1,3.7),
(18.9,16.1) also change from zero grid-compatible pairs to compatible refined
proposals. All alternatives and budget stops remain visible. Direct native tests
also cover unchanged input, exact original-grid retention, held-aside mutation
invariance, dry ambiguity, impossible evidence, missing calibration, source-only
replay, malformed saved conclusions and preflight work refusal.

Run `node tests/wetting-front-refinement.test.mjs` for those controls and
`node tests/wetting-front-search.test.mjs` for the unchanged grid contract.
The actual browser course is `tests/wetting-front-refinement.browser.mjs`, using
the maintained sandbox-admitted browser owner. It exercises the main application,
automatic proposals, draft transfer, generated-file reopen and stale retirement
at desktop and narrow viewports.
