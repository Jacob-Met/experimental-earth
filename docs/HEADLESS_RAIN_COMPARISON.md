# Recompute a portable rain project outside the browser

Export the original Experimental Earth site project JSON from the existing workbench. Reopen it in a headless local process:

    node inspect-rain-project.mjs /path/to/exported-project.json

The command reads one explicit local original file, validates it through the ordinary project contract (up to 4 MiB), and calls the exact exported core comparison solver. It returns a JSON document with the original bytes' SHA-256, both scenario water budgets, proposal-minus-existing differences, and declared units. Failure uses exit status 1, a stderr explanation and empty stdout; no partial result is emitted.

Fields include total rain, absorbed water, boundary exit, final surface storage, numerical mass remainder and maximum instantaneous ponding, plus the maximum local depth and number of cells that reached 10 mm depth. Per-cell peak depths are not simultaneous pooled water. Deltas mean proposal minus existing, always in the stated units.

This recomputes the base rain model only. Original readings, optional investigations, raster evidence and original source descriptions remain in the input project, not independently checked here. A saved derived output cannot affect results. The CLI does not edit the source file or browser state, upload anything, change model assumptions or claim environmental observations. Model results are conceptual, not flood forecasts or measured intervention benefits.

The input must be a regular file, not a symlink or device; the reader rejects invalid UTF-8, oversize content and ordinary concurrent filesystem identity/timestamp changes. This is not a hardened forensic protocol against an adversary with privileged filesystem control. Preserve the original file beside captured stdout and verify the source hash when sharing.

The separately owned human-readable standalone comparison is tracked at Experimental Earth #400. This headless receipt does not replace the browser or that report.
