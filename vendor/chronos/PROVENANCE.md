# Maintained exact rational arithmetic

`exact-halfplanes.mjs` is byte-identical to:

- Jacob-Met/chronos-vision `app/exact-halfplanes.mjs` at commit `1c17c4d0ebd808726419f63579bded8dcd6cad3c`.
- Maintained WORLDLAW `src/unknown-lab/chronos-exact-halfplanes.mjs`, introduced by commit `cb75db6dcbca42ccd2c0cda2c9fabbd6969b6947`.
- Git blob `eb6552489373b2890b1b99fc829badf204218be7`.
- SHA-256 `3f2020d8adac92ac1b82331dd5b30964a889a85d249e81cd16bb9dbba99b1150`.

Both original pinned Chronos content and maintained WORLDLAW content were fetched
and their identical Git blob verified before adoption. WORLDLAW's
`docs/CORRELATION_BANDS.md` records the same provenance and absence of LICENSE or
LICENSE.md at the pinned Chronos revision. No general licence was present in the
inspected WORLDLAW tree. This is authorized reuse inside the same owner's
engineering estate, not a claim of an external licence grant, public distribution
right or a change to either project's ownership/licensing.

The Earth consumer uses only `rational`, `sub`, `mul`, `div`, `cmp`, `enclosure`
and `serial`; geometry exports are unused. The original4096-bit refusal behavior
is unchanged. Earth adds a complete9×64candidate/pair bound and preserves every
original source. Independent Python Fraction tests check actual consumer
arithmetic and outward projections. Upstream remains the natural owner; no forked
rational implementation or upstream edit is proposed.
