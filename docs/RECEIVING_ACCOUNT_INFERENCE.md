# Infer receiving layers from original water accounts

This workflow proposes a finite set of receiving-layer parameters without asking
the user to supply initial stored water. It uses the existing draining-layer
forward model and the original selected footprint. It does not identify a unique
physical material, estimate a continuous parameter enclosure, or adopt a model
into the active site.

The maintained application exposes the workflow under **Can water below ground
distinguish these explanations? → Infer receivers without supplying their
initial water**. Copy a separate original receiving account, declare why one
uniform layer is appropriate, and propose. Existing offered hypothesis
parameters are not inputs to this inverse. The three authored examples exercise
a wet-surface inventory, a late retained-water ambiguity, and three unequal-time
cumulative drainage readings.

## Original quantities and assumptions

The selected original scenario and surface determine every included cell and
the complete receiving area. A litre total means water below **all** those cells,
not one soil probe, a surface outlet collection, or a conveniently rescaled
point measurement.

The inverse requires:

- One uniform receiving layer across the explicitly declared selected footprint.
- Positive constant rain followed by a dry period.
- Zero lateral mobility and zero surface-boundary outflow.
- Initially dry surface, as in the maintained original forward model.
- Original receiver readings and offers at exact retained solver endpoints,
  including a final partial step; no receiver interpolation is introduced.
- Cumulative receiver drainage measured from the original event start.
- Explicit original calibration/challenge roles, uncertainty bands and sources.

Every candidate is checked through the actual maintained forward model against
**all** original surface and receiving calibration bands for the selected
scenario. Held-aside values only challenge the generated candidates. They do
not generate parameters, narrow the generated set, or choose a future offer.
Other scenarios' observations retain their original role and are not silently
retargeted.

A held reading at a channel/time makes that channel/time already recorded for
prospective-question purposes, independently of its value. Calibration support
alone ranks unrecorded offered measurements. Strict separation requires a
predicted gap larger than both declared half-widths and the computational
comparison guards. Ties preserve original offer order.

## Wet surface and one receiving account

Use an original storm-end surface depth H, a later positive depth L at the same
cell, and a receiving calibration reading between those times. Let R be rain,
f the selected surface's infiltration rate, F = min(R, f), T the storm duration
in hours, and t the later time in hours.

The full-store drainage rate and inferred fill time are:

    q = (H - L) / (t - T)
    tf = ((R - q) T - H) / (F - q)

The interior inverse requires 0 ≤ q < F and 0 ≤ tf < T. Negative inferred fill
times are refused, not clamped.

For a retained-water total I across area A:

    C = I / A
    k = q / C
    S = C - (F - q) tf exprel(k tf)

C is capacity, k drainage per hour, and S initial stored water.
exprel(z) = expm1(z) / z, with the continuous value 1 at zero.

For cumulative drainage D/A at time ta, the integrated intake is
F tf + q(ta - tf). Its difference from observed drainage equals
(F - q) tf exprel(k tf), a monotone equation in k. A bounded bisection searches
the maintained domain; the resulting C = q/k and S must remain in the original
parameter domain.

Zero drainage with q = 0 does not identify capacity and initial water from the
drainage channel. An initially full course fixes only kC through cumulative
drainage. These cases remain non-identifying or unresolved. Positive drainage
cannot be rounded into zero to manufacture identification.

A separately enumerated initially-full retained-water proposal S = C preserves
that physical boundary when floating arithmetic makes the interior fill time
slightly negative. It still must pass every original forward band. The failed
interior trial stays visible.

## Late retained water: retain both capacity branches

Two positive decreasing retained-water totals Iu, Iv after the storm, together
with original storm-end depth H, supply:

    k = log(Iu / Iv) / (v - u)
    logAmplitude = log(Iu / A) + k(u - T)
    log(C) + H/C = logAmplitude

The capacity equation changes monotonicity at C = H. The implementation examines
both branches; assuming just one would discard an observationally compatible
receiver.

The conditional domain also requires a full receiver at storm end and a dry
surface by the first inventory:

    C ≥ H / (k(u - T))
    C ≤ min(10000, F/k)

Each resolved capacity supplies separately enumerated initially-full and,
where it can fill before storm end, initially-empty alternatives. An interior
fill time and initial water estimate are also attempted. Invalid interior
estimates remain refused. No negative storage is converted into an empty model.

The authored ambiguity illustrates the practical difference. Capacity 12 mm
with initial water about 3.391 mm and capacity about 19.089 mm with initial
water about 15.870 mm share the same late retained course at drainage rate
0.63/hour. Retained water at minute 360 does not separate them. Cumulative
drainage at minute 360 differs by about 49.916 L across the declared 4 m²
footprint and does separate them at the offered ±0.1 L precision.

## Three late cumulative drainage readings

After the surface is dry, a conditional receiver has the form:

    D(t) = Ainf - B exp(-k(t - T))

