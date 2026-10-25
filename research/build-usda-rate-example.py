"""Build the explicit source-only comparison from the verified selected pair."""
import csv, io, json, pathlib, sys
pair=json.loads(pathlib.Path(sys.argv[1]).read_text())
assert pair['sourceSha256']=='6db82e5c484e99f1663e9b0e7259572be97a7c99e12a928db204403b7a23c9d9'
assert pair['samePlotAndDate']==['ER2','N','1','2013','7','30']
events=[]
for kind,count in [('DRY',13),('WET',38)]:
    original=pair['events'][kind];assert len(original)==count
    stream=io.StringIO(newline='');writer=csv.writer(stream,lineterminator='\n')
    writer.writerow(['minute','rain_mm_hr','runon_mm_hr','runoff_mm_hr','source_line'])
    for row in original:
        r=row['raw'];assert r['Run'].strip()==kind
        writer.writerow([r['Time'],r['Precipitation'],r['Run-on'],r['Runoff'],row['sourceLine']])
    events.append({'source':{
      'event':f'ER2 / natural N / plot 1 / 2013-07-30 / {kind}',
      'source':f'USDA DOI 10.15482/USDA.ADC/1358583; U.S. Public Domain. Corrected file43727238 SHA256 {pair["sourceSha256"]}. Original outlet flow rates in mm/h. Sequential DRY/WET runs differ in antecedent conditions and forcing; source methods describe a pause between runs. No collected volumes or uncertainty bands inferred.',
      'fileName':f'Rainfall simulation (R11272017).csv — {kind} event extract'
    },'text':stream.getvalue()})
result={'kind':'experimental-earth-original-rate-events','version':1,'events':events}
path=pathlib.Path(sys.argv[2]);path.parent.mkdir(parents=True,exist_ok=True);text=json.dumps(result,indent=2)
if path.exists() and path.read_text()!=text:raise ValueError('Preserve differing prior acquired example')
path.write_text(text)
print(json.dumps({'output':str(path),'events':[len(pair['events'][k]) for k in ['DRY','WET']]}))
