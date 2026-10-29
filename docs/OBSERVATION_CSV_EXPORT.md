# Export the observation notebook

In **Test it against a reading**, choose **Export observation CSV** to download every retained notebook reading, in notebook order. The button becomes available after a reading is retained, including readings imported from an original measurement table. Exporting does not change the project, model, readings, evidence roles or retained source files.

The UTF-8 file is named `experimental-earth-observations.csv`. It uses the existing observation-table columns:

```csv
cell,minute,depth,uncertainty,unit,source,scenario,use
```

The cell is the current grid label, such as `B2`. Time is modeled minutes from the start of this modeled event; these are not clock timestamps. Depth and its stated uncertainty are expressed in millimetres; `unit` is always `mm`. Numbers retain their stored precision. The source description, assigned scenario and evidence role remain attached to each reading. Legacy readings without explicit roles are exported as `unassigned`, matching their existing notebook meaning.

## Choose the appropriate export

This CSV is a normalized table for analysis or transfer to a matching grid and event. It does not include the grid geometry, weather, original unit tokens, logger station mappings, clock declarations, original CSV bytes or the rest of the project.

Use the ordinary **Export JSON** action to preserve the complete project and its retained observation metadata. The separate original-source controls retain the original CSV and supplied station map. A normalized CSV does not establish an independent measurement, clock synchronization or physical validation.

Quoted commas, double quotes and line breaks in source descriptions are preserved in the downloaded CSV. The existing CSV importer trims surrounding whitespace and normalizes CR/CRLF to LF; a reimport therefore follows those existing source-text semantics. A reimport also records the new file and its row positions as its table source. Keep the original project for original provenance. When importing into a spreadsheet, treat the source-description column as text.

Every valid 100-reading notebook fits the existing 128,000-byte table limit under the current 200-character source bound. Empty notebooks cannot be exported. Invalid projects are refused without omitting or repairing readings. Source strings containing isolated UTF-16 surrogate units cannot be encoded faithfully as UTF-8; CSV export identifies the row and directs you to Export JSON, which can preserve the original string. Valid paired Unicode characters remain supported.

## Receiving

Run `node --test tests/observation-export.test.mjs` for literal format, mixed-unit normalization, nonsquare-grid mapping, full-precision and subnormal values, quoted multiline sources, maximal Unicode notebooks, invalid-project refusal and source preservation.

Run `CHROME_BIN=/opt/google/chrome/chrome node tests/observation-export.browser.mjs` with Node.js 22+, Python 3 and the maintained browser prerequisites. Set an absolute new `BROWSER_RUN_DIRECTORY` to retain receipts. To receive an extracted runtime served by its maintained `serve.py`, set `EARTH_RECEIVING_URL` to its `http://127.0.0.1:PORT/` origin.

The dedicated browser receiving course exercises the actual download, matching-grid reimport, project nonmutation, empty/refused states and desktop/narrow controls. Its receipts identify the executed source, browser and artifact. These checks establish software behavior; they do not validate the underlying measurements.
