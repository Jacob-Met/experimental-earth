# Shade and stored heat

The **What does a shade change do to stored heat?** investigation connects the
maintained mapped-obstruction calculation to the maintained two-store thermal
response. A person can compare a dated shade proposal at the saved heat point,
inspect its surface and lower-store history, and retain the original source for
independent reopening. It does not edit the original sun or heat investigation.

## Use the actual workbench

1. Save the site's sourced obstruction declaration, surface properties and lower
   heat store in the existing instruments. Select **Use saved site declarations**
   in the Shade + Heat panel. The saved thermal point determines the ground sample.
2. Enter geographic position, grid bearing, explicit UTC start/end and interval;
   retain the location and orientation basis. Supply constant direct-normal and
   diffuse-horizontal irradiance, reservoir temperature, and their source or
   explicit assumption. Up to 24 numerical intervals within one day are admitted.
3. Compare the temperature courses. Switch between surface and lower heat store,
   move the time control, and inspect the mapped obstruction witness and energy
   balance. A proposed material change and a shade change both affect the response;
   the comparison does not attribute their combined effect to shade alone.
4. Download the original site and raw investigation inputs. The file includes
   the declared location. Reopening recomputes against its original source and
   keeps the current working site intact. No stored temperature verdict is trusted.

**Explore authored shade example** opens an isolated invented courtyard: a
three-metre opaque column lies east of the selected ground point, with identical
materials in both scenarios. Its weather, coordinates and geometry are labeled
assumptions. Exploring it never replaces the working site.

## Receive original hourly weather

**Use NASA POWER hourly JSON** receives one complete UTC day without an online
request from the workbench. Obtain a point response in JSON with the parameters
`ALLSKY_SFC_SW_DNI`, `ALLSKY_SFC_SW_DIFF` and `T2M`, `start` equal to `end`, and
`time-standard=UTC`. The [POWER hourly API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/hourly/)
explains the point request and source resolution. Its default local solar time is
not UTC; the receiver refuses an LST file. NASA's [time convention](https://power.larc.nasa.gov/docs/faqs/other/)
defines a timestamp as the start of the entire hour.

After selecting the original site or isolated example, import that JSON, inspect
its point and UTC day, confirm the grid bearing and its source, then compare. The
point, start/end and 60-minute intervals stay attached to the original data. Each
hour supplies a separate direct-normal input, diffuse-horizontal input and ambient
reservoir temperature. The time inspector shows the original source key and values.
**Use constant weather** removes that attachment, retires the result and restores
explicit constant inputs. Changing sites does not manufacture new weather data.

The supported hourly response units are **Wh/m^2** for each radiation quantity and
**C** for T2M. Radiation energy is divided by the original one-hour duration to
obtain average W/m²; the numerical equality is not a relabeling of equal units.
T2M is used as the ambient reservoir. It is not a measured surface or lower-store
temperature, and the initial stores still come from the declared thermal model.

The full 24-record course is admitted before simulation. All three parameters must
have exactly the same start-of-hour keys for the declared calendar day. Missing or
fill-valued hours, strings in place of numbers, wrong units, impossible dates,
unsupported coordinates and values, multi-day files, invalid UTF-8 and files over
256 KiB are refused without truncation, imputation or clamping. A failed import
preserves the prior accepted investigation. The original JSON text, including its
header and additional metadata, stays in the input-only download.

Source point data retains its original spatial resolution. Uploaded metadata is a
source declaration, not authentication or a local field measurement. The model
projects hourly mean DNI using the midpoint sun angle and obstruction; it does not
integrate continuous sunlight or reproduce observed horizontal direct energy.
Diffuse sky-view changes remain outside the model. A weather record does not
validate the invented geometry, material assumptions or predicted temperatures.

An internal source-receiving experiment used the public POWER response for
2025-06-21 at 51.5°N, 0.1°W with the invented courtyard. Its hourly existing-surface
model peak was 58.8526°C; replacing those records with daily arithmetic means gave
39.5867°C. This demonstrates sensitivity to temporal forcing, not physical accuracy.
The maintained offline test fixture is explicitly authored and is not distributed
as a weather observation.

## The calculation

