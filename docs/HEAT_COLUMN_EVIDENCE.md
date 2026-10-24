# Surface evidence for hidden heat-store alternatives

This investigation compares a finite list of declared lower-store explanations with sourced **surface-temperature** reading bands. It preserves the original two-store model and exposure. A candidate can agree with the visible surface while predicting a substantially different hidden lower-store peak.

It screens the offered alternatives; it does not solve an inverse problem over all capacities and conductances. One remaining candidate means one survivor in this declared list, not unique material identification, calibrated physical parameters or a confidence interval.

## Fixed model and varied declarations

The maintained two-store model is:

```text
C₁ dT₁/dt = α I − h (T₁ − Tₐ) − g (T₁ − T₂)
C₂ dT₂/dt =                         g (T₁ − T₂)
```

Surface properties C₁, α and h, both initial temperatures, all exposure intervals and the selected place remain fixed from the saved column study. Each alternative supplies only a label, lower capacity C₂, internal conductance g and a source. Initial lower temperature cannot be varied through an extra hypothesis field. The other existing/proposed place is not changed by evaluating the selected target.

The lower boundary remains insulated. These are internally uniform stores with surface-only absorbed input and linear exchange, not resolved layers with inferred depth or conductivity. The model's omissions remain those documented in [Two declared heat stores](HEAT_COLUMN.md).

## Reading roles and decisions

Readings contain elapsed time, surface temperature, supplied band half-width, a `calibration` or `challenge` role, and source text. They may be instantaneous or explicitly declared interval means; the latter retain a start and end and are compared with the model average over that complete support. Existing readings without an operator remain instantaneous. See [interval means and acquired hourly evidence](HEAT_COLUMN_AVERAGES.md). Lower-store temperatures and energy readings are not accepted as interchangeable quantities.

For each candidate, every reading is evaluated against that candidate's unchanged surface response. The residual is **reading minus predicted surface temperature**. A candidate passes a reading when the residual magnitude is at most the supplied half-width plus the separately reported engineering arithmetic guard.

Calibration-compatible candidates must pass every calibration band. Challenge readings then screen those same candidates; they do not refit, rank, optimize or replace any parameters. Every candidate and both role-specific results remain available for inspection. The original reading index is retained even when rows are separated by role.

| Status | Meaning |
| --- | --- |
| `no-evidence` | No retained investigation exists. |
| `context-changed` | Its original place, column or exposure no longer matches the current project. |
| `need-calibration` | No calibration readings have been supplied; compatibility is not established. |
| `calibration-rejected` | No declared candidate passes all calibration readings. |
| `needs-challenge` | Calibration-compatible candidates remain, but there are no challenge readings. |
| `challenged` | Challenge readings reject every calibration-compatible candidate. |
| `one-survivor` | Exactly one candidate passes the two supplied groups. |
| `ambiguous` | Multiple candidates remain compatible after challenge screening. |

The remaining lower-maximum temperature range and peak-time range are the extrema of the surviving **finite candidates**. They are absent when there is no supported survivor set. They do not enclose every possible physical lower-store response or every continuously varying parameter pair. Two differently sourced labels with identical physics remain two indistinguishable explanations rather than becoming an artificial unique result.

A role label records the user's declaration. It does not prove independent acquisition, demonstrate that a reading was held aside before model selection, or make overlapping or correlated measurements statistically independent.

## Arithmetic guards and whole-course admission

The arithmetic guard is separate from the supplied measurement band. The implementation multiplies `Number.EPSILON × 2048 × intervalCount` by the largest of one, relevant temperature magnitudes and an accumulated transfer/capacity scale. That scale includes absorbed input, ambient exchange and internal transfer, accounting for cancellation-sensitive courses as well as temperatures themselves.

This is an engineering floating-point allowance. It is **not a certified numerical enclosure**, a sensor uncertainty model, a fitted noise estimate or a probability. Original reading half-widths are not overwritten by the guard. The per-reading inspector exposes the guard alongside the prediction, residual and band decision.

Each candidate is evaluated over the **whole saved exposure**, including both stores' interior stationary times and interval boundaries. Unsupported temperatures, invalid inputs or an unsupported unobserved interval refuse the whole comparison. The implementation does not silently omit a failed candidate or return a partial survivor set. For example, a time-zero reading cannot qualify an isolated candidate that subsequently exceeds the supported calculation range.

The plotted course includes all reading times, 121 evenly spaced plotting times, exposure boundaries and stationary points. The final plotting time uses the exact admitted duration value, avoiding a rounded endpoint beyond a short decimal exposure. Maxima come from the maintained course evaluator, not from choosing the highest plotted grid sample. Displayed curves join calculated states; they are not observed continuous traces or formal error bounds.

## Actual user workflow

1. Save the sourced surface exposure and its two-store declaration above this panel.
2. In **Which hidden heat stores still explain the surface?**, select existing or proposed place and explain how the readings belong to that place and exposure.
3. Enter alternatives in structured cards, each with a distinct label, C₂, g and source. Add surface reading cards with elapsed time, temperature, band half-width, role and source.
4. **Save surface evidence**, then **Compare saved alternatives**. Unsaved edits clear derived results and disable comparison without rewriting accepted inputs.
5. Inspect both plots. Surface reading bands use ochre for calibration and purple for challenge. Solid curves represent remaining alternatives; dashed curves retain alternatives not supported by the current evidence. The selected candidate is emphasized rather than automatically chosen as a preferred explanation.
6. Select a candidate and calculated time, or **Inspect selected lower maximum**. Both plots' markers and the numerical inspector use that same candidate and time. The peak list retains every candidate, while the highlighted spread describes only remaining candidates.
7. Open the source details to inspect association text, hypothesis source and per-reading residuals, roles, guards and source notes. Source strings are displayed literally.
8. Export the whole project. Fresh reopening restores raw declarations and recomputes results; stored derived reports, trajectories or peak ranges are not authority.

