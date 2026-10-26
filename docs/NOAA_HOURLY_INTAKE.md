# Original NOAA hourly station investigations

Follow **Investigate an original NOAA hourly station file** from the maintained two-store heat section, or open `noaa-hourly.html`. This is a separate thermal investigation: it neither replaces nor writes the site workbench's project. Its illustrative cell is not a station terrain survey or a measured physical column.

## Original records to a comparison

Declare the NOAA yearly format03 URL, then choose the original ASCII file. The URL is provenance supplied by the investigator; this page does not fetch it. An optional **Load archived Tucson nine-row source** action reads the repository's existing original excerpt and verifies its documented digest. Supply the first line in the provided file, 1–24 consecutive hours and corrected (`C`) or raw (`R`) surface policy.

The original first interval determines the initial instant shown in the page. The investigator separately declares surface and lower point temperatures at that instant. Neither is inferred from the first hourly mean. The visible starting values, surface properties, three lower-store alternatives and ±0.5 °C comparison band are explicitly authored illustrative assumptions. They are editable and are never fitted to improve agreement.

The maintained parser preserves every original field and fixed-width row. Required selected observations must come from one station/location, have contiguous original UTC windows and the declared correction type, contain all required measurements and have usable surface/solar flags. A gap, invalid calendar, missing required field, inappropriate flag or negative incident radiation refuses the complete selection. There is no dropped-row, clipped-radiation or interpolated replacement.

The original `SUR_TEMP` value is a preceding-hour surface mean. `SOLARAD` and `T_HR_AVG` supply each hour's explicitly assumed constant forcing. The last-five-minute `T_CALC` value is not substituted for the hourly air mean. Surface evidence is passed to the maintained complete interval-mean operator, not an endpoint-temperature comparison. The first declared number of rows are calibration; the rest are challenge. These labels do not establish independently held-out acquisition or statistical independence.

The existing thermal preparation/comparison APIs admit the complete model family and source course, retain every alternative, and report original observed means, predicted means, signed residuals and band decisions. No new heat solver or parameter-search mechanism is introduced. Existing initial-state inference and capacity/conductance-search owners remain separate.

## Source identity and portability

The shared `noaa-hourly.js` parser is the extracted maintained research implementation. `examples/noaa-tucson-hourly/intake.mjs` remains its Node file/hash/CLI wrapper. Browser receiving uses WebCrypto SHA-256 on an owned copy of the original bytes; asynchronous input mutation cannot attach one digest to another byte sequence. Recipe comparison also snapshots its declarations before asynchronous work.

Downloads use `experimental-earth-noaa-input/1` and contain only original text, its full digest, declared source URL, original selected line bounds, correction policy, point initial-state assumptions, surface properties, all offered lower-store hypotheses, band basis, role split and observation/model association. The entire original text is retained once; parsed annual row objects and derived answers are not serialized. Reopening verifies the digest and recomputes from the original input. Missing/malformed/wrong source identity, altered raw bytes or an injected derived-answer field refuse.

The source-byte limit is 4,000,000; the original-input JSON limit is the maintained 4 MiB file bound. The original yearly parser keeps its 9,000-row limit, while the actual thermal consumer admits only 24 hourly intervals and the maintained 1,440-minute horizon. Every individual selected raw row remains inspectable in the page. A supplied-file line number refers to the provided bytes; it is not silently relabeled as a line number in an unprovided parent-year file. A digest binds supplied bytes and does not authenticate acquisition or the declared URL.

Invalid source-file selection clears the prior source, preventing a fallback to an older file from being reported as the new result. Draft edits retire comparisons and exports. Invalid recipe reopening preserves the prior input fields but retires the displayed result and disables export. Asynchronous completion is generation-guarded.

## Maintained baseline and executed controls

The [original archived example](../examples/noaa-tucson-hourly/README.md) records the [NOAA 2025 Tucson source URL](https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/2025/CRNH0203-2025-AZ_Tucson_11_W.txt), its parent-file identity and the separate nine-line excerpt identity. The shared parser receives the exact 2,196-byte excerpt with SHA-256 `247bd26d2cdc1af26c933af2ced818d00dfbe629e4d1cdfae9a5a81b1b9547ac` identically through Node and browser-safe byte paths. The original course and complete comparison report equal the existing maintained build. All three offered alternatives remain calibration-rejected; the first predicts 20.284480645203562 °C against an observed 4.5 °C. This failure is preserved, not counted as a physical capability gain.

A different original six-hour span beginning at supplied-file line 4 starts with a 24.4 °C mean and produces a different comparison with unchanged alternatives. Independently supplied authored controls exercise raw-corrected subzero records across leap-day UTC midnight, CRLF input, invalid calendars, nonhourly endpoints, gaps, duplicate times, flags, missing fields and station/location drift. These authored controls are not acquired Alaska observations.

Run `node --test tests/noaa-hourly*.test.mjs` for original-byte parity, source-only replay, physical admission delegated to maintained APIs, informative rejection, changed original selection and asynchronous snapshot controls. Run `CHROME_BIN=/usr/bin/google-chrome-stable node tests/noaa-hourly.browser.mjs` for the ordinary link, actual file selection, keyboard comparison, actual download/fresh reopening, invalid identity/derived answer, invalid-source fallback control, flagged-record refusal and desktop/narrow inspection. The script requires the maintained strict Chromium sandbox admission; its presence is not an executed browser receipt.

These capabilities reduce original-record transcription and connect measured source values to a declared model comparison. They do not validate the illustrative thermal parameters, infer physical layer depth, establish instrument uncertainty, supply an engineering design approval or perform a field intervention.

## Current-source browser receiving

Composed on current main `0ed48d9d117a7f4a8f1548f837843faaa12e9b8b`, preserving incoming exact lateral-heat application and fixed-rain-geometry work. All 1,127 base blobs and the twelve proposed source paths were checked. Ten native groups pass. The actual sandbox-assessed Chrome course passes six groups: ordinary workbench entry, original file admission, maintained failed calibration, real source-only download and fresh reopen, changed original span, malformed identity and source refusal, keyboard use and desktop/390px rendering. Both result layouts were inspected. The initial harness waited only for HTML controls and timed out before source receipt; it now waits for module initialization and fresh page readiness, with explicit diagnostic capture. No product correction was needed for that timing issue. Final published-source receiving is recorded separately on the PR.
