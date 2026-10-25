# One connection across observed visits

The existing evidence inquiry asks whether a connection is supported at one
exact notebook time. This additive inquiry asks whether the **same path** is
supported at every explicitly selected time. It uses only original numeric
depth bands, without running the hydraulic model or interpolating observations.

Choose the observed scenario, 2–16 distinct exact elapsed times, two endpoint
cells, a depth threshold and an explicit offered footprint. An absent reading
is unknown. A time with no matching observations is not filled from adjacent
visits. Different paths that work at different visits do not establish a shared
path. The existing one-sided-evidence and measurement-planning inquiries retain
their own contracts and ownership.

## Conditional conclusions

- **Supported:** one path has an upper band at or below the threshold for every
  cell at every selected visit.
- **Excluded:** every path includes a cell with a lower band above the threshold
  at at least one selected visit. The reported boundary names its original
  blocking times. These blocking readings need not be simultaneous.
- **Unresolved:** a candidate shared path has no established violation, but its
  missing or straddling cell/visit pairs prevent support.
- Conflicting original bands, numerical contact and disconnected footprints
  remain explicit outcomes; none is converted into a successful path.

The implementation reuses the maintained exact-time notebook admission and
intersection ledger at each selected time, then reuses the maintained graph
search and source-component boundary. All original rows and roles remain
inspectable, including expandable raw row JSON with table provenance. Different
scenarios and unselected times are not silently combined.

Downloads contain only the original project and canonical question. Reopening
recomputes in an isolated original project without replacing the working
notebook. Edits retire prior results; stale asynchronous reads cannot restore
them. Stored derived conclusions are never trusted.

## Evidence and limits

In an authored 16-row two-corridor control, the single-time inquiry supports a
5 mm connection at both 10 and 20 minutes, using different corridors. The shared
inquiry excludes it because every path has an original 10 mm depth at one of
those visits. Removing three readings makes the question unresolved; supplying
inclusive upper bounds can support it. Adding an unobserved 15-minute visit
returns to unresolved without interpolation.

Native tests independently enumerate every binary completion in 64 small-grid
interval families and check support, exclusion and unresolved outcomes. Other
tests cover original-source preservation, repeated-band conflicts, wrong
scenario, malformed selections, disconnected footprints and source-only replay.
These are authored computational controls, not newly acquired field data.

Bands and event/location/clock associations remain supplied declarations, not
verified truth, independence, calibrated confidence or causal evidence. A path
supported at selected visits says nothing about the intervals between them,
walkability, walls, slopes, travel, physical safety or permission to intervene.

## Executed consumer receiving

The composition based on merged main
`74967a9591a8e606396b33064341eb739426d506` passed 19 native groups: five new
shared-time groups, eight existing observed-connectivity groups and six
observed-range groups. Independent source review found no blocking defect.

Root then executed all six browser workflow groups against the received merged
runtime, with actual maintained Chromium sandbox admission and zero page
errors. Its retained receipt is
`/tmp/earth285-browser-GCEfxn/receipt.json`. The course exercised the alternating
original-row counterexample, source-only keyboard download, missing readings,
inclusive support versus an unobserved intermediate visit, isolated reopen
preserving a newer working notebook, desktop/390 px layout, and malformed or
stale-read retirement. These results establish those receiving workflows;
publication and verification of the resulting merged consumer are separate.

In particular, support is limited to the exact selected times. The browser
control that adds an unobserved 15-minute visit becomes unresolved despite
support at 10 and 20 minutes. The inquiry neither interpolates that missing
visit nor establishes any condition throughout the interval between visits.
