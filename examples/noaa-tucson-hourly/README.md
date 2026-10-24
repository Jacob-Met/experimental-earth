# NOAA Tucson hourly means: an unfitted column example

Open `project.json` with the application's project import, then compare its saved surface evidence. The original nine hourly means are compared against model **interval averages**, not endpoint temperatures. All three offered alternatives are rejected by the declared calibration bands. This is an honest example of a simple, uncalibrated model family failing an explicit comparison; no parameters were adjusted to improve the result.

## Reproduce

From the repository root:

```sh
node examples/noaa-tucson-hourly/build.mjs
node tests/noaa-hourly-example.test.mjs
```

The build verifies the excerpt hash and fixed-width input, regenerates the portable project through maintained preparation APIs and prints the newly computed result. The tests check source custody, time supports, raw values, the saved project, replay and a changed challenge reading that changes neither calibration predictions nor alternatives.

## Source and byte identity

[NOAA 2025 Tucson hourly file](https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/2025/CRNH0203-2025-AZ_Tucson_11_W.txt), literal parent lines **16–24**. The supplied `tucson-hourly-excerpt.txt` is an unchanged 2,196-byte subset. Parent and excerpt hashes are different objects:

| Object | SHA-256 |
| --- | --- |
| Full parent year, 2,137,440 bytes; recorded by the direct-fetch receipt | `8a3f9e470c96557cb21a0e1bab0f556630f4c8ec50965666a8f5a32a0677ea75` |
| Included nine-line excerpt, rehashed by the build | `247bd26d2cdc1af26c933af2ced818d00dfbe629e4d1cdfae9a5a81b1b9547ac` |

`source-receipt.json` retains source URLs, metadata and both identities. The full year is not bundled. Its digest documents the fetched snapshot rather than promising that the live NOAA URL will continue serving identical bytes. The intake's `sha256` is always the supplied bytes' digest; in this example that means the excerpt, never the full year.

[NOAA's hourly02 README](https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/README.txt) defines preceding-hour UTC support, correction types, flags and missing fields. All included surface values have type C and flag 0; solar flags are 0. The raw rows retain every field, including unconsumed soil measurements, local standard time and logger version. `T_HR_AVG` supplies the air hourly mean; `T_CALC`, which covers only the last five minutes, is not substituted for it.

## Explicit authored assumptions

The exposure starts **2025-01-01T15:00:00Z** and ends **2025-01-02T00:00:00Z**. Surface and lower initial states are both **20 °C at the starting instant**. They are illustrative declarations, not measured states inferred from the first hourly average.

Surface capacity is 20,000 J/(m² K), exchange coefficient 10 W/(m² K), and absorptivity 0.8. Offered lower capacities are 60,000, 80,000 and 160,000 J/(m² K), each at conductance 20 W/(m² K). None was fitted. The application cell is illustrative; it is not an imported station terrain survey or a measured physical layer.

Solar and air hourly means are treated as piecewise constant forcing. This does not reconstruct within-hour variability. Infrared surface temperature is used as an explicitly associated observation of the model surface state; that association is a model assumption, not an established measurement of a uniform physical store.

Each comparison half-width is an explicitly supplied **0.5 °C**. It is not NOAA instrument uncertainty, an interpretation of printed decimal resolution, or a statistical confidence interval. The first three rows are labeled calibration and the remaining six challenge. This chronological labeling does not establish independent held-out validation. Good QC and corrected surface status do not authenticate these other assumptions.

The first 60,000 J/(m² K) alternative predicts approximately **20.28448 °C** for the first interval mean, against the observed **4.5 °C**. Its residual is about −15.78448 °C, far beyond the supplied half-width. All alternatives fail calibration; subsequent challenge rows are still inspectable but do not turn this into a validated or identified physical model. Changing the initial-state assumptions could change that outcome and requires a new explicit declaration.
