"""Independent Decimal gas-law receiving. Run python tests/soil-air-boundary-independent.py; NODE_BINARY optionally selects Node. Emits a small JSON receipt, without writing into the repository."""
from pathlib import Path
from decimal import Decimal,localcontext
import json,subprocess,hashlib,os
script=Path(__file__).resolve();core=script.parents[1]/'soil-air-boundary.js'
core_hash=hashlib.sha256(core.read_bytes()).hexdigest();node=os.environ.get('NODE_BINARY','node')
assumptions=['constantPonding','rigidUniformColumn','fullyWetSharpFront','positiveConductivity','isothermalIdealGas','initiallyAmbientAir','noOtherGasStorage','releaseOnlyGasExchange']
def inquiry(L,z0,h,a,H,t):return {'schema':'experimental-earth-soil-air-boundary/1','title':'Independent authored numerical control','column':{'depth':L,'initialFront':z0,'unit':'mm','source':'authored'},'boundary':{'pondingHead':h,'atmosphericHead':H,'unit':'mm','source':'authored'},'target':{'front':t,'unit':'mm','source':'authored'},'hypotheses':[{'id':'control','capillaryHead':a,'unit':'mm','source':'authored'}],'assumptions':dict.fromkeys(assumptions,True)}
params=[(400,1,50,0,10332),(400,100,50,200,10332),(400,399,50,0,10332),(400,1e-6,50,1000,10332)]
for L in [1,100000]:
 for z0 in [1e-6,L*(1-4e-8)]:
  for h,a,H in [(1e-6,0,20000),(100000,100000,1000),(1e-6,0,1000)]:params.append((L,z0,h,a,H))
cases=[]
for p in params:
 L,z0,*_=p
 for t in [z0,z0+(L-z0)/2,L*(1-1.01e-8)]:
  if t>=z0:cases.append(inquiry(*p,t))
js="import{inspectSoilAirBoundary}from'"+core.as_uri()+"';let s='';for await(const x of process.stdin)s+=x;console.log(JSON.stringify(JSON.parse(s).map(x=>{const a=inspectSoilAirBoundary(x);return{root:a.alternatives[0].closedAir,target:a.alternatives[0].target,profile:a.alternatives[0].profile}})));"
p=subprocess.run([node,'--input-type=module','-e',js],input=json.dumps(cases),text=True,capture_output=True);assert p.returncode==0,p.stderr
outputs=json.loads(p.stdout);assert len(outputs)==len(cases);rows=[]
with localcontext() as ctx:
 ctx.prec=100
 D=lambda x:Decimal.from_float(float(x))
 for c,o in zip(cases,outputs):
  L,z0,h,a,H,t=map(D,[c['column']['depth'],c['column']['initialFront'],c['boundary']['pondingHead'],c['hypotheses'][0]['capillaryHead'],c['boundary']['atmosphericHead'],c['target']['front']]);a+=h
  lo,hi=z0,L
  for _ in range(400):
   mid=(lo+hi)/2
   if mid in (lo,hi):break
   if H*(mid-z0)/(L-mid)<mid+a:lo=mid
   else:hi=mid
  root=(lo+hi)/2;delta=root-z0;observed=o['root'];target=o['target'];rooterr=abs(D(observed['limitingFrontMm'])-root);deltaerr=abs(D(observed['advancementMm'])-delta)
  tol=D(128*2.220446049250313e-16)*(L+z0+abs(root)+delta+a)
  assert rooterr<=tol and deltaerr<=tol,(c,rooterr,deltaerr,tol)
  # Independently recompute the remaining mole fraction from pressure times volume.
  removed=max(Decimal(0),1-(H+t+a)*(L-t)/(H*(L-z0)))
  relation=target['relation'];contact=D(target['numericalContactMm'])
  if relation=='numerical-contact':assert abs(t-root)<=contact+rooterr and target['minimumRemovedFraction'] is None
  else:
   assert (t>root)==(relation=='beyond-closed-limit')
   assert abs(D(target['minimumRemovedFraction'])-removed)<=Decimal('2e-12'),(c,removed,target)
  assert o['profile'][-1]=={'frontMm':float(L),'minimumRemovedFraction':1,'kind':'base-limit-only'}
  assert all(x['minimumRemovedFraction'] is None or 0<=x['minimumRemovedFraction']<=1 for x in o['profile'])
  rows.append({'input':c,'rootAbsoluteErrorMm':str(rooterr),'advancementAbsoluteErrorMm':str(deltaerr),'expectedRootMm':str(root),'expectedRemovedFraction':str(removed),'relation':relation})
assert hashlib.sha256(core.read_bytes()).hexdigest()==core_hash, 'Core changed during receiving'
print(json.dumps({'status':'pass','scriptSha256':hashlib.sha256(script.read_bytes()).hexdigest(),'coreSha256':core_hash,'cases':len(rows),'method':'100-digit original gas-law bisection and independent PV mole ratio; exact binary64 inputs','rootTolerance':'128 EPS times domain scale; not certified enclosure','releaseAbsoluteTolerance':2e-12,'nodeBinary':node,'maximumRootAbsoluteErrorMm':str(max(Decimal(row['rootAbsoluteErrorMm']) for row in rows))},indent=2))
