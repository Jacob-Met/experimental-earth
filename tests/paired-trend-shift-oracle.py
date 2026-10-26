import json,itertools,sys
from fractions import Fraction as F
from datetime import datetime

def determinant(m):
 return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0])
out=[]
for source in json.load(sys.stdin):
 x=source['inquiry'];ps=x['series']['pairs'];origin=datetime.fromisoformat(ps[0]['time']);planes=[]
 for p in ps:
  t=F(int((datetime.fromisoformat(p['time'])-origin).total_seconds()),86400);post=F(p['role']=='post')
  lo=F(p['treated']['lower'])-F(p['comparison']['upper']);hi=F(p['treated']['upper'])-F(p['comparison']['lower'])
  planes.extend([([F(1),t,post],hi),([F(-1),-t,-post],-lo)])
 vertices=set()
 for triple in itertools.combinations(planes,3):
  m=[t[0] for t in triple];rhs=[t[1] for t in triple];det=determinant(m)
  if not det:continue
  v=[]
  for col in range(3):
   matrix=[r[:] for r in m]
   for row in range(3):matrix[row][col]=rhs[row]
   v.append(determinant(matrix)/det)
  if all(sum(a*b for a,b in zip(n,v))<=c for n,c in planes):vertices.add(tuple(v))
 if vertices:
  expected=[min(v[2] for v in vertices),max(v[2] for v in vertices)]
  out.append([str(v.numerator)+'/'+str(v.denominator)for v in expected])
 else:out.append(None)
print(json.dumps(out))
