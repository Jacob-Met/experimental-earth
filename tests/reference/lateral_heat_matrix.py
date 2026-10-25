import json
import numpy as np
from scipy.linalg import expm
cases=[
 dict(name='two-lit-4m2',size=2,a=[.85,40000,12,25],b=[.5,80000,8,29],g=80,schedule=[[60,600,25],[60,150,22]]),
 dict(name='stiff-unequal-capacity',size=.25,a=[.3,1000,1000,90],b=[.9,1e7,0,20],g=1000,schedule=[[.1,2000,15]]),
 dict(name='large-area-weak-edge',size=100,a=[.9,1e7,0,20],b=[.4,1000,1000,40],g=.1,schedule=[[.1,1000,25],[.1,500,20]]),
 dict(name='unequal-exchange-cooling',size=.5,a=[.8,2500,1,70],b=[.2,9000,500,5],g=400,schedule=[[.1,100,25],[.1,0,25]])]
for c in cases:
 A=c['size']**2;alpha1,C1,h1,T1=c['a'];alpha2,C2,h2,T2=c['b'];G=c['g']
 # State T1,T2,Q12,Eambient1,Eambient2,constant1. The augmented
 # exponential directly integrates the unsplit ODE plus signed energy ledgers.
 y=np.array([T1,T2,0.,0.,0.,1.])
 for minutes,I,Ta in c['schedule']:
  m=np.zeros((6,6));m[0,0]=-(h1+G/A)/C1;m[0,1]=G/(A*C1);m[0,5]=(alpha1*I+h1*Ta)/C1
  m[1,0]=G/(A*C2);m[1,1]=-(h2+G/A)/C2;m[1,5]=(alpha2*I+h2*Ta)/C2
  m[2,0]=G;m[2,1]=-G
  m[3,0]=A*h1;m[3,5]=-A*h1*Ta
  m[4,1]=A*h2;m[4,5]=-A*h2*Ta
  y=expm(m*(minutes*60))@y
 c['reference']={'temperaturesC':y[:2].tolist(),'transferJ':float(y[2]),'exchangeOutJ':y[3:5].tolist()}
print(json.dumps(cases,indent=2))
