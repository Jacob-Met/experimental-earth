import {node,number,point,table,phaseFigure} from './shade-heat-epoch-view.js';
import {rational as q,sub} from './vendor/chronos/exact-halfplanes.mjs';
import {profileFraction} from './shade-heat-profile-band.js';

const stores=[['surfaceC','Ground surface'],['subsurfaceC','Lower heat store']];
const fraction=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const exactText=value=>value.exact.numerator+' / '+value.exact.denominator;
const interval=(lower,upper)=>number(lower)+' to '+number(upper);
const patternName=pattern=>pattern.splitUtcs.length?pattern.splitUtcs.join(' · '):'One fixed profile for the whole original course';
const originalLabel=time=>time.utc+' · '+(time.index?'original interval '+time.index:'initial state');
const makeTable=(caption,headings,rows)=>{const result=table(caption,headings,rows);result.classList.add('joint-table');return result;};
const requirementName=index=>index===0?'A':'B';
const rule=target=>(target.relation==='at-most'?'Upper endpoint ≤ ':'Lower endpoint ≥ ')+String(target.differenceC)+' °C';
const entryFor=(pattern,kind)=>kind==='joint'?pattern.joint:pattern.individual[kind==='a'?0:1];
const entryName=kind=>kind==='joint'?'Both requirements together':'Requirement '+(kind==='a'?'A':'B')+' separately';

/** Every displayed course belongs to one retained common profile.
 * No individual witnesses or different tied patterns are combined.
 */
