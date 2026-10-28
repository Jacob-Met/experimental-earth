# Continuous mapped diffuse sky

The continuous column method accounts for every azimuth and visible elevation above the original horizontal ground receiver. It uses the retained opaque, ground-filled column geometry and isotropic sky radiance. It does not require an angular sample count. Direct beam and the thermal time intervals keep their existing models.

The separate [authored directional-brightness option](SHADE_HEAT_WEIGHTED_SKY.md) reuses this horizon and elevation integral with declared relative azimuth weights. It has its own v5 input model; the isotropic method and its v4 files retain their original meaning.

Enable mapped diffuse obstruction in the shade and heat settings and choose continuous columns. The sampling controls retire. The sky inspector lets you choose existing or proposal geometry and minimum or maximum roofs, then inspect each angular sector and its controlling source. Keyboard input changes the selected sector. Minimum roofs give the upper diffuse transmission estimate; maximum roofs give the lower estimate.

## Why a separate method

In a finite enclosure, a sufficiently high elevation ray can pass above every roof. A midpoint direction grid may miss that small opening and report zero sampled transmission. The continuous method retains the opening without asking the user to select increasingly fine grids.

For the authored courtyard with direct beam zero and diffuse input 80 W/m²:

| Diffuse method | Proposal transmission | Final proposal surface °C |
| --- | ---: | ---: |
| Uniform input | 1 | 25.85192655048 |
| 512 midpoint directions | 0.78515625 | 24.59467670565 |
| 4096 midpoint directions | 0.78076171875 | 24.568960 |
| Continuous columns | 0.7808293973514892 | 24.569356281758342 |

These are authored numerical outputs. The sampled and continuous methods also use different grazing conventions, so their difference is not a certified quadrature-error estimate. The clear existing geometry retains transmission 1 and the uniform-input temperature in this course.

## Horizon integral

Let a column roof be H metres above the receiver. For a horizontal azimuth ray that first enters its rectangular footprint at distance d, the column blocks elevations with tangent at most H/d. Roofs at or below the receiver contribute no obstruction to its upper hemisphere. Because columns are filled from below the receiver, there is no elevated opening beneath them.

At azimuth θ, the horizon slope h(θ) is the largest H/d among intersected columns. Horizontal projected irradiance has elevation weight sin(e) cos(e). Integrating the visible elevations gives the projected fraction 1 / (1 + h(θ)²). Transmission is the azimuth average:

```text
T = (1 / (2π)) ∫₀²π 1 / (1 + h(θ)²) dθ
```

