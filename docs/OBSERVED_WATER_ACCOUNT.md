# Reconcile original water quantities

The observed water account combines original sourced rainfall, full-boundary
collected runoff and complete start/end ponding-depth bands without running the
hydraulic model. It exposes an unassigned residual, including negative results
that challenge the declared account. It does not identify infiltration uniquely.

## Prepare the evidence

Retain an original full-boundary collection in the existing collected-runoff
panel. Its site/event context must still match the working project. Select one
original interval in **Do the original water quantities reconcile?**. Multiple
overlapping collections are not summed or implicitly assumed independent.

Supply original notebook depth readings for every cell at exactly the selected
collection's start and end, assigned to the same observed scenario. Repeated
bands reuse the maintained consistency diagnostic; all original sources and
roles remain visible. Missing readings do not mean dry cells and are never
filled by simulation or time interpolation. Contradictory bands, numerical
contact or incomplete endpoints withhold the entire account.

The maintained notebook admits at most 100 readings. A complete two-endpoint
account therefore fits at most 50 cells before repeated readings consume extra
slots. The default 48-cell site can fit both endpoints. Larger sites remain
inspectable but cannot produce a complete account under this current contract;
no cells are omitted or downsampled to make one fit.

Enter the measured interval rainfall depth and its bound in mm, cm or inches,
with a source. This is separate from the project's hypothetical rain setting.
Explicitly record the basis for treating each depth band as a bound on its
whole cell's mean, rainfall coverage over the whole site and collection
interval, same-event/clock association and absence of other surface inflows,
uncollected outflows or withdrawals. These are supplied assumptions, not
authenticated measurement quality. A single point probe is not automatically
a cell mean, and one rain gauge is not automatically an area-average gauge.

## Arithmetic and meaning

One millimetre over one square metre is one litre. Each endpoint's storage band
is the sum of cell-mean depth bands times the original cell area. The account is:

`unassigned residual = rainfall − collected runoff − (final storage − initial storage)`

Its lower endpoint uses the smallest rainfall and initial storage and largest
collection and final storage; its upper endpoint uses the opposite choices.
These are attained extrema under the supplied bands alone. Correlations not
represented by this interface can narrow the possibilities. Roles are retained
as source metadata, not used to fit or rank hypotheses.

A wholly positive residual leaves water unassigned to collection or final
surface storage. It can include infiltration, evaporation, other omitted losses
or source error. A wholly negative residual requires unaccounted input or
incorrect source/coverage assumptions; the application does not select the
cause. A band containing zero leaves the sign unresolved. A separate numerical
guard is applied to sign classification and reported explicitly; raw signed
endpoints are not clipped, rounded to a guaranteed threshold or presented as
certified physical bounds.

For an authored four-cell, one-metre-grid control, rainfall 10±1 mm, initial
depth 1±0.1 mm in each cell, final depth 3±0.2 mm and collection 20±1 L imply
approximately [5.8,18.2] L residual. Changing only collection to 50±1 L gives
approximately [−24.2,−11.8] L. These are authored arithmetic controls, not
field measurements or successful environmental validation.

## Retain and reopen

Download stores the original project and explicit input declarations only in
`experimental-earth-observed-water-account/1`. Fresh reopening recomputes the
account, including missing/conflicting outcomes, without replacing the working
project. Reopened output is labeled separately from the form, which acts on the
current notebook. Changed working evidence or form input retires the result;
a delayed file read cannot overwrite a newer input. Transfers share the 4 MiB
limit. Source descriptions and filenames do not authenticate an acquisition.

## Verification

Run `node --test tests/observed-water-account.test.mjs`. The tests independently
enumerate 1,024 original-band endpoint assignments, preserve nonzero initial
storage, compare original units, exercise a two-metre cell area and unchanged
collection volume, and check missing, conflicted, source-changed and forged
cached-result refusals.

Run `CHROME_BIN=/usr/bin/google-chrome-stable node tests/observed-water-account.browser.mjs`
through the maintained sandbox-admitted browser owner. It exercises keyboard
entry, source-only download/reopen, visible desktop/narrow results, negative
residual, missing/conflicting sources and stale asynchronous reads. Execution
receipts are required before reporting these courses as passed.
