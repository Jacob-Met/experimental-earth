# Original-clock course proposals

The separate NOAA station investigation now discovers complete original courses after loading a source. An investigator chooses a duration and correction policy, then sees the original UTC starts/ends and station identity. The first available complete course is proposed automatically on new-source intake, in supplied-file order. Every other offered start remains available. Manual source-line correction is optional, under its own disclosure.

This reduces the need to scan an annual file for usable line numbers, flags and gaps. It is not an event-selection or parameter-fitting method. No observed-temperature magnitude, observation band, candidate physics, prediction or fit result selects or orders a course.

## Reuse and admission

`proposeOriginalHourlyCourses(source, {hours, correctionType})` takes original ASCII text, declared source URL and mandatory full SHA-256. It replays the original bytes through the maintained parser; imported row caches or derived answers cannot substitute for them. The source helper shared with `selectCourse` checks correction policy, required-field availability, original surface/solar flags and the existing nonnegative-incident-radiation requirement. These fixed source-admission rules are not a ranking by values or agreement.

Each complete window contains exactly the requested 1–24 original hourly rows. Windows never bridge a missing or excluded row, gap, duplicated/reordered UTC support, station change or location change. Every possible admitted start is retained in source order. There is no hidden best-fit choice, truncation, interpolation or dropped interior row.

Every excluded row retains its supplied-file line, original fixed-width text, station, interval support, reason and reason code. Breaks between otherwise usable original rows remain explicit. Runs with fewer hours than requested are retained but cannot produce a shorter fallback course. No complete course produces an explicit unavailable result; changing the requested duration or policy is a deliberate correction.

The source parser's original limits still bound work: at most 9,000 rows and 4,000,000 bytes. The number of offered windows is at most the number of original rows. The consumer displays choices and exclusions in pages of 10 with total counts; all choices/exclusions remain available and no page limit changes the computation.

## Original clocks and declarations

An optional exact-clock lookup reuses the maintained strict explicit-offset timestamp parser. It never snaps an unavailable half-hour to another source hour. If multiple original courses share the requested clock, each retains its separate station and supplied-line identity; ambiguity is not silently collapsed.

Applying an offered course changes only the selected original start. The interval count, correction policy and source identity remain bound to the proposal. The exact original start determines where the investigator's separately declared point initial temperatures apply. No point temperature is inferred from an hourly mean. Surface properties, offered lower-store alternatives, bands and their sources remain editable explicit declarations.

A new source is eligible for an automatic first-course proposal. An existing original-input recipe keeps its explicit selected start on reopening. A manual start-line correction made while discovery is pending is preserved. Changing the source, duration or policy invalidates pending discovery; an older completion cannot overwrite the newer proposal. Every changed course retires the modeled comparison and its download until recomputed.

Clock searching and pagination are inspection actions. Enter in the clock field searches original starts rather than submitting a physical comparison. A source-admissible course is not a promise that a physical model will fit or that its full trajectory will be supported; the maintained comparison still performs complete admission.

## Evidence

For the existing nine-row original Tucson excerpt, a six-hour request yields all four original starts at 15:00, 16:00, 17:00 and 18:00 UTC. Applying the last start reaches the unchanged maintained six-hour comparison with first observed mean 24.4 °C. The model's failure remains distinct from acquisition success.

Authored perturbations retain a flagged row verbatim and split valid runs around it. Changing surface values while preserving their availability/flags leaves proposals unchanged. Incompatible correction policy retains every excluded original row and supplies no prior-course fallback. Repeated original courses preserve duplicate clock choices; exact half-hour lookup refuses to substitute another hour.

An independent Chronos enumeration compared every possible start through maintained `selectCourse` against the proposal output for original, missing-hour, swapped-hour, repeated-course and flagged-row sequences at durations 1, 2, 4 and 7. All 125 admitted courses matched exactly. These perturbations and independent controls are authored software checks, not additional acquired station observations.

Native checks: `node --test tests/noaa-hourly*.test.mjs`. Actual consumer checks: `CHROME_BIN=/usr/bin/google-chrome-stable node tests/noaa-hourly-courses.browser.mjs`, followed by the existing `tests/noaa-hourly.browser.mjs` receiving course. Both require explicit maintained Chromium sandbox admission. A checked-in script does not by itself establish executed browser qualification.

## Actual full-year receiving

Root received the complete original 2025 Tucson annual file from the official NOAA source, 2,137,440 bytes and 8,760 rows, SHA256 `8a3f9e470c96557cb21a0e1bab0f556630f4c8ec50965666a8f5a32a0677ea75`. Independent fixed-position/UTC enumeration agrees exactly with every production start: corrected-policy C offers 8,757 one-hour, 8,747 six-hour and 8,711 twenty-four-hour windows, retaining three excluded rows. Incompatible R offers none and retains all 8,760 exclusions. No row is silently skipped inside a course. The whole six-case native harness took 1.77 seconds; production proposal calls took135–168ms, and whole-harness peak RSS was333,028KiB (not browser memory).

The actual annual browser course admitted the original file in332ms including picker discovery, paged ten original starts at a time, found `2025-07-02T13:00:00.000Z` by exact UTC, selected supplied line4382 and compared all24 original hours through the maintained investigation. All displayed original lines/UTC/surface means/types/flags were checked; the three illustrative hypotheses remain calibration-rejected. Changing duration retires the comparison. Incompatible R displays all exclusions with bounded pagination and refuses comparison without retaining a previous result or downloadable answer. This adds two actual browser groups to the six new source-course and six prior investigation groups.

Current-main composition at `982ec2e68c1542bd515070af71640c58486d0081` preserves incoming heat-band search and transfer consumers.39 affected native groups and all14 actual browser groups pass with explicit namespace/PID/network/seccomp/TSYNC sandbox admission. Root inspected desktop/narrow course controls and keyboard-focusable tables. Detailed compact receipts are in `docs/receipts/noaa-source-courses-333*.json`; complete original bytes and detailed annual exclusions are retained in the receiving environment. The repository includes reproducible native/browser receivers and compact-receipt generation under `experiments/`. Re-fetch the official annual URL identified in the receipt and verify its digest; later NOAA revisions must not be silently treated as the same source.