For a horizontal plane, unblocked direct-normal irradiance projects as
`DNI × sin(solar elevation)`. Diffuse-horizontal irradiance is a separate input.
This is the ordinary horizontal irradiance decomposition described by
[Sandia's PV Performance Modeling Collaborative](https://pvpmc.sandia.gov/modeling-guide/1-weather-design-inputs/irradiance-insolation/global-horizontal-irradiance/).

At each interval midpoint, the existing pinned SunCalc model gives apparent
elevation and grid-relative direction. The existing opaque-column and stepped
terrain kernel supplies the original obstruction status and witness. The coupled
forcing is held constant for that numerical interval:

`incident = diffuse + transmission × directNormal × max(0, sin(elevation))`

| Original mapped status | Beam transmission in the coupled interval |
|---|---|
| Blocked, below horizon | 0 |
| No mapped blocker | 1, conditional on the declared mapped scene |
| Height dependent, grazing, positive elevation below 1° | 0 to 1 |
| Inside a declared column footprint | Refused; the point is not modeled as exposed ground |

Original times use whole UTC seconds. When an odd-second final interval has a
half-second midpoint, the earlier whole second is used and its −0.5-second offset
is retained in the report. No implicit local timezone is used.

The declared diffuse input is deliberately unchanged by geometry. It remains a
declared forcing even at night; supply zero where appropriate. The instrument does
not estimate cloud, sky-view attenuation, reflected light or foliage transmission.

For each scenario, `evaluateHeatColumnTarget` receives lower and upper incident
schedules using the original surface/lower-store properties. Its exact-real
constant-forcing propagator, floating-point implementation, energy accounting and
interior turning-point calculation remain the single thermal implementation.

Positive capacities and nonnegative coupling make the two-temperature system
cooperative: the off-diagonal response terms are `g/C_surface` and `g/C_lower`.
Increasing incident input with fixed parameters cannot decrease either store's
temperature. Therefore the two extreme incident schedules enclose temperature
courses formed from independent intermediate beam choices. Maximum-temperature
ranges use the maxima of those extreme courses, including their interior extrema.
Proposal-minus-existing uses the conservative cross-scenario range
`[proposalLower − existingUpper, proposalUpper − existingLower]`.

These are conditional floating-point engineering envelopes. Independent choices
at successive times may not correspond to one physical realization of all column
heights. The bands do not enclose changing sunlight between midpoint samples or
establish convergence, physical accuracy, thermal comfort or safe temperatures.
Changing interval width can materially change a result. The lower boundary is
insulated; lateral heat, moisture and nonlinear thermal radiation remain outside
the maintained two-store model.

## Source and lifecycle

The complete original project, model identifiers and normalized input declaration
are retained in `experimental-earth/shade-heat-inputs/1` for constant declarations or
`experimental-earth/shade-heat-inputs/2` for original hourly weather. Both reopen through
the same maintained consumer; v2 also pins the hourly receiver identifier. The outer envelope rejects
unknown fields, including forged derived reports. Model identifiers must match.
Portable-project admission preserves the original site's own validation and byte
limit; the complete coupled input file is limited to 5 MiB.

Changing a field removes the displayed result. Editing a working site retires its
selected snapshot. An independently reopened investigation keeps its own original
source. Late file reads cannot overwrite a newer draft; failed imports preserve the
prior accepted investigation. The native file selection resets immediately after
capture so the same file can be selected again after a stale read. Source strings
are rendered as text.

## Verification

`node --test tests/shade-heat.test.mjs` exercises independent horizontal projection
and first-order thermal arithmetic, shade/control divergence, zero-beam and night
controls, original-kernel witnesses, positive-system envelopes across intermediate
column heights, signed energy accounting, changed numerical intervals, raw-file
replay, stale-source refusal and complete-work limits.

`node tests/shade-heat.browser.mjs` runs the actual maintained application with the
shared active-sandbox Chromium session owner. It receives original-site import,
changed irradiance, literal source text, real input-only download and reopening,
forged-result refusal, stale file completion and same-file reselection, changed
working sites, uncertainty bands, keyboard inspection and desktop/390 px rendering.

The original complete course is refused before partial output if its conservative
all-cell ray-work estimate exceeds 16 million checks. This first integration reuses
the maintained 24-interval heat contract. No new solver, observation fitter,
provider runtime, deployment or physical intervention is introduced.

`node --test tests/weather-power.test.mjs tests/shade-heat-weather.test.mjs`
exercises complete source/clock/unit receiving, missing data, changed hourly
ambient forcing, independent first-order recurrence at every hour, location/day
binding, and original v1/v2 replay. `node tests/shade-heat-weather.browser.mjs`
receives actual files through the application, downloads and reopens the complete
source, rejects LST and invalid UTF-8 transactionally, supersedes late reads,
reselects the same file, returns to constant mode and inspects the narrow layout.
The original shade-and-heat browser course continues to exercise v1 receiving.
