# Can any nonnegative rainfall history explain the original totals?

This bounded evidence diagnostic complements the constant-intensity interval intersection. It does not implement a rainfall timeline solver or infer a unique profile.

Let C(t) be cumulative rainfall. For every original calibration interval [a,b], supplied depth d±u in maintained units implies max(0,d-u)≤C(b)-C(a)≤d+u. Adjacent retained endpoints additionally require C to be nondecreasing. Difference-constraint feasibility is checked with exact rational arithmetic on the represented original numeric inputs. At most64 readings create128 endpoints and255 edges, so at most32640 relaxations are evaluated.

An empty feasible set yields original-reading witnesses from a negative cycle. Witnesses demonstrate inconsistency but are not promised to be globally minimal. A nonempty set means some nonnegative history is compatible; it does not identify that history, bound instantaneous intensity, verify site/time association, or supply a soil fit. Original held-aside and unassigned readings do not constrain calibration feasibility. The constant storm cutoff is intentionally not enforced in this separate question.

Unequal half-hour totals5mm and25mm reject constant rainfall yet admit varying rainfall. A whole-hour20mm reading together with two15mm half-hour readings is incompatible with every nonnegative history at zero uncertainty. Uncertainty bands remain inclusive.

Native verification includes an independent exhaustive three-bin integer oracle over125 combinations, original-cycle witness replay, inclusive boundaries, subset monotonicity, dry-window independence and held-aside isolation. Actual maintained browser receiving distinguishes both outcomes from reopened original source and displays the witness identifiers.
