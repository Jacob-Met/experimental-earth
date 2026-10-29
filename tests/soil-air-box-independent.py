#!/usr/bin/env python3
"""Independent Fraction gas-amount oracle, exhaustive corners and interior probes.

This is computational receiving of the declared stored-number model. The analytic
monotonicity proof, physical assumptions and measurement range coverage are separate.
"""
import argparse
from fractions import Fraction
import hashlib
import itertools
import json
import math
import os
from pathlib import Path
import random
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('product', nargs='?', type=Path, default=Path(__file__).resolve().parents[1])
parser.add_argument('--node', default=os.environ.get('NODE_BINARY', 'node'))
args = parser.parse_args()
product = args.product.resolve()
module = product / 'soil-air-box.js'
core_hash = hashlib.sha256(module.read_bytes()).hexdigest()
names = ['columnDepth', 'initialFront', 'pondingHead', 'capillaryHead', 'atmosphericHead', 'targetFront']
assumptions = ['constantPonding', 'rigidUniformColumn', 'fullyWetSharpFront', 'positiveConductivity',
               'isothermalIdealGas', 'initiallyAmbientAir', 'noOtherGasStorage', 'releaseOnlyGasExchange', 'allRangeCombinations']
scales = {'mm': 1, 'cm': 10, 'm': 1000}
rng = random.Random(20261029)

def source(rows, ordinal):
    return {'schema': 'experimental-earth-soil-air-box/1', 'title': f'Independent authored box {ordinal}',
            'parameters': {name: {'lower': lo, 'upper': hi, 'unit': unit, 'source': f'Frozen oracle declaration {ordinal}/{name}.'}
                           for name, (lo, hi, unit) in zip(names, rows)},
            'assumptions': {name: True for name in assumptions}}

cases = []
for ordinal in range(96):
    length = rng.randint(500, 8000)
    initial_low = rng.randint(1, 20)
    initial_high = initial_low + rng.randint(0, 40)
    target_low = rng.randint(initial_high + 10, length - 50)
    target_high = rng.randint(target_low, length - 5)
    pond = rng.randint(1, 100)
    cap = rng.randint(0, 500)
    pressure = rng.randint(1000, 12000)
    ranges = [(length, length + rng.randint(0, 400)), (initial_low, initial_high),
              (pond, pond + rng.randint(0, 150)), (cap, cap + rng.randint(0, 3000)),
              (pressure, pressure + rng.randint(0, 7000)), (target_low, target_high)]
    rows = []
    for lo, hi in ranges:
        unit = rng.choice(list(scales))
        rows.append((lo / scales[unit], hi / scales[unit], unit))
    cases.append(source(rows, ordinal))

base = [100, 10, 5, 15, 1408, 20]
for target in [11, 12, math.nextafter(12, -math.inf), math.nextafter(12, math.inf), 20]:
    values = [*base[:-1], target]
    cases.append(source([(value, value, 'mm') for value in values], len(cases)))
values = [1, 0.000001, 0.000001, 0, 1000, 0.99999998]
cases.append(source([(value, value, 'mm') for value in values], len(cases)))
values = [100, 10, 20, float.fromhex('0x0.0000000000001p-1022'), 1408, 12]
cases.append(source([(value, value, 'mm') for value in values], len(cases)))
# Here unclipped U initially decreases with target depth. Clipped R remains zero.
cases.append(source([(100000, 100000, 'mm'), (1, 2, 'mm'), (1, 2, 'mm'),
                     (0, 1, 'mm'), (1000, 1001, 'mm'), (2, 2000, 'mm')], len(cases)))
assert len(cases) == 104

script = """
import {readFileSync} from 'node:fs';
const {inspectSoilAirBox}=await import(process.argv[1]);
const inputs=JSON.parse(readFileSync(0,'utf8'));
console.log(JSON.stringify(inputs.map(input=>inspectSoilAirBox(input))));
"""
encoded = json.dumps(cases, ensure_ascii=False, separators=(',', ':')).encode()
run = subprocess.run([args.node, '--input-type=module', '-e', script, module.as_uri()],
                     input=encoded, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=30)
reports = json.loads(run.stdout)
assert len(reports) == len(cases)
assert hashlib.sha256(module.read_bytes()).hexdigest() == core_hash


