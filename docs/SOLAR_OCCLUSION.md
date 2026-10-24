# Conditional direct-sun obstruction

Compare ground-centre samples against declared opaque, ground-based columns and the existing metric terrain. This is a geometric investigation, not a geographic solar ephemeris, thermal model or guarantee of sunlight.

## Inputs and reference frame

A sun heading is authored relative to the grid: 0° toward increasing columns (right), 90° toward increasing rows (down). Elevation is 1–90° above the grid's horizontal plane. The user must supply a source or basis. No latitude, date, timezone or geographic north is inferred.

Each scenario has an explicit list of at most 64 opaque columns. A footprint is one grid cell; its lower/upper heights are metres above that cell's declared ground, between 0 and 100 m, with positive upper height and a source. Existing and proposed lists are independent; the UI offers explicit copying. Neither list changes the rain model's surfaces, elevations, internal barriers or weather. These solid columns represent wall/building-like occluders, not canopies or transmissive vegetation.

The retained context contains original grid size, metric spacing, source, ground elevations and survey provenance. Changes to these invalidate the comparison. Other rain forcing can change without affecting solar geometry. Ordinary project export/import retains raw declarations; results are recomputed rather than trusted.

## Mechanism and uncertainty

A unit ray from each ground-centre point toward the authored sun is intersected analytically with axis-aligned columns. Terrain is the existing grid represented as stepped opaque columns; it is not interpolated into a smooth terrain surface. Each ray is tested against minimum and maximum declared obstacle heights. Their footprints are excluded from exposure samples because the geometry occupies those ground points.

- **Blocked across declared height bounds:** some minimum-height geometry intersects a ray through its interior, beyond the numerical guard. This remains conditional on declared terrain, footprint and opacity assumptions.
- **Unresolved across declared heights:** maximum-height geometry blocks, but minimum-height geometry does not robustly block.
- **Grazing or numerically unresolved:** only a boundary/guarded contact remains possible. A touch is not promoted to robust shade.
- **No mapped blocker:** even the expanded maximum-height mapped geometry does not intercept the ray. Unmapped off-site buildings, omitted objects and atmospheric conditions remain unknown.

The numerical guard is 1e-9 times the largest of 1 m, grid extents and 110 m. Shrunk boxes establish interior intersection; expanded boxes preserve possible grazing. This arithmetic guard is separate from the user's height interval. Terrain elevations remain fixed; retained survey uncertainty is not propagated or erased. A witness identifies the responsible declared column or terrain cell and its source.

Coloured dots are **point samples**, not estimates of shaded cell area, percentage coverage, irradiance, temperature, comfort or structural feasibility. The two scenarios show changed classifications, not a prescription to install or remove an object.

## Qualification

Authored analytic controls include a blocker spanning x=4–6 m with top at 2 m on flat ground. At 45°, a ground sample x=3 m meets its front at 1 m and is blocked; x=1 m meets it at 3 m and is not blocked by that feature. At 30°, the latter ray enters at about 1.732 m and is blocked. A 4 m height also blocks it at 45°. Reversed heading, overhead/parallel rays, exact grazing, straddling height intervals, terrain ridge, paired reversal, source/provenance invalidation and maximum 24×24 grids are exercised independently.

Eight native groups pass. The actual browser course authors source-bound columns, changes sun conditions and height bounds, inspects witnesses, reopens saved raw declarations and refuses stale source geometry. Browser results and pixel inspection are recorded separately.

Reuse inspection considered Second Ground's orthographic plan calibration/convex rectangle cover and Workshop's native STEP solid intersections. Neither supplies this browser ray/height-grid operation. The small analytic slab primitive therefore stays with its Earth consumer; no competing scene renderer, solar-position library or copied inference subsystem is introduced.
