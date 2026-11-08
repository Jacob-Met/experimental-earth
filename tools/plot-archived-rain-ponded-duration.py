#!/usr/bin/env python3
"""Fixed-certificate extraction/rendering. No producer imports or model calls."""
import argparse
from fractions import Fraction as F
import hashlib, io, json, math, os, re, stat
from pathlib import Path
COMMIT='48a75f6a46fbfa48e28caeef4c61ab26725dabdf'
PINS={'ponded-one.stdout.json':'ba377b442d2830ab0b3d80bb9182bff3e5737507c641dd0a282d3ae34bb40aca','ponded-two.stdout.json':'f99e115f0f682518630d796a291f7884ed863ff3bddac09a4b5a5704363c6ae8','ponded-four.stdout.json':'ddcf31aa5c146648f955adcdfb55c4c5093585630d582929a788af5b2facf3fa'}
SCHEMA='experimental-earth-ponded-duration-figure-certificates/1'
def need(ok,msg):
 if not ok:raise ValueError(msg)
def sha(b):return hashlib.sha256(b).hexdigest()
def identity(s):return s.st_dev,s.st_ino,s.st_mode,s.st_size,s.st_mtime_ns,s.st_ctime_ns
def read_file(path,cap):
 path=Path(path);before=path.lstat();need(stat.S_ISREG(before.st_mode) and before.st_size<=cap,'bounded regular file');fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  need(identity(os.fstat(fd))==identity(before),'changed before read');parts=[];left=cap+1
  while left:
   b=os.read(fd,min(left,65536))
   if not b:break
   parts.append(b);left-=len(b)
  data=b''.join(parts);need(len(data)<=cap and identity(os.fstat(fd))==identity(before),'changed or oversized')
 finally:os.close(fd)
 need(identity(path.lstat())==identity(before),'path changed');return data
def parse(data):
 need(not data.startswith(b'\xef\xbb\xbf'),'BOM refused')
 def bad(_):raise ValueError('nonfinite JSON')
 v=json.loads(data.decode('utf-8'),parse_constant=bad);pending=[v];visited=0
 while pending:
  x=pending.pop();visited+=1;need(visited<=32768,'visits cap')
  if isinstance(x,(dict,list)):
   vs=list(x.values()) if isinstance(x,dict) else x;need(visited+len(pending)+len(vs)<=32768,'pending cap');pending.extend(vs)
  elif isinstance(x,float):need(math.isfinite(x),'finite JSON')
 return v
def fields(x,ks):need(type(x) is dict and set(x)==set(ks),'exact fields')
def checked(q):
 need(abs(q.numerator).bit_length()<=8192 and q.denominator.bit_length()<=8192,'rational budget');return q
def rat(x):
 fields(x,('numerator','denominator'));a,b=x['numerator'],x['denominator'];need(type(a) is str and type(b) is str and len(a)<=650 and len(b)<=650,'token cap');need(re.fullmatch(r'0|-?[1-9][0-9]*',a) and re.fullmatch(r'[1-9][0-9]*',b),'integer tokens');v=checked(F(int(a),int(b)));need(str(v.numerator)==a and str(v.denominator)==b,'reduced rational');return v
def op(k,a,b):
 a,b=checked(F(a)),checked(F(b));need(max(abs(a.numerator).bit_length(),a.denominator.bit_length())+max(abs(b.numerator).bit_length(),b.denominator.bit_length())+1<=16384,'intermediate budget');return checked(a+b if k=='+' else a-b if k=='-' else a*b)
def publish(path,data,cap):
 need(len(data)<=cap,'output cap')
 with Path(path).open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
 need(read_file(path,cap)==data,'readback mismatch')
