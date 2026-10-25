"""Independent SciPy augmented matrix exponential; no production heat algebra."""
import json
import subprocess
from pathlib import Path
import numpy as np
from scipy.linalg import expm

cases = []
for c1, c2, h, g in [(20000,80000,10,20), (1000,1e7,20,300), (1e7,1000,10,300), (20000,80000,0,20), (20000,80000,10,0), (20000,80000,0,0)]:
    rates = np.linalg.eigvalsh(np.array([[(h+g)/c1,-g/np.sqrt(c1*c2)],[-g/np.sqrt(c1*c2),g/c2]]))
    for decay in [0,1e-9,max(0,float(rates[0])),float(rates[1]),.001,.01]:
        for seconds in [.001,100,3600]:
            a=np.zeros((7,7))
            a[0,:4]=[-(h+g)/c1,g/c1,-1/c1,(560+h*20)/c1]
            a[1,:2]=[g/c2,-g/c2]
            a[2,2]=-decay
            a[4,[0,3]]=[h,-h*20]
            a[5,:2]=[g,-g]
            a[6,2]=1
            expected=expm(a*seconds)@np.array([20,20,150,1,0,0,0])
            if min(expected[:2]) < -100 or max(expected[:2]) > 500:
                continue
            cases.append(dict(c1=c1,c2=c2,h=h,g=g,decay=decay,seconds=seconds,
                expected={k:float(v) for k,v in zip(['surfaceC','subsurfaceC','exchangeOutJm2','transferDownJm2','surfaceLossJm2'],expected[[0,1,4,5,6]])}))
script="""import {readFileSync} from 'node:fs';
import {advanceHeatColumnWithLoss} from './heat-column-step.js';
const rows=JSON.parse(readFileSync(0,'utf8'));
console.log(JSON.stringify(rows.map(r=>advanceHeatColumnWithLoss(
 {capacityJm2K:r.c1,exchangeWm2K:r.h,absorptivity:.8},
 {capacityJm2K:r.c2,conductanceWm2K:r.g},
 {incidentWm2:700,reservoirC:20},{surfaceC:20,subsurfaceC:20},r.seconds,
 {initialWm2:150,decayPerSecond:r.decay}))));"""
received=json.loads(subprocess.run(['node','--input-type=module','-e',script],input=json.dumps(cases),text=True,capture_output=True,check=True,cwd=Path(__file__).resolve().parent.parent).stdout)
maxima={k:0 for k in cases[0]['expected']}
for case,actual in zip(cases,received,strict=True):
    for key,expected in case['expected'].items():
        error=abs(actual[key]-expected)
        maxima[key]=max(maxima[key],error)
        tolerance=2e-8 if key.endswith('C') else 2e-5
        assert error <= tolerance, (case,key,actual[key],expected,error)
print(json.dumps({'status':'PASS','independent_method':'SciPy augmented matrix exponential','cases':len(cases),'max_absolute_errors':maxima},indent=2))
