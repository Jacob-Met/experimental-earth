"""Independent constant-course matrix reference for the retained authored triple.

Run with Python + NumPy/SciPy. This is a reference experiment, not application
solver code or a general original-reading adapter.
"""
import csv, io, itertools, json, pathlib
import numpy as np
from scipy.linalg import expm

root = pathlib.Path(__file__).resolve().parents[1]
source = json.loads((root / 'tests/fixtures/heat-joint-triple-conflict.json').read_text())
support, predictions = [], []
for exposure in source['exposures']:
    transfer = exposure['transfer']
    evidence = transfer['originalProject']['heatColumnEvidence']
    target = evidence['target']
    study = transfer['challengeProject']['heatColumnStudy']
    top, lower = study['heatStudy'][target], study['lowerLayers'][target]
    rows = list(csv.DictReader(io.StringIO(transfer['readingFile']['text'])))
    accepted = []
    for hypothesis in evidence['hypotheses']:
        compatible = True
        for row in rows:
            assert row['aggregation'] == 'instant' and row['unit'] == 'C'
            remaining = float(row['minute']) * 60
            state = np.array([top['initialC'], lower['initialC'], 1.0])
            for interval in study['heatStudy']['schedule']:
                seconds = min(remaining, interval['minutes'] * 60)
                if seconds <= 0:
                    break
                capacity = top['capacityJm2K']
                hidden = hypothesis['capacityJm2K']
                conductance = hypothesis['conductanceWm2K']
                exchange = top['exchangeWm2K']
                matrix = np.array([
                    [-(exchange + conductance) / capacity, conductance / capacity,
                     (top['absorptivity'] * interval['incidentWm2'] + exchange * interval['reservoirC']) / capacity],
                    [conductance / hidden, -conductance / hidden, 0],
                    [0, 0, 0],
                ])
                state = expm(matrix * seconds) @ state
                remaining -= seconds
            assert remaining == 0
            compatible &= abs(float(row['temperature']) - state[0]) <= float(row['half_width'])
            predictions.append({'exposure': exposure['reference'], 'candidate': hypothesis['label'], 'minute': float(row['minute']), 'surfaceC': float(state[0])})
        if compatible:
            accepted.append(hypothesis['label'])
    support.append(accepted)
assert support == [['B', 'C'], ['A', 'B'], ['A', 'C']]
common = lambda indices: set.intersection(*(set(support[i]) for i in indices))
assert all(len(common(pair)) == 1 for pair in itertools.combinations(range(3), 2))
assert not common(range(3))
print(json.dumps({'method': 'Independent SciPy augmented 3x3 matrix exponentials', 'authoredControlOnly': True, 'individualSupport': support, 'everyPairHasOneCommonCandidate': True, 'jointSupport': [], 'minimalConflicts': [[0, 1, 2]], 'predictions': predictions}, indent=2))
