# Required gas release across explicitly offered parameter ranges

This inquiry extends the [single-condition static air balance](soil-air-boundary.md). It asks whether the necessary gas-removal requirement remains positive for **every combination** in six explicitly offered closed ranges. It retains both exact extremal corner conditions. It does not choose parameter values, infer measurement uncertainty, fit observations or predict elapsed time.

Open **Inspect required gas release across offered parameter ranges** from `soil-air-boundary.html`, or open `soil-air-box.html` through the maintained local launcher:

```sh
python3 serve.py --port 0
```

The entry begins with empty endpoints and unconfirmed assumptions. The separate authored-example action supplies explicitly fictional ranges and sources. Saving exports original inputs only; reopening recomputes the exact result.

## The declared physical model

The original assumptions remain explicit: a rigid homogeneous column, a positive fully wet sharp front, positive conductivity, constant positive ponding, initially ambient isothermal ideal gas, no other gas storage or residual gas behind the front, and release-only gas exchange. Each offered combination is one condition under those assumptions. There is no inferred relationship or probability distribution between the ranges.

Let L be packed depth, z₀ the initial front, h ponding head, ψ capillary head, H ambient **absolute** pressure expressed as water head, and z the target front. All depths run downward from the surface. The initial connected gas amount is proportional to `H(L − z₀)`. At zero water drive at the target, remaining gas amount is proportional to `(H + z + h + ψ)(L − z)`. Therefore the necessary removed fraction is

```text
R = max(0, 1 − (H + z + h + ψ)(L − z) / (H(L − z₀))).
```

This is a fraction of initial gas amount—moles, or mass at fixed composition—not pore volume. A positive threshold gives zero water drive at equality. If the threshold is zero, the original full gas amount may leave positive drive or may be exactly at balance. The witness records retain that distinction.

A static necessary condition does not give an arrival time or a dynamically sufficient venting schedule. No field validation or inference of real gas escape follows.

## Admit the complete box

Each parameter has `lower`, `upper`, `unit` and a literal `source`. Units are independently declared as mm, cm or m. Equal endpoints are allowed. The source schema is `experimental-earth-soil-air-box/1`, with exactly `schema`, `title`, `parameters` and `assumptions`.

The six parameter keys are `columnDepth`, `initialFront`, `pondingHead`, `capillaryHead`, `atmosphericHead` and `targetFront`. The eight original model assumptions and `allRangeCombinations` must each be explicitly true. A supplied object with accessor or symbol properties is refused rather than reading an unretained source value. The UTF-8 input envelope is bounded at 96,000 bytes.

Scalar software limits after exact conversion are:

| Quantity | Admitted millimetre range |
| --- | --- |
| Packed depth | 1 to 100000 |
| Initial front, ponding head, target front | represented binary64 value `0.000001` to 100000 |
| Capillary head | 0 to 100000 |
| Atmospheric absolute head | 1000 to 20000 |

The positive scalar cutoff deliberately preserves the prior software constant as its represented binary64 number. The relative gas-region margin is separately defined as the **exact rational** `1/100000000`.

Whole-box admission requires

```text
initialFront.upper ≤ targetFront.lower

targetFront.upper ≤ (99999999 / 100000000) × columnDepth.lower.
```

These comparisons use the same exact rational values as the result. They ensure every target is at or below every initial front and every combination retains the required positive gas region. The initial gas-region condition follows from those inequalities. Reversed endpoints, nonfinite values and incompatible combinations refuse the entire box; the program never deletes inconvenient combinations.

## Why two corners bound every combination

Write `a = h + ψ` and let U denote the expression inside `max(0, U)`. On the admitted domain:

```text
dU/dL  = −(H + z + a)(z − z₀) / (H(L − z₀)²) ≤ 0
dU/dz₀ = −(H + z + a)(L − z) / (H(L − z₀)²) < 0
dU/da  = −(L − z) / (H(L − z₀)) < 0
dU/dH  =  (z + a)(L − z) / (H²(L − z₀)) > 0
dU/dz  =  (H + 2z + a − L) / (H(L − z₀)).
```

The final derivative need not be positive before equilibrium. The needed statement concerns the clipped R: U is an upward quadratic in z, `U(z₀) = −(z₀ + a)/H < 0`, and its polynomial extension gives `U(L) = 1`. It has exactly one zero between z₀ and L and is increasing after that zero. Before it, R is zero. Thus **R is nondecreasing in target depth throughout the admitted interval**, even where U initially decreases. The extension at L is used for the proof; zero remaining gas is never admitted as a physical state.

