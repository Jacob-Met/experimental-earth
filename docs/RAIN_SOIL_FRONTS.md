# Joint rainfall and changing-infiltration explanations

The receiving-mechanism investigation can now compare explicit conductivity/capillary-drive offers alongside its constant-rate unlimited, closed and draining alternatives. Rainfall intensity and storm-end offers remain original finite alternatives. Gauge calibration constrains forcing; water calibration constrains each full mechanism. Held-aside readings can contradict an admitted explanation but never alter its calibration score or rescue an excluded one.

The implementation calls the maintained rainfall solver's `surfaceWettingFront` option. It does not introduce a hydraulic algorithm or combine wetting fronts with closed/draining layers. Conductivity K and capillary drive A (suction times initial moisture deficit) remain declared model parameters. Moisture recovery and physical field accuracy are not inferred. Source provenance is required for every offer.

## Independent capability control

With uniform rain R=30 mm/h, K=10 mm/h and A=20 mm, ponding begins at cumulative uptake Fp=KA/(R−K)=10 mm and time tp=Fp/R=1/3 hour. After ponding, the independent balance is:

`F − A ln((F+A)/(Fp+A)) = Fp + K(t−tp)`.

At minute60 the predicted surface depth is5.4047208884346 mm. A constant infiltration rate24.5952791115654 mm/h produces the same endpoint, so this calibration does not identify the soil mechanism. At minute30, the sharp-front and constant-rate depths differ (.5908037178904895 versus2.7023604442173 mm). An original held-aside reading can distinguish them. Both are dry at minute90: observing that later dry state supplies no such distinction. A zero-capillary offer reproduces its constant-rate limit and both labels remain supported.

## Bounds and original custody

One to eight distinct sourced K/A alternatives are admitted using maintained parameter bounds. The combined constant-rate receiving families plus every rainfall/duration/front combination reserve at most3,000,000 cell steps before fitting. A front is run once per forcing, not repeatedly for each unrelated constant-rate offer. No partial ranking is returned on work refusal.

Original-only JSON includes source project, request, gauge, duration, capacity and draining offers plus the new fronts; results are recomputed on reopen. Exact keys and4MiB admission reject report injection. The child explicitly identifies the original imported project, event, scenario and surface. Failed or stale replacement retires download authority, and parent replacement prevents late publication. No active-site mutation or automatic model adoption occurs.
