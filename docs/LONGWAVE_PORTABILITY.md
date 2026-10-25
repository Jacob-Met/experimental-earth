# Complete original longwave investigations

The longwave comparison retains a canonical original heat exposure, two
emissivity declarations and one radiative environment per exposure interval.
Downloads and uploads now share a **320 KiB UTF-8 limit**. The former upload-only
120,000-byte limit could reject a valid original produced by the same panel.

## Why this bound covers the admitted original

The current source contract admits at most:

| Text field | Maximum UTF-16 code units |
| --- | ---: |
| Original place context JSON | 20,000 |
| Two original layer sources | 1,200 |
| 24 original exposure sources | 9,600 |
| Two emissivity sources | 1,200 |
| 24 radiative environment sources | 14,400 |
| **Total variable text** | **46,400** |

JSON escaping can expand one UTF-16 code unit to six ASCII bytes, including
control characters and lone surrogates. Thus variable text contributes at
most 278,400 bytes. Fixed keys, schema/model labels, indentation and at most
107 finite numeric fields add less than 10,000 bytes. The 327,680-byte ceiling
covers that complete canonical shape. The serializer still checks actual
UTF-8 bytes before producing a download, so a later schema extension cannot
silently create an unreopenable file.

The focused controls include an admitted 143,471-byte CJK source and a
282,059-byte escaped-source envelope. Both preserve every original field on
reopening. The latter also demonstrates why a 256 KiB limit would not cover
all currently admitted canonical input. These are authored transfer controls,
not environmental observations.

## Transactional receiving

Reading a candidate file retains the current accepted table and its original
download until the candidate has passed byte admission, strict UTF-8 decoding,
JSON/source validation, numerical comparison and original linear-baseline
admission. Malformed, oversized or unsupported candidates leave that accepted
investigation unchanged. An uncomputed or failed comparison cannot become a
successful original merely because its JSON parsed.

The handler captures the File and clears the input selection immediately,
allowing the same original to be selected again after edits. A generation
fence retires pending reads when newer drafts, source changes or file selections
supersede them. Original canonical fields remain the calculation authority;
uploaded derived reports are stripped by the existing canonicalizer.

The numerical solver, original reading-time inference and scientific model
remain with their existing owners. This change repairs custody of original
inputs; it does not claim environmental validation or a new thermal mechanism.

Run `node tests/longwave-portability.test.mjs` for native source-envelope controls.
The actual sandboxed browser course is
`node tests/longwave-portability.browser.mjs`; it creates a valid source through
the maintained heat declaration, downloads and reopens the real multibyte file,
challenges malformed/oversized/baseline-refused candidates, and exercises delayed
reads, repeated original selection and the narrow-screen result. Executed
receiving evidence accompanies integration separately.