export function drawSkyJointReport(host,result,isCurrent){
 const {investigation,report:r}=result;
 let selectedPattern=r.alternatives[0]?.patternIndex??null,selectedKind='joint',
  selectedSource=r.requirements[0].sourceIndex,selectedTime=r.requirements[0].originalIndex,selectionVersion=0;
 const active=element=>host.isConnected&&element.isConnected&&isCurrent();
 host.replaceChildren();host.hidden=false;
 Object.assign(host.dataset,{status:r.compatibility,joint:r.jointStatus,minimum:r.minimumChanges===null?'none':String(r.minimumChanges),
  patterns:String(r.patterns.length),alternatives:String(r.alternatives.length),originalTimes:String(r.originalTimes.length),
  records:String(r.readings.length),sources:String(r.work.uniqueSources)});
 const outcome=node('div');outcome.className='joint-outcome';outcome.dataset.status=r.compatibility;
 outcome.append(node('h2',r.compatibility==='compatible'?(r.minimumChanges===0?'One fixed profile is compatible with the complete original record':r.minimumChanges+' changes are the original minimum compatible class'):'No original-compatible pattern in the declared class'),
  node('p',r.compatibility==='compatible'?r.alternatives.length+' compatible '+(r.alternatives.length===1?'pattern is':'patterns are')+' retained. Every simpler pattern was examined before either requirement was applied.':'Every declared pattern was examined against every original observation. Requirements are unevaluated because the original compatible family is empty.'),
  node('p',r.readings.length+' original records · '+r.work.uniqueSources+' receivers · '+r.originalTimes.length+' original times. '+r.unexaminedHigherChangePatterns+' higher-change patterns were not examined.'));
 host.append(outcome);
 const verdict=node('section');verdict.id='joint-verdict';verdict.className='joint-verdict';
 Object.assign(verdict.dataset,{joint:r.jointStatus,a:r.individual?.[0].status??'unevaluated',b:r.individual?.[1].status??'unevaluated',
  jointPatterns:JSON.stringify(r.jointPatternIndices),aPatterns:JSON.stringify(r.individual?.[0].patternIndices??null),bPatterns:JSON.stringify(r.individual?.[1].patternIndices??null)});
 const both=r.individual?.every(item=>item.status==='compatible');
 const title=r.jointStatus==='original-incompatible'?'Requirements are unevaluated':r.jointStatus==='joint-compatible'?'A common profile can meet both requirements':both?'Each requirement is possible separately; no common profile meets both':'The two requirements have no common compatible profile';
 verdict.append(node('h3',title),node('p',r.jointStatus==='original-incompatible'?'There is no original-compatible profile on which to evaluate individual or joint requirement membership.':r.jointStatus==='joint-compatible'?
  'Both whole represented intervals meet their requirements under one profile in '+r.jointPatternIndices.length+' retained '+(r.jointPatternIndices.length===1?'pattern.':'patterns.') :
  both?'Each requirement has its own feasible witness, but every original minimum pattern has an exact contradiction for their conjunction. Those separate histories cannot be combined.':
  'At least one requirement is impossible throughout the original minimum class. Each individual result and each pattern’s joint contradiction remain inspectable.'));
 const requirementTable=makeTable('Both declarations stay bound to original receiver/time/component identities',['Requirement','Original target','Whole-interval condition','Individual result','All individually compatible patterns'],r.requirements.map((target,index)=>[
  requirementName(index),'Receiver '+(target.sourceIndex+1)+' · point '+point(investigation.readings[target.receiverReadingIndex])+' · '+target.utc+' · '+(target.store==='surfaceC'?'surface':'lower store'),
  rule(target),r.individual?(r.individual[index].status==='compatible'?'Some profile meets it':'No profile meets it'):'Unevaluated',
  r.individual?(r.individual[index].patternIndices.map(i=>i+1).join(', ')||'None'):'Unevaluated']));
 requirementTable.id='joint-requirements';verdict.append(requirementTable,
  node('p','Joint-compatible patterns: '+(r.jointStatus==='original-incompatible'?'unevaluated':r.jointPatternIndices.map(i=>i+1).join(', ')||'none')+'. Equality is included. Individual feasibility does not imply simultaneous feasibility.'),
  node('p','These are conditional represented-model results. A feasible profile does not prove a physically realizable sky history, correlated uncertainty or a physical intervention benefit.'));
 if(r.alternatives.length){
  const cases=makeTable('Every compatible original minimum pattern retains all three answers',['Pattern / original changes','A separately','B separately','Both together','Maximum lower − upper ≈ °C, A / B'],r.alternatives.map(a=>[
   'Pattern '+(a.patternIndex+1)+' · '+patternName(a),a.individual[0].compatibility,a.individual[1].compatibility,a.joint.compatibility,a.maximumLowerMinusUpperC.map(value=>number(value.upper)).join(' / ')]));
  cases.id='joint-pattern-results';Array.from(cases.querySelectorAll('tbody tr')).forEach((row,i)=>{const a=r.alternatives[i];Object.assign(row.dataset,{pattern:String(a.patternIndex),a:a.individual[0].compatibility,b:a.individual[1].compatibility,joint:a.joint.compatibility,orderA:String(a.maximumLowerMinusUpperC[0].upper),orderB:String(a.maximumLowerMinusUpperC[1].upper)});});
  verdict.append(cases,node('p','Each endpoint-order proof covers the entire original feasible pattern before adding either requirement. Displayed decimals are rounded approximations; exact fractions and outward numerical enclosures remain in the evidence.'));
 }
 const inquiryProof=node('details');inquiryProof.className='joint-proof';inquiryProof.id='joint-requirement-proof';inquiryProof.append(node('summary','Exact requirements, complete pattern sets and joint certificates'));
 const inquiryCode=node('pre');inquiryProof.append(inquiryCode);
 inquiryProof.addEventListener('toggle',()=>{if(!active(inquiryProof)||!inquiryProof.open||inquiryCode.textContent)return;inquiryCode.textContent=JSON.stringify({requirements:r.requirements,requirementIntervalRows:r.exactEvidence.requirementIntervalRows,individual:r.individual,jointPatternIndices:r.jointPatternIndices,cases:r.exactEvidence.result.cases},null,2);});
 verdict.append(inquiryProof);host.append(verdict);
  const classes=node('div');classes.className='joint-classes';
  for(let changes=0;changes<=2;changes++){
    const examined=r.patterns.filter(p=>p.changes===changes),compatible=examined.filter(p=>p.compatibility==='compatible');
    const declared=changes<=r.query.maximumChanges;
    const status=!declared?'outside-declaration':!examined.length?'not-examined':compatible.length?'compatible':'incompatible';
    const card=node('article');card.className='joint-class';Object.assign(card.dataset,{changes:String(changes),status,examined:String(examined.length),compatible:String(compatible.length)});
    card.append(node('h3',changes+' '+(changes===1?'change':'changes')),node('strong',status==='outside-declaration'?'Outside the declaration':status==='not-examined'?'Not examined':compatible.length?compatible.length+' compatible':'All incompatible'),
      node('p',!declared?'Increase the declared maximum to include this class.':!examined.length?'A complete simpler class already succeeded.':examined.length+' complete '+(examined.length===1?'pattern was':'patterns were')+' checked.'));
    classes.append(card);
  }host.append(classes);
  host.append(node('p','The shared static and original-step responses define one represented model across every pattern. Phase coefficients are regrouped exactly, so a simpler class stays inside its refinements. Compatibility is not a probability or a measured time of change.'));

 if(r.alternatives.length){
  const label=node('label','Inspect a pattern in the original minimum class');label.className='joint-pattern-choice';
  const select=node('select');select.id='joint-pattern-select';
  for(const alternative of r.alternatives){const option=node('option','Pattern '+(alternative.patternIndex+1)+' · '+patternName(alternative));option.value=String(alternative.patternIndex);select.append(option);}
  select.value=String(selectedPattern);label.append(select);host.append(label);
  const kindLabel=node('label','Inspect an individual result or their conjunction');kindLabel.className='joint-pattern-choice';
  const kindSelect=node('select');kindSelect.id='joint-result-select';
  for(const kind of ['joint','a','b']){const option=node('option',entryName(kind));option.value=kind;kindSelect.append(option);}
  kindSelect.value=selectedKind;kindLabel.append(kindSelect);host.append(kindLabel);
  const witnessHost=node('section');witnessHost.id='joint-witness';witnessHost.className='joint-witness';host.append(witnessHost);
  kindSelect.addEventListener('input',()=>{if(!active(kindSelect)||!['a','b','joint'].includes(kindSelect.value))return;selectedKind=kindSelect.value;drawAlternative();});
  select.addEventListener('input',()=>{if(!active(select))return;const index=Number(select.value);if(!r.alternatives.some(a=>a.patternIndex===index))return;selectedPattern=index;drawAlternative();});
  function drawAlternative(){
   const pattern=r.alternatives.find(a=>a.patternIndex===selectedPattern),entry=entryFor(pattern,selectedKind),alternative=entry.witness,version=++selectionVersion;
   const guard=element=>version===selectionVersion&&active(element);
   witnessHost.replaceChildren();Object.assign(witnessHost.dataset,{pattern:String(selectedPattern),kind:selectedKind,compatibility:entry.compatibility,phases:String(alternative?.phaseProfiles.length??0)});
   witnessHost.append(node('h3',entryName(selectedKind)+' · pattern '+(selectedPattern+1)));
   const exactCase=r.exactEvidence.result.cases.find(c=>c.patternIndex===selectedPattern),exactEntry=selectedKind==='joint'?exactCase.joint:exactCase.individual[selectedKind==='a'?0:1];
   const certificate=node('details');certificate.className='joint-proof';certificate.id='joint-selected-certificate';certificate.append(node('summary',alternative?'Exact common-profile feasibility certificate':'Exact contradiction for this requirement set'));
   const certificateCode=node('pre');certificate.append(certificateCode);
   certificate.addEventListener('toggle',()=>{if(!guard(certificate)||!certificate.open||certificateCode.textContent)return;certificateCode.textContent=JSON.stringify({patternIndex:selectedPattern,splits:exactCase.splits,endpointOrder:exactCase.endpointOrder,requirementResult:exactEntry},null,2);});
   if(!alternative){
    witnessHost.append(node('p','No common profile in this original pattern meets '+(selectedKind==='joint'?'both whole-interval requirements.':selectedKind==='a'?'requirement A.':'requirement B.')+' The exact augmented-matrix contradiction is retained. There is no witness course for this result.'),certificate);return;
   }
   witnessHost.append(node('p','This is one common profile for every original receiver and both designs across the whole course. It meets '+(selectedKind==='joint'?'both requirements.':'requirement '+(selectedKind==='a'?'A':'B')+'; the other requirement is shown separately below.')+' It is a feasibility witness, not a unique or optimized physical history.'));
   const phases=phaseFigure(alternative),edges=[0,...pattern.splitAfterIntervals,r.originalTimes.length-1];
   phases.querySelectorAll('figcaption').forEach((caption,phase)=>{caption.textContent='Profile '+(phase+1)+' · '+r.originalTimes[edges[phase]].utc+' to '+r.originalTimes[edges[phase+1]].utc;});witnessHost.append(phases);
   const values=makeTable('Both requirements under this same profile',['Requirement / condition','Represented interval ≈ °C','Exact represented status','Original numerical interval ≈ °C','Original numerical status'],
    alternative.requirements.map(item=>[requirementName(item.requirementIndex)+' · '+rule(r.requirements[item.requirementIndex]),
     interval(item.representedPairC.lower.lower,item.representedPairC.upper.upper),item.representedStatus,
     interval(item.originalNumericalPairC.lower.lower,item.originalNumericalPairC.upper.upper),item.originalNumericalStatus]));
   values.id='joint-witness-requirements';Array.from(values.querySelectorAll('tbody tr')).forEach((row,index)=>{const item=alternative.requirements[index];
    Object.assign(row.dataset,{requirement:String(item.requirementIndex),represented:item.representedStatus,numerical:item.originalNumericalStatus,
     representedLower:String(item.representedPairC.lower.lower),representedUpper:String(item.representedPairC.upper.upper),
     numericalLower:String(item.originalNumericalPairC.lower.lower),numericalUpper:String(item.originalNumericalPairC.upper.upper)});});
   witnessHost.append(values,node('p','The requirement statuses use exact fractions. Rounded displays may look equal while the exact status differs. Original numerical statuses are separate and do not replace the represented-model certificate.'));
   const selection=node('div');selection.className='joint-selection';
   const receiverLabel=node('label','Inspect an original receiver'),receiverSelect=node('select');receiverSelect.id='joint-receiver-select';
   for(const replay of alternative.originalReplays){const option=node('option','Receiver '+(replay.sourceIndex+1)+' · point '+point(investigation.readings[replay.representativeReadingIndex]));option.value=String(replay.sourceIndex);receiverSelect.append(option);}
   receiverSelect.value=String(selectedSource);receiverLabel.append(receiverSelect);
   const timeLabel=node('label','Inspect an original time'),timeSelect=node('select');timeSelect.id='joint-time-select';
   r.originalTimes.forEach(time=>{const option=node('option',originalLabel(time));option.value=String(time.index);timeSelect.append(option);});
   timeSelect.value=String(selectedTime);timeLabel.append(timeSelect);selection.append(receiverLabel,timeLabel);witnessHost.append(selection);
   const detail=node('div');detail.id='joint-time-detail';witnessHost.append(detail);
   receiverSelect.addEventListener('input',()=>{if(!guard(receiverSelect))return;const index=Number(receiverSelect.value);if(!alternative.originalReplays.some(row=>row.sourceIndex===index))return;selectedSource=index;drawTime();});
   timeSelect.addEventListener('input',()=>{if(!guard(timeSelect))return;const index=Number(timeSelect.value);if(!Number.isInteger(index)||!r.originalTimes[index])return;selectedTime=index;drawTime();});
   const outside=alternative.originalObservations.some(row=>Object.values(row.endpointStatus).includes('outside-original-band'));
   const notice=node('p',outside?'An original numerical observation endpoint is outside its original band. Exact represented compatibility and the numerical replay status remain separate.':'Every separately replayed original observation endpoint is within its original band for this profile. This numerical check does not establish physical accuracy.');
   notice.id='joint-replay-note';notice.className='replay-note'+(outside?' outside':'');notice.dataset.replay=outside?'outside-original-band':'within-original-band';witnessHost.append(notice);
   const observations=node('details');observations.id='joint-observations';observations.append(node('summary','All '+r.readings.length+' original observations under this profile'),
    makeTable('Every original observation retains its band and numerical status',['Record / point','Original UTC / component','Original band °C','Represented value ≈ °C','Original replay lower / upper °C','Original replay status'],
     alternative.originalObservations.map(row=>{const original=r.readings[row.recordIndex];return [row.recordIndex+1+' / '+point(investigation.readings[row.recordIndex]),row.utc+' / '+(row.store==='surfaceC'?'surface':'lower store'),
      String(original.temperatureC)+' ± '+String(original.halfWidthC),number(row.additiveC.lower),String(row.originalC.lower)+' / '+String(row.originalC.upper),Object.values(row.endpointStatus).join(' / ')];})));
   witnessHost.append(observations,certificate);
   const profileProof=node('details');profileProof.className='joint-proof';profileProof.append(node('summary','Exact profile masses and numerical replay weights'));const profileCode=node('pre');profileProof.append(profileCode);
   profileProof.addEventListener('toggle',()=>{if(!guard(profileProof)||!profileProof.open||profileCode.textContent)return;profileCode.textContent=JSON.stringify({phaseProfiles:alternative.phaseProfiles,productMasses:alternative.productMasses,
    requirements:alternative.requirements,normalizedReplays:alternative.originalReplays.map(row=>({sourceIndex:row.sourceIndex,approximateProfiles:row.approximateProfiles,maximumReplayResidualC:row.maximumReplayResidualC}))},null,2);});witnessHost.append(profileProof);
   function drawTime(){
    const replay=alternative.originalReplays.find(row=>row.sourceIndex===selectedSource),row=replay.originalCourse[selectedTime];
    detail.replaceChildren();Object.assign(detail.dataset,{pattern:String(selectedPattern),kind:selectedKind,source:String(selectedSource),time:String(selectedTime),utc:row.utc});
    detail.append(node('h4',row.utc+' · point '+point(investigation.readings[replay.representativeReadingIndex])),
     node('p','Original elapsed minutes: '+row.minute+'. Accumulated thermal minutes: '+row.thermalMinute+'. Both clocks are retained; no interpolated observation is introduced.'));
    const values=node('div');values.className='joint-values';const exactRows=[];
    for(const [store,title]of stores){
     const additive={lower:profileFraction(sub(fraction(row.additiveC.proposal.lower[store]),fraction(row.additiveC.existing.upper[store]))),
      upper:profileFraction(sub(fraction(row.additiveC.proposal.upper[store]),fraction(row.additiveC.existing.lower[store])))};
     const original={lower:profileFraction(sub(q(row.originalC.proposal.lower[store]),q(row.originalC.existing.upper[store]))).lower,
      upper:profileFraction(sub(q(row.originalC.proposal.upper[store]),q(row.originalC.existing.lower[store]))).upper};
     const card=node('article');card.className='joint-value';Object.assign(card.dataset,{store,additiveLower:String(additive.lower.lower),additiveUpper:String(additive.upper.upper),originalLower:String(original.lower),originalUpper:String(original.upper)});
     card.append(node('h4',title),node('strong','Proposal − existing: ≈ '+interval(additive.lower.lower,additive.upper.upper)+' °C'),
      node('p','Represented paired endpoints for this fixed profile. Negative values mean the proposal is cooler in this calculation.'),
      node('p','Separate original numerical replay: ≈ '+interval(original.lower,original.upper)+' °C.'));values.append(card);exactRows.push([title,exactText(additive.lower),exactText(additive.upper)]);
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
  const patterns=node('details');patterns.id='joint-all-patterns';patterns.append(node('summary','Inspect every examined pattern and its exact certificate'));
  patterns.append(makeTable('Every examined pattern; all original observations remain',['Pattern','Changes','Original change UTCs','Compatibility'],r.patterns.map(p=>[p.patternIndex+1,p.changes,patternName(p),p.compatibility])));
  const proofLabel=node('label','Choose an examined pattern'),proofSelect=node('select');proofSelect.id='joint-proof-select';
  r.patterns.forEach(pattern=>{const option=node('option','Pattern '+(pattern.patternIndex+1)+' · '+pattern.compatibility+' · '+patternName(pattern));option.value=String(pattern.patternIndex);proofSelect.append(option);});proofLabel.append(proofSelect);patterns.append(proofLabel);
  const proof=node('details');proof.className='joint-proof';proof.append(node('summary','Exact matrix, certificate and original numerical checks'));const proofCode=node('pre');proof.append(proofCode);patterns.append(proof);host.append(patterns);
  function drawProof(){
    if(!active(proofSelect)||!proof.open)return;
    const pattern=r.patterns.find(p=>p.patternIndex===Number(proofSelect.value));if(!pattern)return;
    proofCode.textContent=JSON.stringify({coordinateOrder:r.exactEvidence.coordinateOrder,pattern,proof:r.exactEvidence.result.analysis.cases[pattern.exactProofIndex]},null,2);
    proof.dataset.pattern=String(pattern.patternIndex);
  }
  proofSelect.addEventListener('input',()=>{if(active(proofSelect)){proofCode.textContent='';drawProof();}});proof.addEventListener('toggle',drawProof);
  const work=node('details');work.id='joint-work';work.append(node('summary','Complete work, consistency checks and scope'),
    node('p',r.work.executedBasisCourses+' complete basis courses and '+r.work.executedWitnessCourses+' fixed-profile courses executed. '+r.work.reusedCompleteCourses+' requests reused an identical complete bin sequence within its original receiver source.'),
    node('p',r.work.geometryPasses+' original geometry passes; '+r.work.exactSolves+' exact solves, '+r.work.exactObjectives+' endpoint-order objectives, '+r.work.linearPivots+' pivots and '+r.work.linearRationalOperations+' counted solver rational operations. The inquiry reserves its entire declared search before returning a result.'),
    node('p',r.work.combinationStatesScreened+' original combination endpoint/component values were checked against the '+r.numericalEvidence.consistencyScreenC+' °C consistency screen. '+r.work.actualReplayEndpointRows+' common-profile receiver/time rows remain inspectable.'),
    node('p','Work counts are recorded by the fresh computation. Certificate verification checks their arithmetic and declared ceilings; the certificates do not independently prove the actual execution counts.'),
    node('p',r.numericalEvidence.scope),node('p',r.semantics));host.append(work);
}
