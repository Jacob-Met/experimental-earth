# Joint later challenge of an earlier linear history

The original paired-series trend-region consumer now asks **Do all later
original bands fit one unchanged earlier-compatible line?** alongside its
individual residual envelopes. No additional manual hypothesis list or copied
readings are needed. The same source-only investigation recomputes this check
when reopened; the existing format remains valid.

This is a challenge of a declared continued relation, not a causal attribution.
A contradiction can reflect an intervention, weather, measurement error,
nonlinearity or other changed conditions. Compatibility cannot establish that
an intervention had no effect. Source association and model assumptions remain
explicit and unverified.

## Why separate later overlaps are insufficient

In an authored control, original earlier gaps are exactly 0 at day 0 and
[-1,1] at day 1. Earlier support contains slopes [-1,1] with baseline zero.
A later gap of 2 at day 2 has residual [0,4], while a gap of -3 at day 3 has
residual [-6,0]. Each contains zero, but the first requires slope +1 and the
second slope -1. No single unchanged line fits both. Replacing the final gap
with +3 leaves one jointly supported line. These are authored software controls,
not measured field outcomes.

## Retain the earlier region; challenge a separate copy

`challengePairedTrendContinuation` calls the maintained complete earlier-region
inference once, preserves that result unchanged, and clips a separate exact
polygon against every original later lower/upper band. It reuses the unchanged
Chronos rational/half-plane implementation. The earlier region and its original
per-reading residual envelopes are never replaced by the challenged subset.

An already incompatible earlier history receives no later joint test. An empty
challenge region reports the tested original later indices and the index at
which their ordered prefix became contradictory. The earlier original evidence
plus this prefix is a reproducible contradiction witness. It is not claimed to
be minimal, and its order does not imply causation. Remaining original rows stay
in the preserved source; they cannot rescue an already empty intersection.

When support remains, the full jointly supported vertices are available in
expanded exact records. No point, line, average or best-fit parameter is selected
or adopted. The same supplied-binary64 and exact-UTC scope, outward endpoint
enclosures, original-band semantics and measurement limitations described in
[the earlier-region guide](PAIRED_TREND_REGION.md) apply.

The work ceiling is shared across earlier-region construction and later clipping
(at most 200000 constraint checks). A failure returns no partially challenged
success. The original pair work bound and arithmetic capacity remain unchanged.

## Receiving and proof

`node tests/paired-trend-continuation.test.mjs` runs four groups: separate-overlap
contradiction; shared-line positive and source-order invariance; original source
immutability/replay and unchanged earlier support; combined work refusal and an
already rejected earlier history. An independent whole-course pair-inequality
oracle tests 150 unfamiliar small-integer courses (31 compatible, 119 rejected)
without using polygon clipping. Integer cross-products in this bounded oracle
are exact and independent of production rational geometry.

`node tests/paired-trend-continuation.browser.mjs` exercises the actual maintained
series-to-region consumer, automatic joint contradiction, original-input download
and fresh reopen, a changed later reading that restores joint support, preserved
active workspace, invalid-draft retirement and desktop/narrow readability.
Execution and published-source receipts remain on the native PR; these commands
do not assert unrun browser checks or physical validation.
