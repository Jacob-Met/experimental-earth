# Mapped diffuse sky in shade and heat

The shade and heat investigation can optionally account for mapped columns and stepped terrain obstructing diffuse light at the saved ground point. Direct beam retains the maintained midpoint solar model. Both optional diffuse methods use an equally bright sky and the declared ground-column geometry.

The default remains unchanged diffuse-horizontal irradiance. Select **Include mapped diffuse-sky obstruction** in the shade and heat settings, then choose sampled directions or continuous columns. Sampled directions remains the initial optional method. The authored example with direct-normal irradiance set to zero isolates the diffuse effect. Inspect the directions or continuous horizon sectors to see the mapped witnesses, and download the original site and investigation inputs to repeat the calculation.

The [continuous column method](SHADE_HEAT_CONTINUOUS_SKY.md) integrates the declared unpadded horizon over all azimuths and visible elevations. It removes the diffuse angular-grid choice and retains finite zenith openings that a sampled grid may miss. Its floating-point estimates and height endpoints are distinct from the sampled ray classifier's epsilon/grazing ranges.

## Sampled model

The isotropic assumption is uniform sky radiance, as described by the [Sandia PV Performance Modeling Collaborative](https://pvpmc.sandia.gov/modeling-guide/1-weather-design-inputs/plane-of-array-poa-irradiance/calculating-poa-irradiance/poa-sky-diffuse/isotropic-sky-diffuse-model/). This implementation adds opaque mapped obstruction at a horizontal receiver; it does not implement a calibrated sky-brightness distribution.

For elevation e and azimuth theta, horizontal projected irradiance is proportional to sin(e) cos(e) de dtheta. Substitution u = sin(e)^2 gives equal irradiance weights for equal bins in u and azimuth. Each bin is sampled at its midpoint.

The default is 32 azimuth samples and 16 elevation bands. Admitted declarations require:

- 4–128 azimuth samples in multiples of four.
- 1–64 elevation bands.
- At most 4096 total directions.
- One original ground cell outside the declared column footprints.
- Current retained geometry and supported site declarations.

Each direction uses the maintained ray/slab calculations and their obstruction status and source witness. Clear direction counts determine the lower transmission. Total directions minus blocked direction counts determine the upper transmission. Both integer counts are divided by the same total, so nonbinary fractions do not create a false uncertainty interval through subtraction rounding.

These are bounds on the sampled declared geometry. They do not bound angular sampling error, unrecorded objects or objects outside the mapped source. A high finite enclosure can block every sampled direction while still admitting a small continuous region near the zenith. Reflected light, anisotropic sky brightness and foliage transmission are omitted.

## Thermal coupling

For each scenario and thermal interval, incident input is:

- Direct-normal irradiance times horizontal projection times maintained beam transmission.
- Plus diffuse-horizontal irradiance times transmission from the chosen diffuse method.

The sky geometry is static across the dated course. Original hourly weather, when supplied, retains its exact original JSON and hourly direct/diffuse/ambient records. The existing thermal solver, material declarations and cumulative energy accounting remain in use.

Uncertain sampled geometry produces lower and upper input courses. Those extremes are conservative choices within this sampled model; they do not assert one simultaneous realization of every uncertain height, continuous sunlight between temporal samples, formal floating-point bounds or physical validation.

At night, an explicitly nonzero diffuse input still contributes according to the declared model. Declare zero when that is the intended forcing.

## Bounded direction batching

The diffuse investigation admits its unchanged original source, receiver and complete direction population once through `compareSolarDirectionsAt`. The API allows at most 4096 directions and 16 million estimated ray checks. It copies the source once and retains the existing ray/slab arithmetic, direction conversion, epsilon, column order and witness tie behavior for every direction. Scalar and whole-map entry points keep their original validation. Geometry columns are still rebuilt per ray.

On an authored 24 by 24 grid, separate fresh Node processes measured the complete `compareShadeHeat` call, including all direction details:

| Directions | Prior qualified milliseconds | Batched milliseconds | Prior peak RSS KiB | Batched peak RSS KiB |
| ---: | ---: | ---: | ---: | ---: |
| 512 | 1559 | 440 | 80396 | 59916 |
| 4096 | 6777 | 1688 | 113084 | 79040 |

These are individual observed runs, not general speed or memory guarantees. Peak RSS covers the entire process. A separate instrumented 4096-direction run attributed about 88% of its elapsed time to repeated project validation and source-context construction; instrumentation itself adds overhead. Whole reports, source bytes and witnesses matched the qualified scalar version in the tested courses.

## Authored changed-input control

In the authored courtyard with direct beam zero and diffuse input 80 W/m², the original uniform-diffuse course gives the same final surface temperature for existing and proposal: 25.851927 °C. With 512 sky directions, existing remains 25.851927 °C and proposal becomes 24.594677 °C. Proposal transmission is 0.78515625, giving 62.8125 W/m².

These are authored model outputs, not field measurements. Changing the direction grid changes the answer nonmonotonically:

| Directions | Proposal transmission | Final surface °C |
| ---: | ---: | ---: |
| 128 | 0.78125 | 24.571818 |
| 512 | 0.78515625 | 24.594677 |
| 2048 | 0.7802734375 | 24.566103 |
| 4096 | 0.78076171875 | 24.568960 |

This comparison demonstrates sampling sensitivity; it does not establish convergence or a continuous-sky error bound. Setting diffuse input to zero leaves the tested thermal trajectories and energy accounting unchanged.

## Source-only persistence and computation ownership

Legacy v1 constant and v2 hourly files retain their existing saved bytes for the tested original courses. The only intentional legacy report change is the selected-point work estimate: heating evaluates the saved ground point instead of constructing every receiver map.

A sampled diffuse declaration uses the v3 input kind, for either constant or hourly weather. Continuous columns uses a separate v4 kind and the declaration `diffuseSky: { method: 'continuous-columns' }`. Sampling fields are refused for that method. The saved envelope contains only kind, model, original project and declaration. Reopening recomputes all geometry and thermal results. Saved reports and altered model envelopes are refused.

Preparation, reopening and export validation use an owned module worker. Changing the input cancels its computation. Late completion from a retired worker cannot settle or terminate its successor. During file reads and computation, explicit pending status identifies any prior accepted comparison still visible; compare/export actions are retired until the current request resolves. Refused files retain the previous accepted investigation.

## Verification

The final continuous-sky composition passed 122 targeted native groups on Node 24.22.1 against repository base 3b7f6bff95515339f0198b1edc714edb5b013b00. The preceding batched sampled-sky candidate passed 111 of those groups, including four for the bounded batch API, complete scalar report/witness parity, population admission, source binding, frozen inputs and returned-result isolation. Six new groups cover continuous geometry and five cover thermal coupling and typed v4 replay.

- The final continuous method passed six actual browser groups, including worker execution, constant and original-hourly v4 download and fresh reopening, forged-report refusal, delayed-file retirement after a method change, keyboard sector inspection and desktop/390 px layouts. All 615 JavaScript, module, HTML and CSS files, including tests, match the browser-tested copy. The final narrow-label repair is included in that copy.
- The same composition separately passed all nine existing sampled-sky browser groups. The only later change was continuous-inspector wording in `shade-heat-panel.js`; the sampled branch did not change. Both courses recorded no application exceptions and an active Chromium sandbox.
- Separately loaded modules preserve complete v1/v2/v3 reports, serialized input bytes and reopened structures relative to the saved batched candidate. The independent continuous derivation, slab/quadrature oracle, final-kernel replay and two detected deliberate calculation faults are detailed in the continuous-method documentation.

The following evidence belongs to the preceding point, sampled-sky and batching qualifications and remains in the package with its original scope:

- Three native comparisons against the separate original source preserve whole legacy reports after the intentional point-work estimate adjustment and preserve v1/v2 saved bytes exactly.
- The preceding diffuse-sky UI candidate passed 24 real-browser groups: nine sky, nine maintained shade/heat and six maintained hourly-weather groups. Checks included input-only downloads and fresh reopening, arbitrary valid sampling, changed sources, forged report refusal, pending files, failed worker construction, late real-worker completions, keyboard controls and desktop/390 px layouts. No application exceptions were recorded.
- The batched successor separately passed an actual 24 by 24, 4096-direction browser course with real worker parse, serialize and reopen operations, native thermal parity, source-only persistence, unchanged working-site storage and an advancing main-thread heartbeat. All 365 runtime JavaScript, module, HTML and CSS files in that version matched its browser-tested copy exactly. The only runtime differences from its preceding UI candidate were the two reviewed batching modules.
- Namespace, PID/network, Seccomp-BPF and TSYNC protections were active in the browser runs. The full-grid harness emitted its sandbox status and result to captured execution stdout; its retained evidence explicitly records subsequent transcription and does not claim a standalone session log or screenshots.
- Batch qualification includes 27 complete report/ray parity controls and 341 independent controls, including 320 full scalar/batch ray and witness comparisons, malformed source/direction refusals, source-context changes and 4096/4097 population boundaries. Independent reviews found no blocker within the maintained plain-data/JSON consumer scope.
- Earlier independent reviews checked projected-horizontal quadrature, sampled uncertainty, forcing parity and asynchronous computation ownership. Numerical experiments remain separate from physical validation.

The native command is:

~~~sh
node --test --test-isolation=none --test-reporter=tap tests/solar*.test.mjs tests/shade-heat*.test.mjs tests/diffuse-sky.test.mjs tests/continuous-sky.test.mjs
~~~

Use an existing compatible Chrome executable through CHROME_BIN when running these maintained browser courses:

~~~sh
node tests/shade-heat-sky.browser.mjs
node tests/shade-heat-continuous-sky.browser.mjs
node tests/shade-heat.browser.mjs
node tests/shade-heat-weather.browser.mjs
~~~

The maintained browser owner requires the active Chromium sandbox. See the compact receipt in docs/receipts/diffuse-sky-52d429.json. Current-main composition and its additional native/browser checks are documented in SHADE_HEAT_CONTINUOUS_SKY.md and the version4 qualification receipt. Repository publication, normal merge and accepted-main receiving remain separate gates; no public release or physical-feasibility claim follows from source qualification.
