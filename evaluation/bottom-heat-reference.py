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
base={"c1":20000,"c2":80000,"h":10,"g":20,"b":0,"q":560,"ambient":20,"deep":20,"surface":20,"lower":20,"seconds":3600}
declarations=[
 ("insulated-pulse",{}),
 ("deep-drained-pulse",{"b":10}),
 ("uncoupled-lower-cooling",{"g":0,"h":0,"b":30,"q":0,"surface":50,"lower":40}),
 ("only-bottom-outlet",{"h":0,"b":40,"q":500}),
 ("warm-deep-source",{"b":20,"q":0,"deep":50}),
 ("equal-decay-rates",{"g":0,"b":40,"q":0,"surface":40,"lower":50,"deep":10}),
 ("nearly-equal-decay-rates",{"g":1e-12,"b":40,"q":0,"surface":40,"lower":50,"deep":10}),
 ("tiny-time",{"g":1e-8,"b":1e-6,"h":1e-8,"seconds":1e-6,"surface":30,"lower":10}),
 ("stiff-unequal-capacities",{"c1":1000,"c2":1e7,"h":1000,"g":500,"b":1000,"seconds":86400,"surface":50,"lower":10}),
 ("all-insulated-input",{"g":0,"h":0,"b":0,"seconds":1}),
 ("zero-duration",{"b":20,"seconds":0,"surface":40,"lower":10}),
 ("upward-internal-transfer",{"b":15,"q":0,"surface":10,"lower":60,"deep":40}),
]
cases=[]
for name,changes in declarations:
    raw={**base,**changes}
    cases.append({"name":name,"input":raw,"expected":reference(raw)})
report={"schema":"hamon-independent-two-store-bottom-reference/v1","method":"80-digit Decimal augmented 5x5 exponential; norm-scaled Taylor to 1e-76 followed by squaring",
        "authoredBeforeCandidateReceiving":True,"evidence":"authored mathematical controls, not physical measurements","cases":cases}
json.dump(report,sys.stdout,indent=2);print()
