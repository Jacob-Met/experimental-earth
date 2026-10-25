# One fixed connection across a modeled interval

The native-time connection course may choose a different path at every snapshot.
The optional **Keep one connection for a whole time window** inquiry instead
chooses one edge-adjacent path inside the same offered footprint and minimizes
its largest modeled depth over the entire declared interval. Existing and
proposed sites are compared separately, each retaining its own fixed path.

First compare a connection using two endpoints and an explicit allowed
footprint. Enter start and end minutes in the added inquiry and compare. Expand
the per-cell peak witnesses to inspect where and when the path's maximum comes
from. A witness time is either an original solver snapshot or an interpolated
window endpoint. Downloading the parent investigation retains the optional
window together with its original project and question; reopening recomputes
the result without replacing the active site. Editing the window, question or
active project retires the affected result.

## Mechanism and interpretation

For each cell, take its largest depth at the declared window endpoints and all
interior original snapshots. A piecewise-linear function cannot exceed these
values between them. Reuse the maintained minimum-bottleneck connection search
on these cell maxima, including both endpoints. The existing second-pass BFS
retains the shortest grid path among equal minimum-bottleneck paths. Each
scenario's path remains fixed throughout the interval; paths are not spliced.

This is a comparison of explicit linear interpolation of retained modeled
depths. It does not bound unsampled solver behavior, establish measured depths,
or account for walls, slopes, route width, permissions or movement. It is not
the separately owned timed-traversal inquiry. Arithmetic uses ordinary floating
point; no certified outward numerical bounds or physical safety are claimed.

The complete aligned input is checked before either scenario is evaluated.
Out-of-event windows, zero duration, malformed/sparse histories and unsupported
grids refuse the inquiry. Disconnected footprints remain disconnected, even
when all cell depths are zero. Aggregate snapshot-cell work is bounded before
evaluation using the maintained connectivity work limit.

## Executed controls

An authored 3×3 grid with two alternating corridors has a zero-depth optimum at
both native endpoints when paths can change. Every fixed full-window path has
a 10 mm maximum. An unchanged proposal corridor remains at 0 mm. A fractional
2–8 minute window yields 8 mm, while an interior 10-minute peak remains present
in a wider window. These are model controls, not field observations.

An independent exhaustive enumeration of every simple path on 100 deterministic
3×3 depth histories agrees on optimum depth and shortest tied length. The
maintained courtyard solver's A2-to-D2 whole-event inquiry gives existing
28.965689582746727 mm and proposal 25.755398528567092 mm. Directly rescoring the
returned paths against original snapshots reproduces both maxima; removing
rain yields a zero-depth negative control without changing the original input.

Run `node tests/sustained-connection.test.mjs` for these controls. Browser
qualification, independent review and integration are recorded separately;
these native results alone do not establish them.
