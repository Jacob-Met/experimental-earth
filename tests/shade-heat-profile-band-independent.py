import json,subprocess,random,math,hashlib,pathlib
from fractions import Fraction as F
source=pathlib.Path(__file__).resolve().parents[1]/'shade-heat-profile-band.js'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='a74eef5e7d65aa1137f6bc84007f337a06eb0653b6e760705821f172706adfef'
rng=random.Random(52296);cases=[]
for index in range(400):
 n=[2,4,8,16][index%4];obs=[rng.choice([-.1,0.,.1,1.,2.,4.,8.]) for _ in range(n)];objective=[rng.randint(-20,20)/8 for _ in range(n)]
 center=rng.choice(obs+[.5,1.5,3.,10.]);width=rng.choice([0.,.1,.5,2.,20.]);cases.append({'obs':obs,'objective':objective,'reading':{'temperatureC':center,'halfWidthC':width}})
for obs in [[0.,0.,0.,0.],[1.,1.,1.,1.],[0.,5e-324,1e-323,1.],[-1e100,0.,1e100,1.]]:
 for center,width in [(0.,0.),(.5,0.),(1.,0.),(0.,1.)]:cases.append({'obs':obs,'objective':[-3.,1.,4.,9.],'reading':{'temperatureC':center,'halfWidthC':width}})
js="""import fs from 'node:fs';import {intersectProfileBand,evaluateProfileMixture,describeProfileCandidate} from '%s';let qs=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(qs.map(q=>{let r=intersectProfileBand(q.obs,q.reading);return {status:r.status,work:r.work,c:r.candidates.map(c=>({...c,objective:evaluateProfileMixture(c,q.objective),described:describeProfileCandidate(c,q.obs.length)}))};}),(_,v)=>typeof v==='bigint'?String(v):v));"""%source
reports=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],input=json.dumps(cases).encode()))
def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
def hull(points):
 points=sorted(set(points))
 if len(points)<2:return points
 low=[];high=[]
 for p in points:
  while len(low)>1 and cross(low[-2],low[-1],p)<=0:low.pop()
  low.append(p)
 for p in reversed(points):
  while len(high)>1 and cross(high[-2],high[-1],p)<=0:high.pop()
  high.append(p)
 return low[:-1]+high[:-1]
def clip(poly,bound,lower):
 if not poly:return []
 out=[];prev=poly[-1];inside=lambda p:p[0]>=bound if lower else p[0]<=bound
 for cur in poly:
  a,b=inside(prev),inside(cur)
  if a!=b:
   t=(bound-prev[0])/(cur[0]-prev[0]);out.append((bound,prev[1]+t*(cur[1]-prev[1])))
  if b:out.append(cur)
  prev=cur
 return list(dict.fromkeys(out))
checked=0
for q,r in zip(cases,reports):
 obs=list(map(F,q['obs']));obj=list(map(F,q['objective']));lo=F(q['reading']['temperatureC'])-F(q['reading']['halfWidthC']);hi=F(q['reading']['temperatureC'])+F(q['reading']['halfWidthC'])
 poly=clip(clip(hull(list(zip(obs,obj))),lo,True),hi,False)
 assert bool(poly)==bool(r['c'])
 scores=[]
 for c in r['c']:
  weights=[F(int(a),int(b)) for a,b in c['weights']];assert sum(weights)==1 and all(w>0 for w in weights)
  observed=sum(obs[i]*w for i,w in zip(c['support'],weights));objective=sum(obj[i]*w for i,w in zip(c['support'],weights));assert lo<=observed<=hi;assert observed==F(*map(int,c['observed']));assert objective==F(*map(int,c['objective']));scores.append(objective)
  for d in c['described']['weights']+[c['described']['observedC']]:
   x=F(int(d['exact']['numerator']),int(d['exact']['denominator']));a,b=d['lower'],d['upper'];assert F(a)<=x<=F(b)
   if a!=b:assert math.nextafter(a,math.inf)==b
  checked+=1
 if poly:assert (min(scores),max(scores))==(min(y for x,y in poly),max(y for x,y in poly))
 assert r['work']['candidates']<=len(obs)**2
print(json.dumps({'projectedHullCases':len(cases),'candidateWitnesses':checked,'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'result':'PASS exact alternative 2D hull-clipping extrema; witness simplex/band membership; minimal outward displays; degeneracy/subnormal/zero-width'}))
