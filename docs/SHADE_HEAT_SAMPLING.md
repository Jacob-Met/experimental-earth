# Shade and heat: solar sampling sensitivity

This investigation asks whether a proposed shade and heat consequence changes materially when its solar midpoint grid changes. It compares 60-, 30- and 15-minute solar samples while preserving the original site, material assumptions and complete hourly weather source.

Open the maintained application, choose the shade and heat investigation, and attach a complete original UTC day of NASA POWER hourly JSON. Accept the hourly comparison. In the solar sampling section, choose **Compare three solar grids**. An independently saved sampling investigation can also be reopened directly.

## Read the result

Select the existing or proposed site and the ground surface or lower heat store. All three curves remain visible. Each grid retains its own lower and upper mapped-beam courses; the shaded bands concern unresolved geometry within that course.

The complete-course table gives each day's mean, thermal peak and endpoint for both beam courses. Means are duration-weighted analytic interval means. Peaks inspect interval endpoints and the maintained thermal propagator's interior stationary times.

The grid-sensitivity table compares 60→30 and 30→15 minutes. Its largest difference is the largest absolute difference among the 1,441 common integer-minute samples, including both day endpoints. It is not a continuous-time maximum. Endpoint, mean and peak changes retain their sign as finer minus coarser. Direction can reverse. A smaller grid is not established as a better physical prediction.

Use the common-minute slider to inspect all three temperatures at the same minute. Each solar interval displays its own midpoint, the original weather hour and original DNI/DHI energy values, reservoir temperature, incident beam bounds and mapped witness where available. Day-end inspection uses the final original weather hour.

The final energy table begins from the original declared initial temperatures. It reports absorbed input, signed ambient exchange, surface and lower stored changes, and their residual. Switching the site reveals the other site's complete ledger.

## Original inputs and derived grids

The source remains the strict hourly shade/heat input envelope: the original portable site, declared location and grid orientation, the original hourly weather JSON, and the maintained model declarations. No weather value is interpolated or invented. For a derived subhour interval, the original hourly DNI, diffuse radiation and T2M record are held over that original hour. One-hour radiation energy in Wh/m² becomes its one-hour mean power in W/m².

Only the midpoint solar and mapped-shadow sampling changes. Each grid still propagates both existing/proposal targets and both lower/upper beam courses through the maintained two-store thermal step. This creates twelve complete thermal courses.

The complete investigation preflights the combined 24 + 48 + 96 intervals. Its estimated work is 6 × N × (N − 1) × 168 ray checks for N grid cells, subject to the maintained 16 million limit. A site that fits the original hourly calculation can therefore be refused for the complete three-grid comparison. No partially calculated new comparison is presented.

The maintained −100…200°C initial declaration contract is unchanged. Carried states are passed directly to the existing thermal state contract, which admits its existing −100…500°C range. Chunking does not reinterpret a later temperature as a fresh initial declaration. Cumulative stored heat remains relative to the original initial state.

## Save and reopen

**Download sampling inputs** saves the strict experimental-earth/shade-heat-sampling/1 input envelope. It contains kind, model and source only. Temperature trajectories, chart points, differences and cumulative ledgers are recomputed on reopening. The original hourly JSON and geographic declarations remain in that file.

Reopening does not replace the working site or the parent investigation. An invalid model, extra derived result field, invalid UTF-8, malformed JSON or oversized file is refused while retaining the prior accepted sampling comparison. The 5 MiB investigation limit is checked before reading file bytes; the original hourly weather's 256 KiB limit also remains in force.

Parent source changes and edits invalidate the child comparison. Deferred calculations check their generation and parent identity before beginning work. Delayed file reads cannot replace a newer source. File selection resets immediately after the File is captured, allowing the same file to be chosen again. Downloads are disabled while a replacement is pending.

## Scope of the claim

This is an authored-site numerical sensitivity investigation. It is not field calibration, a comfort claim, a convergence proof, a continuous shadow enclosure or proof that the finest grid is best. Geometry ambiguity and temporal sampling sensitivity remain separate. Agreement between courses does not establish physical accuracy.

The existing hourly shade/heat schema, thermal integrator, weather admission, solar geometry and portable-site validation remain the maintained sources of those contracts. The sampling module composes them.

## Verification

Run the focused numerical and input regressions from the repository root:

```sh
node --test tests/shade-heat.test.mjs tests/shade-heat-weather.test.mjs tests/shade-heat-sampling-independent.test.mjs
```

The independent sampling test exercises baseline parity at every common integer minute, original-hour containment, energy conservation, nonzero uncertainty bands, analytic warming above the initial-declaration limit, the combined work refusal and strict input-only round trips. The existing shade/heat and hourly-weather tests preserve their original admission and numerical contracts.

Run the actual application course with an installed Chromium binary:

```sh
CHROME_BIN=/opt/google/chrome/chrome node tests/shade-heat-sampling.browser.mjs
```

The browser course uses the maintained process owner and requires active sandbox admission before product assertions. It exercises original hourly attachment, the displayed means, peaks, endpoints and common-minute values, the real input download and fresh-page reopening, strict refusals, delayed reads, queued calculations and parent invalidation. It retains source hashes, browser receipts and desktop/390-pixel screenshots in a unique temporary run directory.

At narrow widths, visible table captions stay above their horizontally scrolling data regions. Each table also retains its semantic caption and a labeled keyboard-focusable scroll area. Numerical and browser receipts describe the exercised source and runtime; physical accuracy and convergence remain separate claims.
