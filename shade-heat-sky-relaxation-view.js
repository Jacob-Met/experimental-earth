import {node,number,point,table,phaseFigure} from './shade-heat-epoch-view.js';
import {rational as q,sub} from './vendor/chronos/exact-halfplanes.mjs';
import {profileFraction} from './shade-heat-profile-band.js';

const stores=[['surfaceC','Ground surface'],['subsurfaceC','Lower heat store']];
const fraction=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const exactText=value=>value.exact.numerator+' / '+value.exact.denominator;
const interval=(lower,upper)=>number(lower)+' to '+number(upper);
const patternName=pattern=>pattern.splitUtcs.length?pattern.splitUtcs.join(' · '):'One fixed profile for the whole original course';
const originalLabel=time=>time.utc+' · '+(time.index?'original interval '+time.index:'initial state');
const makeTable=(caption,headings,rows)=>{const result=table(caption,headings,rows);result.classList.add('relaxation-table');return result;};
const requirementName=index=>index===0?'A':'B';

export function skyRelaxationAmountText(value){
 const numerator=BigInt(value.exact.numerator),denominator=BigInt(value.exact.denominator);
 if(numerator===0n)return '0';
 if(numerator<0n||denominator<=0n)throw Error('A displayed common relaxation must be nonnegative');
 let exponent=numerator.toString().length-denominator.toString().length;
 if(exponent>=0?numerator<denominator*10n**BigInt(exponent):numerator*10n**BigInt(-exponent)<denominator)exponent--;
 const shift=6-exponent,scaled=shift>=0?numerator*10n**BigInt(shift)/denominator:numerator/(denominator*10n**BigInt(-shift));
 const digits=scaled.toString().padStart(7,'0');
 if(exponent>=-2&&exponent<=3)return String(Number(scaled)*10**(exponent-6));
 return digits[0]+'.'+digits.slice(1)+'e'+String(exponent);
}

const rule=target=>(target.relation==='at-most'?'Upper endpoint ≤ ':'Lower endpoint ≥ ')+String(target.differenceC)+' °C';

/** Every displayed course belongs to one retained common profile.
 * Every original minimum pattern retains its own optimum; no different patterns are combined.
 */
