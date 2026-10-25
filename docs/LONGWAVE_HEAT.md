# Explicit longwave exchange in the retained surface experiment

The surface heat panel now offers a separate radiation investigation using the
original saved cell, layers, incident-input schedule and linear reservoir.
Emissivity and an effective radiative environment are separate sourced
declarations. The user must declare that the saved linear exchange coefficient
excludes this radiation term. An empirical coefficient already including
radiation is not suitable without revising its basis; otherwise the two terms
would double count heat loss.

For each layer the implemented equation is

`C dT/dt = absorptivity * incident - h*(T - air) - emissivity*sigma*(T_K^4 - surroundings_K^4)`.

Here `sigma = 5.6703744191844314e-8 W m^-2 K^-4` (the SI Stefan–Boltzmann constant),
C is areal capacity, and all fourth powers use Kelvin. The final difference is
factored to avoid cancellation near equal temperatures. The effective environment
uses a unit view factor; it is neither air temperature nor a geometric estimate
of sky visibility. Longwave emissivity is not inferred from shortwave absorption.

The signed linear and radiation energy channels are integrated separately,
while absorbed energy and change in stored heat are computed independently.
Negative outgoing energy means heat received. A cold radiative environment can
produce below-air surface temperature while the linear reservoir supplies heat;
the old linear-only model cannot represent this under zero incident input.
The panel also reports the change from the original exact linear-only model.

## Numerical scope

Constant original exposure intervals are preserved without interpolation across
forcing jumps. RK4 with step doubling controls local temperature truncation
estimates at 1e-8 degrees C, and a conservative maximum derivative at the admitted
500 degrees C upper bound caps explicit steps. A maximum of 100000 attempted
steps is shared by both layers; an upfront lower bound refuses clearly excessive
work before integration. A runtime cap catches further refinements. The local
tolerance is not a global error bound or a physical uncertainty estimate.

All layer temperatures must remain within the original −100–500 degrees C
calculation range. Effective surroundings are admitted only from −150 to 200
degrees C; zero Kelvin, nonfinite values and silently converted string quantities
are refused. Source admission reuses the original surface heat contract.
The autonomous scalar equation is monotone within each constant interval, so
retained interval endpoints include extrema. Minute samples support inspection;
they do not define the integration step.

## Receiving

`node tests/longwave-heat.test.mjs` exercises exact zero-emissivity linear
recurrence at every minute, a separately implemented fixed-step midpoint
reference using direct fourth powers, signed cold/warm surroundings, equilibrium,
energy accounting, different emissivity, interval splitting, stiff cooling,
near-equilibrium precision and refused inputs/over-budget/out-of-range results.
The midpoint reference uses 360000 steps and does not call the production stepper.

`node tests/longwave-heat.browser.mjs` exercises the mounted consumer, draft
invalidation, unchanged project, actual source-only file download and fresh-page
native reopening, narrow/wide rendering, actual keyboard inspection and malformed
source refusal. `node tests/surface-heat.browser.mjs` receives the preserved
original consumer. These are authored model controls, not acquired field evidence.

The exported investigation contains original declarations only. Reopening
recomputes it in isolation and does not replace the current project. A current
project change retires displayed results. Source words render as text.

No evaporation, internal gradients, spatial heat transport, atmospheric inference,
view-factor geometry, human comfort or physical intervention approval is supplied.
The two-node heat-column and coupled shade/heat investigations remain separate.

## Shared mechanism review

The maintained HAMON Engine #405 consumer was inspected at cooling source blob
`d91851dabc06c414a238a6db143849965e0dce9b`, including its model/use contract. It
uses Python/SciPy, pinned mesh-area input and unforced log-excess decay toward
one enclosure. This browser consumer needs piecewise incident forcing and two
distinct reservoirs, so that state transform and CLI cannot directly serve it.
The factored fourth-power law, signed outgoing-energy convention and the same
binary64 Stefan–Boltzmann value are retained; no engine source or owner changes.
The natural browser-layer owner remains Experimental Earth.

References: [maintained engine model](https://github.com/Jacob-Met/hamon-engine/blob/main/docs/science/mesh-radiative-cooling-ad4cad229e2e/MODEL_AND_USE.md),
[NIST constant table](https://physics.nist.gov/cuu/pdf/all.pdf),
[NASA radiation conductances course](https://tfaws.nasa.gov/TFAWS12/Proceedings/Form%20Factors%20Grey%20Bodies%20and%20Radks%20Course.pdf).