def geometry(w):
 segs,knots,records=w['segments'],w['knots'],w['durationRecords'];need(4<=len(segs)<=7 and len(knots)==len(segs)+1 and len(records)==len(segs),'history caps');rain=[];water=[];bars=[];prev=total=F(0);depths=[F(0)]*4
 for i,(s,v) in enumerate(zip(segs,records)):
  fields(s,('startHour','endHour','rateMmHr','depthMm'));fields(v,('segmentIndex','startHour','endHour','startWaterMm','endWaterMm','case','drainHour','durationHours'))
  a,b,rate=[rat(s[k]) for k in ('startHour','endHour','rateMmHr')];need(a==prev and a<b<=1 and 0<=rate<=20,'coverage/rate');need(type(v['segmentIndex']) is int and v['segmentIndex']==i,'record index');need(rat(v['startHour'])==a and rat(v['endHour'])==b,'record times');need(rat(s['depthMm'])==op('*',rate,op('-',b,a)),'segment integral')
  bins=[j for j in range(4) if F(j,4)<=a<b<=F(j+1,4)];need(len(bins)==1,'quarter crossing');depths[bins[0]]=op('+',depths[bins[0]],rat(s['depthMm']))
  start,end=rat(v['startWaterMm']),rat(v['endWaterMm']);need(0<=start<=20 and 0<=end<=20 and rat(knots[i]['hour'])==a and rat(knots[i+1]['hour'])==b,'water times');need(start==rat(knots[i]['surfaceWaterMm']) and end==rat(knots[i+1]['surfaceWaterMm']),'water identity');slope=op('-',rate,6);need(end==max(F(0),op('+',start,op('*',slope,op('-',b,a)))),'reflected endpoint')
  if not water:water.append((a,start))
  length=rat(v['durationHours'])
  if v['case']=='dry':need(start==end==length==0 and slope<=0 and v['drainHour'] is None,'dry record')
  elif v['case']=='drains-to-dry':
   t=rat(v['drainHour']);need(a<t<b and rate==0 and start>0 and end==0,'strict drain');need(op('+',start,op('*',slope,op('-',t,a)))==0 and length==op('-',t,a),'drain point');water.append((t,F(0)));bars.append((a,t,start>0,False))
  else:
   need(v['case']=='wet' and v['drainHour'] is None and length==op('-',b,a),'wet record');need(start>0 or slope>0,'zero plateau');need(op('+',start,op('*',slope,length))>=0,'hidden drain');bars.append((a,b,start>0,end>0))
  water.append((b,end));rain.append((a,b,rate));total=op('+',total,length);prev=b
 need(prev==1 and total==rat(w['durationHours']),'duration sum');need(op('+',depths[0],depths[1])==op('+',depths[2],depths[3])==5,'half totals');need(depths[0]==rat(w['quarterTotalsMm']['first']) and depths[2]==rat(w['quarterTotalsMm']['third']),'quarter totals');need(op('+',rat(w['earlyHalfDurationHours']),rat(w['laterHalfDurationHours']))==total and rat(w['laterHalfDurationHours'])==F(1,2),'duration halves')
 return {'rain':rain,'water':water,'bars':bars,'duration':total}
def validate(v):
 fields(v,('schema','sourceCommit','cases'));need(v['schema']==SCHEMA and v['sourceCommit']==COMMIT and len(v['cases'])==3,'projection identity');drawings=[];ns=nk=nv=0
 # Reserve all six history shapes before any rational geometry work.
 pre_segments=pre_knots=0
 for case in v['cases']:
  for role in ('lowerWitness','upperWitness'):
   w=case['assessment'][role];segs,knots,records=w['segments'],w['knots'],w['durationRecords']
   need(type(segs) is list and type(knots) is list and type(records) is list,'history arrays')
   need(4<=len(segs)<=7 and len(knots)==len(segs)+1 and len(records)==len(segs),'history shape')
   pre_segments+=len(segs);pre_knots+=len(knots)
 need(pre_segments<=36 and pre_knots<=42 and pre_knots+pre_segments<=78,'reserved geometry caps')
 for case,(name,pin),q in zip(v['cases'],PINS.items(),(1,2,4)):
  fields(case,('sourceFile','sourceSHA256','sourceBytes','inputs','assessment'));need(case['sourceFile']==name and case['sourceSHA256']==pin and type(case['sourceBytes']) is int and 0<case['sourceBytes']<=4194304,'source provenance');fields(case['inputs'],('originalDeclaration','firstArchivedReading','thirdArchivedReading','peakCriterion'))
  for x in case['inputs'].values():
   fields(x,('sha256','bytes'));need(type(x['sha256']) is str and re.fullmatch('[0-9a-f]{64}',x['sha256']) and type(x['bytes']) is int and 0<x['bytes']<=16384,'input identity')
  a=case['assessment'];fields(a,('status','compatibleQuarterBands','durationBounds','lowerWitness','upperWitness'));need(a['status']=='declared-readings-compatible','compatible case');fields(a['compatibleQuarterBands'],('first','third'))
  for key,amount in (('first',q),('third',2)):
   b=a['compatibleQuarterBands'][key];fields(b,('lowerMm','upperMm','empty'));need(rat(b['lowerMm'])==rat(b['upperMm'])==amount and b['empty'] is False,'fixed bands')
  b=a['durationBounds'];fields(b,('lowerHours','upperHours','lowerInclusive','upperInclusive'));need(b['lowerInclusive'] is True and b['upperInclusive'] is True,'attained bounds');pair=[]
  for role,bound in zip(('lowerWitness','upperWitness'),('lowerHours','upperHours')):
   w=a[role];g=geometry(w);need(g['duration']==rat(b[bound]),'bound identity');pair.append(g);ns+=len(w['segments']);nk+=len(w['knots']);nv+=len(g['water'])
  drawings.append((q,pair))
 need(ns<=36 and nk<=42 and nv<=78,'figure caps');return drawings

