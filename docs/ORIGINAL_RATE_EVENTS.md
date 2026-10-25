# Original rainfall and runoff event comparison

This investigation compares original rate samples without treating them as collected-volume observations. Follow the original-rate comparison link from the Rain Lab, then explicitly open the acquired USDA DRY/WET comparison or supply two attributed event extracts. Inspect their original times, rainfall, run-on, runoff and source lines. Source-only JSON download/reopen recomputes the comparison. The example action reads a bundled source-only account; it never replaces the main Rain Lab project.

## Input

Each event supplies an event label, source/conditions reference, filename and CSV:

```csv
minute,rain_mm_hr,runon_mm_hr,runoff_mm_hr,source_line
0,74,0,0,2
6.33,74,0,0,3
7,74,0,5,4
```

These three rows are an excerpt of acquired USDA observations, not a complete event. Use the complete event for an actual comparison. `source_line` refers to the original source, while the importer separately retains the physical line in the supplied extract. Neither constitutes file authentication. Source strings remain text and are never executed.

Every event has 2–512 strictly increasing original samples, at most 128000 UTF-8 bytes, 0–1440 minutes, and up to six decimal minute places. Integer micro-minute keys align only exactly coincident admitted times; no rounding, sorting, merging or interpolation invents observations. Rate arithmetic uses the maintained decimal-to-Number parser and ordinary floating-point subtraction; it is not exact decimal arithmetic. Rates are bounded to 0–10000 mm/h. A nonzero decimal that underflows to zero is refused.

`NA` remains missing for any rate. Run-on additionally admits `rate1`–`rate5`, the USDA source's labels for unknown nonzero inputs. An unknown input is never silently replaced by zero. A comparison difference remains unavailable unless both original values are numeric observations.

## Meaning

The point display and full tables show original rates. Highest sampled runoff is not a continuous-time peak. First positive sample is not a measured onset time. A gap is a sampling gap, not a dry interval. Matching run-relative time does not establish matching rainfall, run-on, site conditions or initial moisture. The separate rainfall/run-on differences help expose those distinctions.

The page does not fit a hydraulic model, infer a causal treatment effect, calculate a measured total, convert rates into collection evidence, or modify the Rain Lab project. It does not estimate measurement uncertainty. The original input and missingness remain available for a later scientifically qualified consumer.

## Acquired source qualification

Primary source: [USDA Ag Data Commons, rainfall simulation experiments using the Walnut Gulch Rainfall Simulator](https://agdatacommons.nal.usda.gov/articles/dataset/Rainfall_simulation_experiments_in_the_Southwestern_USA_using_the_Walnut_Gulch_Rainfall_Simulator/24852309), DOI `10.15482/USDA.ADC/1358583`, U.S. Public Domain. The corrected 2017 table supersedes the older rainfall table.

The ordinary public downloads were acquired and checked against the public metadata's byte sizes and MD5 checksums. Retained SHA256 values:

| File | Figshare ID | Bytes | SHA256 |
| --- | --- | ---: | --- |
| Rainfall simulation (R11272017).csv | 43727238 | 945935 | `6db82e5c484e99f1663e9b0e7259572be97a7c99e12a928db204403b7a23c9d9` |
| Data dictionary.csv | 43727163 | 5397 | `b64e976b2761885919de2954a5586cc50243f865254fe76c7d70d39d93d461ed` |

The dictionary defines time from precipitation commencement and runoff as flow rate at the plot outlet in mm/h. Methods describe a calibrated flume and variable sampling. They do not turn each row into an interval-mean rate, a measured collection volume, or a supplied uncertainty band. The experimental plots have three bordered sides and a downslope collection outlet; correspondence with the conceptual model's all-edge outlet has not been established.

The first complete numeric zero-run-on DRY event in source order is ER2, natural condition N, plot1, 2013-07-30. Its13 original samples span0–46.33 minutes, with a largest10-minute gap and highest sampled runoff14mm/h at15,20 and25minutes. Selection did not use a model result. Primary methods describe sequential DRY/WET runs with a pause and different forcing/antecedent conditions; matching plot/date does not make those runs interchangeable.

An exact-decimal inspection of that DRY event gives7.4111667mm under left-step integration,6.9671667mm under right-step integration, and7.1891667mm under linear interpolation. The left/right difference is exactly0.444mm for the retained decimals. These are deliberately different assumed reconstructions, not measured totals, uncertainty bounds or evidence of which reconstruction is correct. The consumer therefore retains original samples and does not import any of these estimates as collection readings.

## Verification state

Six native groups pass: acquired DRY sample facts/source preservation; exact-time and missing-input distinctions; source-only replay with recomputed derived fields; malformed/order/capacity/underflow refusal; all 51 original paired rows with independently checked coincident-time differences; and aggregate serialized-source refusal before producing a file beyond the 300 KB reopen limit.

The actual sandboxed Chrome receiving course exercises the acquired pair through the main Rain Lab link, original CSV files, keyboard activation, all original rows, source-only download and fresh reopen after divergence, same-file restoration, delayed replay/example retirement and a 390 px viewport. It waits for the installed module handlers instead of treating parsed HTML as application readiness. The narrow table keeps headers and numeric tokens intact in a keyboard-scrollable table. Independent numerical/source and UI reviews found no remaining blocker; exact source and runtime evidence accompany the published receipt. These software checks do not establish model fit, measurement uncertainty or a causal wetness effect.

## Reproduce the acquired extract

With the public corrected CSV already acquired, `python research/select-usda-rate-pair.py /path/to/revised.csv /tmp/usda-pair.json` verifies its full SHA256 before selecting the exact plot/date. Then `python research/build-usda-rate-example.py /tmp/usda-pair.json /tmp/usda-comparison.json` preserves every admitted rate token and original line. `python research/check-usda-rate-semantics.py research/usda-er2-dry.json` reproduces the independent decimal reconstruction control. These scripts do not download data, sort observations or omit rows to make an event pass.
