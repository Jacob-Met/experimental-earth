# SunCalc — pinned offline dependency

`index.js` and `LICENSE` are unmodified upstream source from
[mourner/suncalc](https://github.com/mourner/suncalc/tree/21449f34820c3c80a27a78cdc940747ff19ca1e3),
commit `21449f34820c3c80a27a78cdc940747ff19ca1e3`, package version **2.1.1**.
The BSD 2-Clause notice is retained in `LICENSE`.

Only `getPosition` is consumed, by `solar-path.js`. This version returns **degrees**,
azimuth clockwise from geographic north, and apparent (refraction-corrected) altitude.
Version 1 used different units and bearings; do not substitute it without adapting and
requalifying the consumer. Vendoring keeps private coordinates and the calculation
offline; no runtime CDN or remote ephemeris request is made.

`tests/fixtures/solar-path-reference.json` contains only the 728 Sun-position records
from upstream `test/fixtures.json` at this same commit (upstream blob
`ae2a9702cb446f085775d57aeb490a275991e06e`). Upstream identifies these as JPL Horizons
topocentric apparent/refraction-corrected outputs, generated 2026-06-17, covering 14
locations and 13 dates including 1950 and 2050. They are independent ephemeris values
retained by upstream, not outputs regenerated from this implementation. This consumer
does not claim a fresh JPL query or independent field measurement. The same upstream
license applies. The native test checks every record and angular wrap explicitly.

Retain the upstream source/version and reference provenance on any future update.