def extract(args):
 need(args.source_commit==COMMIT,'commit mismatch');cases=[];originals=[]
 for name,pin in PINS.items():
  path=Path(args.reports)/name;data=read_file(path,4194304);need(sha(data)==pin,'report hash');v=parse(data);need(v['schema']=='experimental-earth-archived-rain-ponded-duration-cli/1','CLI schema');cases.append({'sourceFile':name,'sourceSHA256':pin,'sourceBytes':len(data),'inputs':v['inputs'],'assessment':v['report']['assessment']});originals.append((path,data))
 v={'schema':SCHEMA,'sourceCommit':COMMIT,'cases':cases};validate(v);data=(json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode()
 for path,old in originals:need(read_file(path,4194304)==old,'source changed')
 publish(args.output,data,1048576);print(json.dumps({'status':'PASS','mode':'extract','sha256':sha(data),'bytes':len(data)}))

def render(args):
 need(re.fullmatch('[0-9a-f]{64}',args.projection_sha256) is not None,'projection hash syntax')
 raw=read_file(args.certificates,1048576);need(sha(raw)==args.projection_sha256,'projection hash mismatch');v=parse(raw);drawings=validate(v)
 import matplotlib
 matplotlib.use('Agg')
 import matplotlib.pyplot as plt
 plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'svg.fonttype':'none','svg.hashsalt':'archived-ponded-duration-v1','axes.spines.top':False,'axes.spines.right':False})
 fig,axes=plt.subplots(3,3,figsize=(14,9),sharex=True,gridspec_kw={'height_ratios':[1,1.25,.65]})
 colors=('#0072B2','#D55E00');styles=('-','--');labels=('Shortest ponded time','Longest ponded time')
 for col,(q,pair) in enumerate(drawings):
  bounds=[g['duration'] for g in pair]
  axes[0,col].set_title(f'First-quarter rain: {q} mm\nExact ponded bounds: {bounds[0]} to {bounds[1]} h',fontsize=11,pad=12)
  for j,g in enumerate(pair):
   xx=[];yy=[]
   for a,b,r in g['rain']:xx.extend((float(a*60),float(b*60)));yy.extend((float(r),float(r)))
   axes[0,col].plot(xx,yy,color=colors[j],linestyle=styles[j],linewidth=2,label=labels[j])
   axes[1,col].plot([float(t*60) for t,w in g['water']],[float(w) for t,w in g['water']],color=colors[j],linestyle=styles[j],linewidth=2)
   row=1-j
   for a,b,left,right in g['bars']:
    axes[2,col].plot([float(a*60),float(b*60)],[row,row],color=colors[j],linewidth=6,solid_capstyle='butt')
    for t,closed in ((a,left),(b,right)):
     axes[2,col].plot(float(t*60),row,'o',markersize=5,color=colors[j],markerfacecolor=colors[j] if closed else 'white',markeredgewidth=1.2)
   axes[2,col].text(60,row+.16,f'{g["duration"]*60} min',ha='right',color=colors[j],fontsize=9)
  for row in range(3):
   ax=axes[row,col];ax.set_xlim(-1,61);ax.set_xticks((0,15,30,45,60));ax.grid(axis='y',alpha=.18)
   for t in (15,30,45):ax.axvline(t,color='#777777',linewidth=.65,alpha=.3,zorder=0)
  axes[0,col].set_ylim(-1,22);axes[0,col].set_yticks((0,6,20))
  axes[1,col].set_ylim(-.15,5);axes[1,col].set_yticks((0,1,2,3,4,5))
  axes[2,col].set_ylim(-.35,1.5);axes[2,col].set_yticks((0,1),('Longest','Shortest'));axes[2,col].set_xlabel('Elapsed minutes')
 axes[0,0].set_ylabel('Rain rate (mm/hour)');axes[1,0].set_ylabel('Surface water (mm)');axes[2,0].set_ylabel('Strictly ponded intervals')
 axes[1,0].annotate('Dry at 10 min;\nno rain until 15 min',xy=(10,0),xytext=(4,3.7),fontsize=9,arrowprops={'arrowstyle':'->','color':'#555555'})
 axes[1,1].annotate('Rain at 6 mm/hour,\nbut water stays zero',xy=(21,0),xytext=(4,3.7),fontsize=9,arrowprops={'arrowstyle':'->','color':'#555555'})
 fig.suptitle('Within each column: same quarter totals, different ponded durations',fontsize=16,y=.98)
 handles,_=axes[0,0].get_legend_handles_labels();fig.legend(handles,labels,loc='upper center',bbox_to_anchor=(.5,.935),ncol=2,frameon=False)
 fig.text(.07,.035,'Authored model: dry start, infiltration capacity 6 mm/hour, rain cap 20 mm/hour; assumed half-hour totals 5 + 5 mm, third-quarter total 2 mm.\nOpen bar endpoints mean zero surface water; isolated endpoints have zero duration. These are duration-attaining histories,\nnot pointwise water envelopes or field observations. Exact interior drainage splits are shown; no new model run.',fontsize=9,va='bottom')
 fig.subplots_adjust(top=.84,bottom=.14,left=.07,right=.98,hspace=.27,wspace=.28)
 outputs=[];buf=io.BytesIO();fig.savefig(buf,format='svg',metadata={'Date':None,'Creator':'plot-archived-rain-ponded-duration.py','Title':'Same quarter totals, different ponded durations','Description':'Three authored first-quarter rain cases, each showing shortest and longest duration-attaining rain histories, exactly reflected surface water including interior drainage, and strictly ponded intervals. Fixed dry-start infiltration capacity 6 mm/hour and rain cap 20 mm/hour. Not field observations or pointwise water envelopes.'});outputs.append((args.svg,buf.getvalue()))
 if args.png:
  buf=io.BytesIO();fig.savefig(buf,format='png',dpi=200,metadata={'Software':'plot-archived-rain-ponded-duration.py'});outputs.append((args.png,buf.getvalue()))
 plt.close(fig);need(read_file(args.certificates,1048576)==raw,'projection changed')
 need(len({str(Path(p).absolute()) for p,d in outputs})==len(outputs),'duplicate outputs')
 for p,d in outputs:need(not Path(p).exists() and len(d)<=8388608,'output exists or exceeds cap')
 for p,d in outputs:publish(p,d,8388608)
 print(json.dumps({'status':'PASS','mode':'render','matplotlib':matplotlib.__version__,'projectionSHA256':sha(raw),'outputs':[{'file':Path(p).name,'sha256':sha(d),'bytes':len(d)} for p,d in outputs]}))

def main():
 parser=argparse.ArgumentParser(description=__doc__);sub=parser.add_subparsers(dest='mode',required=True)
 p=sub.add_parser('extract');p.add_argument('--reports',required=True);p.add_argument('--source-commit',required=True);p.add_argument('--output',required=True)
 p=sub.add_parser('render');p.add_argument('--certificates',required=True);p.add_argument('--projection-sha256',required=True);p.add_argument('--svg',required=True);p.add_argument('--png')
 args=parser.parse_args()
 try:
  if args.mode=='extract':extract(args)
  else:render(args)
 except (ValueError,OSError,KeyError,TypeError,OverflowError) as exc:parser.exit(1,f'Certificate figure refused: {exc}\n')

if __name__=='__main__':main()
