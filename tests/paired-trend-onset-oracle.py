"""Original 4D band constraints plus continuity wedges; no projected-polygon code."""
import itertools,json,sys
from fractions import Fraction as F
from datetime import datetime
def solve(rows):
 a=[[F(v) for v in n]+[F(rhs)] for n,rhs in rows]
 for col in range(4):
  pivot=next((r for r in range(col,4)if a[r][col]),None)
  if pivot is None:return None
  a[col],a[pivot]=a[pivot],a[col];d=a[col][col];a[col]=[v/d for v in a[col]]
  for r in range(4):
   if r!=col:
    d=a[r][col];a[r]=[v-d*w for v,w in zip(a[r],a[col])]
 return tuple(a[r][4] for r in range(4))
def serial(v):return str(v.numerator)+'/'+str(v.denominator)
out=[]
for source in json.load(sys.stdin):
 series=source['response']['inquiry']['series'];origin=datetime.fromisoformat(series['intervention']);planes=[];bands=[]
 for p in series['pairs']:
  delta=datetime.fromisoformat(p['time'])-origin;t=F(delta.days*86400+delta.seconds,86400)
  n=[F(1),t,F(0),F(0)]if p['role']=='pre'else[F(0),F(0),F(1),t]
  lo=F(p['treated']['lower'])-F(p['comparison']['upper']);hi=F(p['treated']['upper'])-F(p['comparison']['lower'])
  planes.extend([(n,hi),([-v for v in n],-lo)]);bands.append((t,lo,hi,p['role']))
 low=max(t for t,_,_,role in bands if role=='pre');high=min(t for t,_,_,role in bands if role=='post');parts=[]
 for sign in (1,-1):
  # sign * (later-earlier)(low) <= 0, opposite inequality at high.
  nlo=[-sign,-sign*low,sign,sign*low];nhi=[sign,sign*high,-sign,-sign*high];slope=[0,sign,0,-sign]
  restrictions=planes+[(nlo,F(0)),(nhi,F(0)),(slope,F(0))]
  roots=[]
  for four in itertools.combinations(restrictions,4):
   v=solve(four)
   if v is None or not all(sum(a*b for a,b in zip(n,v))<=c for n,c in restrictions):continue
   jump=v[2]-v[0];s=v[3]-v[1]
   if s:roots.append(-jump/s-low)
  if roots:parts.append({'direction':'positive'if sign==1 else'negative','bounds':[serial(min(roots)),serial(max(roots))]})
 ordered=sorted(bands);lower=None;upper=None
 for i,a in enumerate(ordered):
  for b in ordered[i+1:]:
   dt=b[0]-a[0];lo=(b[1]-a[2])/dt;hi=(b[2]-a[1])/dt
   lower=lo if lower is None else max(lo,lower);upper=hi if upper is None else min(hi,upper)
 out.append({'parts':parts,'unchanged':lower<=upper})
print(json.dumps(out))
