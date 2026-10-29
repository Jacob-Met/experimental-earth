import { node, number, point, table, phaseFigure } from './shade-heat-epoch-view.js';

const component=value=>value==='surfaceC'?'ground surface':'lower heat store';
export function drawThreeEpochWitness(host,{report:r,readings,witnessId}) {
  const w=r.witnesses.find(value=>value.id===witnessId);if(!w)throw Error('Unknown original-time witness');
  host.replaceChildren();host.dataset.witness=String(w.id);host.dataset.support=w.masses.flatMap((mass,i)=>BigInt(mass.exact.numerator)?[i]:[]).join(',');
  const phases=phaseFigure(w);
  phases.querySelectorAll('figcaption').forEach((caption,i)=>{caption.textContent=['Epoch1 · before '+r.splitUtcs[0],'Epoch2 · '+r.splitUtcs[0]+' to '+r.splitUtcs[1],'Epoch3 · after '+r.splitUtcs[1]][i];});
  host.append(node('h3','Three fixed profiles through every original observation'),
    node('p','The same three profiles supply every original receiver and both designs. The two original changes are '+r.splitUtcs.join(' and ')+'.'),phases);
  const exactTable=table('Original bands and the exact additive model, displayed approximately in C',
    ['Record / point','Original UTC','Component','Additive value','Original band'],r.readings.map((reading,i)=>[
      (i+1)+' / '+point(readings[i]),reading.utc,component(reading.store),number(w.observedC[i].lower),
      String(reading.temperatureC)+' ± '+String(reading.halfWidthC)]));
  exactTable.id='three-observation-model';host.append(exactTable);
  const outside=w.originalObservations.some(replay=>Object.values(replay.endpointStatus).includes('outside-original-band'));
  const notice=node('p',outside?'An original numerical replay endpoint at an observation time lies outside its original band. The exact additive model is compatible; this numerical replay is a separate result.'
    :'Every separately replayed original observation endpoint lies within its original band for this witness. This is a numerical check, not physical validation.');
  notice.id='three-replay-note';notice.className=outside?'replay-note outside':'replay-note';notice.dataset.replay=outside?'outside-original-band':'within-original-band';host.append(notice);
  const replayTable=table('Original numerical replay at each actual observation time',
    ['Record / point','Original UTC','Component','Original lower / upper C','Original band status'],w.originalObservations.map((replay,i)=>[
      (i+1)+' / '+point(readings[i]),replay.utc,component(replay.store),
      String(replay.originalC.lower)+' / '+String(replay.originalC.upper),
      Object.values(replay.endpointStatus).every(x=>x==='within-original-band')?'within original band':'outside original band']));
  replayTable.id='three-observation-replay';host.append(replayTable);
  host.append(node('p','Largest computed replay discrepancy from this additive witness: ≤ '+number(w.maximumReplayResidualC.upper)+' C. This is not a solver error bound.'));
  const detail=node('details');detail.append(node('summary','Exact profile masses and observation values'));
  w.phaseProfiles.forEach((phase,i)=>{
    detail.append(node('h4','Epoch '+(i+1)+' profile'));
    phase.forEach((weight,bin)=>detail.append(node('p','Bin '+(bin+1)+': '+weight.exact.numerator+' / '+weight.exact.denominator)));
    detail.append(node('p','Separately normalized numerical replay weights: '+w.approximateProfiles[i].weights.join(', ')));
  });
  w.observedC.forEach((v,i)=>detail.append(node('p','Original reading '+(i+1)+' exact additive value: '+v.exact.numerator+' / '+v.exact.denominator+' C.')));
  detail.append(node('p','Each exact marginal profile has total mass one. The internal coupling does not assert an observed sky history.'));host.append(detail);
}
