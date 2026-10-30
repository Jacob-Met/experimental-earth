# Explicit sourced-crest event process

`uniform-source-finite-event-crest/research3` is an optional extension of the finite event model. Existing models and the maintained default are unchanged; older event/profile choices still refuse effective crest declarations.

The model receives existing canonical internal-barrier declarations, including their source strings. Closed edges are removed before crest handling. An effective crest in metres is converted to millimetres. For unequal heads, the request is mobility times `max(0, upstreamHead-max(downstreamHead,crest))`. A crest at/below adjoining ground remains an ordinary edge through the maintained canonical helper. Downstream submergence restores the ordinary head-difference request. Exterior outlet behavior is unchanged.

The new model retains dynamic heads, midpoint stages, finite receiving events, conservative final donor allocation, numerical ledger checks and bounded refusals. Crest crossings are approximated by those stages; they are not separately located exact events. This is not a universal threshold-overshoot, accuracy or convergence theorem. Source uptake or another outlet can lower a donor below a crest legitimately, so final depth alone is not a barrier-leak test.

Calibration and hypothetical layouts use the same factory-fixed model. The comparison factory permits crests only for this selected model; existing unsupported-geometry preflight remains for other models. Private original support, raw declarations, stale-source checks and adoption provenance retain the chosen version and barrier geometry. Receiving-family inference is still unsupported in this explicit finite model.

## Independent controls and actual consumer

Twenty-four closed-pair courses cover blocked, crest-limited and submerged transitions. The oracle is piecewise: while the downstream head is below the crest the upstream excess decays at mobility; after submergence the head difference decays at twice mobility. Twelve multiple-outlet courses combine two crest levels with zero/positive rain and finite receiving storage, using an independent piecewise linear donor/storage event solution and absorbing downstream sinks. Errors decrease in the frozen4/16/64-step courses; this finite course is not a general convergence proof. Forty-eight held graphs reverse cell and edge ordering and check conservation/state bounds; malformed edges and exhausted work refuse.

The actual2×2 consumer calibrates zero uptake from an equal-head original6mm rainfall course, then compares all9 mixed layouts with a sourced2mm crest. A single garden plan has an independent final-depth formula `2+6*(1-exp(-2/3))`; its whole-site score differs from the one-minute model by0.0000963L. Original support remains[0]. Raw reopen reproduces the layouts; changed crest geometry invalidates adoption; older event versions still refuse the declaration. This is authored software evidence, not measured field validation or optimality.

Run `node tests/event-crest-pair.test.mjs`, `node tests/event-crest-coupled.test.mjs`, `node tests/event-crest-held.test.mjs`, `node tests/event-crest-consumer.test.mjs` and the sandboxed mixed-placement browser receiver.
