/** Maintained column-normalized QR primitive, shared by validated science consumers.
 * Callers admit finite, equal-length columns/target with bounded row/column counts.
 * A null fit means rank-deficient or nonfinite arithmetic, never zero evidence.
 */
export const RANK_TOLERANCE = 1e-8;
function dot(a, b) { let total = 0; for (let i = 0; i < a.length; ++i) total += a[i] * b[i]; return total; }
function norm(a) { return Math.hypot(...a); }

// Column normalization and two-pass modified Gram-Schmidt avoid normal-equation
// squaring of condition number. Rank decisions are relative to unit-length columns.
export function fitLinearColumns(columns, target) {
  if (columns.length === 0) return { coefficients: [], conditionEstimate: 1 };
  const scales = columns.map(norm);
  if (scales.some(value => value === 0 || !Number.isFinite(value))) return null;
  const q = [], r = columns.map(() => columns.map(() => 0));
  const pivots = [];
  for (let j = 0; j < columns.length; ++j) {
    const v = columns[j].map(value => value / scales[j]);
    for (let pass = 0; pass < 2; ++pass) {
      for (let i = 0; i < j; ++i) {
        const projection = dot(q[i], v);
        r[i][j] += projection;
        for (let k = 0; k < v.length; ++k) v[k] -= projection * q[i][k];
      }
    }
    const pivot = norm(v);
    if (!(pivot > RANK_TOLERANCE)) return null;
    r[j][j] = pivot; pivots.push(pivot); q.push(v.map(value => value / pivot));
  }
  const solution = q.map(col => dot(col, target));
  for (let i = solution.length - 1; i >= 0; --i) {
    for (let j = i + 1; j < solution.length; ++j) solution[i] -= r[i][j] * solution[j];
    solution[i] /= r[i][i];
  }
  const coefficients = solution.map((value, i) => value / scales[i]);
  if (!coefficients.every(Number.isFinite)) return null;
  return { coefficients, conditionEstimate: Math.max(...pivots) / Math.min(...pivots) };
}

// Pivoted rank diagnostic for the whole offered library, including zero columns.
export function linearColumnRank(columns) {
  let remaining = columns.map(col => { const scale = norm(col); return col.map(v => scale === 0 ? 0 : v / scale); });
  let rank = 0;
  while (remaining.length) {
    const sizes = remaining.map(norm);
    const index = sizes.indexOf(Math.max(...sizes));
    if (!(sizes[index] > RANK_TOLERANCE)) break;
    const basis = remaining[index].map(v => v / sizes[index]);
    remaining.splice(index, 1); rank++;
    remaining = remaining.map(col => {
      const result = [...col];
      for (let pass = 0; pass < 2; pass++) {
        const projection = dot(basis, result);
        for (let i = 0; i < result.length; i++) result[i] -= projection * basis[i];
      }
      return result;
    });
  }
  return rank;
}
