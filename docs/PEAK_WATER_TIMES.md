# Read the times behind peak standing water

The **Peak standing water** card compares each scenario's largest retained whole-site water total. The two maxima can occur at different times.

Below the ordinary water-history readout, **When did standing water peak?** shows the exact peak value and the number of retained times attaining it for Existing and Proposed separately. Choose a time in either scenario's selector, then use **Read paired values**. The existing readout shows both original scenario totals, and proposed minus existing, at that same retained time.

Every exact tie is available. A dry or zero-water course can have a peak of zero at every retained time; the interface does not invent a unique peak. Fractional endpoint minutes remain available without time rounding. Keyboard users can use the native time selector and activate the adjacent button with Enter.

## Separate maxima and simultaneous values

An authored example makes the distinction concrete:

| Retained minute | Existing water | Proposed water | Proposed minus existing |
| --- | ---: | ---: | ---: |
| 0 | 1 L | 7 L | +6 L |
| 2 | 8 L | 2 L | −6 L |
| 5.5 | 3 L | 9 L | +6 L |

Existing peaks at 2 minutes and Proposed at 5.5 minutes. Comparing their separate peak magnitudes gives 8 L and 9 L; it does not give the simultaneous difference at either peak time. The paired readout shows those original rows explicitly. This example demonstrates the interface's arithmetic, not a physical site.

## Source and availability

Peak inspection copies the accepted comparison's original aligned snapshots. It neither edits the project nor calls the rain solver. Changing the selected peak only changes the paired readout.

While a comparison is pending or unavailable, the last completed values remain labeled and the peak controls are disabled. A new accepted comparison replaces both tie lists and starts their selectors at the first retained peak time. The paired readout keeps its selected minute if that exact minute still exists, following its existing behavior.

The whole-event tradeoff panel retains its independent more/less/equal summaries and guarded navigation API. CSV exports, the map navigator and model calculations are unchanged.

## Interpretation

These are maxima of retained model snapshots, not continuous-time maxima. Equal totals use exact native numeric equality; close but unequal values are not grouped as ties. The numbers are model totals before display rounding. A lower peak alone does not establish that a proposal is preferable.

## Verification

The maintained native test command is:

```sh
node --test --test-concurrency=1 --test-reporter=tap tests/water-history-values.test.mjs tests/water-peak-times.test.mjs
```

The seven new groups cover distinct scenario peaks, all ties including 721 retained times, signed zero, invalid alignment, unchanged-model ordinary/tradeoff/zero/dry/fractional controls, pending selection and source replacement. The four existing readout groups remain intact.

The first native course passed all 11 tests with no failures or skips, with all 34 admitted source files identical before and after execution. Its controlled DOM contract is separate from real-browser keyboard and layout receiving. Source and receipt identities, current-main composition and any actual browser qualification are recorded in the pull request.
