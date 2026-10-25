"""Independent authored RK4 reference; no production code imports.
This is numerical model evidence, not acquired readings or a certified bound.
"""
import json

def course(b=10, deep=20, dt=3.0):
    state = [20., 20., 0.]
    out = {0: state[:]}
    def rhs(s, q):
        x, y, _ = s
        return [(q - 10*(x-20) - 20*(x-y))/20000, (20*(x-y) - b*(y-deep))/80000, x]
    for i in range(round(25200/dt)):
        q = 560. if i*dt < 3600 else 0.
        a = rhs(state, q)
        bb = rhs([s+dt*v/2 for s,v in zip(state,a)], q)
        c = rhs([s+dt*v/2 for s,v in zip(state,bb)], q)
        d = rhs([s+dt*v for s,v in zip(state,c)], q)
        state = [s+dt*(aa+2*bv+2*cv+dv)/6 for s,aa,bv,cv,dv in zip(state,a,bb,c,d)]
        seconds = round((i+1)*dt, 6)
        if seconds in [1800,3600,5400,7200,21600,25200]:
            out[seconds/60] = state[:]
    return out

for dt in [3., 1.5]:
    result = course(dt=dt)
    print(json.dumps({"method":"independent augmented RK4", "stepSeconds":dt,
      "surface60":result[60][0], "surface420":result[420][0],
      "means":[{"fromMinute":a,"minute":b,"surfaceMeanC":(result[b][2]-result[a][2])/((b-a)*60)}
        for a,b in [(0,60),(30,90),(60,120),(360,420)]]}))
