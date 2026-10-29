# Main rain comparison

Long projects can make the existing/proposal rain comparison occupy the browser's main thread. The application now computes larger comparisons in a module worker so the browser can keep responding while the original project is evaluated. Small comparisons still run directly.

## Working while a comparison runs

After a change starts a larger comparison, a status message identifies the pending work. The last completed comparison remains visible, with an explicit explanation that it belongs to the previous completed project. Its result and evidence panels cannot be operated while they are obsolete, and the map-view selector is disabled.

The project title, rain, storm duration, overall duration, cell size, project import, and project export remain available. Further changes supersede the running comparison. The application terminates the old worker and rejects late replies; an older imported file cannot replace a newer edit, file selection, or explicit restore.

Export retains the current project input, including changes whose comparison is pending or failed. It does not claim that those changes have completed a comparison. Normal project validation still applies to export.

## Failure and recovery

A worker startup, computation, or response failure leaves an explicit failure message. The application does not silently run the large comparison on the main thread as a fallback. The attempted input remains available for editing and export, and the previous browser save is retained.

**Retry comparison** starts a fresh comparison of the current input. **Restore last completed project**, when available, explicitly replaces the current input with the last completed project and restores its results. Restore also invalidates pending worker replies and pending file reads.

Results become available for interaction after the new comparison has been drawn and its panels refreshed. If display refresh fails, the application reports that the display may be incomplete and keeps it unavailable for analysis.

Only an accepted comparison is eligible for the normal browser save. A pending or failed attempt does not overwrite that saved project. Browser storage can still fail; the existing save-status message reports that separately. Reload recomputes the saved project, using a worker when it exceeds the same size threshold.

## Model and scheduling

The worker imports the unchanged `compare()` function from `core.js` and returns its complete existing/proposal results. It does not replace the model, shorten the storm, sample fewer cells, or discard snapshots.

The scheduling estimate is:

```text
2 × width × height × ceil(durationMinutes / stepMinutes)
```

An estimate of at most 10,000 runs directly; larger estimates use the worker. This is a scheduling heuristic, not a promised frame-time budget or a model accuracy setting. Worker startup, message transfer, result validation, and rendering also cost time. Other application calculations retain their existing behavior.

## Reproduce the checks

Run `npm test` with Node.js 20 or newer for the native suite. The worker tests compare complete canonical outputs, including the authored 24×24, 720-minute project and a fractional final step.

With Node.js 22 or newer and an installed Chrome/Chromium, run:

```sh
CHROME_BIN=/absolute/path/to/chrome node tests/main-comparison-worker.receiving.mjs
```

The maintained browser course checks exact displayed values and full input export, animation progress during a real worker comparison, stale requests, failures, retry, restore, file-read races, keyboard focus, and original CSV/map custody. It captures separate pending and ready screenshots. Set `RUN_DIRECTORY` to an absolute new directory to retain a distinct receipt; optional `APP_ROOT` selects an absolute extracted distribution directory for the same checks.

The heartbeat measures the interval from posting the request until receiving the native worker response, including startup, scheduling and message transfer. It is not compute-only time or a general speedup claim. Controlled held replies and failures are separate from the native responsiveness measurement. See the versioned release's receiving evidence for the actual source version, platform, results and limits.
