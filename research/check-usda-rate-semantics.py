"""Reproduce the selected event's interpolation ambiguity using exact decimals.

These calculations are declared interpolation experiments, not observations,
uncertainty bounds, or hydraulic-model validation.
"""
import decimal, json, pathlib, sys
D=decimal.Decimal
decimal.getcontext().prec=40
event=json.loads(pathlib.Path(sys.argv[1]).read_text())
rows=event['rows']
times=[D(r['raw']['Time']) for r in rows]
rates=[D(r['raw']['Runoff']) for r in rows]
assert len(rows)==13 and times[0]==0 and times[-1]==D('46.33')
assert all(b>a for a,b in zip(times,times[1:]))
assert all(q>=0 and q.is_finite() for q in rates)
# Compute minute-weighted sums first; divide once to avoid accumulation rounding.
left=sum((b-a)*q for a,b,q in zip(times,times[1:],rates))
right=sum((b-a)*q for a,b,q in zip(times,times[1:],rates[1:]))
assert left==D('444.670') and right==D('418.030')
assert abs(left-right)/60==D('.444')
result={
 'sourceSha256':event['source']['sha256'],
 'event':event['event'],
 'originalSourceLines':[r['sourceLine'] for r in rows],
 'observedSamplePeakMmPerHour':str(max(rates)),
 'observedSamplePeakMinutes':[str(t) for t,q in zip(times,rates) if q==max(rates)],
 'firstPositiveSampleMinute':str(next(t for t,q in zip(times,rates) if q>0)),
 'precedingZeroSampleMinute':'6.33',
 'largestSampleGapMinutes':str(max(b-a for a,b in zip(times,times[1:]))),
 'assumptionDerivedDepthsMm':{
   'holdLeftSampleUntilNext':str(left/60),
   'holdRightSampleBackToPrevious':str(right/60),
   'linearBetweenSamples':str((left+right)/120),
   'absoluteLeftRightDifference':str(abs(left-right)/60)
 },
 'limits':[
   'Observed sample maximum is not a known continuous peak.',
   'First positive sample is not a measured runoff onset time.',
   'Interpolated depths are not measured collected volumes or uncertainty bounds.',
   'No between-sample regularity, sampling-window or error model is supplied.',
   'Neither geometry nor all-boundary outlet correspondence is admitted.'
 ]
}
print(json.dumps(result,indent=2))
