# Continuous trend-change times in the original observation gap

The separate-history consumer can compare an explicit continuous change in slope somewhere between the last original earlier reading and the first original later reading, including either endpoint. It infers every supported time without asking the user to offer a time grid, moving readings between periods or changing the declared intervention instant.

This model asks whether the earlier and later affine lines can meet inside the unobserved gap. It does not identify when an intervention caused an effect, assume an instantaneous physical process, or establish that the actual between-reading course follows either line.

## Exact signed projection

The maintained separate-history result supplies the complete joint polygon of jump j and slope change s at reference instant tau. Continuity at time t requires j+s*(t-tau)=0.

For positive s, the difference at the gap start must be nonpositive and at the gap end nonnegative. For negative s, those inequalities reverse. Three exact halfplanes per direction intersect the joint polygon with the complete appropriate wedge, including the corresponding slope sign.

Every zero-slope point in either wedge must be the origin. An origin-only wedge supports no nonzero change. Unchanged-line feasibility is reported separately because an unchanged line does not identify a change time.

For nonzero slope, onset offset from tau is -j/s. Within each signed convex wedge, the ratio for any convex combination is a denominator-weighted average of the ratios of its nonzero vertices. The origin contributes nothing to numerator or denominator. Thus the extrema over all nonzero changes are attained by nonzero vertices, and the continuous image is the complete interval between them. This handles polygons, segments through the origin and singleton points without dividing by zero or introducing a small-slope tolerance.

Returned intervals are exact offsets after the last original earlier reading, measured in 86400-second days. Positive and negative change branches remain separate even if their intervals overlap. Endpoint witnesses retain supported nonzero jump/slope pairs. Closure vertices may include the unchanged origin; zero slope is explicitly excluded from each change branch.

## Authored distinctions

Earlier exact gaps 0 and 0 on days 0 and 1 followed by gaps 1 and 3 on days 2 and 3 support a continuous change at day 1.5. With +/-0.1 bands, the complete onset interval is approximately days 1.3 through 1.7. Negating the gaps preserves that time interval and reverses the slope-change direction.

The earlier control 0 / [-1,1] followed by later 3 / 1 supports separate linear histories, but no continuous nonzero transition inside the original day 1 through day 2 gap. Separately, all-zero exact readings support unchanged history only. Bands [-1,1] at all four times allow both nonzero slope directions across the entire gap and also retain unchanged history. None of these states is collapsed into a selected onset.

## Work, source and receiving

The unchanged separate-history inference runs first. Six additional exact clips share its existing 200000 constraint-check limit; all nonzero vertex ratio evaluations share a 512-evaluation cap. Original pair, vertex, hull and rational arithmetic bounds remain in force. Any incomplete work refuses the whole result.

Original rows, period regions and declared intervention metadata are preserved. A child comparison in the ordinary separate-history consumer accepts the existing source directly. Downloads contain only original project, original response inquiry and explicit continuity-model declaration. Reopen recomputes results without adopting the active workspace; source changes and delayed reads retire stale output.

The native suite compares 40 authored courses against an independent Python Fraction oracle that intersects the original four-dimensional band constraints with continuity wedges and projects attained nonzero vertices. It does not reuse the production joint polygon or clipping implementation. Additional controls cover closed gap endpoints, tiny nonzero slopes, both directions, unchanged-only and incompatible states, reference-time invariance, complete 64-row evidence and work refusal.

Actual browser receiving covers original-series intake through the three explicit model comparisons, interval and singleton results, source-only replay, unchanged/both-direction alternatives, incompatible/insufficient histories, invalid and delayed reads, keyboard use, and desktop/narrow layouts.

Exactness is conditional on the supplied binary64 reading bands and canonical UTC source times. Measurement truth, additional cross-period error constraints, statistical confidence and causal attribution are not established.
