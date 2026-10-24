import json
import numpy as np
from scipy.linalg import expm

def advance(initial, seconds, c1, c2, g, h, q, ta):
    # Independent augmented affine system, with Celsius temperature integrals.
    a=np.zeros((5,5));a[:2,:2]=[[-(h+g)/c1,g/c1],[g/c2,-g/c2]]
    a[0,4]=(q+h*ta)/c1;a[2,0]=1;a[3,1]=1
    return expm(a*seconds)@np.array([*initial,0.,0.,1.])

def course(name, start, end, g=20., h=10., pulse=60.):
    c1,c2=20000.,80000.;state=np.array([20.,20.]);integral=np.zeros(2)
    cuts=sorted(set([0.,start,end]+([pulse] if pulse<end else [])))
    for a,b in zip(cuts,cuts[1:]):
        if b<=a:continue
        result=advance(state,(b-a)*60,c1,c2,g,h,560. if a<pulse else 0.,20.)
        state=result[:2]
        if a>=start:integral+=result[2:4]
    return dict(name=name,fromMinute=start,toMinute=end,g=g,h=h,pulseMinutes=pulse,
                averageSurfaceC=float(integral[0]/((end-start)*60)),averageLowerC=float(integral[1]/((end-start)*60)),
                endpointSurfaceC=float(state[0]),endpointLowerC=float(state[1]))
rows=[course('heating hour',0.,60.),course('cooling hour',60.,120.),course('crosses pulse boundary',30.,90.),
      course('short interval across pulse',59.9,60.1),course('insulated coupled',0.,60.,h=0.),
      course('uncoupled exchange',0.,60.,g=0.),course('uncoupled insulated ramp',0.,60.,g=0.,h=0.)]
print(json.dumps(rows,indent=2));open('thermal-research/interval-average-oracle.json','w').write(json.dumps(rows,indent=2)+'\n')