For original ordered times u < v < w, let a = v-u, b = w-v, d1 = Dv-Du,
d2 = Dw-Dv, with time intervals in hours:

    d2/d1 = exp(-ka) (1 - exp(-kb)) / (1 - exp(-ka))

This ratio decreases strictly with positive k. The implementation permits
unequal spacing, uses logarithms and expm1 for the rate equation, and reserves
at most 128 bisections. Nonpositive increments refuse; constant average rate
does not identify positive decay; increasing average rate contradicts this
conditional post-dry course.

The inferred internal retained course is:

    Iu = d1 / (1 - exp(-ka))
    Iv = Iu exp(-ka)
    Ainf = Du + Iu

These are derived model quantities, **never new original observations**.
The original three drainage rows, plus every other original calibration band,
check all resulting capacity branches. In the authored example, a second
capacity branch can fit a held retained reading yet fail the original drainage
calibration. It therefore remains unsupported.

## Complete work and evidence custody

The producer reserves the entire combined family before any inverse or forward
calculation:

- Two wet trials per retained calibration account and one per drainage account,
  for each original surface pair.
- Six trials per late retained pair and per distinct-time drainage triple,
  for each original storm-end calibration row.
- At most 128 trials and 1,000,000 cell-steps.
- At most 100,000 complete offered-question pair comparisons.

Drainage triples are counted by time groups before they are materialized.
Repeated-time readings remain separate original bands and provenance, but
cannot constitute three distinct times. Exact duplicate parameter tuples share
one forward run while retaining every generating original-row combination.
A budget refusal never returns a computed prefix or restores a rejected family.

Original-input files have exactly schema, project, selection and account at
their root, bounded to 2 MiB. Saved conclusions, candidates or derived courses
are rejected on reopen. The actual application downloads originals and
recomputes them in a fresh context. The child owns an explicit separate copy:
editing the parent cannot retarget its source. Editing the child's uniformity
declaration retires accepted results. Generation checks prevent delayed file
reads and queued calculations from replacing a newer source action.

## Qualification on the recorded source

Local native qualification ran through ordinary Node, without experimental VM
flags:

    RECEIVING_INVERSE_RECEIPT=/absolute/output.json \
      node --test tests/receiving-account-proposals.test.mjs

The 11 behavior groups cover wet recovery and degeneracy, both late capacity
branches, an independent integrated mass-account calculation, original-role
separation, contradictory bands, unequal-time drainage, repeated-time
provenance, unsupported regimes, strict original-only files and complete
preflight refusal. Instrumentation forwards to the actual maintained modules;
a 217-trial family refuses with zero inverse or forward calls. A valid drainage
course reserves 9 trials / 5,184 cell-steps and executes five distinct forward
models.

The unfamiliar authored grid contains 162 parameter tuples. Eligibility is
selected from the maintained forward course before inversion: positive
storm-end depth, full receiver at storm end and dry surface by the first
account. Fifty-three are eligible; 109 remain excluded with their reasons.

- Generating parameters recovered within the recorded tolerance: 53/53.
- Recovery without the separately enumerated empty boundary: 44/53.
- All nine added recoveries retain the refused negative interior-storage trial.
- Forward models across eligible courses: 171.
- One surviving finite proposal: 36 courses; several survivors: 17.
- Worst relative generating-parameter error: approximately 5.93e-10.

This measures synthetic regime coverage, not field accuracy or unique
identification. The no-empty comparison retains exactly duplicated central
proposals; it does not remove a valid central root merely because the same tuple
was also enumerated as an empty boundary.

The actual maintained browser course passes 10 groups with Chromium's full
sandbox active, zero browser exceptions and zero failed local resources. It
exercises the three examples, offer inspection, original download/fresh
reopen, wrong held values, contradictions, forged conclusions, explicit parent
copy, stale file/queued-run exclusion, complete-budget refusal and desktop/
390 px controls. Screenshots were visually inspected.

The unchanged original account behavior also passes its six native behavior
groups and seven actual-browser groups against the composed implementation.
Independent source review checked inverse regimes, budget ordering, original
band use and stale-input custody; it did not substitute for execution.

The first actual inverse browser run found a control-ID collision with the
existing simpler receiving-proposal panel before any product assertion passed.
The new controls now use their own rai- prefix. That failed receipt is retained
separately and is not counted as a pass. Two fixture-construction refusals
(off-grid minute and disallowed reading-ID punctuation) are likewise recorded.

See docs/receipts/receiving-inverse/ for exact hashes, native/browser receipts,
the initial browser failure, source review and integration status.

## Remaining capability limits

These are finite proposals from calibration centers and explicit physical
boundaries. Measurement uncertainty is used to check original bands; it is not
propagated into a certified continuous parameter region. Both capacity branches
are conditional on the phase assumptions and uniform isolated footprint.
Heterogeneous receivers, laterally coupled footprints, nonconstant rain and
unsupported wet/dry phases remain outside this inverse. Numerical comparison
guards are computational conventions, not calibrated instrument error,
certified root enclosures, convergence proofs or environmental guarantees.