export function drawSkyRelaxationReport(host,result,isCurrent){
 const {investigation,report:r}=result;
 let selectedPattern=r.attainingPatternIndices[0]??r.alternatives[0]?.patternIndex??null,selectedKind='optimal',
  selectedSource=r.requirements[0].sourceIndex,selectedTime=r.requirements[0].originalIndex,selectionVersion=0;
 const active=element=>host.isConnected&&element.isConnected&&isCurrent();
 host.replaceChildren();host.hidden=false;
 Object.assign(host.dataset,{status:r.compatibility,relaxation:r.relaxationStatus,minimum:r.minimumChanges===null?'none':String(r.minimumChanges),
  patterns:String(r.patterns.length),alternatives:String(r.alternatives.length),originalTimes:String(r.originalTimes.length),
  records:String(r.readings.length),sources:String(r.work.uniqueSources)});
 const outcome=node('div');outcome.className='relaxation-outcome';outcome.dataset.status=r.compatibility;
 outcome.append(node('h2',r.compatibility==='compatible'?(r.minimumChanges===0?'One fixed profile is compatible with the complete original record':r.minimumChanges+' changes are the original minimum compatible class'):'No original-compatible pattern in the declared class'),
  node('p',r.compatibility==='compatible'?r.alternatives.length+' compatible '+(r.alternatives.length===1?'pattern is':'patterns are')+' retained. Every simpler pattern was examined before either requirement was applied.':'Every declared pattern was examined against every original observation. Requirements are unevaluated because the original compatible family is empty.'),
  node('p',r.readings.length+' original records · '+r.work.uniqueSources+' receivers · '+r.originalTimes.length+' original times. '+r.unexaminedHigherChangePatterns+' higher-change patterns were not examined.'));
 host.append(outcome);
 const verdict=node('section');verdict.id='relaxation-verdict';verdict.className='relaxation-verdict';
 Object.assign(verdict.dataset,{relaxation:r.relaxationStatus,originalCompatible:r.originalRequirementsCompatible===null?'unevaluated':String(r.originalRequirementsCompatible),
  attainingPatterns:JSON.stringify(r.attainingPatternIndices),zeroPatterns:JSON.stringify(r.zeroCompatiblePatternIndices),
  delta:r.minimumRelaxationC?exactText(r.minimumRelaxationC):'unevaluated'});
 const title=r.minimumRelaxationC===null?'No relaxation result for an empty original family':r.originalRequirementsCompatible?'Both original requirements can be met with zero relaxation':'Global minimum common relaxation: ≈ '+skyRelaxationAmountText(r.minimumRelaxationC)+' °C';
 verdict.append(node('h3',title),node('p',r.minimumRelaxationC===null?'No profile satisfies the original observations in the declared class, so the common relaxation is unevaluated. It is not zero.':
  r.originalRequirementsCompatible?'At least one pattern in the original minimum class admits both declared whole-interval requirements under the same profile.':
  'This is the least shared amount that allows one common profile to meet both relaxed requirements in the original minimum class. Positive relaxation means the original conjunction is still incompatible; the rounded amount is not used to decide zero.'));
 const requirementTable=makeTable('The original declarations remain unchanged',['Requirement','Original target','Original whole-interval condition','Declared basis'],r.requirements.map((target,index)=>[
  requirementName(index),'Receiver '+(target.sourceIndex+1)+' · point '+point(investigation.readings[target.receiverReadingIndex])+' · '+target.utc+' · '+(target.store==='surfaceC'?'surface':'lower store'),
  rule(target),target.source]));
 requirementTable.id='relaxation-requirements';verdict.append(requirementTable,
  node('p','The same nonnegative Celsius amount is added to every “at most” limit and subtracted from every “at least” limit. Original observation bands stay unchanged. Equality is included.'),
  node('p','The result does not adopt new thresholds or recommend weakening them. It is a conditional question about the represented model; it is not a fitted noise level or a calibrated physical tolerance.'));
 if(r.minimumRelaxationC!==null){
  const minimum=node('details');minimum.id='relaxation-exact-minimum';minimum.append(node('summary','Exact minimum and every attaining pattern'),
   node('p','Exact common relaxation: '+exactText(r.minimumRelaxationC)+' °C.'),
   node('p','All globally attaining patterns: '+r.attainingPatternIndices.map(i=>i+1).join(', ')+'.'),
   node('p','Patterns meeting both original requirements with zero relaxation: '+(r.zeroCompatiblePatternIndices.map(i=>i+1).join(', ')||'none')+'.'),
   node('p','Feasible common relaxations include the exact minimum and every larger amount. Distinct pattern profile sets remain separate throughout the calculation.'));
  verdict.append(minimum);
 }
 if(r.alternatives.length){
  const cases=makeTable('Every original minimum pattern keeps its own certified optimum',['Pattern / original changes','Own minimum ≈ °C','Global result','Maximum lower − upper ≈ °C, A / B'],r.alternatives.map(a=>[
   'Pattern '+(a.patternIndex+1)+' · '+patternName(a),skyRelaxationAmountText(a.minimumRelaxationC),a.attainsGlobalMinimum?'Attains the global minimum':'Needs more relaxation',a.maximumLowerMinusUpperC.map(value=>number(value.upper)).join(' / ')]));
  cases.id='relaxation-pattern-results';Array.from(cases.querySelectorAll('tbody tr')).forEach((row,i)=>{const a=r.alternatives[i];Object.assign(row.dataset,{pattern:String(a.patternIndex),delta:exactText(a.minimumRelaxationC),attains:String(a.attainsGlobalMinimum),orderA:String(a.maximumLowerMinusUpperC[0].upper),orderB:String(a.maximumLowerMinusUpperC[1].upper)});});
  verdict.append(cases,node('p','Every compatible minimum pattern has a complete optimum certificate, including nonattaining patterns. Endpoint-order proofs cover its entire original feasible set before applying relaxation. Rounded displays can hide exact differences.'));
 }
 const inquiryProof=node('details');inquiryProof.className='relaxation-proof';inquiryProof.id='relaxation-requirement-proof';inquiryProof.append(node('summary','Exact requirements, all optima and complete attaining pattern sets'));
 const inquiryCode=node('pre');inquiryProof.append(inquiryCode);
 inquiryProof.addEventListener('toggle',()=>{if(!active(inquiryProof)||!inquiryProof.open||inquiryCode.textContent)return;inquiryCode.textContent=JSON.stringify({requirements:r.requirements,requirementIntervalRows:r.exactEvidence.requirementIntervalRows,minimumRelaxationC:r.minimumRelaxationC,attainingPatternIndices:r.attainingPatternIndices,zeroCompatiblePatternIndices:r.zeroCompatiblePatternIndices,cases:r.exactEvidence.result.cases},null,2);});
 verdict.append(inquiryProof);host.append(verdict);
  const classes=node('div');classes.className='relaxation-classes';
  for(let changes=0;changes<=2;changes++){
    const examined=r.patterns.filter(p=>p.changes===changes),compatible=examined.filter(p=>p.compatibility==='compatible');
    const declared=changes<=r.query.maximumChanges;
    const status=!declared?'outside-declaration':!examined.length?'not-examined':compatible.length?'compatible':'incompatible';
    const card=node('article');card.className='relaxation-class';Object.assign(card.dataset,{changes:String(changes),status,examined:String(examined.length),compatible:String(compatible.length)});
    card.append(node('h3',changes+' '+(changes===1?'change':'changes')),node('strong',status==='outside-declaration'?'Outside the declaration':status==='not-examined'?'Not examined':compatible.length?compatible.length+' compatible':'All incompatible'),
      node('p',!declared?'Increase the declared maximum to include this class.':!examined.length?'A complete simpler class already succeeded.':examined.length+' complete '+(examined.length===1?'pattern was':'patterns were')+' checked.'));
    classes.append(card);
  }host.append(classes);
  host.append(node('p','The shared static and original-step responses define one represented model across every pattern. Phase coefficients are regrouped exactly, so a simpler class stays inside its refinements. Compatibility is not a probability or a measured time of change.'));

 if(r.alternatives.length){
  const label=node('label','Inspect a pattern in the original minimum class');label.className='relaxation-pattern-choice';
  const select=node('select');select.id='relaxation-pattern-select';
  for(const alternative of r.alternatives){const option=node('option','Pattern '+(alternative.patternIndex+1)+' · ≈ '+skyRelaxationAmountText(alternative.minimumRelaxationC)+' °C'+(alternative.attainsGlobalMinimum?' · global minimum':' · nonattaining')+' · '+patternName(alternative));option.value=String(alternative.patternIndex);select.append(option);}
  select.value=String(selectedPattern);label.append(select);host.append(label);
  const witnessHost=node('section');witnessHost.id='relaxation-witness';witnessHost.className='relaxation-witness';host.append(witnessHost);
  select.addEventListener('input',()=>{if(!active(select))return;const index=Number(select.value);if(!r.alternatives.some(a=>a.patternIndex===index))return;selectedPattern=index;drawAlternative();});
  function drawAlternative(){
   const pattern=r.alternatives.find(a=>a.patternIndex===selectedPattern),alternative=pattern.witness,version=++selectionVersion;
   const guard=element=>version===selectionVersion&&active(element);
   witnessHost.replaceChildren();Object.assign(witnessHost.dataset,{pattern:String(selectedPattern),kind:selectedKind,delta:exactText(pattern.minimumRelaxationC),attains:String(pattern.attainsGlobalMinimum),phases:String(alternative.phaseProfiles.length)});
   witnessHost.append(node('h3','One optimal common profile · pattern '+(selectedPattern+1)));
   const exactCase=r.exactEvidence.result.cases.find(c=>c.patternIndex===selectedPattern),exactEntry=exactCase.relaxation;
   const certificate=node('details');certificate.className='relaxation-proof';certificate.id='relaxation-selected-certificate';certificate.append(node('summary','Exact feasibility and minimum-relaxation optimality proofs'));
   const certificateCode=node('pre');certificate.append(certificateCode);
   certificate.addEventListener('toggle',()=>{if(!guard(certificate)||!certificate.open||certificateCode.textContent)return;certificateCode.textContent=JSON.stringify({patternIndex:selectedPattern,splits:exactCase.splits,endpointOrder:exactCase.endpointOrder,relaxation:exactEntry},null,2);});
   witnessHost.append(node('p','This pattern needs a common relaxation of approximately '+skyRelaxationAmountText(pattern.minimumRelaxationC)+' °C. '+(pattern.attainsGlobalMinimum?'It attains the global minimum.':'Its optimum is above the global minimum.')),
    node('p','The displayed profile is shared across every original receiver and both designs. It is one optimum witness; other optimal profiles may exist. The original thresholds and their separate statuses stay visible.'));
   const phases=phaseFigure(alternative),edges=[0,...pattern.splitAfterIntervals,r.originalTimes.length-1];
   phases.querySelectorAll('figcaption').forEach((caption,phase)=>{caption.textContent='Profile '+(phase+1)+' · '+r.originalTimes[edges[phase]].utc+' to '+r.originalTimes[edges[phase+1]].utc;});witnessHost.append(phases);
   const values=makeTable('Both requirements under the same optimal profile and shared relaxation',['Requirement / original condition','Relaxed limit ≈ °C','Represented interval ≈ °C','Exact status: original / relaxed','Original numerical interval ≈ °C','Numerical status: original / relaxed'],
    alternative.requirements.map(item=>[requirementName(item.requirementIndex)+' · '+rule(r.requirements[item.requirementIndex]),
     number(item.relaxedLimitC.lower),interval(item.representedPairC.lower.lower,item.representedPairC.upper.upper),item.representedStatus+' / '+item.relaxedRepresentedStatus,
     interval(item.originalNumericalPairC.lower.lower,item.originalNumericalPairC.upper.upper),item.originalNumericalStatus+' / '+item.relaxedOriginalNumericalStatus]));
   values.id='relaxation-witness-requirements';Array.from(values.querySelectorAll('tbody tr')).forEach((row,index)=>{const item=alternative.requirements[index];
    Object.assign(row.dataset,{requirement:String(item.requirementIndex),represented:item.representedStatus,relaxedRepresented:item.relaxedRepresentedStatus,
     numerical:item.originalNumericalStatus,relaxedNumerical:item.relaxedOriginalNumericalStatus,originalLimit:exactText(item.originalLimitC),relaxedLimit:exactText(item.relaxedLimitC),
     representedLower:String(item.representedPairC.lower.lower),representedUpper:String(item.representedPairC.upper.upper),
     numericalLower:String(item.originalNumericalPairC.lower.lower),numericalUpper:String(item.originalNumericalPairC.upper.upper)});});
   witnessHost.append(values,node('p','“Original” checks the declared limit; “relaxed” checks this pattern’s own optimum limit. Exact fractions determine all statuses. Rounded displays may look equal while exact or numerical statuses differ. Numerical replay does not replace the represented-model certificate.'));
   const selection=node('div');selection.className='relaxation-selection';
   const receiverLabel=node('label','Inspect an original receiver'),receiverSelect=node('select');receiverSelect.id='relaxation-receiver-select';
   for(const replay of alternative.originalReplays){const option=node('option','Receiver '+(replay.sourceIndex+1)+' · point '+point(investigation.readings[replay.representativeReadingIndex]));option.value=String(replay.sourceIndex);receiverSelect.append(option);}
   receiverSelect.value=String(selectedSource);receiverLabel.append(receiverSelect);
   const timeLabel=node('label','Inspect an original time'),timeSelect=node('select');timeSelect.id='relaxation-time-select';
   r.originalTimes.forEach(time=>{const option=node('option',originalLabel(time));option.value=String(time.index);timeSelect.append(option);});
   timeSelect.value=String(selectedTime);timeLabel.append(timeSelect);selection.append(receiverLabel,timeLabel);witnessHost.append(selection);
   const detail=node('div');detail.id='relaxation-time-detail';witnessHost.append(detail);
   receiverSelect.addEventListener('input',()=>{if(!guard(receiverSelect))return;const index=Number(receiverSelect.value);if(!alternative.originalReplays.some(row=>row.sourceIndex===index))return;selectedSource=index;drawTime();});
   timeSelect.addEventListener('input',()=>{if(!guard(timeSelect))return;const index=Number(timeSelect.value);if(!Number.isInteger(index)||!r.originalTimes[index])return;selectedTime=index;drawTime();});
   const outside=alternative.originalObservations.some(row=>Object.values(row.endpointStatus).includes('outside-original-band'));
   const notice=node('p',outside?'An original numerical observation endpoint is outside its original band. Exact represented compatibility and the numerical replay status remain separate.':'Every separately replayed original observation endpoint is within its original band for this profile. This numerical check does not establish physical accuracy.');
   notice.id='relaxation-replay-note';notice.className='replay-note'+(outside?' outside':'');notice.dataset.replay=outside?'outside-original-band':'within-original-band';witnessHost.append(notice);
   const observations=node('details');observations.id='relaxation-observations';observations.append(node('summary','All '+r.readings.length+' original observations under this profile'),
    makeTable('Every original observation retains its band and numerical status',['Record / point','Original UTC / component','Original band °C','Represented value ≈ °C','Original replay lower / upper °C','Original replay status'],
     alternative.originalObservations.map(row=>{const original=r.readings[row.recordIndex];return [row.recordIndex+1+' / '+point(investigation.readings[row.recordIndex]),row.utc+' / '+(row.store==='surfaceC'?'surface':'lower store'),
      String(original.temperatureC)+' ± '+String(original.halfWidthC),number(row.additiveC.lower),String(row.originalC.lower)+' / '+String(row.originalC.upper),Object.values(row.endpointStatus).join(' / ')];})));
   witnessHost.append(observations,certificate);
   const profileProof=node('details');profileProof.className='relaxation-proof';profileProof.append(node('summary','Exact profile masses and numerical replay weights'));const profileCode=node('pre');profileProof.append(profileCode);
   profileProof.addEventListener('toggle',()=>{if(!guard(profileProof)||!profileProof.open||profileCode.textContent)return;profileCode.textContent=JSON.stringify({phaseProfiles:alternative.phaseProfiles,productMasses:alternative.productMasses,
    requirements:alternative.requirements,normalizedReplays:alternative.originalReplays.map(row=>({sourceIndex:row.sourceIndex,approximateProfiles:row.approximateProfiles,maximumReplayResidualC:row.maximumReplayResidualC}))},null,2);});witnessHost.append(profileProof);
   function drawTime(){
    const replay=alternative.originalReplays.find(row=>row.sourceIndex===selectedSource),row=replay.originalCourse[selectedTime];
    detail.replaceChildren();Object.assign(detail.dataset,{pattern:String(selectedPattern),kind:selectedKind,source:String(selectedSource),time:String(selectedTime),utc:row.utc});
    detail.append(node('h4',row.utc+' · point '+point(investigation.readings[replay.representativeReadingIndex])),
     node('p','Original elapsed minutes: '+row.minute+'. Accumulated thermal minutes: '+row.thermalMinute+'. Both clocks are retained; no interpolated observation is introduced.'));
    const values=node('div');values.className='relaxation-values';const exactRows=[];
    for(const [store,title]of stores){
     const additive={lower:profileFraction(sub(fraction(row.additiveC.proposal.lower[store]),fraction(row.additiveC.existing.upper[store]))),
      upper:profileFraction(sub(fraction(row.additiveC.proposal.upper[store]),fraction(row.additiveC.existing.lower[store])))};
     const original={lower:profileFraction(sub(q(row.originalC.proposal.lower[store]),q(row.originalC.existing.upper[store]))).lower,
      upper:profileFraction(sub(q(row.originalC.proposal.upper[store]),q(row.originalC.existing.lower[store]))).upper};
     const card=node('article');card.className='relaxation-value';Object.assign(card.dataset,{store,additiveLower:String(additive.lower.lower),additiveUpper:String(additive.upper.upper),originalLower:String(original.lower),originalUpper:String(original.upper)});
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
  const patterns=node('details');patterns.id='relaxation-all-patterns';patterns.append(node('summary','Inspect every examined pattern and its exact certificate'));
  patterns.append(makeTable('Every examined pattern; all original observations remain',['Pattern','Changes','Original change UTCs','Compatibility'],r.patterns.map(p=>[p.patternIndex+1,p.changes,patternName(p),p.compatibility])));
  const proofLabel=node('label','Choose an examined pattern'),proofSelect=node('select');proofSelect.id='relaxation-proof-select';
  r.patterns.forEach(pattern=>{const option=node('option','Pattern '+(pattern.patternIndex+1)+' · '+pattern.compatibility+' · '+patternName(pattern));option.value=String(pattern.patternIndex);proofSelect.append(option);});proofLabel.append(proofSelect);patterns.append(proofLabel);
  const proof=node('details');proof.className='relaxation-proof';proof.append(node('summary','Exact matrix, certificate and original numerical checks'));const proofCode=node('pre');proof.append(proofCode);patterns.append(proof);host.append(patterns);
  function drawProof(){
    if(!active(proofSelect)||!proof.open)return;
    const pattern=r.patterns.find(p=>p.patternIndex===Number(proofSelect.value));if(!pattern)return;
    proofCode.textContent=JSON.stringify({coordinateOrder:r.exactEvidence.coordinateOrder,pattern,proof:r.exactEvidence.result.analysis.cases[pattern.exactProofIndex]},null,2);
    proof.dataset.pattern=String(pattern.patternIndex);
  }
  proofSelect.addEventListener('input',()=>{if(active(proofSelect)){proofCode.textContent='';drawProof();}});proof.addEventListener('toggle',drawProof);
  const work=node('details');work.id='relaxation-work';work.append(node('summary','Complete work, consistency checks and scope'),
    node('p',r.work.executedBasisCourses+' complete basis courses and '+r.work.executedWitnessCourses+' fixed-profile courses executed. '+r.work.reusedCompleteCourses+' requests reused an identical complete bin sequence within its original receiver source.'),
    node('p',r.work.geometryPasses+' original geometry passes; '+r.work.exactSolves+' exact solves, '+r.work.exactObjectives+' endpoint-order and relaxation objectives, '+r.work.linearPivots+' pivots and '+r.work.linearRationalOperations+' counted solver rational operations. The inquiry reserves its entire declared search before returning a result.'),
    node('p',r.work.combinationStatesScreened+' original combination endpoint/component values were checked against the '+r.numericalEvidence.consistencyScreenC+' °C consistency screen. '+r.work.actualReplayEndpointRows+' common-profile receiver/time rows remain inspectable.'),
    node('p','Work counts are recorded by the fresh computation. Certificate verification checks their arithmetic and declared ceilings; the certificates do not independently prove the actual execution counts.'),
    node('p',r.numericalEvidence.scope),node('p',r.semantics));host.append(work);
}
