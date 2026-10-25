# Original paired series and a constant earlier place difference

The measured-change investigation now has labeled controls for its four original
readings. Its original download/reopen format remains supported. Under **Do earlier
paired readings support a constant place difference?**, investigate two or more
original pre-intervention pairs and at least one post-intervention pair.

Each pair contains an original treated-place interval and comparison-place
interval at one exact UTC instant. Declare the common quantity, original unit,
places and comparability basis. Declare a separate intervention instant and an
explicit pre/post role for every pair. Times must be distinct and strictly before
or after that instant; an observation at the intervention instant is refused.
At most64pairs are accepted. A pair shares its explicitly entered unit/place/time
metadata; changing these declarations does not perform unit conversion.

The original four-reading comparison can seed one pre pair and one post pair,
including all original source descriptions. This does not invent an intervention
time or a second earlier reading: supply those separately before comparison.
The fictional example is an authored software control, not measured field data.

## What is tested

For every earlier pair, subtract the comparison interval from the treated
interval. The intersection of these intervals describes the constant
between-place gap permitted by **all** earlier bands. No average, regression or
best-fitting gap is selected. A lower endpoint greater than the upper endpoint
by more than the numerical guard contradicts this fixed-gap hypothesis. The
result retains the original pairs attaining both endpoints as a short witness.
A tiny reversed interval is reported as numerical contact; later contrasts are
withheld. Compatible narrow/zero-width intersections are explicitly boundary
cases. Original measurement intervals are never widened.

For each later pair, subtract the entire compatible earlier-gap interval from
that pair's gap. These are conditional descriptive contrasts. Later values do
not select or change the earlier feasible set. Stable earlier gaps cannot
establish parallel trends, absence of confounding, a valid comparison site or
causal intervention effects. Incompatible gaps may reflect measurement or
association errors as well as changing environmental differences.

Arithmetic takes independent Cartesian combinations permitted by the entered
bands. It does not infer shared sensor errors or probabilistic confidence.
Endpoints use floating-point arithmetic, not certified outward-rounded bounds.
The64ε-scaled numerical guard only separates robust conflict from numerical
contact and flags narrow intervals; it is not a measurement uncertainty.

## Source custody and replay

A comparison captures the original workspace context. Reopening retains that
original context while leaving the active workspace intact. Editing the paired
readings retains their captured context; **Use current workspace context** is an
explicit replacement. Any input change retires the displayed result. Asynchronous
file reads cannot overwrite a newer draft. Original-input download keeps all
original rows—including conflicting readings—and the full source project, with
no stored verdict. Reopening validates and recomputes. Files may contain private
site or source information and use the maintained4MiB limit. Nothing is uploaded.

## Verification

`node tests/paired-series.test.mjs` checks authored compatible/conflicting/boundary
cases, original witness indices, post-value independence, source/unit/time/role
refusals,100independent enumerations over original permitted integer readings,
source immutability, the64pair bound and floating-point contact.

`node tests/paired-series.browser.mjs` received eight actual maintained-app groups
through sandboxed Chrome156: labeled source entry, conflict witnesses, original
conflicting-input download, independent replay preserving the active site,
boundary contact, blank-bound refusal, late-read refusal and1280/390px fit.
The retained four-reading browser course still passes five groups. Independent
SECOND GROUND source review found no blocking defect. These software controls do
not qualify physical measurements, causal conclusions or deployment.
