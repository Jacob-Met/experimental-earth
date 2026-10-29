# Original interval-total rainfall CSV

The existing rain-gauge investigation accepts pasted original CSV with exactly:

`id,start,end,depth,uncertainty,unit,source,use`

Supply the original event origin and the existing event/site/interval association declarations. Timestamps require a valid calendar date, seconds, and a known explicit offset (`Z` or `±HH:MM`, at most14hours); years1900–9999 and up to millisecond precision are admitted. Local timestamps, unknown `-00:00`, leap seconds and nonexistent dates refuse. Offsets are supplied facts, not inferred timezones.

The maintained bounded CSV reader supports quoted commas, newlines and escaped quotes. At most64 original intervals are admitted. Numbers, units and evidence roles are explicit; blanks are not zero and no row is automatically calibration. The adapter validates all rows before replacing the displayed original intervals. Each resulting source retains the original start/end timestamp and event origin. Existing600-character source limits remain enforced.

Readings must already be interval totals. No cumulative-counter differencing, reset repair, rainfall interpolation or new forcing simulation is performed. Compare explicitly after import. Existing original-input export/reopen retains these sources and recomputes inference; imported CSV is not a saved result.

The contribution is complementary to issue7's owned rainfall-timeline solver. It makes original measured inputs usable by the existing constant-forcing gauge comparison and exact nominal-band consistency diagnostic without changing soil inference or the active site.
