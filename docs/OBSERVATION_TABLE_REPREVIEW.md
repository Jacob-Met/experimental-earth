# Correct a station map without choosing the CSV again

The measurement-table panel keeps one selected, successfully decoded CSV in this
browser tab while you prepare its preview. This lets you correct the optional
station map and inspect the original table again without reopening the file
chooser.

1. Choose **Preview CSV** in **Bring in a measurement table**. A valid table and
   mapping still receive an immediate first preview.
2. If the station map is missing or needs correction, edit **Optional station map
   JSON**. Changing the map clears the previous preview and disables **Add
   selected readings**.
3. Choose **Preview selected table**. The panel reinterprets the same original
   CSV using the current station map and current project, then shows its original
   filename, source rows, supplied quantities and interpreted cells.
4. Check the preview and explicitly choose its original source rows, or choose
   **Choose all rows**. No rows are selected automatically. Choose **Add selected
   readings** to append only those rows in original table order. Previewing alone
   never changes the notebook.

A failed mapping can be corrected and retried. A selected file that has invalid
CSV content remains available for another preview; choose another CSV to replace
its contents. A failed replacement never falls back to the previous file.

Only one CSV is available for preview at a time. Each selected file is limited
to 128,000 bytes and decoded strictly as UTF-8. The panel does not reconstruct
the original CSV from interpreted readings, send
its contents over the network, or persist the selected file in browser storage.
The unchanged observation parser still validates the complete original source
before row selection, including its source-row limit. Notebook-capacity and
duplicate checks apply atomically to the selected rows at append. The supplied
filename, physical source line, original quantities, station token and declared
station placement remain attached to each selected reading.

Adding readings clears the actionable table selection and preview, while the
complete original CSV and the exact map used for that preview remain available
for download. [Save the original table and map](ORIGINAL_OBSERVATION_SOURCE.md)
before changing the project. Resetting the project or changing an input that
reruns the site clears this tab-only source. If the project changes after a
preview, adding its readings is refused until you make a fresh preview. Selecting a
different CSV immediately replaces the prior selection; a late read from an older
selection cannot restore it. If the station map changes while a file is being
read, the latest file becomes available for an explicit preview after reading
finishes. It is not automatically applied with an unseen map change.

The station map is an authored placement declaration. Re-previewing does not
verify a logger's physical position, clock synchronization, measurement accuracy
or independence.

## Receiving

With Node.js 22+ and a supported installed Chromium, run the source-pinned actual
browser course through the existing session owner:

```sh
CHROME_BIN=/opt/google/chrome/chrome node tests/observation-import-repreview.browser.mjs
```

The course covers correction and retry without file reselection, unchanged
notebook content during preview, original evidence after append, invalidation
after mapping changes, failed replacement, delayed file selection and project
reset. It uses the maintained Linux Chromium session and sandbox admission; it
does not qualify environmental model accuracy or other operating systems.
