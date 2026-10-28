# Cooling requirements over sampled-minute windows

After accepting the three solar-grid comparison, enter an inclusive first and last elapsed minute, required cooling in °C, and heat store. Press **Check sampled window**. Positive cooling is existing temperature minus proposed temperature: positive means the proposal is cooler.

Each 60-, 30- and 15-minute solar grid is evaluated separately. All integer-minute samples in the declared window must exist exactly once and contain finite temperatures. The inquiry refuses incomplete input rather than drawing a conclusion from a partial window.

For each required minute, conservative cooling bounds subtract the independent beam ranges:

- Lower cooling = existing lower temperature − proposed upper temperature.
- Upper cooling = existing upper temperature − proposed lower temperature.

A sample is **supported** if its lower cooling meets or exceeds the threshold. It is **failed** only if its upper cooling is strictly below the threshold. Otherwise it is **ambiguous**. A lower-bound miss alone does not establish failure.

The whole window is supported only if every required sample is supported. Any failed sample makes the window failed; its earliest definite counterexample is retained. Otherwise a window containing ambiguous samples is ambiguous. The first ambiguous sample and all individual samples remain inspectable. Witness buttons move the existing common-minute inspector to that sample and heat store.

Counts refer to samples, never continuous duration. No coverage between integer minutes, continuous-time physical guarantee, convergence, preferred solar grid, or combined sampling-error bound is inferred. Beam extremes need not be jointly attainable. These are conditional modeled comparisons of the retained declarations, not measured cooling.

## Inputs and reopening

Endpoints are integers from 0 to 1440 inclusive, in ascending order. Required cooling is a finite number from −1000 to 1000 °C. A one-minute inquiry is permitted. Query edits clear the accepted result and disable its download until rechecked. Replacing the parent source invalidates the inquiry.

**Download window inputs** stores only the original sampling source and query. The download includes the original site, geographic coordinates and uploaded weather JSON; it contains no trusted cached trajectories or classifications. Reopening validates the source/model and recomputes the courses and query. An invalid file retains the preceding accepted result. A newer accepted window import retires a pending older sampling import.

The ordinary sampling-source export format is unchanged. Neither inquiry evaluation nor reopening replaces the working site.

## Qualification

Run `node tests/shade-heat-window.test.mjs` for equality, ambiguity, earliest definite counterexample, complete-window refusal and authored original-source replay controls. Run the maintained `node tests/shade-heat-sampling.browser.mjs` for actual mounted query, witness jump, invalidation, raw-only download/reopening and deferred-import ordering checks, alongside the existing solar sampling journey. The browser helper requires its maintained Chromium sandbox admission.
