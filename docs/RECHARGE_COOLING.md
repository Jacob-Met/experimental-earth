# Cooling while original rain enters the rooted store

This investigation compares two explicit recharge timings under the **same original thermal clock**. It reuses the native rain infiltration trace, rooted-water constitutive law and two-store heat model. The separate after-rain investigation and its original-reading inference retain their original meaning.

## Use the actual consumer

In **Can retained rain sustain a cooler surface?**, first retain sourced water and heat declarations. In **What changes when water arrives throughout the rain?**, select **Retain these water and heat declarations**, then supply the source or hypothetical basis for thermal minute zero being the original rain-event start. The complete retained heat exposure must include the rain event.

The fictional during-rain example can be opened separately. It retains a 5 mm rooted store initially empty, a 3 mm / four-hour rain event, the original two thermal stores and an explicitly authored common clock. Existing and proposed places remain separately inspectable even when a control gives equal results.

Green solid curves use original native infiltration intervals. Orange dashed curves hold the same whole-event infiltration until event end. The original rain trace's accepted infiltration is distributed uniformly within each native interval; this does not infer finer rainfall arrival. At event end the pulse water is counted immediately, with excess drainage if needed. The pulse cannot change earlier heat or transpiration. Its water curve shows the actual jump.

Select a place and inspect any finite minute using the exact numeric control or native keyboard range. The accounts include arriving recharge, rooted storage, drainage, supplied/unmet demand, both temperatures, mean temperature since event start, independently accumulated latent heat and water/energy residuals. Curves join display samples; they do not locate continuous extrema.

A retained timing investigation owns its original project, water/heat/demand declarations and clock source. Later edits in the parent investigation do not silently reattribute it. Save writes only the versioned original inputs. Reopening in a fresh page recomputes the native rain trace, constitutive transitions and thermal response. Derived saved conclusions are refused. A newer clock draft cancels a delayed file read.

## Water and heat response

The maintained forced root store uses available water S, capacity C, stress threshold T=(1-p)C, constant interval recharge r and prescribed potential transpiration E. Below T, supplied transpiration is E S/T; above T it is E. Capacity excess drains. The explicit T=0 limit consumes full demand until empty, then only arriving water can be supplied. Initial rooted water retains its own declared origin.

An additive opt-in function in `root-zone-forced.js` records the **same native response's** supply regimes. Its original API keeps its original return shape and water arithmetic. A regime has

`q(t) = q0 exp(-k t) + qInf (1-exp(-k t))`

in mm/day. In the stressed forced region, q0=(E/T)S0, qInf=r and k=E/T. A full-demand or zero-supply leg is constant. Each interval is split at the native stress/full-store transitions; the heat calculation also respects every original infiltration and heat/demand boundary.

Multiply supplied-water flux by the declared latent heat and the explicit fraction drawn from the effective thermal surface. The two-store heat equation receives that nonnegative, possibly rising or falling loss directly. Rising losses use positive integrated convolutions, avoiding subtraction of nearly equal constant and decaying responses. Stable repeated/zero-rate limits supply exact analytic endpoint and interval-mean operators to floating-point accuracy. No mean flux is substituted for the changing latent loss.

The model continues to prescribe demand independently of temperature. It does not add soil evaporation, infer a physical latent-energy source outside the modeled fraction, estimate comfort or validate field cooling. The constant 2.45 MJ/kg in the fictional example follows the approximate value in [FAO Irrigation and Drainage Paper 56, chapter 1](https://www.fao.org/4/x0490e/x0490e04.htm); plant stress interpretation is grounded in [chapter 8](https://www.fao.org/4/x0490e/x0490e0e.htm). The continuous forced store and thermal association remain explicit model adaptations.

## Executed control and its consequence

At minute 240, the authored interval-arrival control has:

- 3 mm original native infiltration over 48 five-minute intervals.
- 1.896361676485676 mm remaining and 1.103638323514324 mm supplied to transpiration.
- Surface 42.129284417107826 °C; lower store 34.568866710464974 °C.
- Direct mean surface 41.601191838003714 °C and surface latent loss 1,622,348.335566063 J/m².

Holding the water until event end gives 50.308772169186845 °C immediately before/after the pulse. Its water becomes 3 mm at that instant, while its earlier latent loss stays zero. During the later lower-input exposure, the held water sustains more cooling: by minute 480 the interval-arrival surface is 30.37334189346585 °C versus 29.695497670303904 °C. Thus the timing difference changes sign. These are conditional authored controls, not measurements or a preferred intervention.

## Admission and numerical limits

The original trace owner requires a native initially dry surface and complete rainfall attribution. Untagged initial ponding is refused rather than relabeled as rain-derived recharge. Retained root water is permitted through its existing declaration. The native two-place rain-trace cell-step budget, 720 infiltration intervals, 24 heat intervals and 1440-minute exposure limit remain in force.

A source clock association is required; no unknown offset or time alignment is fitted. The same plant demand and thermal forcing apply to both timing scenarios. Computed residuals are engineering floating-point checks, not certified bounds. Extreme combinations outside the maintained finite water or actual heat-flux ranges retain explicit refusals.

## Qualification and reproduction

The full native suite passes 720 tests, including the additive heat, supply-regime and coupled controls. Independent review exercised 480 augmented matrix cases (476 admitted and four domain refusals), 100 high-precision modal-integral cases and 160 scalar energy cases. Maximum admitted matrix temperature/mean difference was 2.824e-9 °C. Another reviewer independently ran the eight root/coupled groups and 528 fractional heat-boundary semigroup comparisons, with maximum relative difference 6.34e-16 and unchanged input objects.

The actual sandbox-admitted Chrome consumer passes 12 new groups; both maintained cooling and original-reading courses retain all 13 groups each. The new course includes independent authored numeric controls, pulse semantics, later sign reversal, exact-time/keyboard and place selection, literal source, parent-source retention, desktop/390px receiving, actual download/fresh-profile recomputation, forged-result refusal and delayed-file cancellation.

Run:

```sh
npm test
node tests/review-recharge-clock.mjs "$PWD"
RECHARGE_COOLING_RECEIPT_DIR=/tmp/new-recharge-receipt CHROME_BIN=/path/to/chrome node tests/recharge-cooling.receiving.mjs
```

Browser receipt destinations must be new. The maintained browser-session helper admits the browser sandbox and retains its process receipts. See the compact [verification receipt](receipts/recharge-cooling-ee5a/verification.json). No deployment, hardware operation or field submission is qualified by these controls.
