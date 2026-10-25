# Sourced acquisition windows for depth readings

The reading-time-window panel asks whether an existing depth observation could
agree with a retained infiltration hypothesis when its acquisition time is only
known within a declared interval. This complements the existing common clock
offset diagnostic: each selected reading's time varies independently, not through
one shared clock correction.

Choose assigned readings, select the records whose timing is uncertain, and enter
the earliest/latest minute plus a source or basis for each interval. Each interval
must include that record's original minute and remain inside the modeled event.
Unselected calibration and held-aside readings retain their original instant.
No observation is edited and no interval is inferred from a model mismatch.

For every candidate the panel reports the minimum and maximum predicted depth
throughout each window, with extremum times, endpoint interpolation brackets,
original depth band, evidence role and original/window sources. It checks every
interior solver snapshot as well as both window endpoints. Under the maintained
piecewise-linear interpolation this finds the full range; endpoint-only checks
can miss an intervening peak.

- **All-times compatible:** the entire modeled range lies inside the depth band.
- **Some-time compatible:** at least one modeled time fits, but other times do not.
- **Incompatible throughout:** no time in the declared interval fits.

Candidate order remains the original-minute calibration RMSE order. Held-aside
values cannot reorder candidates. Window compatibility is reported separately and
does not refit rates, identify an actual measurement time or automatically rescue
or adopt a nominally rejected model. All candidates and every assigned reading
remain inspectable. The numerical band guard is shown separately.

The authored closed 2 × 2 control receiving 30 mm/h rain for 60 minutes with 9 mm/h
infiltration has 10.5 mm depth at 30 minutes, 21 mm at 60 and 16.5 mm at 90. A 21 mm reading
can fit somewhere in the 30–90 minute window even though neither endpoint fits.
Another authored control at nominal 120 minutes with depth 15 mm rejects all offered
rates 3/6/9/22 at that instant; a 90–150 minute acquisition window admits 6 and 9 only
as possible, not all-times agreement. These are software controls, not field data.

## Original inputs and independent reopening

Download retains only the entire original project and sourced window declarations
in a versioned envelope. It does not serialize computed verdicts. Reopening
validates and recomputes without replacing the active workspace. Source changes
clear live results, and a delayed file read cannot repaint after a workspace
change. Review the complete project and source descriptions before sharing.
Files are limited to 4 MiB. Calculations refuse more than 3 million solver cell-steps
or 500,000 estimated reading/snapshot inspections before running the model.

Timing sources are declarations, not authenticated timestamps. Possible agreement
is existential for each reading independently; it does not establish a common
clock offset or consistent acquisition ordering. Modeled depth ranges inherit
the chosen solver interval and interpolation, not a physical uncertainty interval,
probability or environmental validation. Narrow or unchanged results do not
establish numerical convergence.

## Received integrated source

The owned runtime was received against maintained main `1c808888f18b8156f594c49abde216f086cd9a2b`: 630 native tests passed, and the launched browser course passed all seven assertion groups with actual Namespace/PID/network/seccomp/TSYNC sandbox admission. Desktop 1440 px and narrow 390 px source displays were inspected. These authored controls qualify software behavior, not field calibration or timestamp authenticity. The versioned receipts retain the actual browser course and the precise tested runtime blob identities.
