import {node,number,point,table,phaseFigure} from './shade-heat-epoch-view.js';
import {rational as q,sub} from './vendor/chronos/exact-halfplanes.mjs';
import {profileFraction} from './shade-heat-profile-band.js';

const stores=[['surfaceC','Ground surface'],['subsurfaceC','Lower heat store']];
const fraction=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const exactText=value=>value.exact.numerator+' / '+value.exact.denominator;
const interval=(lower,upper)=>number(lower)+' to '+number(upper);
const patternName=pattern=>pattern.splitUtcs.length?pattern.splitUtcs.join(' · '):'One fixed profile for the whole original course';
const originalLabel=time=>time.utc+' · '+(time.index?'original interval '+time.index:'initial state');
const makeTable=(caption,headings,rows)=>{const result=table(caption,headings,rows);result.classList.add('change-table');return result;};

/** A displayed consequence always belongs to one complete fixed profile.
 * Caller identity and connected-element guards also protect held file reads.
 */
export function drawSkyChangeReport(host,result,isCurrent){
  const {investigation,report:r}=result;
  let selectedPattern=r.alternatives[0]?.patternIndex??null,selectedSource=0,selectedTime=0,selectionVersion=0;
  const active=element=>host.isConnected&&element.isConnected&&isCurrent();
  host.replaceChildren();host.hidden=false;
  Object.assign(host.dataset,{status:r.compatibility,minimum:r.minimumChanges===null?'none':String(r.minimumChanges),
    patterns:String(r.patterns.length),alternatives:String(r.alternatives.length),originalTimes:String(r.originalTimes.length),
    records:String(r.readings.length),sources:String(r.work.uniqueSources)});
  const outcome=node('div');outcome.className='change-outcome';outcome.dataset.status=r.compatibility;
  outcome.append(node('h2',r.compatibility==='compatible'
    ?r.minimumChanges===0?'One fixed profile is compatible with the complete record':r.minimumChanges+' changes are the minimum compatible class'
    :'No compatible pattern in the declared class'),node('p',r.compatibility==='compatible'
    ?r.alternatives.length+' compatible '+(r.alternatives.length===1?'pattern is':'patterns are')+' retained in that class. Every simpler pattern was examined against every original observation.'
    :'Every declared pattern was examined against every original observation. This result concerns the declared model class; it does not establish which physical assumption or observation is responsible.'),
    node('p',r.readings.length+' original records · '+r.work.uniqueSources+' complete receivers · '+r.originalTimes.length+' original times. '+r.unexaminedHigherChangePatterns+' higher-change patterns were not examined.'));
  host.append(outcome);
  const classes=node('div');classes.className='change-classes';
  for(let changes=0;changes<=2;changes++){
    const examined=r.patterns.filter(p=>p.changes===changes),compatible=examined.filter(p=>p.compatibility==='compatible');
    const declared=changes<=r.query.maximumChanges;
    const status=!declared?'outside-declaration':!examined.length?'not-examined':compatible.length?'compatible':'incompatible';
    const card=node('article');card.className='change-class';Object.assign(card.dataset,{changes:String(changes),status,examined:String(examined.length),compatible:String(compatible.length)});
    card.append(node('h3',changes+' '+(changes===1?'change':'changes')),node('strong',status==='outside-declaration'?'Outside the declaration':status==='not-examined'?'Not examined':compatible.length?compatible.length+' compatible':'All incompatible'),
      node('p',!declared?'Increase the declared maximum to include this class.':!examined.length?'A complete simpler class already succeeded.':examined.length+' complete '+(examined.length===1?'pattern was':'patterns were')+' checked.'));
    classes.append(card);
  }host.append(classes);
  host.append(node('p','The shared static and original-step responses define one represented model across every pattern. Phase coefficients are regrouped exactly, so a simpler class stays inside its refinements. Compatibility is not a probability or a measured time of change.'));

  if(r.alternatives.length){
    const label=node('label','Inspect a pattern in the minimum compatible class');label.className='change-pattern-choice';
    const select=node('select');select.id='change-pattern-select';
    for(const alternative of r.alternatives){const option=node('option','Pattern '+(alternative.patternIndex+1)+' · '+patternName(alternative));option.value=String(alternative.patternIndex);select.append(option);}
    select.value=String(selectedPattern);label.append(select);host.append(label);
    const witnessHost=node('section');witnessHost.id='change-witness';witnessHost.className='change-witness';host.append(witnessHost);
    select.addEventListener('input',()=>{
      if(!active(select))return;
      const index=Number(select.value);if(!r.alternatives.some(a=>a.patternIndex===index))return;
      selectedPattern=index;drawAlternative();
    });
    function drawAlternative(){
      const alternative=r.alternatives.find(a=>a.patternIndex===selectedPattern),version=++selectionVersion;
      const guard=element=>version===selectionVersion&&active(element);
      witnessHost.replaceChildren();Object.assign(witnessHost.dataset,{pattern:String(selectedPattern),phases:String(alternative.phaseProfiles.length)});
      witnessHost.append(node('h3','One feasible common profile for this pattern'),node('p','These same profiles supply every original receiver and both designs for the whole course. The displayed temperatures belong to this one feasible choice; they are not the full consequence range for the pattern.'));
      const phases=phaseFigure(alternative),edges=[0,...alternative.splitAfterIntervals,r.originalTimes.length-1];
      phases.querySelectorAll('figcaption').forEach((caption,phase)=>{caption.textContent='Profile '+(phase+1)+' · '+r.originalTimes[edges[phase]].utc+' to '+r.originalTimes[edges[phase+1]].utc;});
      witnessHost.append(phases);
      const selection=node('div');selection.className='change-selection';
      const receiverLabel=node('label','Inspect an original receiver'),receiverSelect=node('select');receiverSelect.id='change-receiver-select';
      for(const replay of alternative.originalReplays){const option=node('option','Receiver '+(replay.sourceIndex+1)+' · point '+point(investigation.readings[replay.representativeReadingIndex]));option.value=String(replay.sourceIndex);receiverSelect.append(option);}
      receiverSelect.value=String(selectedSource);receiverLabel.append(receiverSelect);
      const timeLabel=node('label','Inspect an original time'),timeSelect=node('select');timeSelect.id='change-time-select';
      r.originalTimes.forEach(time=>{const option=node('option',originalLabel(time));option.value=String(time.index);timeSelect.append(option);});
      timeSelect.value=String(selectedTime);timeLabel.append(timeSelect);selection.append(receiverLabel,timeLabel);witnessHost.append(selection);
      const detail=node('div');detail.id='change-time-detail';witnessHost.append(detail);
      receiverSelect.addEventListener('input',()=>{if(!guard(receiverSelect))return;const index=Number(receiverSelect.value);if(!alternative.originalReplays.some(row=>row.sourceIndex===index))return;selectedSource=index;drawTime();});
      timeSelect.addEventListener('input',()=>{if(!guard(timeSelect))return;const index=Number(timeSelect.value);if(!Number.isInteger(index)||!r.originalTimes[index])return;selectedTime=index;drawTime();});
      const outside=alternative.originalObservations.some(row=>Object.values(row.endpointStatus).includes('outside-original-band'));
      const notice=node('p',outside?'An original numerical observation endpoint is outside its original band. Exact represented compatibility and the numerical replay status remain separate.':'Every separately replayed original observation endpoint is within its original band for this profile. This numerical check does not establish physical accuracy.');
      notice.id='change-replay-note';notice.className='replay-note'+(outside?' outside':'');notice.dataset.replay=outside?'outside-original-band':'within-original-band';witnessHost.append(notice);
      const observations=node('details');observations.id='change-observations';observations.append(node('summary','All '+r.readings.length+' original observations under this profile'),
        makeTable('Every original observation retains its band and numerical status',['Record / point','Original UTC / component','Original band °C','Represented value ≈ °C','Original replay lower / upper °C','Original replay status'],
          alternative.originalObservations.map(row=>{const original=r.readings[row.recordIndex];return [row.recordIndex+1+' / '+point(investigation.readings[row.recordIndex]),row.utc+' / '+(row.store==='surfaceC'?'surface':'lower store'),
            String(original.temperatureC)+' ± '+String(original.halfWidthC),number(row.additiveC.lower),String(row.originalC.lower)+' / '+String(row.originalC.upper),Object.values(row.endpointStatus).join(' / ')];})));
      witnessHost.append(observations);
      const profileProof=node('details');profileProof.className='change-proof';profileProof.append(node('summary','Exact profile masses and numerical replay weights'));
      const profileCode=node('pre');profileProof.append(profileCode);
      profileProof.addEventListener('toggle',()=>{if(!guard(profileProof)||!profileProof.open||profileCode.textContent)return;profileCode.textContent=JSON.stringify({phaseProfiles:alternative.phaseProfiles,productMasses:alternative.productMasses,
        normalizedReplays:alternative.originalReplays.map(row=>({sourceIndex:row.sourceIndex,approximateProfiles:row.approximateProfiles,maximumReplayResidualC:row.maximumReplayResidualC}))},null,2);});
      witnessHost.append(profileProof);
      function drawTime(){
        const replay=alternative.originalReplays.find(row=>row.sourceIndex===selectedSource),row=replay.originalCourse[selectedTime];
        detail.replaceChildren();Object.assign(detail.dataset,{pattern:String(selectedPattern),source:String(selectedSource),time:String(selectedTime),utc:row.utc});
        detail.append(node('h4',row.utc+' · point '+point(investigation.readings[replay.representativeReadingIndex])),
          node('p','Original elapsed minutes: '+row.minute+'. Accumulated thermal minutes: '+row.thermalMinute+'. Both clocks are retained; no interpolated observation is introduced.'));
        const values=node('div');values.className='change-values';
        const exactRows=[];
        for(const [store,title]of stores){
          const additive={lower:profileFraction(sub(fraction(row.additiveC.proposal.lower[store]),fraction(row.additiveC.existing.upper[store]))),
            upper:profileFraction(sub(fraction(row.additiveC.proposal.upper[store]),fraction(row.additiveC.existing.lower[store])))};
          const original={lower:profileFraction(sub(q(row.originalC.proposal.lower[store]),q(row.originalC.existing.upper[store]))).lower,
            upper:profileFraction(sub(q(row.originalC.proposal.upper[store]),q(row.originalC.existing.lower[store]))).upper};
          const card=node('article');card.className='change-value';Object.assign(card.dataset,{store,additiveLower:String(additive.lower.lower),additiveUpper:String(additive.upper.upper),originalLower:String(original.lower),originalUpper:String(original.upper)});
          card.append(node('h4',title),node('strong','Proposal − existing: '+interval(additive.lower.lower,additive.upper.upper)+' °C'),
            node('p','Represented paired endpoints for this fixed profile. Negative values mean the proposal is cooler in this calculation.'),
            node('p','Separate original numerical replay: '+interval(original.lower,original.upper)+' °C.'));
          values.append(card);exactRows.push([title,exactText(additive.lower),exactText(additive.upper)]);
        }detail.append(values);
        const endpoints=node('details');endpoints.append(node('summary','All design endpoints and exact paired differences at this time'),
          makeTable('This fixed profile at the selected original receiver and time',['Design','Component','Represented lower / upper ≈ °C','Original numerical lower / upper °C'],
            ['existing','proposal'].flatMap(target=>stores.map(([store,title])=>[target,title,interval(row.additiveC[target].lower[store].lower,row.additiveC[target].upper[store].upper),String(row.originalC[target].lower[store])+' / '+String(row.originalC[target].upper[store])]))),
          makeTable('Exact represented proposal minus existing endpoints',['Component','Lower fraction','Upper fraction'],exactRows));detail.append(endpoints);
      }
      drawTime();
    }
    drawAlternative();
  }

  const patterns=node('details');patterns.id='change-all-patterns';patterns.append(node('summary','Inspect every examined pattern and its exact certificate'));
  patterns.append(makeTable('Every examined pattern; all original observations remain',['Pattern','Changes','Original change UTCs','Compatibility'],r.patterns.map(p=>[p.patternIndex+1,p.changes,patternName(p),p.compatibility])));
  const proofLabel=node('label','Choose an examined pattern'),proofSelect=node('select');proofSelect.id='change-proof-select';
  r.patterns.forEach(pattern=>{const option=node('option','Pattern '+(pattern.patternIndex+1)+' · '+pattern.compatibility+' · '+patternName(pattern));option.value=String(pattern.patternIndex);proofSelect.append(option);});proofLabel.append(proofSelect);patterns.append(proofLabel);
  const proof=node('details');proof.className='change-proof';proof.append(node('summary','Exact matrix, certificate and original numerical checks'));const proofCode=node('pre');proof.append(proofCode);patterns.append(proof);host.append(patterns);
  function drawProof(){
    if(!active(proofSelect)||!proof.open)return;
    const pattern=r.patterns.find(p=>p.patternIndex===Number(proofSelect.value));if(!pattern)return;
    proofCode.textContent=JSON.stringify({coordinateOrder:r.exactEvidence.coordinateOrder,pattern,proof:r.exactEvidence.analysis.cases[pattern.exactProofIndex]},null,2);
    proof.dataset.pattern=String(pattern.patternIndex);
  }
  proofSelect.addEventListener('input',()=>{if(active(proofSelect)){proofCode.textContent='';drawProof();}});proof.addEventListener('toggle',drawProof);
  const work=node('details');work.id='change-work';work.append(node('summary','Complete work, consistency checks and scope'),
    node('p',r.work.executedBasisCourses+' complete basis courses and '+r.work.executedWitnessCourses+' fixed-profile courses executed. '+r.work.reusedCompleteCourses+' requests reused an identical complete bin sequence within its original receiver source.'),
    node('p',r.work.geometryPasses+' original geometry passes; '+r.work.exactSolves+' exact solves, '+r.work.linearPivots+' pivots and '+r.work.linearRationalOperations+' counted solver rational operations. The inquiry reserves its entire declared search before returning a result.'),
    node('p',r.work.combinationStatesScreened+' original combination endpoint/component values were checked against the '+r.numericalEvidence.consistencyScreenC+' °C consistency screen. '+r.work.actualReplayEndpointRows+' fixed-profile receiver/time rows remain inspectable.'),
    node('p',r.numericalEvidence.scope),node('p',r.semantics));host.append(work);
}
