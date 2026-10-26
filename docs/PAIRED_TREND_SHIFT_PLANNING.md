# Planning additional later observations under the common-shift model

The ordinary paired-series shift comparison now calculates a limit on how much later-only evidence can identify. It uses the original earlier uncertainty bands and the complete currently supported slope/shift region. No future measurements, selected slope, or guessed shift are supplied.

For an earlier relation a+b*t and later relation c+b*t, the shift is d=c-a. At a fixed supported slope b, the earlier intercept remains in
A(b) = [max_i(L_i-b*t_i), min_i(U_i-b*t_i)].
Its width W(b) is concave: a minimum of affine functions minus a maximum of affine functions. The current joint slope projection is a finite closed interval B. Consequently W(b) is at least min(W(B.lower),W(B.upper)) throughout B.

Any additional later-only bands constrain b and c. At a surviving (b,c), every a in the original A(b) still fits. Therefore the projected shift interval contains c-A(b), and its width cannot fall below the reported endpoint minimum while the model remains feasible. Inconsistent later evidence can reject the model; rejection is not a zero-width inferred response.

The new wrapper preserves every original shift result and adds:
- exact current width;
- exact minimum remaining width;
- an upper bound on possible width reduction, not a forecast of achievable improvement;
- exact endpoint slope/intercept witnesses and at most 126 earlier-band checks.

The calculation is conditional on the original earlier bands, shared-slope constant-shift model, and later-only additional observations. Earlier archival measurements, independent intercept constraints, or model changes can alter the bound. A zero bound does not promise that later observations will identify the shift. None of these quantities is a causal effect, statistical confidence interval, or measurement-truth guarantee.

An authored example has earlier gaps [-1,1] at days 0 and 1 and later gaps 3±.01 and 4±.01 at days 2 and 3. The floor is about .98. Adding exact later gaps 5 and 6 at days 4 and 5 fixes slope 1 and later intercept 1 but leaves earlier intercept [-1,0], hence shift [1,2]. The original earlier uncertainty remains despite the extra exact later data.

The existing original-only shift download format is unchanged. Reopen recomputes the planning result from source inputs, without adopting a workspace or persisting inferred values.
