"""Regenerate independent high-precision mathematical controls; no product imports."""
from decimal import Decimal, localcontext
import json
from pathlib import Path

CASES = [
    ('0', '10', '20', '1'),
    ('10', '10', '20', '0.66666666666666666666666666666666666666666666666667'),
    ('10', '10', '20', '0.73333333333333333333333333333333333333333333333333'),
    ('0', '0.00001', '5000', '0.000001'),
    ('1000000', '0.000001', '5000', '0.00001'),
    ('0', '2000', '5000', '12'),
    ('0.001', '1', '0.0001', '0.01666666666666666666666666666666666666666666666667'),
    ('100', '9', '30', '0.1'),
    ('0', '9', '30', '0.08333333333333333333333333333333333333333333333333'),
]

rows = []
with localcontext() as context:
    context.prec = 90
    for initial, conductivity, drive, duration in CASES:
        F, K, A, T = map(Decimal, (initial, conductivity, drive, duration))
        low = Decimal(0)
        high = 2 * K * T + 2 * (A * K * T).sqrt()

        def integral(increment):
            return increment - A * ((F + A + increment) / (F + A)).ln()

        while integral(high) < K * T:
            high *= 2
        for _ in range(400):
            middle = (low + high) / 2
            if integral(middle) < K * T:
                low = middle
            else:
                high = middle
        rows.append({'initialMm': initial, 'conductivityMmHr': conductivity,
                     'capillaryDriveMm': drive, 'hours': duration,
                     'incrementMm': str((low + high) / 2)})

output = Path(__file__).resolve().parents[1] / 'fixtures' / 'wetting-front-reference.json'
output.write_text(json.dumps({
    'basis': 'Independent Python Decimal 90-digit inversion of d - A ln((F + A + d)/(F + A)) = K t; 400 bisections, no production imports. Authored mathematical controls, not field data.',
    'cases': rows,
}, indent=2) + '\n')
print(f'Wrote {len(rows)} independent references to {output}')
