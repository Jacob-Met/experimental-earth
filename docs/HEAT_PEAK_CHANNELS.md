# Choose a channel for inferred hidden-peak uncertainty

The existing **Which reading could narrow the hidden-store peak?** investigation can now also compare an explicitly available lower-store sensor. It still evaluates every distinct calibration-compatible proposal from the selected maintained search and uses the original worst-remaining-peak objective. There is no new search, heat solver or probability model.

## Ordinary investigation

Infer proposals from the original heat evidence. Declare the available acquisition window, number of time samples, instantaneous or complete mean operator, and surface precision as before. To compare a second channel, explicitly enable **Also compare an explicitly available lower-store sensor**, declare its prospective half-width, and explain both sensor/window access and its association with the effective uniform lower store. The model does not infer a physical probe depth, historical data availability or sensor independence.

The summary compares the best surface and lower questions, then identifies the smallest worst remaining lower-peak spread. The time table retains every offered channel/time. Exact objective ties prefer the existing surface channel, then the earliest time within that channel. A no-reduction result is explicit; a larger number of samples is not itself evidence of physical certainty.

Original surface-reading supports exclude overlapping surface questions. A separately declared lower channel can overlap them, because this source contract contains no recorded lower-channel readings. This is an acquisition question under the retained exposure; earlier times need an actual archive or a repeat-exposure plan. A plausible modeled lower temperature does not create a reading or make a sensor available.

## Mechanism and cost

`finitePeakQuestion` remains unchanged. For every distinct compatible proposal, a prospective band contains that channel's modeled point or mean temperature plus the supplied half-width and the existing engineering arithmetic allowance. Every overlapping pair can coexist under a possible supported observed value. The largest target-peak difference among such pairs is the worst conditional peak spread. Duplicating an optimizer proposal cannot weight this objective, unlike counting proposal pairs. Complete original held-aside values never select the proposal family or reading time.

The same analytic evaluator computes both channels. Preflight conservatively charges the complete prospective course-sample workload for both channels before running the search; the existing two-million work bound remains. No partial subset is silently retained to fit a budget. The finite caps remain 400 proposals and 241 times per channel. This is not a continuous-domain feasible enclosure or a certified numerical error bound.

## Executed authored comparison

The maintained pulse fixture with lower capacity bounds 60,000–500,000 J/(m² K) and conductance 10–40 W/(m² K) yields 155 tested proposals and 108 calibration-compatible distinct proposals. Their predicted lower-store peak range is 6.5300689436 °C. On a three-minute grid with ±2 °C prospective bands, the best surface question leaves 5.9934182031 °C worst remaining spread; a lower-store question at 39 minutes leaves 0.5433980525 °C. The existing surface-only minimax already used the complete inferred family. This extension brings the lower-channel choice to that same family without manually pruning 108 proposals into the separate twelve-alternative evidence form.

At ±0.01 °C the surface channel slightly outperforms the lower channel, and at ±5 °C neither channel reduces the range. Those adverse/no-gain controls are retained. All numbers are authored software/model consequences, not measured sensor performance, field accuracy or a physical installation recommendation.

## Original-source replay

Original `inferred-heat-peak-minimax/1` files remain surface-only with their original interpretation. They cannot inject a new lower-channel setting. Surface-only downloads keep v1. Enabling the lower channel creates `inferred-heat-peak-minimax/2`, which retains the original project, search domain/method and explicit acquisition/channel declarations. Derived recommendations are never saved or trusted. Reopening v1 disables and clears the lower-channel draft. Users must explicitly ask a new question to add a lower sensor.

## Verification

Eight new native groups test the complete-family gain, tight-precision surface win and no-gain control, exact existing-surface row/optimum parity, challenge-value independence, original lower means, duplicate/permutation invariance, complete surface coverage, v1/v2 replay and combined-work refusal. The five existing peak-question groups remain passing. The actual browser receiving script is `tests/heat-column-peak-channel.browser.mjs`; it covers original search through comparison, keyboard inspection, actual download/fresh reopening, desktop/narrow layout, changed precision, legacy replay and forged semantics refusal. Browser execution and independent review must be recorded separately before qualification.
