# Original temperature table intake

The maintained **Which hidden heat stores still explain the surface?** section now accepts an original temperature CSV as an alternative to entering every reading card. Open **Import original temperature CSV**, choose a UTF-8 file, inspect every converted row, then use **Replace draft readings with preview**. This replaces the draft reading cards only. Save surface evidence and compare through the existing finite-family investigation. The current hypotheses, site, exposure, and accepted evidence remain unchanged until the ordinary save action.

## Explicit original-input contract

The header contains these eight columns, in any order:

```csv
minute,from_minute,aggregation,temperature,half_width,unit,use,source
60,,instant,112.15579813943923,0.09,F,calibration,Authored Fahrenheit control
120,,instant,300.58965430499205,0.25,K,challenge,Authored Kelvin control
```

These two rows are authored computational controls, not acquired observations. The file does not supply material properties or establish the association between a reading and a place. Keep the existing place/exposure association and original material alternatives explicit.

- `minute` is elapsed time from the saved exposure, not a timestamp or clock estimate.
- `aggregation` is exactly `instant` or `interval-mean`. An instantaneous row leaves `from_minute` empty. A mean supplies a strictly earlier interval start. An interval mean constrains the mean over that complete window, not its endpoint or every intermediate temperature.
- `unit` is explicitly `C`, `F`, or `K`. The original temperature and half-width share that unit. Celsius conversion subtracts 32 and multiplies by 5/9 for Fahrenheit, subtracts 273.15 for Kelvin, and leaves Celsius unchanged. A Fahrenheit half-width is multiplied by 5/9; Kelvin and Celsius half-widths are unchanged. No absolute-temperature offset is applied to a width.
- `use` is `calibration` or `challenge`. These labels describe declared use and do not establish independent acquisition.
- `source` is required. Each resulting editable source description retains a JSON object containing the file name, starting CSV line and all original lexical field values. Original source text is rendered as text, never HTML. This is declared provenance, not cryptographic authentication.

The maintained shared validator admits at most 100 readings, with unique instantaneous times or mean windows, times inside the saved exposure, temperatures −100..500°C and supplied half-widths 0..100°C. The intake reuses the bounded quoted-field CSV parser and strict decimal parser. It accepts quoted commas/newlines, escaped quotes, CRLF and a UTF-8 BOM. It refuses malformed UTF-8, ambiguous numeric forms, unknown units/roles/aggregation, malformed headers, duplicate identities, invalid windows, or an invalid final row without adopting a valid prefix.

Files are limited to 128000 bytes and parsed text to 128000 characters. The original provenance must fit the existing 600-character reading source field. Overflow refuses instead of silently dropping original fields. Use a concise file name and source description that retains its basis. Preview and source descriptions remain editable; changes are not automatically verified against an external instrument.

## Preview lifetime and replay

Selecting a file conservatively retires the displayed comparison before decoding. An invalid import leaves the draft reading cards and accepted project unchanged, but the user must save/compare again if they want a new displayed result. Editing any evidence draft field or replacing the working project retires an existing preview. A delayed file decode cannot restore a preview after such a change. The explicit apply action checks the exact workspace snapshot again.

The normal project download retains the converted readings and original lexical provenance. Reopening recomputes through the maintained hidden-store model. This feature adds no physics, automatic candidate fitting, invented observation, unit inference, or new evidence schema.

## Verification

`node --test --test-isolation=none tests/temperature-table.test.mjs tests/temperature-table-consumer.test.mjs tests/heat-column-evidence.test.mjs` exercises conversion controls, malformed and bounded inputs, original source replay, interval-mean operator use, unchanged declared families and challenge-only rejection.

`CHROME_BIN=/usr/bin/google-chrome-stable node tests/temperature-table.browser.mjs` exercises the actual application and maintained strict Chromium sandbox check: original file preview, trusted-keyboard replacement, normal save/comparison, actual project download and reopened comparison, stale asynchronous decoding, malformed UTF-8/duplicate refusal, changed challenge input, interval means and desktop/narrow screenshots. An unexecuted browser script is not a passing receipt; use the concrete run output and source pin when reporting qualification.

The F/K control preserves the same five calibration-compatible offered lower-store explanations as its Celsius baseline and retains one after the original challenge. Changing only the Kelvin challenge to 373.15 K rejects the retained family without changing its calibration results or hypotheses. These are authored software controls and do not establish physical accuracy.

### Receiving record

The composed current main `655b842d1f00afbc78ffd4ab7f84691fe0a6485e` candidate passed 53 affected native groups on Node 22 using ordinary `node --test`, plus all 7 actual application browser groups with the unchanged strict Linux Chromium sandbox check and no application exceptions. Root independently reviewed the source and narrow preview. The browser harness was then corrected to re-scroll the desktop preview after resizing so the desktop capture depicts the changed consumer. Exact published revision and postmerge receiving remain separate integration steps.
