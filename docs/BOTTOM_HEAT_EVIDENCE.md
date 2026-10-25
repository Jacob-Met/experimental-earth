# Surface readings and a continuous deep-reservoir range

The lower-boundary workflow can now retain original surface-temperature bands against explicitly offered bottom conductances. It keeps the original exposure, surface and lower capacities, internal conductance, surface ambient exchange and both initial temperatures fixed.

## Use the retained original source

1. Compare or reopen a bottom-heat investigation. In its **Which deep-reservoir alternatives survive surface readings?** section, choose **Use retained accepted original source**. This copies accepted inputs, not unsaved bottom drafts. A new source starts blank reading and alternative declarations.
2. Choose the observed place and explain the association between that original source and the readings.
3. Offer up to nine distinct bottom conductances. Give each a label, source and continuous reservoir-temperature interval. A fixed interval is allowed; it checks that declared value rather than estimating a range.
4. Add original sourced surface readings, their comparison half-widths and calibration/held-aside roles. For an interval mean, give its complete start and end. Do not reinterpret air, subsurface or final-five-minute readings as whole-hour surface means.
5. Compare. Inspect each alternative's calibration interval before its separate held-aside intersection. The chart shows nominal band intervals; separate details expose arithmetic allowances and unresolved contact. Fixed domains receive a single axis label, tiny positive conductances use scientific notation, and a nonzero interval is never collapsed into one rounded temperature in the text. Rejected and unsupported alternatives remain visible.
6. Download the original surface investigation. Reopening recomputes from the original source and raw declarations, independently of the current workspace. No parameter is adopted. Draft edits hide old results; restoring recovers the accepted original inputs. Invalid or late file replacements cannot overwrite newer work.

The input-only file has a 4 MiB UTF-8 limit, including the canonical pretty representation used for download. Original source, operator, interval, role, label and association text are retained. Derived saved verdicts are not trusted.

## The actual inference

For each offered bottom conductance b, the fixed two-store equations are linear in the constant deep reservoir temperature. At any fixed time, and for a complete interval mean, the surface prediction is affine over the declared reservoir range. The consumer evaluates the two declared endpoints using the maintained bottom propagator. It never extrapolates to a reservoir value outside that range or searches a coarse temperature grid.

Each original band cuts an interval from that continuous range. Calibration rows intersect with one another; held-aside rows intersect separately. Their final intersection is displayed without changing the calibration interval, refitting the forcing or selecting a preferred alternative. The normalized affine-band arithmetic is reused from the maintained cooling-fraction inference; its old callers and behavior remain unchanged.

At b=0, deep temperature cannot affect either store. At zero internal coupling, the surface cannot reveal the deep reservoir even when the lower store exchanges heat. Those cases keep the full compatible declared range rather than dividing by zero and inventing identification. If endpoint variation is no greater than twice the separately reported numerical allowance, the consumer does not manufacture a narrow inverse. A band that strictly contains the entire guard-expanded prediction range retains the full nominal reservoir interval. Exact contact with either guard-expanded endpoint does not establish that nominal interval and remains numerical contact; inclusive equality is not used for this enclosure rule.

Nominal intervals use the original stated bands. Arithmetic-allowance intervals are reported separately. A result supported only by that allowance is marked numerical contact. The allowance scales with source temperatures, transfers, capacities and forcing count; it is an engineering floating-point allowance, not a certified error enclosure, measurement uncertainty or statistical confidence interval.

Every endpoint's complete course is checked, including forcing boundaries and interior extrema, before observations are used. An unsupported endpoint leaves that alternative explicitly uncomputed. For this affine fixed-source model, the endpoint courses span temperatures across the declared reservoir interval. No unsupported course is replaced by the closest remaining fit.

## True interval means

The observation operator integrates over every original forcing segment intersecting the reading window. It advances to each overlap start, uses the maintained analytic mean of that overlap, then combines segment means with normalized positive duration weights. It does not substitute an endpoint or recover a short interval by subtracting large cumulative integrals. The same complete-course admission applies even when the reading covers only a short portion.

The evaluator accepts at most 2,000 requested time/window endpoints; original contracts bound the course to 24 intervals and 1,440 minutes. Evidence has at most 100 readings and nine conductance alternatives. Application computation is local and bounded by these original limits.

## Discriminating authored control

With capacities 20,000 and 80,000 J/(m²·K), surface exchange 10 and internal conductance 20 W/(m²·K), both initial temperatures and ambient reservoir 20°C, a 560 W/m² absorbed hour followed by darkness gives, for b=10 and deep reservoir 20°C:

- Surface at 60 minutes: 43.737706255799°C.
- Surface at 420 minutes: 20.171312173326°C.
- True first-hour surface mean: 37.260998079771°C.
- True 30–90 minute surface mean, crossing the forcing boundary: 37.074465451859°C.

One 60-minute band at ±0.05°C leaves b=5,10,20,50 alternatives compatible through different continuous deep-temperature ranges. A separate 420-minute band with the same half-width leaves b=10 with approximately 19.873656–20.126344°C. This is one survivor among offered conductances, with a nonzero reservoir interval; it is not a unique physical soil parameter.

The separate explicit RK4 experiment integrates temperature and its integral without importing production code. Step sizes 3 and 1.5 seconds agree to about 3.6×10⁻¹²°C on the committed mean controls. That observed agreement is not a certified numerical bound. These authored controls are not acquired or independently held-aside environmental readings.

## Scope and validation

The current original forcing and initial-state association can be wrong. A rejected model may indicate those assumptions, observation association, missing physics or the bottom boundary; it does not uniquely diagnose a deep heat loss. In particular, the maintained NOAA hourly example's measurement operators must remain means and its declared comparison tolerance must not be relabeled instrument uncertainty. This workflow does not silently fit that acquired example or assert bottom exchange explains its mismatch.

Run `node --test tests/bottom-heat-evidence.test.mjs` and `CHROME_BIN=/opt/google/chrome/chrome node tests/bottom-heat-evidence.browser.mjs`. The optional independent reference is `python3 tests/bottom-heat-evidence-rk4.py`. Tests and receiving scripts are qualification tools; actual executed results and final source pins belong in the integration receipt.
