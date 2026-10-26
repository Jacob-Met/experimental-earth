"""Independent original-exposure point/mean oracle. Requires numpy and scipy.
Run: python evaluation/heat-column-transfer-reference.py
All conditions are explicitly authored; no acquired physical data are used.
"""
import json
import numpy as np
from scipy.linalg import expm

parameters=[(60000,27.510121852810165),(80000,20),(120000,16.295174716022963),(240000,14.009639299457522),(500000,13.122086618787623)]
def advance(state,seconds,capacity,conductance,incident,reservoir):
    # State is surfaceC, lowerC, surface integral, lower integral, constant1.
    matrix=np.zeros((5,5))
    matrix[0,0]=-(10+conductance)/20000
    matrix[0,1]=conductance/20000
    matrix[1,0]=conductance/capacity
    matrix[1,1]=-conductance/capacity
    matrix[0,4]=(.8*incident+10*reservoir)/20000
    matrix[2,0]=1
    matrix[3,1]=1
    return expm(matrix*seconds)@state

def at(minute,capacity,conductance):
    state=np.array([52.,36.,0.,0.,1.])
    state=advance(state,min(minute,35)*60,capacity,conductance,0,12)
    if minute>35:
        state=advance(state,(minute-35)*60,capacity,conductance,220,18)
    return state

rows=[]
for capacity,conductance in parameters:
    rows.append({'capacityJm2K':capacity,'conductanceWm2K':conductance,
                 'instant15C':float(at(15,capacity,conductance)[0]),
                 'mean30to45C':float((at(45,capacity,conductance)[2]-at(30,capacity,conductance)[2])/(15*60))})
print(json.dumps({'method':'Independent augmented matrix exponential with explicit temperature integrals across35minute forcing transition','rows':rows},indent=2))
