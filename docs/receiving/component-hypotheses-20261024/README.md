# Component interactions across infiltration hypotheses

## Source / native scope

Outcome: [#80](https://github.com/Jacob-Met/experimental-earth/issues/80). Continuing direct worker `experimental_earth`, team `hamon-cb295a6c5277-20261023`; independent code review by the MECHANISM worker and root; actual browser receiving by root.

Base: `cf830de0d0be2459d8bbc21600b1979cf19eb1e9`, the merged component experiment. Fresh GitHub main inspection before this receipt returned the same revision. The current baseline includes finite crests and threshold evidence; the component module retains the maintained `sameInternalBarriers` interface. This change modifies only the component module/panel, README and two new tests. No app, styles, hydraulic solver or evidence-fitting module changes are needed.

| File | SHA-256 |
| --- | --- |
| `proposal-components.js` | `8a5c930a62bebb7e3c3016797024eaf26622be94da4e41b43813fd3ac0187a31` |
| `proposal-components-panel.js` | `07f9e8e74a4d5f08fa20d3fed4ea3cc60274d002c7c1102b4919f5d16da094de` |
| `README.md` | `1df0700c85c88fe81e320f13299c6a88685ff2186895aa013fbf8ffc6c67f585` |
| `tests/component-hypotheses.test.mjs` | `ace06d93088e1c8ddb26571ddb10ee3988ab6ea8d56332cf308fe805444a372d` |
| `tests/component-hypotheses.receiving.mjs` | `aee08e593a3c02e4757db7c829c7a8dcf24366ce3bb317b4eb9407404f501d62` |

## Mechanism and interpretation

The unchanged observed source is evaluated once by `compareInfiltration`. All-declared, calibration-compatible and calibration-plus-held-aside-compatible sets then feed the same four-world component experiment. Each rate is held fixed for matching surfaces in existing, A-only, B-only and full plans. Partial counterfactual plans never refilter observations from the real declared source plan. The displayed rate selector inspects results without adopting a rate or editing inputs.

Filters explicitly use the numeric-depth notebook. Separate threshold and collected-runoff records are not silently associated. Missing calibration, missing holdout, contradicted evidence and a surface absent from the observed source produce explicit refusals rather than a closest-fit substitution. The combined one-million-cell-step budget conservatively counts one source pass plus four component runs per original rate before filtering.

The authored courtyard split D3/D4/D5 versus E3/E4/E5 has edge-outflow interaction about −7.898 L at sealed infiltration 1 mm/h and +17.126 L at 9 mm/h. A broad authored numeric-depth control retains both; changing only an authored held-aside control changes survivors without changing calibration membership. This demonstrates conditional model sensitivity, not physical parameter identification or independently measured environmental benefit.

Ranges span only retained finite hypotheses. Different metric extrema can come from different rates and cannot be combined as one water budget. Inspect one actual rate for a consistent four-case calculation. The earlier distinction also remains: maxima can interact because their maximizing cell/time changes without any water exchange between components.

## Native and independent review

Local Node.js v24.19.0 on the exact current composition:

```sh
node --test --test-isolation=none tests/*.test.mjs
```

**295 native tests passed**, including six new hypothesis groups. Those groups cover actual interaction reversal, original-source admission, calibration independence from held-aside values, source-proposal evidence not refiltered against partial worlds, explicit missing/rejected/absent-source cases and combined-budget refusal. The local log is `/tmp/earth-component-hypotheses-merged-native.log`.

Independent MECHANISM review reran all six new groups and additionally checked **60 direct fixed-rate/four-world metric comparisons**, complement-interaction symmetry and unchanged inputs. It found no blocker. Root separately reviewed numeric/evidence/budget seams and found no blocker. Neither reviewer changed the frozen source. The independent 60-comparison inputs were `makeExample()`, A=`[19,27,35]`, B=the edited-cell complement, surface=`sealed`, targets `existing` and `proposal`, and candidate lists `[0,1,9]` and `[2,6,12]` in all-declared mode. For each of four studies × three rates × five metrics, direct `runRain` calls on existing/A-only/B-only/full with the identical surface override reproduced `full − A − B + existing`; swapping A/B agreed within 1e−8 and serialized source input stayed unchanged. The reviewer ran this as an in-memory script rather than retaining an additional test file.

## Actual browser receiving

Root's isolated current-source workspace: `/tmp/hamon-cb295a6c5277-earth-hypotheses`.

```sh
CHROME_BIN=/opt/google/chrome/chrome node tests/component-hypotheses.receiving.mjs
CHROME_BIN=/opt/google/chrome/chrome node tests/proposal-components.receiving.mjs
```

The new actual-Chrome course passed **nine groups**: reuse of current source rates; visible interaction reversal; genuine keyboard ArrowDown rate inspection; no automatic adoption; missing-calibration refusal; desktop/390px result layout; positive calibration and surviving modes; changed holdout preserving calibration while changing survivors; and contradiction without fallback. The existing default component course also passed **ten groups**, including keyboard selection/scroll and canonical finite-crest-only import/partition.

Remote logs: `/tmp/hamon-cb295a6c5277-earth-hypotheses-browser.log` and `/tmp/hamon-cb295a6c5277-earth-hypotheses-default-browser.log`. The hypothesis run retains `component-hypotheses-desktop.png` and `component-hypotheses-mobile.png` under `/tmp/hamon-cb295a6c5277-earth-hypotheses-browser`. Both captures use the actual panel rectangle after instant scrolling and two animation frames, with explicit viewports. Root independently inspects these pixels and the retained sandbox/source receipts before publication. The maintained browser session requires same-browser sandbox admission; the generic process-owner `sandbox: not-assessed` field is not a substitute for that separate admission receipt.

## Qualification boundaries

This receipt's current proof is **295 native / 9 hypothesis-browser / 10 default-browser groups plus independent 60-case review**. The preceding component release's 282-native/85-maintained-browser result remains historical evidence for that release; it is not relabeled as a newly executed full-browser result here. The new input modes and regression paths above were actually exercised.

No field calibration, unique material property, probability, statistical confidence range, physical construction permission, deployed service or Nebius execution is claimed. The merged-source commit and postmerge verification belong in #80/the PR after normal integration; this premerge receipt alone does not claim a merge.

## Final receiving evidence

The team lead inspected the actual desktop and390px component results on the source-pinned remote composition. The sign reversal and selected9mm/h four-case details remain visible. Dedicated sandbox admission reports Namespace and Seccomp-BPF support. [New browser course](browser.json), [default component regression](default-browser.json), [sandbox](sandbox.json), [exact tested-source manifest](verification.json), [desktop](desktop.png) and [mobile](mobile.png) are retained alongside this receipt.
