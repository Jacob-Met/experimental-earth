# Heat exchange below the retained stores

Save the ordinary surface exposure and two-store declaration first. In **Does a deeper reservoir change heat recovery?**, supply a bottom conductance, constant reservoir temperature and source for each place. Compare the original insulated response with the exchanging response. Orange traces show the surface and blue traces show the lower store; dashed traces retain the original insulated baseline. The elapsed-time control inspects both models at the same time. Original declarations and signed energy accounts remain inspectable.

Download the original investigation to retain both the two-store source and boundary declarations. Reopening recomputes independently of the working site. Draft edits hide their old comparison; **Restore accepted investigation** recovers the previously accepted original inputs. A refused replacement does not destroy the accepted investigation. The exact exported UTF-8 representation is limited to 4 MiB. Unsupported derived fields are omitted from exported input records.

## Model and comparison

The original surface equation remains:

`C1 dTs/dt = alpha I - h(Ts-Ta) - g(Ts-Tl)`

The lower equation becomes:

`C2 dTl/dt = g(Ts-Tl) - b(Tl-Tdeep)`

Here b is the declared bottom conductance in W/(m²·K) and Tdeep the declared constant reservoir temperature in °C. This reservoir has no finite evolving heat capacity. The model does not infer depth, conductivity, reservoir temperature, moisture effects or material identity.

The explicit `advanceHeatColumnWithBottom` entry point reuses the existing capacity-scaled symmetric two-state propagator. It adds b/C2 to the lower diagonal and bottom forcing to the lower initial derivative. The slow decay rate uses the nonnegative determinant terms h*g+h*b+g*b, avoiding subtractive cancellation. Existing APIs remain insulated and preserve their output shape; zero bottom conductance reduces to the original API. Exponential cooling-loss consumers retain their original insulated semantics.

Within each constant forcing interval the two modal derivatives admit interior stationary points, which are included along with boundaries in reported extrema. One-minute plot samples are visual connections, not accuracy bounds. Both stores remain continuous at forcing changes. Calculations are binary64 engineering results, not certified enclosures.

## Signed energy

Positive bottom exchange is energy leaving the lower store; a warmer reservoir can supply heat, yielding a negative bottom exchange. Surface balance is absorbed input minus ambient exchange minus internal transfer minus surface storage change. Lower balance is internal transfer minus bottom exchange minus lower storage change. Whole-system balance is absorbed input minus ambient exchange minus bottom exchange minus both stored changes. Internal transfer cancels and must not be counted as an external source.

An independently specified 560 W/m² absorbed pulse for 60 minutes with C1=20000, C2=80000 J/(m²·K), h=10, g=20 W/(m²·K), all starting at 20 °C, gives insulated surface/lower 44.5309989664/31.2016068056 °C. Declaring b=10 and Tdeep=20 gives 43.7377062558/29.4797373143 °C and 161470.958866 J/m² bottom loss. These authored reference values demonstrate a model consequence, not an observed physical improvement. A separately constructed 80-digit augmented-matrix-exponential oracle, scalar decoupled controls, zero-bottom parity, stationary equilibrium and original-input replay challenge the implementation.

## Limits and receiving

Bottom conductance is 0–1000 W/(m²·K), reservoir temperature −100–200 °C, and source notes must be nonempty with at most 600 characters. Original two-store exposure and capacity limits apply. There is no resolved soil profile, lateral transport, finite deep reservoir, nonlinear radiation or field calibration. Comparing two authored assumptions does not establish which one describes the place.

Run `node --test tests/bottom-heat.test.mjs` and `CHROME_BIN=/opt/google/chrome/chrome node tests/bottom-heat.browser.mjs`. Record actually executed results and exact source separately; authored tests are not evidence of a pass.

## Independent numerical reference

`evaluation/bottom-heat-reference.py` uses Python’s standard-library Decimal arithmetic at 80 digits to exponentiate an augmented 5×5 state/integral matrix. It uses norm scaling, a Taylor series to 1e-76, and squaring; it does not call or translate the production spectral propagator. The 12 frozen cases were authored before candidate receiving and are retained in `tests/fixtures/bottom-heat-reference.json`. They cover insulated and exchanging boundaries, warm-reservoir input, uncoupled stores, equal and nearly equal rates, tiny time, stiff capacity ratios, zero duration and upward internal transfer. `node --test tests/bottom-heat-reference.test.mjs` compares endpoints, exact interval means, time integrals and energy balances against that fixture. Run `python3 evaluation/bottom-heat-reference.py` to reproduce it. These controls are mathematical evidence; the finite numerical tolerances are not a certified error bound or field calibration.
