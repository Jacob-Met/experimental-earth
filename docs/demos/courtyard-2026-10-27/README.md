# Experimental Earth: private courtyard demonstration

Experimental Earth helps a person compare a proposed change to a place, inspect the assumptions behind its modeled effects, and retain evidence that can challenge them. This private demonstration follows that loop through a fictional courtyard edit, an explicitly fictional reading, and the actual exported project reopened in a fresh browser profile.

## Selected private media

[Watch the silent courtyard demonstration](experimental-earth-courtyard-private-demo.mp4) · [Download the demonstrated project](experimental-earth-site.json)

**82.7 seconds**, 1280 × 1012, 3,044,605 bytes.

SHA-256: `8137df72942bec8d64fe3f20fa7865012786a704a0ce3facb3fea4d9844fb470`.

Take 02 / encoding 03 is selected for private integration. The lead executed runtime receiving, encoding checks, nine seek samples and complete normal-speed browser playback of the SHA-256-verified downloaded artifact. Playback covered 0–82.7 seconds and ended normally, with zero reported dropped or corrupted frames. The retained independent reviewer inspected all eight encoded stage stills: captions are legible and truthful, the comparison story is coherent, and the previously weak notebook framing is corrected. This establishes sampled visual acceptance and complete decoder playback, not continuous human motion-quality assessment or HTTP Range streaming qualification.

Product source remains `d362f62bdc0773d840b0e82be4bf409720992630`. The recorded historical source is distinct from the repository head into which this documentation is integrated.

Package files: `experimental-earth-courtyard-private-demo.mp4`, the actual downloaded `experimental-earth-site.json`, sanitized `receiving.json`, actual timed `captions.json`, `poster.jpg`, `notebook.png` and `playback-timeline.json`.

The actual raw take contains **130 original JPEG viewport frames**: 112 across **72.54737735 seconds** in the main workspace, and 18 across **10.145875589 seconds** of fresh-profile reopening. The combined raw duration is approximately **82.693253 seconds**. These event-driven browser frames use original receipt timestamps; they are not fixed-rate renderer measurements or an asserted final encoded duration.

Take 02 improves heading and notebook framing without changing the product. The reopened source-labelled reading is fully visible at vertical bounds **240.234375–399.5 pixels** in the 900-pixel application viewport. Runtime bounds and exact-source assertions passed; encoded-stage inspection and complete decoder playback were then received separately.

The silent delivery uses an editorial caption band outside the application viewport. Captions explain the actual actions and distinguish the fictional courtyard and authored observation from field evidence. They are not application UI or generated replacement screens.

Repository-facing evidence is summarized in `receiving.json`. It deliberately omits private infrastructure paths, process identifiers and network addresses; original receipts remain in existing private coordination.

## Preserved earlier attempts

Take 01 / encoding 02 passed timing checks but its sampled notebook framing motivated take 02. Take 01’s first encoding failed its duration assertion (82.067 seconds versus 79.232 expected). Both remain historical evidence, not the selected final delivery. A range-less HTTP seek attempt also failed; the selected playback qualification uses the verified complete download in browser blob mode. These failures remain preserved in private coordination and do not qualify streaming.

## Recorded experience

The journey:

1. Open the fictional example and copy the existing site into the proposal.
2. Change only proposed **D4** from sealed paving to a rain garden, retaining its elevation and the original weather.
3. Inspect the actual water quantities and explicit water accounting.
4. Inspect both maps at **60 minutes**, the same retained solver snapshot.
5. Enter an explicitly fictional existing-site reading at D4: **12.5 ± 2 mm at 60 minutes**, marked **Held aside**, with source `Fictional demonstration reading — authored, not field data`.
6. Download `experimental-earth-site.json` through the ordinary Export project button.
7. Import that actual file into a fresh browser profile and inspect the retained reading and recomputed comparison.

## What was verified

The browser course checked identical baseline alternatives, a change confined to proposed D4, unchanged existing geometry and weather, and changed displayed calculation results. The recorded hypothetical proposal showed approximately **339.9 L more infiltration**, **19 L less boundary outflow**, and **320.9 L less final stored water**. Those quantities describe this authored model case; they are not measured intervention benefits.

