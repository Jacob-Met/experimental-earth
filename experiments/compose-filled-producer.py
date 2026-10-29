from pathlib import Path
import hashlib,json
r=Path('/dev/shm/hamon-a755e25-earth-filled-conditioning')
backup=r/'experiments/pre-filled-baseline';backup.mkdir(exist_ok=True)
for name in ['post-dry-receiving-inverse.js','receiving-account-phase-fit.js','receiving-account-proposals-panel.js']:
 p=backup/(name+'.txt');assert not p.exists();p.write_bytes((r/name).read_bytes())
proto=(r/'experiments/filled-drain-prototype.mjs').read_text()
assert hashlib.sha256(proto.encode()).hexdigest()=='371827c83cd8b4f040953a4777dbc9dc6fee11647b1bdb970902ef81f36c8d00'
body=proto[proto.index('export const FILLED_Q_POINTS'):].replace('export function proposeFilledDrainBandWitnesses(input){','export function prepareFilledDrainBandSource(input){',1)
cut=body.index('  let qEvaluations=0,modelEvaluations=0,bandIntersections=0;')
header=body[:cut]+"""  return {status:'ready',R,H,F,T,areaM2,rows,drainedReadings,firstHours,rainVolume,qMin,qMax};
}

const filledDrainReservation=prepared=>prepared.status==='ready'
  ? {status:'active',qEvaluations:FILLED_Q_EVALUATIONS,maximumProposals:(FILLED_Q_POINTS+1)*3,
      bandIntersections:FILLED_Q_EVALUATIONS*(prepared.rows.length+prepared.drainedReadings.length),
      modelEvaluations:FILLED_Q_EVALUATIONS*(prepared.rows.length+prepared.drainedReadings.length)*(2+2*FILLED_K_BISECTIONS)}
  : {status:'inactive',reason:prepared.reason,qEvaluations:0,maximumProposals:0,bandIntersections:0,modelEvaluations:0};
export function reserveFilledDrainBandWork(input){return filledDrainReservation(prepareFilledDrainBandSource(input));}

export function proposeFilledDrainBandWitnesses(input){
  const prepared=prepareFilledDrainBandSource(input),reservation=filledDrainReservation(prepared);
  if(prepared.status!=='ready')return {...prepared,reservation};
  const {H,F,T,areaM2,rows,drainedReadings,firstHours,rainVolume,qMin,qMax}=prepared;
"""
body=header+body[cut:]
old="  const reservation={qEvaluations:FILLED_Q_EVALUATIONS,maximumProposals:(FILLED_Q_POINTS+1)*3,bandIntersections:FILLED_Q_EVALUATIONS*originals.length,modelEvaluations:FILLED_Q_EVALUATIONS*originals.length*(2+2*FILLED_K_BISECTIONS)};\n"
assert body.count(old)==1;body=body.replace(old,'')
p=r/'post-dry-receiving-inverse.js';s=p.read_text()
needle="  const rows=[...readings].sort((a,b)=>a.minute-b.minute),first=rows[0],last=rows.at(-1),T=stormMinutes/60,J=Math.min(R,F),surfaceDepth=(R-J)*T,dryHours=T+surfaceDepth/F;"
replacement="  const rows=[...readings].sort((a,b)=>a.minute-b.minute),first=rows[0],last=rows.at(-1),T=stormMinutes/60,J=Math.min(R,F);\n  const {surfaceDepth,dryHours,possible}=unfilledReceivingSurfaceCourse(input);"
assert s.count(needle)==1;s=s.replace(needle,replacement)
needle="  if(Math.abs(surfaceDepth-H)>stormUncertaintyMm||rows.some(row=>row.minute/60<dryHours))"
assert s.count(needle)==1;s=s.replace(needle,"  if(!possible)")
s+="""\n/** Shared admission arithmetic for the unchanged never-filled producer and its
 * complete preflight budget. Impossible source phases still return their refusal. */
export function unfilledReceivingSurfaceCourse(input){
  const {rainMmHr:R,infiltrationMmHr:F,stormMinutes,stormEndDepthMm:H,stormUncertaintyMm,readings}=input;
  const T=stormMinutes/60,J=Math.min(R,F),surfaceDepth=(R-J)*T,dryHours=T+surfaceDepth/F;
  return {surfaceDepth,dryHours,possible:Math.abs(surfaceDepth-H)<=stormUncertaintyMm&&Array.isArray(readings)&&readings.every(row=>row.minute/60>=dryHours)};
}

/** Finite full-store-rate parameterization. All original calibration bands bind;
 * monotone inner solves and bounded outer proposals do not certify completeness. */
"""+body
p.write_text(s)
p=r/'receiving-account-phase-fit.js';s=p.read_text()
needle="UNFILLED_DRAIN_MAXIMUM_PROPOSALS} from './post-dry-receiving-inverse.js';"
assert s.count(needle)==1;s=s.replace(needle,"UNFILLED_DRAIN_MAXIMUM_PROPOSALS,proposeFilledDrainBandWitnesses,reserveFilledDrainBandWork,unfilledReceivingSurfaceCourse,FILLED_Q_POINTS} from './post-dry-receiving-inverse.js';")
s=s.replace("filledTargets.length*6+UNFILLED_DRAIN_MAXIMUM_PROPOSALS;","filledTargets.length*6+UNFILLED_DRAIN_MAXIMUM_PROPOSALS+(FILLED_Q_POINTS+1)*3;",1)
needle="\n/** Reserve the complete old method"
helper="""
function phaseInput(project,selection,source){
  const w=project.weather;
  return {rainMmHr:w.rainMmHr,infiltrationMmHr:SURFACES[selection.surface].infiltrationMmHr,stormMinutes:w.stormMinutes,
    stormEndDepthMm:source.storm?.reading.depthMm,stormUncertaintyMm:source.storm?.reading.uncertaintyMm,
    areaM2:project[selection.target].filter(cell=>cell.surface===selection.surface).length*w.cellSizeM**2,
    readings:source.retained.map(row=>row.reading),drainedReadings:source.drained.map(row=>row.reading)};
}
"""
assert s.count(needle)==1;s=s.replace(needle,"\n"+helper+needle)
old="""  const refineDrain=source.drained.some(row=>row.reading.minute>0);
  const maximumPhaseProposals=source.hasPhaseSource?filledTargets.length*6+(refineDrain?UNFILLED_DRAIN_MAXIMUM_PROPOSALS:UNFILLED_RECEIVING_MAXIMUM_PROPOSALS):0;"""
