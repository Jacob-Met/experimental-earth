/** Exact bounded 2D half-plane geometry over supplied binary64 values. */
const ZERO = [0n, 1n];
function gcd(a, b) { a = a < 0n ? -a : a; while (b) [a,b] = [b,a%b]; return a; }
function q(n, d = 1n) {
  if (!d) throw Error('Undefined rational division');
  if (d < 0n) { n = -n; d = -d; }
  if (!n) return ZERO;
  const g = gcd(n,d); n /= g; d /= g;
  if (n.toString(2).length > 4096 || d.toString(2).length > 4096) {
    throw Error('Exact arithmetic capacity exhausted; no partial support is returned');
  }
  return [n,d];
}
const add = (a,b) => q(a[0]*b[1]+b[0]*a[1],a[1]*b[1]);
const sub = (a,b) => q(a[0]*b[1]-b[0]*a[1],a[1]*b[1]);
const mul = (a,b) => q(a[0]*b[0],a[1]*b[1]);
const div = (a,b) => q(a[0]*b[1],a[1]*b[0]);
const neg = a => [-a[0],a[1]];
const cmp = (a,b) => { const v=a[0]*b[1]-b[0]*a[1]; return v<0n?-1:v>0n?1:0; };
function rational(value) {
  if (!Number.isFinite(value)) throw Error('Finite binary64 value required');
  if (!value) return ZERO;
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0,value);
  const bits=view.getBigUint64(0), exponent=Number((bits>>52n)&2047n);
  let mantissa=bits&((1n<<52n)-1n);
  if (exponent) mantissa += 1n<<52n;
  if (bits>>63n) mantissa = -mantissa;
  const power=exponent ? exponent-1023-52 : -1074;
  return power>=0 ? q(mantissa<<BigInt(power)) : q(mantissa,1n<<BigInt(-power));
}
/** Adjacent enclosing binary64 values, computed by integer division. */
function enclosure(value) {
  const [signed,d]=value; if (!signed) return {lower:0,upper:0};
  const n=signed<0n?-signed:signed;
  let e=n.toString(2).length-d.toString(2).length;
  if (e>=0 ? n < (d<<BigInt(e)) : (n<<BigInt(-e)) < d) e--;
  if (e>1023) throw Error('The projected bound is not finite');
  const scale=Math.max(52-e,-971);
  const shift=Math.min(1074,scale);
  const a=shift>=0?n<<BigInt(shift):n;
  const b=shift>=0?d:d<<BigInt(-shift);
  const units=a/b, remainder=a%b, quantum=2**(-shift);
  const low=Number(units)*quantum, high=Number(units+(remainder?1n:0n))*quantum;
  if (![low,high].every(Number.isFinite)) throw Error('The projected bound is not finite');
  return signed<0n?{lower:-high,upper:-low}:{lower:low,upper:high};
}
const serial = value => ({numerator:String(value[0]),denominator:String(value[1])});
const equalPoint = (a,b) => cmp(a[0],b[0])===0 && cmp(a[1],b[1])===0;
function unique(points) {
  const out=[];
  for (const point of points) if (!out.length || !equalPoint(point,out.at(-1))) out.push(point);
  if (out.length>1 && equalPoint(out[0],out.at(-1))) out.pop();
  return out;
}
function clip(polygon, a, b, c, work, maxVertices = 244) {
  const limit = work?.limit ?? 200000;
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > 200000 ||
      !Number.isSafeInteger(work?.count) || work.count < 0 || work.count > limit ||
      !Number.isSafeInteger(maxVertices) || maxVertices < 1 || maxVertices > 244) {
    throw Error('Finite bounded constraint work and polygon capacities are required');
  }
  if (!polygon.length) return [];
  const evaluate = point => sub(add(mul(a,point[0]),mul(b,point[1])),c);
  let previous=polygon.at(-1), pv=evaluate(previous), out=[];
  for (const current of polygon) {
    if (++work.count>limit) throw Error('Constraint work capacity exhausted; no partial support is returned');
    const cv=evaluate(current), pi=pv[0]<=0n, ci=cv[0]<=0n;
    if (pi!==ci) {
      const fraction=div(pv,sub(pv,cv));
      out.push([add(previous[0],mul(fraction,sub(current[0],previous[0]))),
        add(previous[1],mul(fraction,sub(current[1],previous[1])))]);
    }
    if (ci) out.push(current);
    previous=current;pv=cv;
  }
  out=unique(out);
  if (out.length>maxVertices) throw Error('Polygon capacity exhausted; no partial support is returned');
  return out;
}

export {rational, add, sub, mul, div, neg, cmp, enclosure, serial, unique, clip};