This is projected irradiance transmission, rather than unweighted sky solid angle. The isotropic radiance assumption is the same as the [Sandia PV Performance Modeling Collaborative isotropic model](https://pvpmc.sandia.gov/modeling-guide/1-weather-design-inputs/plane-of-array-poa-irradiance/calculating-poa-irradiance/poa-sky-diffuse/isotropic-sky-diffuse-model/); the obstruction algorithm here is a separately derived addition.

The implementation splits azimuth at footprint corners and cardinal directions. Within an open sector, each intersected rectangle has a fixed entering face. An x face contributes A|cos θ| and a y face contributes B|sin θ|. Only the greatest coefficient of each kind can control the horizon. There is at most one crossover between those two terms inside a sector.

Each resulting arc has an analytic projected integral. For an x face with coefficient A, define g = hypot(1, A). An antiderivative is the continuously unwrapped angle atan2(sin θ, g cos θ) divided by g. The implementation computes the angle between the transformed endpoint vectors with atan2(cross, dot). Cardinal subdivision keeps each arc within one quadrant and avoids branch-wrap subtraction. A y face uses the corresponding swapped coordinates. Unobstructed arcs integrate their angular width directly.

The result retains every arc's radian and degree endpoints, positive angular width, integral contribution and controlling cell/source when present. Distinct tiny radian angles can round to the same degree value; the radian fields retain the calculation's representation. Summation uses compensation.

## Geometry, limits and numerical meaning

The public entry point `compareContinuousSkyAt(project, cellIndex)` obtains an independently copied receiver and column geometry through the same admitted source/context path as maintained solar calculations. It refuses declared receiver footprints, missing or stale source context, unsupported cells and malformed geometry. Shared column construction preserves existing scalar, batch and whole-map behavior.

Each scenario is evaluated twice: all declared minimum roofs and all declared maximum roofs. Those coherent endpoint geometries give the upper and lower diffuse transmission estimates. The declaration supports at most 575 other columns, and both geometry and the complete heat calculation retain a 16-million work allowance. Heat preflight includes direct-beam checks and a conservative bound on all four skyline integrations; the result reports actual continuous face checks separately from beam ray estimates.

These are binary64 analytic estimates, not certified numerical enclosures. Nearly duplicate angular cuts can collapse at machine precision. The result reports `collapsedSectors` and `omittedAngularWidthRad`, together with the raw transmission and any tiny upper-bound clamp. No fixed numerical tolerance is claimed as an error certificate. Unsupported work and unresolved integrals refuse rather than silently reverting to sampled sky.

The continuous geometry uses exact declared column faces without the maintained ray classifier's erosion/dilation padding. Its height ranges do not enclose that grazing convention, direct-beam temporal sampling error, omitted or off-map objects, anisotropic sky brightness, reflection, foliage transmission or physical prediction error. The receiver remains the original ground centre. There is no tilted-surface, elevated-receiver or field-calibration claim.

## Thermal coupling and source-only replay

Continuous transmission multiplies diffuse-horizontal irradiance through the existing mapped-forcing helper and two-store thermal solver. It is constant for a static retained geometry, while original hourly irradiance and ambient temperature still vary with time. Existing energy accounting remains in use. Setting diffuse input to zero preserves the tested thermal histories exactly.

The declaration is exactly `diffuseSky: { method: 'continuous-columns' }`. Sampling fields and unsupported method keys refuse. Constant and original-hourly courses use the distinct input kind `experimental-earth/shade-heat-inputs/4`, model `continuous-isotropic-column-sky-midpoint-two-store`, and sky model `experimental-earth/continuous-column-sky/1`. The saved envelope retains only kind, model, original project and declaration. It contains no accepted report, skyline or temperature result. Reopening validates the admitted source context and recomputes geometry and thermal output.

Legacy uniform v1/v2 and sampled v3 formats keep their meanings. A method change retires current calculation and export actions, cancels old work and prevents a delayed old file from replacing the newer draft. Actual worker preparation, serialization and reopening use the same ownership rules as the maintained sampled investigation.

## Qualification

The frozen version-2 candidate passed 122 native groups with no failures before the solar-sampling companion merged. Six maintained continuous-geometry groups cover finite-wall and square-enclosure closed forms, coherent height endpoints, source/footprint and frozen-input isolation, sparse/malformed admission, full 24 by 24 grids and nonbinary cell sizes. Five independently authored thermal groups cover scaled-DHI equivalence, exact zero-DHI invariance, intermediate-height thermal bracketing, constant/hourly v4 replay and forged/stale-source refusal. A separate compatibility harness compares complete reports, serialized bytes and reopened structures with the actual saved v1/v2/v3 predecessor modules.

An independent reviewer derived the horizon integral and built a direct slab-distance/adaptive Gauss-Legendre oracle without the face antiderivative. Thirteen geometries agreed within 4.45e-16 absolute transmission in the observed runs. Other independent controls covered 13,000 maintained unpadded ray classifications, 512 primitive comparisons through coefficient 960, and 45 grid courses with 90 integrations. The oracle sometimes reached its depth limit and is not a certified tolerance bound. A final root replay of the unchanged independent fixture, corner and sparse-admission harnesses passes against the exact delivered kernel.

The review found that sparse arrays could bypass ordinary array iteration and produce clear sky. Admission now materializes all positions before validation; the preserved counterexamples refuse. Two further deliberate faults were applied only to private copies. Removing the projection-scale division caused the independent finite-wall and enclosure checks to fail. Using absolute roof height caused the independent stepped-geometry oracle comparison to fail. The delivered source remained unchanged.

Six actual browser groups passed on the frozen continuous candidate: worker/native thermal agreement; real constant v4 download and fresh reopening; forged-result refusal and delayed-file retirement; original-hourly v4 download and fresh reopening; height/keyboard sector inspection; and desktop/390 px controls. All 615 JavaScript, module, HTML and CSS files in that frozen candidate, including tests, matched its browser-tested copy. The existing sampled-sky course separately passed all nine groups; its only later source change in that candidate was continuous-inspector wording. Both courses recorded an active Chromium sandbox and no application exceptions. Screenshots were used for visual inspection.

## Composition with solar sampling

The preceding qualified composition used main `3d574d48d1c1b7c6c953fb80f96ab7826d3a59cd`, including PR #464's solar-sampling companion. Its extracted input-only source admission and midpoint-forcing helper remain available. Source admission retains the original v1/v2/v3/v4 kinds without calculating a solar or thermal course. The point-only geometry calculation and static mapped-sky forcing compose through the extracted helper; original weather hours and source bytes are preserved.

The companion's saved `shade-heat-sampling/1` model keeps uniform diffuse input. Comparing its 60/30/15-minute grids with either mapped-sky model is explicitly refused before a derived course starts. The companion run control explains this limit when a mapped-sky parent is accepted. Previously saved uniform-diffuse sampling inputs can still reopen independently beside that parent. A method or source edit retires the child comparison and delayed file work. The companion's own model, numerical module, panel, original receiving course and source format are unchanged.

The composed source passes 126 native groups, including the companion's independent numerical tests and two new integration groups. The six continuous-sky browser groups pass again. All eight unchanged solar-sampling browser groups also pass, plus four new browser groups for switching between the models, actual source-only download, independent saved sampling reopening and delayed-read retirement. Each browser course records an active sandbox and no application exceptions; the composed 390-pixel controls and sampling layout were inspected. These results qualify the stated numerical and consumer behavior. Repository integration and accepted-main receiving are recorded separately from these source-bound checks; physical validation and public release are not implied.

## Current main composition

The candidate now uses main `6e7344181992372c3ed6064ca6ad2e4d1245a66e`. The 17 incoming paths, including solar-benefit interpretation, its sampling panel and receiving course, and rain-proposal comparison, are preserved exactly. The reviewed sky production files are unchanged from the preceding composition. All 127 targeted native tests pass on this source. The current maintained solar-sampling browser course passes eight groups, and the sky/sampling interaction course passes four. Both used the actual module worker and an active Chrome 156 sandbox, with no application exceptions; their narrow controls and chart were inspected. All runtime and browser-test source files match the executed copies. The earlier six-group continuous course and independent numerical review retain their own source-bound scope in the receipt.

An interrupted object-only tree write for the older base remains outcome-unknown and unreplayed. The current composition is a distinct integration on the newer main; source publication, normal merge and accepted-main receiving are recorded separately.
