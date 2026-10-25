# Import original collected-volume tables

In **Which outlet assumptions explain the collected water?**, set the observed scenario, event reference and collection arrangement and explicitly confirm complete modeled-boundary coverage. Open **Import original collection CSV**, select a UTF-8 CSV file and choose **Preview collection CSV**. Review every row, then **Add all previewed collections**. Preview does not add evidence; any invalid row refuses the whole file.

Required columns are `start_minute,end_minute,volume,uncertainty,unit,source`. Optional `use` is `calibration`, `challenge` or `unassigned`; a missing or empty role remains notebook-only. Units are `L`, `mL` or `m3` and apply to volume and uncertainty. Times are the original minutes since this modeled event began. Quoted commas, doubled quotes and multiline descriptions are supported by the maintained CSV reader. No timestamp, collection coverage, measurement or role is inferred.

This authored example shows the format, not a field dataset:

```csv
start_minute,end_minute,volume,uncertainty,unit,source,use
7,37,16000,500,mL,"Authored collection record, first window",calibration
37,60,.0264,.001,m3,Authored second window,challenge
```

Files are limited to 128000 UTF-8 bytes and the record to 80 total collections. The preview is bound to the complete project and collection settings. Changing them invalidates it, including during an unfinished file read. Committing adds the entire admitted file once; an identical retained filename/physical-line/original-row receipt refuses reimport. Different filenames or rewritten rows are not authenticated as different measurements.

Each reading retains original numeric text, unit, source text, filename and physical starting line. These are checked against the accepted quantities on ordinary project import. The supplied role is retained separately from the current role so deliberate later reassignment remains possible. Original manual entry continues unchanged. Sources and original file rows are visible in the collection ledger and survive ordinary project download, import and reload.

File provenance is supplied metadata, not acquisition authentication or evidence independence. Repeated and overlapping collection windows can be correlated. The same existing candidate comparison consumes these observations; importing them never adopts a coefficient or changes the storm.

Native receiving: `node --test tests/outlet-table.test.mjs tests/outlet-evidence.test.mjs`.
Actual sandboxed browser course: `CHROME_BIN=/usr/bin/google-chrome-stable node tests/outlet-table-browser.mjs`.