**Fill authored ambiguity draft** supplies illustrative alternatives and readings derived from the retained reference calculation. For the standard control below it exposes the intended ambiguity. For a different saved course it scales the offered capacities/conductances relative to that course, clips them to admitted bounds, and places readings at one-seventh and two-sevenths of its duration. It is not guaranteed to reproduce the same ambiguity for another exposure. Its notes explicitly disclose that these are fictional analytic readings, not acquired or independent measurements.

## Source binding and refusal

The project property is `heatColumnEvidence`, with schema `experimental-earth-heat-column-evidence/1` and quantity `surface-temperature`. It retains the entire original `columnStudy`, selected target, association source, hypotheses and readings.

Identity checks compare the retained column with the current saved column and reuse the original surface-study place/exposure binding. Thus lower initial temperature, source notes, surface/forcing declarations and selected-place context cannot silently change underneath accepted readings. Changing the selected existing/proposed target also requires explicit clearing. Export the retained investigation before clearing it and associating new evidence.

A failed proposed replacement preserves accepted inputs. Draft edits invalidate pending comparison work. The consumer compares its retained project snapshot with the current project before installing a result. Imported derived fields are ignored by scientific evaluation; original declared quantities and their sources determine the new calculation.

## Input limits

| Input | Supported limit |
| --- | --- |
| Alternatives | 2–12 |
| Alternative label | Distinct, nonempty, at most 60 characters |
| Lower capacity C₂ | 1,000–10,000,000 J/(m²·K) |
| Internal conductance g | 0–1,000 W/(m²·K) |
| Surface readings | 0–100, distinct operators and time supports |
| Reading time | Within the complete saved exposure, including its endpoints; a mean requires a finite nonempty interval |
| Reading temperature | −100–500 °C |
| Supplied half-width | 0–100 °C |
| Reading role | `calibration` or `challenge` |
| Association and row sources | Nonempty, at most 600 characters each |

Unexpected hypothesis or reading fields are refused rather than interpreted as additional variable properties or quantities. The underlying surface and column admission ranges still apply, including the total exposure and calculated-temperature limits.

## Executed five-explanation control

The standard authored course has C₁=20,000 J/(m²·K), h=10 W/(m²·K), α=0.8 and both initial temperatures and reservoir at 20 °C. Incident input is 700 W/m² for 60 minutes, followed by 360 dark minutes. The following alternatives all predict surface temperature approximately **44.53099896635513 °C at 60 minutes**:

| C₂ · J/(m²·K) | g · W/(m²·K) | Surface at 120 min · °C | Lower maximum · °C | Lower peak time · min |
| ---: | ---: | ---: | ---: | ---: |
| 60,000 | 27.510121852810165 | 29.73205579 | 36.36079224 | 69.18866030 |
| 80,000 | 20 | 27.43965430 | 32.33238368 | 75.02851661 |
| 120,000 | 16.295174716022963 | 25.13436299 | 28.39216727 | 82.48496488 |
| 240,000 | 14.009639299457522 | 22.80006201 | 24.34969828 | 94.31839697 |
| 500,000 | 13.122086618787623 | 21.57338803 | 22.14616617 | 106.20557411 |

A calibration reading of **44.53099896635513 ± 0.05 °C at 60 minutes** admits all five. Their lower maxima span approximately **22.146–36.361 °C** despite their near-identical visible temperature at that instant. Adding **27.439654304992075 ± 0.25 °C at 120 minutes** as a challenge leaves only the offered 80,000-capacity alternative. None of the declared parameters changes during screening.

The values above were reproduced from the implemented API. They are authored numerical controls, not acquired site evidence. Their purpose is to show how a later surface observation can distinguish these particular offered explanations and narrow their hidden-peak spread; they do not establish global parameter identifiability.

## Integrated qualification

The qualified composition uses maintained main `a93b4f25f20cbb9d1b7094a89e97a9e03984d7a4`, preserving the newer placement-resolution work. Node 22.23.4 executed the complete native suite: **480 passed, zero failed or skipped**. This includes seven new evidence controls and the original six column controls. Independent source review caught and corrected target reassociation and decimal-duration endpoint issues before qualification.

The actual sandboxed Chrome 156 evidence receiver passed all eight workflow groups with no page exceptions. It exercised native file import, structured declarations, all/one/no survivors, indistinguishable alternatives, an actual downloaded project and fresh reopening, forged-derived-result resistance, source/draft refusal, and desktop/390 px keyboard interaction. The original two-store browser receiver separately passed all eight groups after the shared course-summary refactor. Actual desktop, narrow curves and narrow peak/spread screenshots were inspected.

Source hashes, commands, numerical limitations and browser results are retained in [verification.json](receipts/heat-column-evidence-20261024/verification.json), [browser.json](receipts/heat-column-evidence-20261024/browser.json) and [column-browser.json](receipts/heat-column-evidence-20261024/column-browser.json). Normal publication and a fresh exact merged consumer are recorded separately in the native PR; candidate execution does not stand in for that receiving step.
