# Keep an original observation table and its station map

The ordinary CSV importer can download the exact original CSV and save it together with the supplied station-map text. Open **Bring in a measurement table** in the main workbench.

Choose a UTF-8 CSV as usual. Its interpreted rows still pass through the maintained table parser, explicit unit conversion, station placement, event-clock and evidence-role checks. **Download original CSV** preserves every original byte, including a UTF-8 BOM, CRLF line endings, quoted multiline fields and original station tokens. It does not export a reconstructed table of interpreted values.

Choose **Save original table + map** to download one source file. It retains the original filename, bytes and SHA-256 together with the exact supplied map text. An unfinished map can be saved for later correction. The source file does not contain the site project, interpreted readings or a saved validation result. Save the site separately with **Export project**.

In another session, open the matching site and choose **Open saved table + map**. The original source identity and UTF-8 encoding are checked before replacing the accepted table or map. Opening restores the source and supplied map; it adds no observations and does not automatically preview them. Choose **Preview selected table**, inspect the current model-cell placement, original rows, units, uncertainty and evidence roles, then explicitly choose the original rows to add and choose **Add selected readings**. No rows are selected automatically; **Choose all rows** and **Clear choices** are explicit actions. Correcting the map retires the old preview and requires another explicit preview.

A successful append keeps the complete original file and the exact map used for that preview available for download immediately afterward, including source rows you did not select. Only the chosen rows enter the notebook, in original table order. Leaving or changing the working project clears this tab-only source. Download it first. Existing project JSON retains the same interpreted row provenance and format; it does not silently gain embedded CSV files.

## Bounds and receiving

Original CSV files have the existing 128,000-byte limit. Station-map text retains the existing 32,000-character limit. Saved source files are bounded to 512,000 UTF-8 bytes, including base64 and escaped map text. SHA-256 detects inconsistent bytes; it does not authenticate a logger, location, reading, source account or clock synchronization.

The source-file receiver checks the complete field set, canonical base64, declared byte count, digest, UTF-8 and filename before adoption. It preserves unfinished map text without treating it as valid station placement. The entire original CSV must pass interpretation and source-wide limits before any row choices are offered. Selecting rows cannot hide malformed units, locations or clocks. Duplicate and notebook-capacity checks apply transactionally to the explicitly selected rows when adding them; an unselected existing duplicate does not prevent adding a new row. Refusal keeps the notebook unchanged and allows the choices to be corrected.

Pending reads and saves belong to their original file, project and map generation. Replacing a source, changing the map, replacing the project or beginning a newer operation retires a stale completion. A failed replacement leaves notebook readings intact and retains the prior original only for download. It retires the actionable selection, preview and append controls; re-select or reopen that source to preview it again. Downloaded object URLs are released after use.

Focused native receiving:

    node --test tests/observation-row-choice.test.mjs tests/observation-source-file.test.mjs tests/observation-table.test.mjs tests/observation-stations.test.mjs tests/observation-clock.test.mjs

The maintained CSV repreview and station browser courses also cover the original importer behavior. New original-source browser receiving exercises actual downloaded files and fresh browser reopening; authored CSV values establish software behavior, not field measurement accuracy.
