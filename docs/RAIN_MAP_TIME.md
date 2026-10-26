# Compare rain maps at one modeled time

The ordinary Existing site and Proposed change maps can show a shared retained moment in the rain model. This helps inspect where a proposal changes modeled water during an event, even when the two site-total curves are identical.

## Use the time view

1. Open the workbench through its ordinary local HTTP server.
2. In **Cell visualization**, choose **Water depth at the same time (mm)**.
3. Use the **Event snapshot** slider or **Previous / Next**. With the slider focused, arrow keys move by one retained snapshot; Home and End reach the first and last.
4. Read the modeled minute and compare the numeric depths in the two maps. Both use the same snapshot index and water-overlay scale.

The first snapshot is minute zero. The final snapshot remains reachable when the event ends between regular steps; for example, a 10.3-minute event with 3-minute steps has snapshots at 0, 3, 6, 9 and 10.3 minutes. The view does not interpolate between them.

Map inspection and painting work as before. Arrow keys within a grid move cell focus. Enter or Space selects that cell and applies the active brush. Moving the time slider does not paint, change the selection, run the model again, write the project, or rebuild unfinished notebook inputs.

## Understand the other views

- **Per-cell peak water depth** shows each cell's own event maximum. Different cells may reach those maxima at different times, and the solver can retain a peak from within a step. These values are not one simultaneous water map.
- **Final water depth** shows the two modeled states at the event endpoint.
- **Surface / elevation** shows the declared site without water-depth shading.

Both time maps use the existing common overlay rule. The underlying surface colors remain different, and the overlay eventually saturates; compare the printed millimeter values when the color alone is ambiguous.

## Changing or reopening the event

The time cursor is a transient view choice. It is not a new field in the portable project or evidence record. A fresh page starts in the ordinary peak view.

When a site or weather change produces new results, the cursor moves to the nearest retained time in that new timeline. An exact tie chooses the earlier snapshot; a shorter event naturally clamps to its endpoint. The visible time always names the current snapshot, rather than leaving old water depths under a changed event.

## Independent authored control

The receiving course uses flat 2×2 sites with no movement between cells or loss across the boundary. Existing cells alternate turf and garden; the proposal reverses those surfaces. Rain is 60 mm/h for 6 minutes, followed by drydown to 10.3 minutes. Turf and garden infiltrate at the declared 9 and 24 mm/h rates.

| Modeled minute | Turf depth, mm | Garden depth, mm | Water in either four-cell site, L |
| --- | ---: | ---: | ---: |
| 0 | 0 | 0 | 0 |
| 3 | 2.55 | 1.8 | 8.7 |
| 6 | 5.1 | 3.6 | 17.4 |
| 9 | 4.65 | 2.4 | 14.1 |
| 10.3 | 4.455 | 1.88 | 12.67 |

The sites have identical total-water histories while the local changes have opposite signs. At minute 9, proposal A1 and A2 have 2.25 mm less modeled water; B1 and B2 have 2.25 mm more. This is a controlled arithmetic example, not a measured site or evidence that a proposal is better.

The maintained receiver checks these independent values against the actual retained snapshots and rendered cells, then checks native keyboard operation, state isolation, real editing, timeline replacement and narrow-screen layout. Run the focused course with `node tests/rain-map-time.browser.mjs` and an installed Chrome/Chromium; `CHROME_BIN` can supply its absolute path. The ordinary `npm run browser-receive` course also includes it.

## Limits

This exposes states from the existing declared rain model. It adds no physical model, interpolation, calibration, timing confidence or field validation. A useful displayed difference is a question to investigate, not proof of real-world water behavior.
