# Challenge one common bearing with recorded obstruction states

After accepting a [common-bearing course](SUN_BEARING_COURSE.md), open its
recorded-pattern investigation. Enter separately sourced obstruction records
for the original ground centre. Each record names one original UTC timestamp,
the existing or proposal scenario, a recorded state and its source. The two
states are **blocked** and **no mapped blocker**.

These are supplied classifications about the mapped obstruction model. The
consumer does not interpret photographs, establish evidence authenticity,
infer cloud conditions or turn an observed dark patch into a known mapped
blocker. State the basis for that interpretation in the record's source. An
authored software control must remain identified as such.

The original project, course, bearing declaration and height bounds stay
unchanged. The investigation asks whether one bearing in that original range
can account for the complete entered pattern. A contradiction challenges the
combination of entered records and model assumptions; it does not automatically
identify the bearing, height, source record or physical mechanism that is wrong.

## Complete-pattern regions

Every original record remains in the comparison. The result distinguishes:

- **Sufficient regions:** every recorded state is supported by its decisive
  envelope at that same bearing. This is sufficient across the admitted height
  envelopes, with the inherited numerical qualifications.
- **Possible-only regions:** no record is excluded, but the complete pattern
  is not established. Different timestamps may rely on different height
  realizations, so this is not proof of one common physical height explanation.
- **Excluded regions:** at least one record is incompatible with the supplied
  conservative envelopes. An empty possible region excludes the entire entered
  pattern within the declared bearing range and qualified model.

The complete angular profile shows lower and upper numbers of matched records.
Intervals retain closed/open endpoints, including isolated points and positive
gaps with no representable binary64 midpoint. Paging changes displayed rows,
not the computed profile. Region widths are not probabilities or orientation
accuracy estimates.

Each record's ledger retains the exact original timestamp and scenario, source,
individual possibility and numerical limitation. A collection can be jointly
excluded even when every record is individually possible. Nighttime,
low-elevation and footprint observations are not ground-obstruction constraints
and refuse this comparison for the affected scenario. Numerical unknowns remain
eligible but can only permit a state, not guarantee one.

## Reusing the original range mechanism

The calculation recomputes the complete original common-bearing course and
reuses its admitted single-instant envelopes. For a recorded blocked state,
sufficient/possible matching uses inner/outer membership. For a recorded clear
state, sufficient matching is outside the outer band and possible matching is
outside the inner band. The maintained grouped endpoint sweep composes these
conditions without sampling headings or closing gaps by tolerance.

The adapter uses mathematical helper rows to count matched records; it does not
rewrite the original existing or proposal scenarios. It retains all original
course timestamps even when only some have separately entered records.

Original common-direction kernel witnesses are reused. At most one additional
complete original-kernel course checks a useful sufficient or possible bearing.
A sufficient interval without a representable direction remains in the
arrangement without receiving a fabricated midpoint witness. For each record,
a witness reports verified match, verified opposite, or unresolved. Grazing and
uncertain predictions cannot verify the opposite observation. Failure to verify
every record means the complete pattern is unverified, unless a definite
opposite classification is separately shown.

An original-course disagreement or a new witness contradicting a decisive
envelope withholds all derived bearing regions. Original records, underlying
course evidence, witness classifications and the reason remain inspectable.
Agreement at selected witness bearings does not prove the complete range by
sampling.

## Admission, custody and replay

Admit one through 32 records, each containing exactly `utc`, `scenario`, `state`
and a nonblank `source` of at most 600 characters. UTC values use the maintained
strict parser and must name original sampled instants. The original final
timestamp remains valid even when it falls between regular sample steps.
Canonical equivalents such as `09:47:00Z` and `09:47:00.000Z` name the same
instant; duplicate timestamp/scenario records refuse instead of being silently
combined or counted twice.

Complete work is reserved before geometry. The original course's reservation
is increased by one full-site witness course, giving a conservative ray bound
of `10 * 6 * N * (N - 1) * T` for N cells and T original timestamps. The original
endpoint-event reservation is increased by
`max(8, 8 * (N - 1) + 4) * M` for M records; the extra four endpoints account
for clear-state complements. The aggregate limits remain 16 million ray checks
and 250,000 endpoint events. No partial list or timestamp subset is substituted
when work does not fit.

Saving downloads `experimental-earth-sun-bearing-evidence.json`. The raw envelope
contains exactly `kind`, `model`, `project`, `declaration`, `settings` and
`observations`; kind is `experimental-earth/sun-bearing-evidence-inputs/1`.
Original common-bearing settings retain only `cellIndex`, `halfWidthDeg` and
`basis`. Reopening validates source context, model and records and recomputes
the original course, complete pattern and witnesses. Cached regions, verdicts
and derived evidence fields refuse. Outer input size is limited to 5 MiB and
the portable project to 4 MiB.

The consumer keeps accepted current and independently reopened sources
distinct. A reopened record set can be inspected beside an unrelated active
site without replacing it. Draft records disable saving; failed imports retain
accepted work. Record edits, parent changes, new imports and close supersede
queued computations and delayed reads. The parent exposes a current source
only when its accepted course is clean and idle.

## Authored controls and actual receiving

The maintained nine-timestamp London control has an authored ten-metre C1
column. Each proposed blocked state is individually possible, but all nine
cannot hold at one common bearing. The 06:00 and 10:00 blocked pair alone is
already incompatible. A seven-blocked followed by two-clear pattern retains a
sufficient interval approximately [92.8512837706, 92.9334022932] degrees, including
the separately checked 92.8923430319-degree original-kernel witness. These are
software controls, not field data or measured orientation accuracy.

Run `node tests/solar-bearing-evidence.test.mjs` for the complete-pattern,
mixed-scenario, endpoint/gap, uncertain-height, UTC, budget and raw-replay
controls. Independent review also compares the actual adapter with 209 cases
covering 1,199 exact rational endpoint/open atoms.

The browser receiver exercises the actual current-course entry, empty record
form, deliberate keyboard submission, both authored patterns, original evidence,
actual download/native reopen, independent active source, refusal and late-work
controls, and readable 390-pixel ranges:

```sh
CHROME_BIN=/opt/google/chrome/chrome \
SUN_BEARING_EVIDENCE_RECEIPT_DIR=/tmp/sun-bearing-evidence \
node tests/solar-bearing-evidence.browser.mjs
```

Authored browser code and native controls remain distinct from executed browser
receiving. All conclusions inherit the original spatial, solar-position,
opaque-column, height and numerical model limitations.
