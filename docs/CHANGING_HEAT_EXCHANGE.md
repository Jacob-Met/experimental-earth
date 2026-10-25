# Changing heat exchange and material consequences

Issue #293 adds an explicitly declared exchange history to the retained uniform-layer heat investigation. It asks whether a material comparison depends on *when* heat is exchanged with the reservoir. A time average of an exchange coefficient generally cannot replace its chronology during changing illumination or reservoir temperature.

The surface heat panel contains editable CSV history and original temperature tables. Save the layer/exposure declaration above it, offer 2–12 complete histories, and compare. Each history specifies both existing and proposed coefficients for every original exposure interval. Coefficients **replace** the saved constant exchange during that interval. All other original layer properties, starting temperatures, incident inputs, reservoir temperatures and sources remain fixed. A row source must support both coefficients; different source explanations can be recorded together explicitly.

This does not derive exchange from wind speed or surface labels. It adds neither radiation nor evaporation. It does not compose automatically with separate nonlinear-radiation, rain-heat, subsurface or lateral-heat models. The result is conditional on the declared uniform-layer, linear-exchange model.

## Actual mechanism

For each complete history and target, the maintained `advanceSurfaceHeat` propagator advances the original state across each constant-forcing interval. Original reading times divide intervals without resetting the state. Every interval endpoint is evaluated even when no readings occur there. Shortwave input and signed outward exchange are accumulated separately; stored heat is independently computed from capacity and temperature change. The exposed arithmetic residual is not a physical uncertainty bound.

At most 12 histories × two targets × (24 exposure intervals + 100 reading times) are admitted. A conservative full-work preflight rejects an insufficient caller budget before any propagation, followed by a shared execution counter. No partial family is reported.

Each original reading retains its target, elapsed minute, temperature, declared half-width, calibration/challenge role and source. Calibration support requires every calibration band. Challenge rows may reject that set but never choose or reorder calibration support. With no calibration readings, all-history consequences remain exploratory and supported ranges are absent. A missing range is never shown as zero effect. Every history and every original residual remain visible.

Only the final-time proposal-minus-existing temperature is summarized as a consequence range. It is not a claim about all-time cooling, comfort, probability or a field treatment effect. Raw-input download preserves the original heat declaration, complete histories, readings and association source. It strips result-like fields. Reopening recomputes independently and does not replace the working project. Draft/site changes retire the displayed result and download.

## Executed authored control

Existing absorption0.6 and capacity40000J/(m²·K), proposed absorption0.4 and capacity80000, start/ambient25°C. Exposure is60minutes at800W/m² followed by60minutes dark. Both layers share the offered exchange history:

| Exchange, first/second interval W/(m²·K) | Final proposed minus existing °C |
|---|---:|
| 2 / 30 | +0.9130203369 |
| 30 / 2 | −5.2447972936 |
| 16 / 16 | −0.4272999299 |

All three have time-average exchange16W/(m²·K), yet the final consequence changes sign. These are authored analytic controls, not acquired coefficients or independent field observations. A25°C initial calibration retains all three. An authored existing-layer60minute reading64.5351492613±0.05°C retains only the first as a challenge; changing that challenge to39.9247117962 retains the second without changing calibration support.

Focused native controls include an independently expressed exponential-equilibrium oracle on unfamiliar forcing, unchanged constant-coefficient agreement, no-input equilibrium with no gain, separate energy closure, raw replay and complete-work/incomplete-history refusal. Final actual browser receiving passed all nine checks in 2.3282562 seconds on Chrome156.0.8078.47: editable input, real download, fresh-page isolated reopen, source preservation, narrow/desktop rendering and challenge-only changes. The lead visually inspected both input and consequence views at desktop and390px; no horizontal overflow occurred. The visible all-history and calibration range was −5.2448 to +0.913°C, with the original challenge retaining +0.913°C. Five focused native groups passed on Node22.23.4 in15.473075ms with zero failures, skips or cancellations. This is focused verification, not a full repository suite. Independent AFTERIMAGE source/math/API review found no blocker.

Run `node tests/changing-heat-exchange.test.mjs`. Browser script: `tests/changing-heat-exchange.receiving.mjs` with `CHROME_BIN`, `PUPPETEER_PATH`, `PORT`, and `RECEIVING_OUT` overrides.

## Source composition and receipts

The publication parent is `aeec6a16c0912f99e7361c76992c2481288d0224`. The mounted surface-heat source and calculation dependencies were compared with immutable current main. Incoming changes between `ae711c50825f98ec3e28fec0bdc2580e3d53d457` and that parent affect independent receiving-component and observed-storage consumers, with no overlap in this change or its heat/parsing dependencies. Current observation station/clock parsing dependencies were explicitly hydrated for receiving. No incoming files are replaced apart from the three-line heat-panel mount.

Actual native/browser receipts and four inspected PNGs are retained in `docs/receipts/changing-exchange-1d6c/`. The source manifest hashes the exact production, harness, documentation and received assets, excluding itself. It records the final label-only fix and source-size admission; older successful browser runs are not substituted for the final receipt.