Submitting the fictional reading added exactly one attributed notebook record without changing model assumptions or calculated quantities. The real downloaded file retained the original scenario inputs and reading. Fresh-profile import reproduced those inputs and the same displayed calculation; the receiving status is `FRESH_PROFILE_EXPORT_REOPEN_PASSED`.

Both browser courses completed in isolated Linux Chrome profiles with successful maintained sandbox admission and no recorded page exceptions. Sanitized source hashes and runtime outcomes are in `receiving.json`; exact operation, timing and cleanup receipts remain in existing private coordination. A source hash identifies the inspected bytes; the executed browser assertions establish the limited behavior above. Neither alone establishes visual quality or environmental validity.

## Reproduce the experience

Use the complete repository at the source commit above. From its root, run `python3 -m http.server 8765` and open `http://localhost:8765/` in a new disposable browser profile. Do not reset an existing personal workspace. Follow the seven steps above; D4 is column D, row 4 of the 8 × 6 grid. Select **Inspect** after painting, and enter observation time before its value and source. For the same-time map, choose **Water depth at the same time (mm)** and select 60 minutes.

For automated reproduction, retain the delivered `tests/rain-journey.recording.mjs` and `tests/rain-demo-course.mjs` alongside the complete pinned source. Use the maintained Linux browser-session prerequisites in `tests/support/README.md`, a verified Chrome executable, and a new absolute `BROWSER_RUN_DIRECTORY`. Set `EARTH_DEMO_SOURCE_COMMIT` to the commit above and run `node tests/rain-journey.recording.mjs`. The optional `EARTH_DEMO_BASE_URL` selects an already running maintained local HTTP origin; `CHROME_BIN` selects the verified browser. Keep the actual launch, source-byte verification and encoding commands with the delivery receipts. This document does not imply the capture scripts are part of the product commit.

Encode a newly recorded course into a new output directory with the installed `ffmpeg` and `ffprobe` tools:

```sh
python3 tools/encode-courtyard-demo.py \
  --take /absolute/path/to/capture-run \
  --output /absolute/path/to/new-video-package
```

The encoder uses the adjacent `capture-run-reopen` directory unless `--reopen` supplies another path. It refuses existing output, preserves capture timing, and checks the actual stage identifiers before applying these captions.

From a checkout containing this delivery, receive the selected media with a new absolute run directory:

```sh
DEMO_PACKAGE_ROOT="$PWD/docs/demos/courtyard-2026-10-27" \
DEMO_VIDEO_PATH="experimental-earth-courtyard-private-demo.mp4" \
DEMO_TIMELINE_PATH="$PWD/docs/demos/courtyard-2026-10-27/playback-timeline.json" \
DEMO_EXPECTED_DURATION=82.7 \
DEMO_DURATION_TOLERANCE=0.04 \
DEMO_PLAYBACK_MODE=downloaded-blob \
DEMO_FULL_PLAYBACK=1 \
BROWSER_RUN_DIRECTORY=/absolute/path/to/new-playback-run \
CHROME_BIN=/opt/google/chrome/chrome \
node tests/private-demo-playback.receiving.mjs
```

The explicit duration overrides the receiver's earlier-take default. This checks the SHA-256-verified complete download, playback and seeking; it does not qualify server Range support. The source-commit environment variable in the recording harness is a supplied label, so verify the product checkout separately when reproducing source-provenance claims.

## Qualification gaps and private status

This is a deliberately simplified conceptual rain model on fictional geometry with authored material assumptions. Conservation and successful reopening do not validate soil properties, predict actual flooding, establish physical access or safety, or justify a real intervention. The notebook's normal “measured” label does not turn this expressly fictional teaching record into field evidence.

The take demonstrates neither NVIDIA model inference nor Nebius Token Factory/AI Cloud execution. It does not establish contest eligibility, public-source/licensing readiness, a public deployment, a Devpost entry, an accepted submission, human usability, or an independently validated scientific result. Those remain separate project and delivery responsibilities. This package and its source/receipts remain **private**; no public release or submission is authorized by their existence.
