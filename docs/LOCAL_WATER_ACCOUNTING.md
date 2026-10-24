# Local water accounting

The ordinary Rain Lab can now explain a selected cell's final water balance through **Trace both scenarios**, immediately below the site totals. It reruns the existing and proposed plans under their saved assumptions and records the actual accepted transfers from the maintained `runRain` solver. Select another map cell, or use a neighboring-cell button, to follow those transfers without changing either plan.

For each cell and the complete modeled event:

`rain + incoming from neighbors − outgoing to neighbors − infiltration − site-boundary exit = final storage`

Every component is in liters, so the cell area is included. Both directions across each neighboring edge are retained independently. The proposal-minus-existing component differences explain the final-storage difference, including a change caused by water arriving from elsewhere. A numerical residual is displayed rather than silently forcing the accounting to balance.

These quantities describe the conceptual model. Summed neighbor crossings can exceed total rainfall because the same water can cross several edges or return along an edge. The ledger does not label individual parcels or establish their original source, a physical flow path, a confidence interval or field validity. It cannot isolate an intervention's real-world causal effect. The calculation uses the saved surface capacities; the separate infiltration and outlet hypothesis investigations retain their own assumptions and evidence.

## Inspect the intervention's footprint

The area control switches among the selected cell, the **directly edited footprint**, and the **whole site**, reusing the computed ledger. The edited footprint includes cells whose proposed elevation or surface differs from the existing plan. The exact same cells are compared in both scenarios; this is not a claim that downstream effects stay within that footprint. Expand the membership list to inspect the selected cells. Identical plans have no edited footprint and are reported explicitly.

For a region, incoming and outgoing totals count only crossings between its members and other modeled cells. Transfers entirely inside it cancel from this boundary budget and appear separately as gross internal circulation. Site-boundary exits remain a separate loss. An outside neighbor touching several selected cells is counted once in the neighbor list, with its actual boundary transfers summed. Selecting that neighbor returns to single-cell inspection.

The whole-site view therefore has zero incoming/outgoing neighbor crossings while retaining modeled site exits, infiltration and storage; it reduces to the existing global water balance. Disconnected selections obey the same relation. No extra simulation or source-water tagging is introduced by grouping cells.

## Persistence and limits

The ordinary site JSON preserves all inputs. Import/reload followed by tracing recomputes the budget; derived ledgers are not silently reused as evidence. Changing geometry, grid dimensions or weather clears the displayed comparison. Selecting a cell or changing notebook readings preserves it because these actions do not change the model. Neighbor inspection always switches to Inspect, so following the flow cannot accidentally paint a cell.

The interactive comparison refuses workloads above 500,000 estimated cell-steps, counting both scenarios. This is a work bound, not an accuracy guarantee. The optional solver trace itself retains only cumulative per-cell and per-edge totals; it does not duplicate the time-step snapshots or create a second hydraulic solver. With tracing disabled, the solver's public result retains its previous shape and values.

## Verification

`node --test tests/local-water-budget.test.mjs` on Node 22 checks an analytic rain/infiltration integral, an independent one-step slope transfer, available-water capping, opposing transfers, local/global closure, horizontal reflection, unchanged ordinary output, paired intervention effects, dry/identical plans, input immutability and work-limit refusal. On a Node 24 environment requiring shared-process admission, the equivalent invocation is `node --test --test-isolation=none tests/local-water-budget.test.mjs`.

The maintained `tests/browser.receiving.mjs` includes the local-accounting course: real rendered numerical comparison, neighbor and map navigation, prevention of accidental painting, project reopen, rainfall invalidation/recomputation and desktop/narrow presentation. The shared browser owner and sandbox admission requirements remain unchanged.