Clipping also preserves the other coordinate monotonicities. Consequently:

| Extremum | Largest offered endpoints | Smallest offered endpoints |
| --- | --- | --- |
| Minimum R | L, z₀, h, ψ | H, z |
| Maximum R | H, z | L, z₀, h, ψ |

Both corners belong to the completely admitted Cartesian box, so these are attained extrema rather than unattained limits. A strictly positive minimum establishes that every offered combination requires some gas removal in this model. A zero minimum and positive maximum retain both kinds of condition. A zero maximum means this particular balance constraint never forces removal in the box; it does not establish that no real gas escaped.

## Exact stored numbers and outward display

The implementation decodes the sign, exponent and significand of every finite IEEE754 binary64 endpoint. BigInt rational arithmetic then applies exact integer unit factors: 1, 10 or 1000. Admission, sign decisions, clipping and corner comparison never use a rounded Number conversion.

This is exact arithmetic on the stored numbers, not on an unrecorded decimal value before JSON parsing. For example, binary64 `0.1 m` converted exactly is slightly greater than an exact integer `100 mm`; ordinary floating-point multiplication would round it to 100. That distinction is deliberate and tested. The single-condition inquiry retains its separate floating-point conversion and numerical-contact convention; its core is unchanged.

Exact reduced numerator/denominator pairs are authoritative. The lower percentage is floored and the upper percentage ceiled at four decimal places using integer arithmetic. The display therefore rounds outward to 0.0001 percentage point. Those displayed percentages need not themselves be attainable; the exact minimum and maximum are attained by the retained corner conditions.

A positive exact minimum that floors to `0.0000%` is explicitly labeled **strictly positive below display resolution**. An upper display of `100.0000%` is explicitly labeled as an outward ceiling: every admitted target is strictly inside the column and every exact result remains below one. The range marker is a visual display of these rounded bounds, not additional precision or a probability distribution.

## Authored example

The [example source module](../soil-air-box-example.js) declares:

| Parameter | Lower | Upper | Unit |
| --- | ---: | ---: | --- |
| Packed depth | 395 | 405 | mm |
| Initial front | 5 | 50 | mm |
| Ponding head | 45 | 55 | mm |
| Capillary head | 0 | 1000 | mm |
| Atmospheric absolute head | 10000 | 10600 | mm |
| Target front | 250 | 350 | mm |

The exact minimum is `71909/142000`; the exact maximum is `48523/55120`. The outward displayed interval is **50.6401% to 88.0316%** of initial connected gas amount. Every original range, unit and source is retained with the two corner selections. These are authored mathematical controls, not uncertainty bounds inferred from published sand-column measurements.

A separate integer control has L=100, z₀=10, h=5, ψ=15, H=1408 and z=20 mm. Its initial gas quantity is proportional to 126720; the zero-drive remainder is 115840. The necessary removal fraction is exactly `17/198`. At z=12 mm it is exactly at balance with zero removal. The next representable target above 12 gives a positive bound below display resolution, which remains distinguishable from exact zero.

## Source custody and verification

The browser computes before adopting an imported inquiry. A malformed import leaves the prior accepted source and result intact. A new endpoint or assumption edit invalidates the displayed result and cancels older file intent. Late failed or successful reads cannot replace a newer source or subsequent edits. Source strings are treated as text; saved files contain only original declarations and explicit assumptions.

The native controls and independent oracle are portable:

```sh
node tests/soil-air-box.test.mjs
python3 tests/soil-air-box-independent.py .
CHROME_BIN=/path/to/chrome node tests/soil-air-box.browser.mjs
```

Six native groups cover the independent integer control, global corner directions, fixed ranges, exact contact and clipping, tiny positive bounds, outward 100%, unit semantics, whole-box refusal and source custody. The independent Python oracle uses `Fraction.from_float` and original gas-amount conservation. It checks all 64 endpoint combinations for each of 104 boxes—6,656 corner evaluations, with repetitions for fixed ranges—and 1,248 exact rational interior points. It independently verifies reduced fractions, original corner witnesses, force-balance labels, classification and outward display. Exhaustive corners and interior probes are computational controls; the analytic monotonicity argument supplies the continuum guarantee.

The actual browser course receives the maintained entry, original mixed-unit source, real download and fresh reopening, exact/display distinctions, malformed and late imports, and desktop/390px layout. Exact source identities and observed results belong in the accompanying receiving record. Browser, native, mathematical and physical claims remain separate; no cloud service, model deployment or field experiment is implied.
