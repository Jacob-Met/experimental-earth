# Read the times behind peak standing water

The **Peak standing water** card compares each scenario's largest retained whole-site water total. The two maxima can occur at different times.

Below the ordinary water-history readout, **When did standing water peak?** shows the exact peak value and the number of retained times attaining it for Existing and Proposed separately. Choose a time in either scenario's selector, then use **Read paired values**. The existing readout shows both original scenario totals, and proposed minus existing, at that same retained time.

Every exact tie is available. A dry or zero-water course can have a peak of zero at every retained time; the interface does not invent a unique peak. Fractional endpoint minutes remain available without time rounding. Keyboard users can use the native time selector and activate the adjacent button with Enter. The action returns focus to the paired readout’s existing time control so the requested values are visible, including on a narrow screen.

## Try the ordinary workbench

Import `examples/peak-water-short-shower.json`, then search **standing water peak** in the existing investigation navigation. This authored flat four-cell control uses a 30 mm/h shower lasting 2.5 minutes, retained 2-minute steps and a 5.5-minute endpoint. It is not a field observation.

Existing sealed surfaces reach 18.933333333333334 L at minute 4; proposed turf reaches 11.2 L at minute 2. Reading the existing peak compares 18.933333333333334 L with 10.399999999999999 L at minute 4. Reading the proposed peak compares 15.466666666666667 L with 11.2 L at minute 2. Separate maxima are not simultaneous values.

Change rain to zero and compare again: every retained time ties at zero. The 5.5-minute endpoint remains selectable. Importing another site replaces these ties with that source's own retained course. Export still contains only original project inputs.

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
