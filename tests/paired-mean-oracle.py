"""Independent 4D original-band vertex oracle; no pair bounds or polygon clipping."""
import itertools,json,sys
from fractions import Fraction as F
from datetime import datetime
def solve(rows):
 a=[[F(v) for v in n]+[F(rhs)] for n,rhs in rows]
 for col in range(4):
  pivot=next((r for r in range(col,4) if a[r][col]),None)
  if pivot is None:return None
  a[col],a[pivot]=a[pivot],a[col]
  d=a[col][col];a[col]=[v/d for v in a[col]]
  for r in range(4):
   if r!=col:
    d=a[r][col];a[r]=[v-d*w for v,w in zip(a[r],a[col])]
 return tuple(a[r][4] for r in range(4))
out=[]
for source in json.load(sys.stdin):
 series=source;origin=datetime.fromisoformat(series['boundary']);planes=[]
 for p in series['pairs']:
  start=datetime.fromisoformat(p['treated']['from'])-origin
  end=datetime.fromisoformat(p['treated']['to'])-origin
  t=F(start.days*86400+start.seconds+end.days*86400+end.seconds,172800)
  n=[F(1),t,F(0),F(0)] if p['role']=='pre' else [F(0),F(0),F(1),t]
  lo=F(p['treated']['value'])-F(p['treated']['halfWidth'])-F(p['comparison']['value'])-F(p['comparison']['halfWidth']);hi=F(p['treated']['value'])+F(p['treated']['halfWidth'])-F(p['comparison']['value'])+F(p['comparison']['halfWidth'])
  planes.extend([(n,hi),([-v for v in n],-lo)])
 projected=set()
 for four in itertools.combinations(planes,4):
  v=solve(four)
  if v is not None and all(sum(a*b for a,b in zip(n,v))<=c for n,c in planes):
   projected.add((v[2]-v[0],v[3]-v[1]))
 out.append([[str(v.numerator)+'/'+str(v.denominator) for v in p] for p in sorted(projected)])
print(json.dumps(out))
