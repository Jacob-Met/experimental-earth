# Change in original standing-water inventory

The evidence map's **How did observed standing water change?** panel compares two exact recorded times in the selected scenario and evidence role. Declare why the readings represent complete cells in the same event. It uses the maintained original-band intersection and preserves every source and notebook row.

Only cells observed at both times contribute. For each cell, later lower minus earlier upper and later upper minus earlier lower bound the change. Millimetres times square metres gives litres. Negative values mean less standing water. Repeated readings intersect instead of being counted twice. Any contradictory original cell bands refuse aggregation; nearby times are never interpolated.

The whole-site change remains unknown unless all cells have readings at both times. A changing observation footprint cannot masquerade as changed site water. Unknown cells receive no modeled water. Original intervals provide conservative bounds without assuming independent errors or cancellation of a shared sensor offset. No observed change identifies infiltration, runoff, rain or an intervention as its cause.

Changes to the project, scenario, role, time or declaration retire results. Ordinary project export/reopen preserves original readings; the temporary query is reentered. The sources and spatial/event basis are declarations, not authenticated measurements. Tests are authored software controls, not physical validation.

Native qualification: `node --test tests/observed-storage-change.test.mjs`.
