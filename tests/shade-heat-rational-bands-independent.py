import json,random,itertools,subprocess,hashlib,sys,tempfile
from fractions import Fraction as F
from pathlib import Path
# Usage: python3 this_test.py /path/to/experimental-earth
_workspace=tempfile.TemporaryDirectory(prefix='earth-rational-band-oracle-')
root=Path(_workspace.name)
source=(Path(sys.argv[1]) if len(sys.argv)>1 else Path.cwd()).resolve()/'shade-heat-profile-two-bands.js'
rng=random.Random(529182); cases=[]
for t in range(160):
 n=2+t%5
 rows=[[F(rng.randint(-9,9),rng.choice([3,5,7,11])) for _ in range(n)] for _ in range(2)]
 if t%6==0:rows[1]=rows[0][:]
 if t%11==0:rows[1]=[F(7,3)*x+F(1,7) for x in rows[0]]
 if t%13==0:rows[0]=[F(1,3)]*n
 if t%17==0:rows=[[F(0)]*n,[F(0)]*n]
 readings=[dict(temperatureC=rng.randint(-4,4)/2,halfWidthC=0 if t%4==0 else rng.randint(0,5)/2) for _ in range(2)]
 cases.append(dict(rows=[[[str(v.numerator),str(v.denominator)] for v in row] for row in rows],readings=readings))
(root/'cases.json').write_text(json.dumps(cases))
runner="import fs from 'node:fs';import {intersectTwoRationalProfileBands as run} from '"+str(source)+"';const cases=JSON.parse(fs.readFileSync(process.argv[2]));console.log(JSON.stringify(cases.map(c=>run(c.rows.map(row=>row.map(v=>v.map(BigInt))),c.readings)),(_,v)=>typeof v==='bigint'?String(v):v));"
(root/'run.mjs').write_text(runner)
results=json.loads(subprocess.check_output(['node',str(root/'run.mjs'),str(root/'cases.json')],text=True))
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
 rows=[[F(int(v[0]),int(v[1])) for v in r] for r in case['rows']];n=len(rows[0]);constraints=[]
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
(root/'receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