new="""  const refineDrain=source.drained.some(row=>row.reading.minute>0),input=phaseInput(project,selection,source);
  const unfilledPossible=source.hasPhaseSource&&unfilledReceivingSurfaceCourse(input).possible;
  const filledDrain=reserveFilledDrainBandWork(input);
  const maximumPhaseProposals=source.hasPhaseSource?filledTargets.length*6+(unfilledPossible?(refineDrain?UNFILLED_DRAIN_MAXIMUM_PROPOSALS:UNFILLED_RECEIVING_MAXIMUM_PROPOSALS):0)+filledDrain.maximumProposals:0;"""
assert s.count(old)==1;s=s.replace(old,new)
s=s.replace("const phaseRateEvaluations=source.hasPhaseSource?(refineDrain?UNFILLED_DRAIN_RATE_EVALUATIONS:UNFILLED_RECEIVING_RATE_POINTS):0;","const phaseRateEvaluations=unfilledPossible?(refineDrain?UNFILLED_DRAIN_RATE_EVALUATIONS:UNFILLED_RECEIVING_RATE_POINTS):0;",1)
s=s.replace("incumbent.totalCellEquivalentSteps+finalGridCellSteps+phaseRootEvaluations+phaseBandIntersections;","incumbent.totalCellEquivalentSteps+finalGridCellSteps+phaseRootEvaluations+phaseBandIntersections+filledDrain.qEvaluations+filledDrain.bandIntersections+filledDrain.modelEvaluations;",1)
s=s.replace("return {incumbent,maximumPhaseProposals,finalGridChecks,finalGridCellSteps,phaseRootEvaluations,phaseRateEvaluations,phaseBandIntersections,","return {incumbent,maximumPhaseProposals,finalGridChecks,finalGridCellSteps,phaseRootEvaluations,phaseRateEvaluations,phaseBandIntersections,filledDrain,unfilledPossible,",1)
s=s.replace("phaseUniqueParameters:0,finalOriginalGridChecks:0};","phaseUniqueParameters:0,finalOriginalGridChecks:0,filledDrainQEvaluations:0,filledDrainModelEvaluations:0,filledDrainBandIntersections:0};",1)
s=s.replace("  let unfilled=null;","  let unfilled=null,filledDrain=null;",1)
s=s.replace("'Never-filled receiver witness '+(phases.length+1):'Filled receiver band-point witness '+(phases.length+1)","'Never-filled receiver witness '+(phases.length+1):origin.family==='filled-drain'?'Filled receiver from original drainage '+(phases.length+1):'Filled receiver band-point witness '+(phases.length+1)",1)
s=s.replace(":'Conditional filled receiver from computational points inside original calibration bands, not substituted observations.'",":origin.family==='filled-drain'?'Conditional filled receiver generated from original retained and drainage calibration bands; no observations are replaced.':'Conditional filled receiver from computational points inside original calibration bands, not substituted observations.'",1)
needle="    if(!unfilled.proposals.length)refusals.push({family:'unfilled',reason:unfilled.reason??unfilled.status});"
append="""
    if(reservation.filledDrain.maximumProposals){
      counts.phaseInverseCalls++;
      filledDrain=proposeFilledDrainBandWitnesses(phaseInput(project,selection,source));
      counts.filledDrainQEvaluations=filledDrain.counts?.qEvaluations??0;
      counts.filledDrainModelEvaluations=filledDrain.counts?.modelEvaluations??0;
      counts.filledDrainBandIntersections=filledDrain.counts?.bandIntersections??0;
      if(counts.filledDrainQEvaluations>reservation.filledDrain.qEvaluations||counts.filledDrainModelEvaluations>reservation.filledDrain.modelEvaluations||counts.filledDrainBandIntersections>reservation.filledDrain.bandIntersections)
        throw Error('The complete original-drainage filled-course reservation was exceeded.');
      for(const h of filledDrain.proposals)keep(h,{family:'filled-drain',surfaceRows:[storm.index],
        accountIndices:[...source.retained,...source.drained].map(row=>row.index).sort((a,b)=>a-b),
        phase:h.phase,fullStoreRateMmHr:h.fullStoreRateMmHr,fillMinute:h.fillMinute,dryMinute:h.dryMinute,
        rateInterval:h.rateInterval,rateFraction:h.rateFraction,endpointInsetPerHour:h.endpointInsetPerHour,qOrigin:h.qOrigin,
        meaning:'Original retained and cumulative-drainage bands constrain the same conditional filled course. Bounded computational parameters are not additional observations, an exhaustive enclosure or identified physical properties.'});
      if(!filledDrain.proposals.length)refusals.push({family:'filled-drain',reason:filledDrain.reason??filledDrain.status});
    }
"""
assert s.count(needle)==1;s=s.replace(needle,needle+append)
s=s.replace("...refusals],unfilled,candidates,compatibleIds","...refusals],unfilled,filledDrain,candidates,compatibleIds",1)
p.write_text(s)
p=r/'receiving-account-proposals-panel.js';s=p.read_text()
s=s.replace("'Unresolved '+refused.phase+': '","'Unresolved '+(refused.phase??refused.family??'proposal')+': '")
needle="        if(report.schema===RECEIVING_ACCOUNT_PHASE_SCHEMA)details.append(node('p','Phase work reserves '+report.reservation.maximumPhaseProposals+' possible extra models, '+report.reservation.phaseRootEvaluations+' bounded inverse root evaluations, '+report.reservation.phaseBandIntersections+' band intersections and '+report.reservation.finalGridChecks+' final original-grid checks.'));"
assert s.count(needle)==1;s=s.replace(needle,needle+"\n        if(report.reservation.filledDrain?.maximumProposals)details.append(node('p','The filled-course drainage search additionally reserves '+report.reservation.filledDrain.qEvaluations+' full-store-rate points and '+report.reservation.filledDrain.modelEvaluations+' monotone original-band model evaluations before any fitting.'));")
needle="          if(origin.family==='unfilled')details.append"
assert s.count(needle)==1;s=s.replace(needle,"          if(origin.family==='filled-drain')details.append(node('p','Conditional full-store drainage '+fmt(origin.fullStoreRateMmHr)+' mm/hour; fill minute '+fmt(origin.fillMinute)+'; surface dry minute '+fmt(origin.dryMinute)+'. Computational decay-rate intersection '+origin.rateInterval.map(fmt).join(' to ')+' /hour; this is not a certified parameter enclosure.'));\n"+needle)
p.write_text(s)
print(json.dumps({n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['post-dry-receiving-inverse.js','receiving-account-phase-fit.js','receiving-account-proposals-panel.js']}))