def decoded(row, bound):
    # Python's exact float conversion is independent of the JS bit decoder.
    return Fraction.from_float(float(row[bound])) * scales[row['unit']]


def required(values):
    length, initial, pond, capillary, atmospheric, target = values
    initial_gas_amount = atmospheric * (length - initial)
    remaining_gas_at_zero_drive = (atmospheric + target + pond + capillary) * (length - target)
    return max(Fraction(0), initial_gas_amount - remaining_gas_at_zero_drive) / initial_gas_amount


def reported(value):
    result = Fraction(int(value['numerator']), int(value['denominator']))
    assert int(value['denominator']) > 0
    assert math.gcd(int(value['numerator']), int(value['denominator'])) == 1
    return result

corners_checked = interior_checked = 0
classifications = {}
for inquiry, report in zip(cases, reports):
    ranges = [(decoded(inquiry['parameters'][name], 'lower'), decoded(inquiry['parameters'][name], 'upper')) for name in names]
    assert ranges[1][1] <= ranges[5][0]
    assert ranges[5][1] <= ranges[0][0] * Fraction(99999999, 100000000)
    corner_values = [required([ranges[index][side] for index, side in enumerate(choice)])
                     for choice in itertools.product((0, 1), repeat=6)]
    lower, upper = min(corner_values), max(corner_values)
    corners_checked += len(corner_values)
    assert reported(report['lower']['minimumRemovedFraction']) == lower
    assert reported(report['upper']['minimumRemovedFraction']) == upper
    for which, expected in [('lower', lower), ('upper', upper)]:
        witness = report[which]
        values = []
        for name in names:
            offered = inquiry['parameters'][name]
            row = witness['parameters'][name]
            value = decoded(offered, row['bound'])
            assert row['value'] == offered[row['bound']] and row['unit'] == offered['unit']
            assert reported(row['exactMM']) == value
            values.append(value)
        assert required(values) == expected
        length, initial, pond, capillary, atmospheric, target = values
        balance = 1 - (atmospheric + target + pond + capillary) * (length - target) / (atmospheric * (length - initial))
        assert reported(witness['unclippedBalance']) == balance
        assert witness['driveAtRequiredRemoval'] == ('positive' if balance < 0 else 'zero')
    for probe in range(12):
        # These rational interior points need not themselves be binary64 endpoints.
        values = [lo + (hi - lo) * Fraction(rng.randint(1, 6), 7) for lo, hi in ranges]
        assert lower <= required(values) <= upper
        interior_checked += 1
    classification = 'all-require-removal' if lower > 0 else 'mixed-requirement' if upper > 0 else 'none-forced'
    assert report['classification'] == classification
    classifications[classification] = classifications.get(classification, 0) + 1
    display = report['display']
    assert Fraction(display['lowerPercent']) / 100 <= lower <= upper <= Fraction(display['upperPercent']) / 100
    scale = 100 * 10 ** display['decimalPlaces']
    floor = (lower.numerator * scale) // lower.denominator
    ceil = -(-(upper.numerator * scale) // upper.denominator)
    assert Fraction(display['lowerPercent']) * 10 ** display['decimalPlaces'] == floor
    assert Fraction(display['upperPercent']) * 10 ** display['decimalPlaces'] == ceil
    assert display['positiveLowerBelowDisplay'] == (lower > 0 and floor == 0)
    assert display['upperRoundedTo100'] == (ceil == scale)

print(json.dumps({'status': 'passed', 'coreSHA256': core_hash, 'inputSHA256': hashlib.sha256(encoded).hexdigest(),
                  'boxes': len(cases), 'exhaustiveCorners': corners_checked, 'rationalInteriorPoints': interior_checked,
                  'classifications': classifications, 'independentArithmetic': 'Python Fraction.from_float and original gas-amount balance',
                  'checks': ['exact endpoint decoding and unit factors', 'all 64 corners per box', 'rational interior membership',
                             'attained source witnesses', 'unclipped balance and drive state', 'classification and outward decimal display'],
                  'limits': 'Computational controls of declared endpoints; analytic whole-box proof remains separate. No physical range coverage, probability or dynamic sufficiency claim.'}, indent=2))
