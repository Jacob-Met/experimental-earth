# Independent full-dimensional Fraction oracle, contributed by the retained Ground worker.
# This uses active inequalities and Gaussian elimination, not the production support construction.
import json,random,itertools,subprocess,hashlib
from fractions import Fraction as F
from pathlib import Path
source=Path(__file__).resolve().parents[1]/'shade-heat-profile-two-bands.js'
rng=random.Random(52917); cases=[]
for t in range(120):
 n=2+t%5
 rows=[[rng.randint(-6,6)/2 for _ in range(n)] for _ in range(2)]
 if t%6==0: rows[1]=rows[0][:]
 if t%11==0: rows[1]=[2*x+1 for x in rows[0]]
 if t%13==0: rows[0]=[1.0]*n
 readings=[dict(temperatureC=rng.randint(-5,5)/2,halfWidthC=0 if t%4==0 else rng.randint(0,5)/2) for _ in range(2)]
 cases.append(dict(rows=rows,readings=readings))
cases += [dict(rows=[[0,1,0],[0,0,1]], readings=[dict(temperatureC=1/4,halfWidthC=0),dict(temperatureC=1/4,halfWidthC=0)]),dict(rows=[[0,1,2],[0,1,2]],readings=[dict(temperatureC=0,halfWidthC=0),dict(temperatureC=1,halfWidthC=0)])]
for scale in [5e-324,1e-100,1e100]:
 cases.append(dict(rows=[[0,scale,2*scale],[2*scale,scale,0]],readings=[dict(temperatureC=scale,halfWidthC=scale),dict(temperatureC=scale,halfWidthC=0)]))
runner="import fs from 'node:fs'; import {intersectTwoProfileBands as run} from "+json.dumps(source.as_uri())+";const c=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(c.map(x=>run(x.rows,x.readings)),(_,v)=>typeof v==='bigint'?String(v):v));"
results=json.loads(subprocess.check_output(['node','--input-type=module','-e',runner],input=json.dumps(cases),text=True))
def solve(a,b):
 a=[list(map(F,row))+[F(y)] for row,y in zip(a,b)]; n=len(a)
 for k in range(n):
  p=next((i for i in range(k,n) if a[i][k]),None)
  if p is None:return None
  a[k],a[p]=a[p],a[k]; d=a[k][k];a[k]=[x/d for x in a[k]]
  for i in range(n):
   if i!=k:
    d=a[i][k]; a[i]=[x-d*y for x,y in zip(a[i],a[k])]
 return tuple(row[-1] for row in a)
witnesses=0; objectives=0
for index,(case,result) in enumerate(zip(cases,results)):
 rows=[list(map(F,r)) for r in case['rows']];n=len(rows[0]);constraints=[]
 for j in range(n):constraints.append(([F(-int(i==j)) for i in range(n)],F(0)))
 for row,reading in zip(rows,case['readings']):
  center,width=F(reading['temperatureC']),F(reading['halfWidthC'])
  constraints.extend([(row,center+width),([-v for v in row],-(center-width))])
 expected=set()
 for active in itertools.combinations(constraints,n-1):
  v=solve([[F(1)]*n]+[a for a,b in active],[F(1)]+[b for a,b in active])
  if v is not None and all(sum(x*y for x,y in zip(a,v))<=b for a,b in constraints):expected.add(v)
 actual=set()
 for candidate in result['candidates']:
  v=[F(0)]*n
  for j,pair in zip(candidate['support'],candidate['weights']):v[j]=F(int(pair[0]),int(pair[1]))
  actual.add(tuple(v));witnesses+=1
 assert actual==expected,(index,actual,expected)
 assert (result['status']=='compatible')==bool(expected)
 for _ in range(6):
  objective=[F(rng.randint(-100,100),7) for _ in range(n)]
  if actual:
   av=[sum(x*y for x,y in zip(v,objective)) for v in actual];ev=[sum(x*y for x,y in zip(v,objective)) for v in expected]
   assert(min(av),max(av))==(min(ev),max(ev));objectives+=1
receipt=dict(sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),cases=len(cases),exactCandidateWitnesses=witnesses,objectivePairs=objectives,method='Full-dimensional inequality active-set enumeration and exact Gaussian elimination using Python Fraction; no pair/triangle support enumeration',status='PASS')
print(json.dumps(receipt))
