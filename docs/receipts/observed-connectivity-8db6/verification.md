# Observed-band connectivity — issue #197

## Source and scope

This additive consumer continues the model-only connection feature merged in
PR #196 at `35068ceb63c23d5e146e7f891a98fd4166439106`. Its source was refreshed to
`b016ed361834e338e499eca071c96022aa7679cb`, preserving the 12 incoming cooling-reading
text files by their Git blob identities and appending only its own README section.
No solver, original observation, evidence-role, clock or calibration code changes
are part of this outcome. The existing graph's threshold BFS was factored to also
return its full reachable source component and above-threshold boundary.

## Independent native qualification

Eight new named native groups passed locally. They include all 729 ternary
low/high/unknown 3×2 ledgers and all 4,096 independently enumerated unknown-depth
completions. The oracle checks each all-completions/possible/excluded verdict and
that each reported boundary alone separates the endpoints. Further controls
preserve original global reading indices and all roles, exact scenario/time
isolation, repeated-band conflicts and numerical contact, equality/straddling
bands, disconnected offered footprints, model-input independence and raw-input
reopening. The predecessor's nine native groups also passed after sharing the BFS.

An independent team reviewer read the core/source adapter and ran all eight new
groups. They confirmed the conditional low-only/possible graph logic, complete
high-band boundary, high-start singleton, original indices and roles, conflict
withholding and recomputation from source-only inputs. No concrete core blocker
was found. This review is not physical evidence or browser qualification.

Before browser receiving, numerical contact was given a separate report status
and consumer heading instead of a generic conflict label. The maintained
`observationConsistency` numerical guard, source rows and actual disjoint-band
classification were unchanged.

Commands from the isolated source directory:

```sh
node tests/observed-connectivity.test.mjs
node tests/ponding-connectivity.test.mjs
CHROME_BIN=/opt/google/chrome/chrome node tests/observed-connectivity.browser.mjs
```

The browser course is designed to receive a real project-file import, keyboard
comparison, an additional reading through the maintained notebook form, actual
source Blob download and fresh File reopen, literal attribution, visible
390 px results, missing bridges/high cuts/conflicts/numerical contact and stale
or pending input changes. Actual browser/composed-suite results are recorded
separately after execution. No field reading is claimed for the authored controls.

## Actual composed receiving

On the complete composition over `b016ed361834e338e499eca071c96022aa7679cb`,
remote Node receiving passed **715/715 native tests**, zero failures/skips, in
6.09 seconds. The first full run passed 714/715; its sole failure was the existing
reading-methods CLI's `git rev-parse HEAD` requirement in a source-only receiving
directory. The initial failure was retained. A clearly labeled local hydrated
snapshot `967ca4175146d908f8a32e032bef934c28963a06` was initialized (this is **not**
an upstream commit). The affected seven groups and then the complete 715-test
suite passed on unchanged product source.

The actual composed browser course passed all **8 groups**, with no page
exceptions. The original project import, notebook form entry, raw source download,
fresh isolated reopening and visible 390 px witness/source ledger were received;
the lead visually inspected and accepted the narrow screenshot. The course used
`/opt/google/chrome/chrome`, Chrome `156.0.8078.47`, in the unique directory
`/tmp/hamon-8db6c36/earth-evidence-composed-receipt` and completed on
2026-10-25 at 02:58:09 UTC.

The separate same-session sandbox receipt explicitly admitted the browser with
namespace layer 1, PID/network namespaces, Seccomp-BPF and TSYNC active. The
process-owner receipt's `sandbox: not-assessed` field is not substituted for that
separate admission. Both receipts are retained beside this verification.

Commands on the isolated composed source:

```sh
node --test tests/*.test.mjs
CHROME_BIN=/opt/google/chrome/chrome BROWSER_RUN_DIRECTORY=/tmp/hamon-8db6c36/earth-evidence-composed-receipt node tests/observed-connectivity.browser.mjs
```

These are exact premerge composition results. Merge and actual merged-consumer
receiving are distinct subsequent steps. They do not establish physical measurement
truth, environmental accuracy, public deployment or permission to intervene.
