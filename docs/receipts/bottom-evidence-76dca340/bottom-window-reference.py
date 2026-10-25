"""Independent 80-digit augmented-matrix oracle for constant two-store heat.
Authored mathematical controls, not measured site/material evidence.
No production spectral projection or propagation code is used.
"""
from decimal import Decimal, localcontext
import json, math, sys
D=lambda v: Decimal(str(v))
def identity(n):
    return [[D(int(i==j)) for j in range(n)] for i in range(n)]
def mul(a,b):
    n=len(a)
    return [[sum((a[i][k]*b[k][j] for k in range(n)),D(0)) for j in range(n)] for i in range(n)]
def expm(a):
    n=len(a)
    norm=max(sum(abs(x) for x in row) for row in a)
    scale=max(0,math.ceil(math.log2(float(norm)))) if norm else 0
    a=[[x/(D(2)**scale) for x in row] for row in a]
    out=identity(n); term=identity(n)
    for k in range(1,256):
        term=[[x/D(k) for x in row] for row in mul(term,a)]
        out=[[out[i][j]+term[i][j] for j in range(n)] for i in range(n)]
        if max(abs(x) for row in term for x in row)<D("1e-76"): break
    else: raise RuntimeError("Taylor reference did not converge")
    for _ in range(scale): out=mul(out,out)
    return out
def reference(case):
    with localcontext() as ctx:
        ctx.prec=80
        c1,c2,h,g,b,q,ta,td,s,l,t=[D(case[k]) for k in ["c1","c2","h","g","b","q","ambient","deep","surface","lower","seconds"]]
        a=[[-(h+g)/c1,g/c1,(q+h*ta)/c1,D(0),D(0)],
           [g/c2,-(g+b)/c2,b*td/c2,D(0),D(0)],
           [D(0)]*5,[D(1),D(0),D(0),D(0),D(0)],[D(0),D(1),D(0),D(0),D(0)]]
        e=expm([[x*t for x in row] for row in a])
        v=[s,l,D(1),D(0),D(0)]
        y=[sum((e[i][j]*v[j] for j in range(5)),D(0)) for i in range(5)]
        input_=q*t; ambient=h*(y[3]-ta*t); bottom=b*(y[4]-td*t); internal=g*(y[3]-y[4])
        stored1=c1*(y[0]-s);stored2=c2*(y[1]-l)
        out={"surfaceC":y[0],"subsurfaceC":y[1],
             "surfaceMeanC":y[3]/t if t else s,"subsurfaceMeanC":y[4]/t if t else l,
             "surfaceDegreeSeconds":y[3],"subsurfaceDegreeSeconds":y[4],
             "inputJm2":input_,"exchangeOutJm2":ambient,"bottomExchangeOutJm2":bottom,
             "transferDownJm2":internal,"surfaceStoredJm2":stored1,"subsurfaceStoredJm2":stored2,
             "totalStoredJm2":stored1+stored2,"balanceResidualJm2":input_-ambient-bottom-stored1-stored2,
             "surfaceBalanceResidualJm2":input_-ambient-internal-stored1,
             "subsurfaceBalanceResidualJm2":internal-bottom-stored2}
        return {k:str(v) for k,v in out.items()}

from functools import lru_cache
base={"c1":20000,"c2":80000,"h":10,"g":20,"b":10,"ambient":20,"deep":20,"surface":20,"lower":20}
declarations=[("insulated",{"b":0}),("drained",{}),("warm-reservoir",{"deep":50}),("strong-cold-reservoir",{"b":50,"deep":-20}),("uncoupled",{"b":25,"g":0}),("no-surface-exchange",{"h":0,"b":25}),("weak-coupling",{"g":1e-6,"b":1e-9}),("unequal-capacities",{"c1":5000,"c2":500000,"h":15,"g":3,"b":5})]
windows=[(0,60),(30,90),(59.999,60.001),(99.5,99.500001),(120.25,240.75),(360,420)]
cases=[]
for name,changes in declarations:
    params={**base,**changes}
    @lru_cache(None)
    def at(minute):
        with localcontext() as ctx:
            ctx.prec=80
            remaining=D(minute)*60;surface=D(params["surface"]);lower=D(params["lower"]);isurf=D(0);ilower=D(0)
            for duration,forcing in [(D(3600),D(560)),(D(21600),D(0))]:
                seconds=min(remaining,duration)
                if seconds<=0:break
                step=reference({**params,"surface":surface,"lower":lower,"seconds":seconds,"q":forcing})
                surface=D(step["surfaceC"]);lower=D(step["subsurfaceC"])
                isurf+=D(step["surfaceDegreeSeconds"]);ilower+=D(step["subsurfaceDegreeSeconds"]);remaining-=seconds
            return surface,lower,isurf,ilower
    with localcontext() as ctx:
        ctx.prec=80
        means=[]
        for start,end in windows:
            a=at(str(start));b=at(str(end));seconds=(D(end)-D(start))*60
            means.append({"fromMinute":start,"minute":end,"surfaceMeanC":str((b[2]-a[2])/seconds),"subsurfaceMeanC":str((b[3]-a[3])/seconds)})
        cases.append({"name":name,"parameters":params,"means":means})
json.dump({"schema":"hamon-bottom-window-reference/v1","method":"Independent 80-digit global augmented-matrix propagation; interval integrals from high-precision cumulative differences across forcing changes","evidence":"Authored mathematical controls, not physical measurements or certified floating-point bounds","cases":cases},sys.stdout,indent=2);print()
