"""Extract the selected plot/date's original DRY/WET/WET2 records, without resampling."""
import csv, hashlib, io, json, pathlib, sys
source=pathlib.Path(sys.argv[1]).read_bytes()
if len(source)!=945935 or hashlib.sha256(source).hexdigest()!='6db82e5c484e99f1663e9b0e7259572be97a7c99e12a928db204403b7a23c9d9':
    raise ValueError('Unexpected revised source bytes')
reader=csv.reader(io.StringIO(source.decode('utf-8-sig')))
header=next(reader); names=[s.strip() for s in header]
target=('ER2','N','1','2013','7','30')
groups={}
for row in reader:
    if len(row)!=len(header): raise ValueError('Malformed source row')
    if tuple(s.strip() for s in row[:6])!=target: continue
    kind=row[6].strip()
    if kind not in ('DRY','WET','WET2'): raise ValueError('Unexpected paired run type')
    group=groups.setdefault(kind,[])
    if len(group)>=512: raise ValueError('Bounded event capacity exceeded')
    group.append({'sourceLine':reader.line_num,'raw':dict(zip(names,row))})
result={'sourceSha256':hashlib.sha256(source).hexdigest(),'originalHeader':header,'samePlotAndDate':target,'events':groups,
        'comparisonMeaning':'Run-relative original observations. DRY/WET are sequential treatments with different antecedent conditions and potentially different forcing; not causal treatment effects or measured collected volumes.'}
text=json.dumps(result,indent=2)
out=pathlib.Path(sys.argv[2])
if out.exists() and out.read_text()!=text: raise ValueError('Preserve differing prior pair')
out.write_text(text)
print(json.dumps({k:len(v) for k,v in groups.items()}))
