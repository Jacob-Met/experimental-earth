// Authored original inputs only; each invocation returns independent mutable input records.
export function makeEpochSkyExample() {
  return {
    "kind": "experimental-earth/two-epoch-shared-sky-reading-inputs/1",
    "model": {
      "name": "two-original-points-two-declared-sky-epochs",
      "version": 1,
      "observation": "two instantaneous original existing-surface bands at distinct receivers and one final UTC",
      "profile": "four equal azimuth bins in each of two epochs, shared by both points and designs",
      "boundary": "one explicitly chosen existing original interval boundary",
      "coefficient": "exact rational C_i0+C_0j-C_00 from seven reference courses, gated by all sixteen original pairs",
      "arithmetic": "exact two-band simplex intersection and marginal-equivalent additive objectives",
      "comparison": "original static coefficients and additive static diagonal reported separately"
    },
    "readings": [
      {
        "kind": "experimental-earth/shared-sky-final-reading-inputs/1",
        "model": {
          "name": "shared-sky-final-surface-reading",
          "version": 1,
          "observation": "one instantaneous existing-surface band at the original receiver and final UTC",
          "domain": "one static nonnegative equal-bin profile shared by both designs and all original intervals",
          "arithmetic": "exact intersection and linear objectives over represented final-temperature coefficients"
        },
        "source": {
          "kind": "experimental-earth/shade-heat-inputs/1",
          "model": {
            "name": "mapped-shade-midpoint-two-store",
            "version": 1,
            "solar": "21449f34820c3c80a27a78cdc940747ff19ca1e3",
            "thermal": "two-uniform-stores-forced-surface-linear-exchange",
            "forcing": "DHI + mapped-beam-transmission * DNI * max(0, sin(apparent-elevation))"
          },
          "project": {
            "schema": "experimental-earth-site/1",
            "title": "Authored common courtyard · original heat points",
            "width": 4,
            "height": 4,
            "weather": {
              "rainMmHr": 36,
              "stormMinutes": 60,
              "durationMinutes": 240,
              "stepMinutes": 5,
              "cellSizeM": 2,
              "mobilityPerHour": 0.5,
              "boundaryExitPerHour": 0.38
            },
            "existing": [
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              }
            ],
            "proposal": [
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              }
            ],
            "observations": [],
            "selectedIndex": 5,
            "source": "Authored multi-point geometry and uniform declared thermal properties; no field measurements",
            "solarStudy": {
              "schema": "experimental-earth-solar-occlusion/1",
              "geometry": "opaque-ground-columns",
              "contextJson": "{\"cellSizeM\":2,\"existing\":[{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null}],\"height\":4,\"proposal\":[{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null}],\"source\":\"Authored multi-point geometry and uniform declared thermal properties; no field measurements\",\"width\":4}",
              "headingDeg": 0,
              "elevationDeg": 45,
              "sunSource": "Authored original direction",
              "existing": [
                {
                  "cellIndex": 4,
                  "heightMinM": 3,
                  "heightMaxM": 3,
                  "source": "Authored fixed west column"
                }
              ],
              "proposal": [
                {
                  "cellIndex": 6,
                  "heightMinM": 3,
                  "heightMaxM": 3,
                  "source": "Authored fixed east column"
                }
              ]
            },
            "surfaceHeatStudy": {
              "schema": "experimental-earth-surface-heat/1",
              "model": "uniform-layer-forced-linear-exchange",
              "cellIndex": 5,
              "contextJson": "{\"cellIndex\":5,\"cellSizeM\":2,\"existing\":{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"surface\":\"sealed\"},\"height\":4,\"proposal\":{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"surface\":\"sealed\"},\"source\":\"Authored multi-point geometry and uniform declared thermal properties; no field measurements\",\"width\":4}",
              "existing": {
                "absorptivity": 0.8,
                "capacityJm2K": 20000,
                "exchangeWm2K": 10,
                "initialC": 20,
                "source": "Authored uniform surface properties, equal in both scenarios"
              },
              "proposal": {
                "absorptivity": 0.8,
                "capacityJm2K": 20000,
                "exchangeWm2K": 10,
                "initialC": 20,
                "source": "Authored uniform surface properties, equal in both scenarios"
              },
              "schedule": [
                {
                  "minutes": 60,
                  "incidentWm2": 0,
                  "reservoirC": 20,
                  "source": "Original independent thermal declaration; coupled forcing is derived separately"
                }
              ]
            },
            "heatColumnStudy": {
              "schema": "experimental-earth-heat-column/1",
              "model": "two-uniform-stores-forced-surface-linear-exchange",
              "heatStudy": {
                "schema": "experimental-earth-surface-heat/1",
                "model": "uniform-layer-forced-linear-exchange",
                "cellIndex": 5,
                "contextJson": "{\"cellIndex\":5,\"cellSizeM\":2,\"existing\":{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"surface\":\"sealed\"},\"height\":4,\"proposal\":{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"surface\":\"sealed\"},\"source\":\"Authored multi-point geometry and uniform declared thermal properties; no field measurements\",\"width\":4}",
                "existing": {
                  "absorptivity": 0.8,
                  "capacityJm2K": 20000,
                  "exchangeWm2K": 10,
                  "initialC": 20,
                  "source": "Authored uniform surface properties, equal in both scenarios"
                },
                "proposal": {
                  "absorptivity": 0.8,
                  "capacityJm2K": 20000,
                  "exchangeWm2K": 10,
                  "initialC": 20,
                  "source": "Authored uniform surface properties, equal in both scenarios"
                },
                "schedule": [
                  {
                    "minutes": 60,
                    "incidentWm2": 0,
                    "reservoirC": 20,
                    "source": "Original independent thermal declaration; coupled forcing is derived separately"
                  }
                ]
              },
              "lowerLayers": {
                "existing": {
                  "capacityJm2K": 80000,
                  "conductanceWm2K": 20,
                  "initialC": 20,
                  "source": "Authored insulated lower heat store; capacity is not a measured depth"
                },
                "proposal": {
                  "capacityJm2K": 80000,
                  "conductanceWm2K": 20,
                  "initialC": 20,
                  "source": "Authored insulated lower heat store; capacity is not a measured depth"
                }
              }
            }
          },
          "declaration": {
            "path": {
              "latitudeDeg": 51.5,
              "longitudeDeg": -0.1,
              "gridColumnBearingDeg": 90,
              "locationSource": "Authored London-like coordinate for this invented example",
              "orientationSource": "Authored east-right, south-down grid",
              "startUtc": "2026-06-21T04:00:00.000Z",
              "endUtc": "2026-06-21T12:00:00.000Z",
              "stepMinutes": 30
            },
            "directNormalWm2": 0,
            "diffuseHorizontalWm2": 80,
            "reservoirC": 20,
            "weatherSource": "Authored constant direct-normal and diffuse-horizontal irradiance and reservoir temperature; not acquired weather"
          }
        },
        "query": {
          "bins": 8,
          "reading": {
            "target": "existing",
            "store": "surfaceC",
            "aggregation": "instant",
            "cellIndex": 5,
            "utc": "2026-06-21T12:00:00.000Z",
            "temperatureC": 23.750014796817474,
            "halfWidthC": 0.001,
            "source": "Authored numerical example: complete original four-bin course, bin1 before08:00Z and bin2 afterwards; no measured observation"
          }
        }
      },
      {
        "kind": "experimental-earth/shared-sky-final-reading-inputs/1",
        "model": {
          "name": "shared-sky-final-surface-reading",
          "version": 1,
          "observation": "one instantaneous existing-surface band at the original receiver and final UTC",
          "domain": "one static nonnegative equal-bin profile shared by both designs and all original intervals",
          "arithmetic": "exact intersection and linear objectives over represented final-temperature coefficients"
        },
        "source": {
          "kind": "experimental-earth/shade-heat-inputs/1",
          "model": {
            "name": "mapped-shade-midpoint-two-store",
            "version": 1,
            "solar": "21449f34820c3c80a27a78cdc940747ff19ca1e3",
            "thermal": "two-uniform-stores-forced-surface-linear-exchange",
            "forcing": "DHI + mapped-beam-transmission * DNI * max(0, sin(apparent-elevation))"
          },
          "project": {
            "schema": "experimental-earth-site/1",
            "title": "Authored common courtyard · original heat points",
            "width": 4,
            "height": 4,
            "weather": {
              "rainMmHr": 36,
              "stormMinutes": 60,
              "durationMinutes": 240,
              "stepMinutes": 5,
              "cellSizeM": 2,
              "mobilityPerHour": 0.5,
              "boundaryExitPerHour": 0.38
            },
            "existing": [
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              }
            ],
            "proposal": [
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              },
              {
                "surface": "sealed",
                "elevationM": 0,
                "provenance": "Authored level two-metre grid cell"
              }
            ],
            "observations": [],
            "selectedIndex": 7,
            "source": "Authored multi-point geometry and uniform declared thermal properties; no field measurements",
            "solarStudy": {
              "schema": "experimental-earth-solar-occlusion/1",
              "geometry": "opaque-ground-columns",
              "contextJson": "{\"cellSizeM\":2,\"existing\":[{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null}],\"height\":4,\"proposal\":[{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null},{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"terrainSource\":null}],\"source\":\"Authored multi-point geometry and uniform declared thermal properties; no field measurements\",\"width\":4}",
              "headingDeg": 0,
              "elevationDeg": 45,
              "sunSource": "Authored original direction",
              "existing": [
                {
                  "cellIndex": 4,
                  "heightMinM": 3,
                  "heightMaxM": 3,
                  "source": "Authored fixed west column"
                }
              ],
              "proposal": [
                {
                  "cellIndex": 6,
                  "heightMinM": 3,
                  "heightMaxM": 3,
                  "source": "Authored fixed east column"
                }
              ]
            },
            "surfaceHeatStudy": {
              "schema": "experimental-earth-surface-heat/1",
              "model": "uniform-layer-forced-linear-exchange",
              "cellIndex": 7,
              "contextJson": "{\"cellIndex\":7,\"cellSizeM\":2,\"existing\":{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"surface\":\"sealed\"},\"height\":4,\"proposal\":{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"surface\":\"sealed\"},\"source\":\"Authored multi-point geometry and uniform declared thermal properties; no field measurements\",\"width\":4}",
              "existing": {
                "absorptivity": 0.8,
                "capacityJm2K": 2000,
                "exchangeWm2K": 10,
                "initialC": 20,
                "source": "Authored alternate thermal capacity for the original second point; no calibration"
              },
              "proposal": {
                "absorptivity": 0.8,
                "capacityJm2K": 2000,
                "exchangeWm2K": 10,
                "initialC": 20,
                "source": "Authored alternate thermal capacity for the original second point; no calibration"
              },
              "schedule": [
                {
                  "minutes": 60,
                  "incidentWm2": 0,
                  "reservoirC": 20,
                  "source": "Original independent thermal declaration; coupled forcing is derived separately"
                }
              ]
            },
            "heatColumnStudy": {
              "schema": "experimental-earth-heat-column/1",
              "model": "two-uniform-stores-forced-surface-linear-exchange",
              "heatStudy": {
                "schema": "experimental-earth-surface-heat/1",
                "model": "uniform-layer-forced-linear-exchange",
                "cellIndex": 7,
                "contextJson": "{\"cellIndex\":7,\"cellSizeM\":2,\"existing\":{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"surface\":\"sealed\"},\"height\":4,\"proposal\":{\"elevationM\":0,\"provenance\":\"Authored level two-metre grid cell\",\"surface\":\"sealed\"},\"source\":\"Authored multi-point geometry and uniform declared thermal properties; no field measurements\",\"width\":4}",
                "existing": {
                  "absorptivity": 0.8,
                  "capacityJm2K": 2000,
                  "exchangeWm2K": 10,
                  "initialC": 20,
                  "source": "Authored alternate thermal capacity for the original second point; no calibration"
                },
                "proposal": {
                  "absorptivity": 0.8,
                  "capacityJm2K": 2000,
                  "exchangeWm2K": 10,
                  "initialC": 20,
                  "source": "Authored alternate thermal capacity for the original second point; no calibration"
                },
                "schedule": [
                  {
                    "minutes": 60,
                    "incidentWm2": 0,
                    "reservoirC": 20,
                    "source": "Original independent thermal declaration; coupled forcing is derived separately"
                  }
                ]
              },
              "lowerLayers": {
                "existing": {
                  "capacityJm2K": 8000,
                  "conductanceWm2K": 20,
                  "initialC": 20,
                  "source": "Authored alternate lower-store capacity for the original second point; no calibration"
                },
                "proposal": {
                  "capacityJm2K": 8000,
                  "conductanceWm2K": 20,
                  "initialC": 20,
                  "source": "Authored alternate lower-store capacity for the original second point; no calibration"
                }
              }
            }
          },
          "declaration": {
            "path": {
              "latitudeDeg": 51.5,
              "longitudeDeg": -0.1,
              "gridColumnBearingDeg": 90,
              "locationSource": "Authored London-like coordinate for this invented example",
              "orientationSource": "Authored east-right, south-down grid",
              "startUtc": "2026-06-21T04:00:00.000Z",
              "endUtc": "2026-06-21T12:00:00.000Z",
              "stepMinutes": 30
            },
            "directNormalWm2": 0,
            "diffuseHorizontalWm2": 80,
            "reservoirC": 20,
            "weatherSource": "Authored constant direct-normal and diffuse-horizontal irradiance and reservoir temperature; not acquired weather"
          }
        },
        "query": {
          "bins": 8,
          "reading": {
            "target": "existing",
            "store": "surfaceC",
            "aggregation": "instant",
            "cellIndex": 7,
            "utc": "2026-06-21T12:00:00.000Z",
            "temperatureC": 26.18914032745404,
            "halfWidthC": 0.001,
            "source": "Authored numerical example: complete original four-bin course, bin1 before08:00Z and bin2 afterwards; no measured observation"
          }
        }
      }
    ],
    "query": {
      "bins": 4,
      "splitAfterInterval": 8,
      "sharingSource": "Authored shared courtyard forcing for both original points and designs, with one declared change after original interval8; this example does not identify a measured sky"
    }
  };
}
