# Compare water across a custom area

In **Why does this place get wetter?**, choose **Custom area** under **Area to inspect**. Select the cells that belong to your question: a courtyard corner, a planting strip, or several disconnected patches. The comparison uses exactly the same cells in the existing and proposed plans.

The dedicated picker changes the inspection area only. It does not paint surfaces, change elevations, or move the selected map cell. Click a cell to include or remove it. With the picker focused, use arrow keys to move and **Enter** or **Space** to toggle the focused cell. Selected cells expose their pressed state, and the membership list gives their grid coordinates. Wide sites scroll inside the picker on narrow screens.

The shortcuts replace the current custom membership:

- **Use selected cell** starts with the cell currently selected on the site map.
- **Use edited footprint** copies the cells whose elevations, surfaces, or internal connections differ between the two plans.
- **Select all** includes the whole current grid.
- **Clear** leaves an unfinished empty area. The panel explicitly shows that no area is selected and disables tracing until you add a cell.

These shortcuts capture a selection at that moment. Later map selection or plan edits do not silently redefine the custom area. **Directly edited footprint** remains available as a separate scope when you want membership to follow the current edits.

## Read the comparison

Choose **Trace both scenarios** to account for the complete modeled event under the saved weather and surface assumptions. The table reports rain, incoming water, outgoing water, infiltration, site-boundary losses, and final stored water, in liters. Transfers between two selected cells cancel from the area's incoming and outgoing totals. Water crossing the selected area's boundary remains visible, including both directions and neighboring cells outside the area.

Use an outside neighbor's **Inspect** button to follow its cell budget. This switches to **Selected cell** and inspection mode without painting the site. Your custom membership remains saved; choose **Custom area** again to return to it.

Changing area membership or switching scopes reuses a current trace. Changing the site or weather clears the stale result and requires tracing again. Clearing an area does not discard an otherwise current trace.

## Save and reopen

The ordinary project save and **Export** retain the active scope and custom membership. Importing that project or reloading the application restores these controls. Trace again after reopening to compute the result from the saved assumptions; derived water-budget results are not persisted.

An import that is still reading a file cannot overwrite a newer area edit. If the application reports that the workspace changed while reading, select the file again only if replacing the current workspace is still intended.

The custom study is tied to its grid dimensions. Imported membership must contain distinct cells within that same grid; incompatible or malformed studies are rejected instead of being silently clipped or reassigned.

These are balances of the conceptual numerical model. Neighbor crossings can count the same water more than once, and accounting closure does not establish a measured field budget or identify where individual water parcels originated.

## Focused browser receiving

Run `node tests/custom-water-budget.browser.mjs` with the maintained Chromium environment to exercise the ordinary application, its investigation navigation, and both local and custom water-budget courses. The driver uses the existing sandboxed browser session and accepts the same `CHROME_BIN` and `BROWSER_RUN_DIRECTORY` settings as the full browser driver. It retains screenshots and session receipts in its run directory.

This focused command checks the affected consumer path. It does not replace the full browser suite or turn a failure in another receiving course into a passing result.
