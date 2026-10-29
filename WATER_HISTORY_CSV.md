# Download the complete water history

In the ordinary workbench, **Download water history CSV** is below **Read a
retained time**. It saves every original retained time from the completed
existing/proposed comparison, including both endpoints. Moving the time slider
does not shorten the download or run another comparison.

Keep the ordinary **Export project** file with the CSV. The CSV identifies that
exact input by SHA-256; the project file contains the complete input needed to
reopen and recompute it. The download is available when the current comparison
is ready. Pending or failed comparisons disable it. A checksum still being
prepared for an older input cannot produce a download after the input changes.
If checksum preparation fails, the status explains the failure and the button
allows an explicit retry.

## File format

The filename is `experimental-earth-water-history.csv`. It is UTF-8 without a
byte-order mark, with CRLF record endings. There is one header record and one
record per retained snapshot. Data fields are quoted and embedded quotes are
doubled.

| Column | Meaning |
| --- | --- |
| `project_title_json` | The original project title encoded as a JSON string. After reading the CSV field, `JSON.parse` recovers the literal title, including quotes, line breaks and Unicode. The initial JSON quote also prevents a title from being interpreted as a spreadsheet formula. |
| `project_input_digest` | `sha256:` followed by the SHA-256 of the exact UTF-8 bytes produced by ordinary **Export project** for the completed input. |
| `model_minute` | The original retained model minute, including a fractional final time. |
| `existing_stored_litres` | Whole-site existing surface water at that snapshot, in litres. |
| `proposed_stored_litres` | Whole-site proposed surface water at the same snapshot, in litres. |
| `proposed_minus_existing_litres` | Proposed minus existing water, using the original numbers. Positive values mean more proposed surface water at that time. |

Numeric fields use the shortest decimal spelling that reads back to the same
JavaScript Number, including negative zero. The file does not round, interpolate,
resample or invoke the solver. A spreadsheet can apply its own numeric precision
and display rules; import these fields as text when preserving their exact
decimal spelling matters. Stored numerical precision does not establish physical
measurement precision.

The input digest is sensitive to all bytes, including whitespace. To check it,
hash the saved original project file without reformatting it. The CSV contains
modeled whole-site surface-water results; the existing observation CSV remains
the separate export for observations.

## Source and lifetime

The component receives only the already committed complete comparison and its
ordinary portable-project serialization. It privately copies the paired scalar
course and source bytes before awaiting the browser checksum. It rejects
misaligned times, invalid water totals and an oversized or malformed source.
Neither later mutation of the caller's arrays nor an old asynchronous completion
can replace the accepted source. Pending, replacement, refused replacement and
page retirement invalidate an outstanding download. A busy synthetic second
click cannot start a second checksum.

## Verification

Run the five focused native groups with:

```sh
node tests/water-history-csv.test.mjs
```

They cover an independent CSV reader, original scalar identity, negative zero,
fractional endpoints, literal Unicode/title context, all 721 retained times,
deterministic bytes, capture before the asynchronous digest and invalid-source
refusal.

The browser course requires Playwright and a sandboxed Chromium executable:

```sh
CHROME_BIN=/path/to/chrome \
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
EARTH_WATER_CSV_BROWSER_OUTPUT=/tmp/earth-water-csv-receiving \
node tests/browser.water-history-csv.mjs
```

It reads actual CSV and project downloads, independently parses every row, hashes
the actual project bytes and compares the values with direct maintained-model
results. Dry, ordinary, maximum-size, fractional and sign-changing authored
controls cover desktop and 390px layouts. It exercises native Enter, a delayed
real checksum, changed/pending sources, actual checksum rejection, explicit
retry and fresh original-project reopening. The page-retirement control
dispatches a persisted `pagehide` event; it does not claim actual BFCache
admission. All served JavaScript/CSS is bound to the tested source, missing assets
and offsite requests are refused, and two captured layouts are inspected.

`tests/fixtures/water-history-tradeoff.json` is an authored unchanged-model
control with both positive and negative original differences. It supports
the unreserved whole-course comparison outcome in
[issue 537](https://github.com/Jacob-Met/experimental-earth/issues/537).
It is not a field measurement or a continuous-time crossing estimate.
