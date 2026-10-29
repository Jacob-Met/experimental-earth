import {node,number,point,table,phaseFigure} from './shade-heat-epoch-view.js';
import {rational as q,sub} from './vendor/chronos/exact-halfplanes.mjs';
import {profileFraction} from './shade-heat-profile-band.js';

const stores=[['surfaceC','Ground surface'],['subsurfaceC','Lower heat store']];
const fraction=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const exactText=value=>value.exact.numerator+' / '+value.exact.denominator;
const interval=(lower,upper)=>number(lower)+' to '+number(upper);
const patternName=pattern=>pattern.splitUtcs.length?pattern.splitUtcs.join(' · '):'One fixed profile for the whole original course';
const originalLabel=time=>time.utc+' · '+(time.index?'original interval '+time.index:'initial state');
const makeTable=(caption,headings,rows)=>{const result=table(caption,headings,rows);result.classList.add('coverage-table');return result;};
const requirementName=index=>index===0?'A':'B';

export function skyCoverageAmountText(value){
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

const signedAmountText=value=>BigInt(value.exact.numerator)<0n?'-'+skyCoverageAmountText({...value,exact:{...value.exact,numerator:String(-BigInt(value.exact.numerator))}}):skyCoverageAmountText(value);
const rule=target=>(target.relation==='at-most'?'Upper endpoint ≤ ':'Lower endpoint ≥ ')+String(target.differenceC)+' °C';

/** Every displayed course belongs to one retained common profile.
 * Every original minimum pattern retains its own minimum and signed bounds; role profiles remain separate.
 */
export function drawSkyCoverageReport(host,result,isCurrent){
 const {investigation,report:r}=result;
 let selectedPattern=r.someProfileAttainingPatternIndices[0]??r.alternatives[0]?.patternIndex??null,selectedKind='some-profile',
  selectedSource=r.requirements[0].sourceIndex,selectedTime=r.requirements[0].originalIndex,selectionVersion=0;
 const active=element=>host.isConnected&&element.isConnected&&isCurrent();
 host.replaceChildren();host.hidden=false;
 Object.assign(host.dataset,{status:r.compatibility,coverage:r.coverageStatus,minimum:r.minimumChanges===null?'none':String(r.minimumChanges),
  patterns:String(r.patterns.length),alternatives:String(r.alternatives.length),originalTimes:String(r.originalTimes.length),
  records:String(r.readings.length),sources:String(r.work.uniqueSources)});
 const outcome=node('div');outcome.className='coverage-outcome';outcome.dataset.status=r.compatibility;
 outcome.append(node('h2',r.compatibility==='compatible'?(r.minimumChanges===0?'One fixed profile is compatible with the complete original record':r.minimumChanges+' changes are the original minimum compatible class'):'No original-compatible pattern in the declared class'),
  node('p',r.compatibility==='compatible'?r.alternatives.length+' compatible '+(r.alternatives.length===1?'pattern is':'patterns are')+' retained. Every simpler pattern was examined before either requirement was applied.':'Every declared pattern was examined against every original observation. Requirements are unevaluated because the original compatible family is empty.'),
  node('p',r.readings.length+' original records · '+r.work.uniqueSources+' receivers · '+r.originalTimes.length+' original times. '+r.unexaminedHigherChangePatterns+' higher-change patterns were not examined.'));
 host.append(outcome);
 const verdict=node('section');verdict.id='coverage-verdict';verdict.className='coverage-verdict';
 const pairNames=pairs=>pairs.map(p=>'pattern '+(p.patternIndex+1)+' / '+requirementName(p.requirementIndex)).join(', ')||'none';
 Object.assign(verdict.dataset,{coverage:r.coverageStatus,someOriginal:r.someProfileMeetsOriginal===null?'unevaluated':String(r.someProfileMeetsOriginal),
  allOriginal:r.allProfilesMeetOriginal===null?'unevaluated':String(r.allProfilesMeetOriginal),floorActive:r.floorActive===null?'unevaluated':String(r.floorActive),floorOnly:r.floorOnly===null?'unevaluated':String(r.floorOnly),
  somePatterns:JSON.stringify(r.someProfileAttainingPatternIndices),allPatterns:JSON.stringify(r.allProfileAttainingPatternIndices),
  rawPairs:JSON.stringify(r.rawMaximumPairs),controllingPairs:JSON.stringify(r.controllingPairs),zeroPatterns:JSON.stringify(r.zeroCoverPatternIndices),
  some:r.someProfileRelaxationC?exactText(r.someProfileRelaxationC):'unevaluated',all:r.allProfileRelaxationC?exactText(r.allProfileRelaxationC):'unevaluated',
  raw:r.rawMaximumViolationC?exactText(r.rawMaximumViolationC):'unevaluated',gap:r.coverageGapC?exactText(r.coverageGapC):'unevaluated'});
 verdict.append(node('h3',r.allProfileRelaxationC===null?'No relaxation comparison for an empty original family':'One profile and every profile require different questions'));
 if(r.allProfileRelaxationC===null){
  verdict.append(node('p','No profile satisfies the original observations in the declared class. Neither relaxation amount is assessed, and there is no every-profile guarantee. Neither amount is zero.'));
 }else{
  const comparison=node('div');comparison.className='coverage-values coverage-amounts';
  for(const [label,amount,meaning]of [
   ['Permit at least one common profile',r.someProfileRelaxationC,r.someProfileMeetsOriginal?'Some profile meets both original requirements':'No profile meets both original requirements'],
   ['Cover every common profile',r.allProfileRelaxationC,r.allProfilesMeetOriginal?'Every profile meets both original requirements':'Some original-compatible profiles do not meet both requirements'],
   ['Additional amount for every profile',r.coverageGapC,'Every-profile amount minus one-profile amount']]){
   const card=node('article');card.className='coverage-value';card.append(node('h4',label),node('strong','≈ '+skyCoverageAmountText(amount)+' °C'),node('p',meaning));comparison.append(card);
  }
  comparison.id='coverage-global-amounts';verdict.append(comparison,
   node('p','The one-profile amount permits both requirements under at least one common profile. The every-profile amount makes both requirements hold for every profile in every compatible pattern of the original minimum class.'),
   node('p',r.floorOnly?'Every signed maximum is strictly negative. The nonnegative floor alone sets the every-profile amount to zero; no requirement pair is binding.':
    r.floorActive?'The every-profile amount is exactly zero. The listed binding requirement pairs make exact contact with an original limit.':
    'Binding requirement pairs at the every-profile amount: '+pairNames(r.controllingPairs)+'. The complete exact bound certificates establish coverage; a selected profile alone does not.'),
   node('p','Every means every profile in the represented original minimum family. Exact fractions determine zero and ties, even when a displayed approximation is extremely small.'));
 }
 const requirementTable=makeTable('The original declarations remain unchanged',['Requirement','Original target','Original whole-interval condition','Declared basis'],r.requirements.map((target,index)=>[
  requirementName(index),'Receiver '+(target.sourceIndex+1)+' · point '+point(investigation.readings[target.receiverReadingIndex])+' · '+target.utc+' · '+(target.store==='surfaceC'?'surface':'lower store'),
  rule(target),target.source]));
 requirementTable.id='coverage-requirements';verdict.append(requirementTable,
  node('p','The same nonnegative Celsius amount is added to every “at most” limit and subtracted from every “at least” limit. Original observation bands stay unchanged. Equality is included.'),
  node('p','The comparison does not adopt new thresholds or recommend weakening them. It is a conditional question about the represented model; it is not a fitted noise level or a calibrated physical tolerance.'));
 if(r.allProfileRelaxationC!==null){
  const minimum=node('details');minimum.id='coverage-exact-amounts';minimum.append(node('summary','Exact amounts, signed maxima and every tied pattern or requirement'),
   node('p','One-profile amount: '+exactText(r.someProfileRelaxationC)+' °C. Every-profile amount: '+exactText(r.allProfileRelaxationC)+' °C. Difference: '+exactText(r.coverageGapC)+' °C.'),
   node('p','Largest signed residual: '+exactText(r.rawMaximumViolationC)+' °C. Raw maximum pairs: '+pairNames(r.rawMaximumPairs)+'.'),
   node('p','Binding requirement pairs at the every-profile amount: '+pairNames(r.controllingPairs)+'.'),
   node('p','Patterns attaining the one-profile minimum: '+r.someProfileAttainingPatternIndices.map(i=>i+1).join(', ')+'.'),
   node('p','Patterns attaining the every-profile bound after the nonnegative floor: '+r.allProfileAttainingPatternIndices.map(i=>i+1).join(', ')+'.'),
   node('p','Patterns whose every profile meets the original requirements: '+(r.zeroCoverPatternIndices.map(i=>i+1).join(', ')||'none')+'.'),
   node('p','Within either question, every allowance at or above its exact amount succeeds. All original pattern identities remain attached to their own certificates and profiles.'));
  verdict.append(minimum);
 }
 if(r.alternatives.length){
  const cases=makeTable('Every original minimum pattern retains both amounts and both signed bounds',['Pattern / original changes','Own one-profile minimum ≈ °C','Own every-profile bound ≈ °C','Signed maximum A / B ≈ °C','Global ties'],r.alternatives.map(a=>[
   'Pattern '+(a.patternIndex+1)+' · '+patternName(a),skyCoverageAmountText(a.someProfileRelaxationC),skyCoverageAmountText(a.allProfileRelaxationC),
   a.maxima.map(m=>signedAmountText(m.maximumViolationC)).join(' / '),
   [a.someProfileAttainsGlobalMinimum?'One-profile minimum':null,a.allProfileAttainsGlobalMaximum?'Every-profile bound':null].filter(Boolean).join(' · ')||'Neither global amount']));
  cases.id='coverage-pattern-results';Array.from(cases.querySelectorAll('tbody tr')).forEach((row,i)=>{const a=r.alternatives[i];Object.assign(row.dataset,{pattern:String(a.patternIndex),
   some:exactText(a.someProfileRelaxationC),all:exactText(a.allProfileRelaxationC),raw:exactText(a.rawMaximumViolationC),
   someAttains:String(a.someProfileAttainsGlobalMinimum),allAttains:String(a.allProfileAttainsGlobalMaximum),floorOnly:String(a.floorOnly),
   maximumA:exactText(a.maxima[0].maximumViolationC),maximumB:exactText(a.maxima[1].maximumViolationC)});});
  verdict.append(cases,node('p','Each signed maximum keeps its own maximizing profile, including negative and nonbinding bounds. The A and B profiles need not coincide. All interval-order proofs cover the entire original feasible set before either relaxation question.'));
 }
 const inquiryProof=node('details');inquiryProof.className='coverage-proof';inquiryProof.id='coverage-requirement-proof';inquiryProof.append(node('summary','Exact requirements, both amounts, complete ties and all certificates'));
 const inquiryCode=node('pre');inquiryProof.append(inquiryCode);
 inquiryProof.addEventListener('toggle',()=>{if(!active(inquiryProof)||!inquiryProof.open||inquiryCode.textContent)return;inquiryCode.textContent=JSON.stringify({requirements:r.requirements,requirementIntervalRows:r.exactEvidence.requirementIntervalRows,result:r.exactEvidence.result},null,2);});
 verdict.append(inquiryProof);host.append(verdict);
  const classes=node('div');classes.className='coverage-classes';
  for(let changes=0;changes<=2;changes++){
    const examined=r.patterns.filter(p=>p.changes===changes),compatible=examined.filter(p=>p.compatibility==='compatible');
    const declared=changes<=r.query.maximumChanges;
    const status=!declared?'outside-declaration':!examined.length?'not-examined':compatible.length?'compatible':'incompatible';
    const card=node('article');card.className='coverage-class';Object.assign(card.dataset,{changes:String(changes),status,examined:String(examined.length),compatible:String(compatible.length)});
    card.append(node('h3',changes+' '+(changes===1?'change':'changes')),node('strong',status==='outside-declaration'?'Outside the declaration':status==='not-examined'?'Not examined':compatible.length?compatible.length+' compatible':'All incompatible'),
      node('p',!declared?'Increase the declared maximum to include this class.':!examined.length?'A complete simpler class already succeeded.':examined.length+' complete '+(examined.length===1?'pattern was':'patterns were')+' checked.'));
    classes.append(card);
  }host.append(classes);
  host.append(node('p','The shared static and original-step responses define one represented model across every pattern. Phase coefficients are regrouped exactly, so a simpler class stays inside its refinements. Compatibility is not a probability or a measured time of change.'));

 if(r.alternatives.length){
  const label=node('label','Inspect a pattern in the original minimum class');label.className='coverage-pattern-choice';
  const select=node('select');select.id='coverage-pattern-select';
  for(const alternative of r.alternatives){const option=node('option','Pattern '+(alternative.patternIndex+1)+' · one ≈ '+skyCoverageAmountText(alternative.someProfileRelaxationC)+' °C · every ≈ '+skyCoverageAmountText(alternative.allProfileRelaxationC)+' °C · '+patternName(alternative));option.value=String(alternative.patternIndex);select.append(option);}
  select.value=String(selectedPattern);label.append(select);host.append(label);
  const witnessHost=node('section');witnessHost.id='coverage-witness';witnessHost.className='coverage-witness';host.append(witnessHost);
  select.addEventListener('input',()=>{if(!active(select))return;const index=Number(select.value);if(!r.alternatives.some(a=>a.patternIndex===index))return;selectedPattern=index;drawAlternative();});
  function drawAlternative(){
   const pattern=r.alternatives.find(a=>a.patternIndex===selectedPattern),maximumIndex=selectedKind==='maximum-a'?0:selectedKind==='maximum-b'?1:null,
    alternative=maximumIndex===null?pattern.someProfile:pattern.maxima[maximumIndex].witness,version=++selectionVersion;
   const guard=element=>version===selectionVersion&&active(element);
   witnessHost.replaceChildren();Object.assign(witnessHost.dataset,{pattern:String(selectedPattern),kind:selectedKind,
    some:exactText(pattern.someProfileRelaxationC),all:exactText(pattern.allProfileRelaxationC),allowance:exactText(alternative.allowanceC),required:exactText(alternative.requiredRelaxationC),
    maximum:alternative.maximumViolationC?exactText(alternative.maximumViolationC):'none',someAttains:String(pattern.someProfileAttainsGlobalMinimum),allAttains:String(pattern.allProfileAttainsGlobalMaximum),phases:String(alternative.phaseProfiles.length)});
   const roleLabel=node('label','Choose a profile role'),roleSelect=node('select');roleSelect.id='coverage-role-select';
   for(const [kind,label]of [['some-profile','Profile attaining this pattern’s one-profile minimum'],['maximum-a','Profile attaining requirement A’s signed maximum'],['maximum-b','Profile attaining requirement B’s signed maximum']]){
    const option=node('option',label);option.value=kind;roleSelect.append(option);
   }
   roleSelect.value=selectedKind;roleLabel.append(roleSelect);roleLabel.className='coverage-pattern-choice';witnessHost.append(roleLabel);
   roleSelect.addEventListener('input',()=>{if(!guard(roleSelect)||!['some-profile','maximum-a','maximum-b'].includes(roleSelect.value))return;selectedKind=roleSelect.value;drawAlternative();});
   witnessHost.append(node('h3',(maximumIndex===null?'One profile attaining this pattern’s minimum':'Profile attaining requirement '+requirementName(maximumIndex)+'’s signed maximum')+' · pattern '+(selectedPattern+1)));
   const exactSome=r.exactEvidence.result.minimum.cases.find(c=>c.patternIndex===selectedPattern),exactAll=r.exactEvidence.result.cases.find(c=>c.patternIndex===selectedPattern),
    exactEntry=maximumIndex===null?exactSome.relaxation:exactAll.tests[maximumIndex];
   const certificate=node('details');certificate.className='coverage-proof';certificate.id='coverage-selected-certificate';certificate.append(node('summary',maximumIndex===null?'Exact feasibility and one-profile minimum proofs':'Exact original-polytope feasibility and designated residual maximum proofs'));
   const certificateCode=node('pre');certificate.append(certificateCode);
   certificate.addEventListener('toggle',()=>{if(!guard(certificate)||!certificate.open||certificateCode.textContent)return;certificateCode.textContent=JSON.stringify({patternIndex:selectedPattern,role:selectedKind,splits:exactAll.splits,endpointOrder:exactSome.endpointOrder,linearModel:maximumIndex===null?exactSome.relaxation.linearModel:exactAll.linearModel,selected:exactEntry},null,2);});
   witnessHost.append(node('p','This pattern’s own one-profile minimum is approximately '+skyCoverageAmountText(pattern.someProfileRelaxationC)+' °C; its own every-profile bound is approximately '+skyCoverageAmountText(pattern.allProfileRelaxationC)+' °C.'),
    node('p',maximumIndex===null?'This common profile attains this pattern’s one-profile minimum. Its relaxed statuses use that same pattern allowance. Other optimal profiles may exist.':
     'Requirement '+requirementName(maximumIndex)+' reaches its signed maximum of approximately '+signedAmountText(alternative.maximumViolationC)+' °C at this profile. The other requirement remains visible, without a claim that it reaches its own maximum here. The A and B maximizing profiles remain separate.'),
    node('p','Allowance used for the displayed relaxed limits: approximately '+skyCoverageAmountText(alternative.allowanceC)+' °C'+(maximumIndex===null?' (this pattern’s one-profile minimum).':' (the global every-profile amount).')+' This selected profile itself requires approximately '+skyCoverageAmountText(alternative.requiredRelaxationC)+' °C.'),
    node('p','The displayed profile is shared across every original receiver and both designs. Original thresholds and separate exact and numerical statuses stay visible.'));
   const phases=phaseFigure(alternative),edges=[0,...pattern.splitAfterIntervals,r.originalTimes.length-1];
   phases.querySelectorAll('figcaption').forEach((caption,phase)=>{caption.textContent='Profile '+(phase+1)+' · '+r.originalTimes[edges[phase]].utc+' to '+r.originalTimes[edges[phase+1]].utc;});witnessHost.append(phases);
   const values=makeTable('Both requirements under this selected common profile and its stated allowance',['Requirement / original condition','Relaxed limit ≈ °C','Represented interval ≈ °C','Exact status: original / relaxed','Original numerical interval ≈ °C','Numerical status: original / relaxed'],
    alternative.requirements.map(item=>[requirementName(item.requirementIndex)+' · '+rule(r.requirements[item.requirementIndex]),
     number(item.relaxedLimitC.lower),interval(item.representedPairC.lower.lower,item.representedPairC.upper.upper),item.representedStatus+' / '+item.relaxedRepresentedStatus,
     interval(item.originalNumericalPairC.lower.lower,item.originalNumericalPairC.upper.upper),item.originalNumericalStatus+' / '+item.relaxedOriginalNumericalStatus]));
   values.id='coverage-witness-requirements';Array.from(values.querySelectorAll('tbody tr')).forEach((row,index)=>{const item=alternative.requirements[index];
    Object.assign(row.dataset,{requirement:String(item.requirementIndex),represented:item.representedStatus,relaxedRepresented:item.relaxedRepresentedStatus,
     numerical:item.originalNumericalStatus,relaxedNumerical:item.relaxedOriginalNumericalStatus,originalLimit:exactText(item.originalLimitC),relaxedLimit:exactText(item.relaxedLimitC),
     representedLower:String(item.representedPairC.lower.lower),representedUpper:String(item.representedPairC.upper.upper),
     numericalLower:String(item.originalNumericalPairC.lower.lower),numericalUpper:String(item.originalNumericalPairC.upper.upper)});});
   witnessHost.append(values,node('p','“Original” checks the declared limit; “relaxed” checks the stated allowance for this profile role. The one-profile role uses this pattern’s minimum; either maximum role uses the global every-profile amount. Exact fractions determine statuses. Rounded displays may look equal while exact or numerical statuses differ.'));
   const selection=node('div');selection.className='coverage-selection';
   const receiverLabel=node('label','Inspect an original receiver'),receiverSelect=node('select');receiverSelect.id='coverage-receiver-select';
   for(const replay of alternative.originalReplays){const option=node('option','Receiver '+(replay.sourceIndex+1)+' · point '+point(investigation.readings[replay.representativeReadingIndex]));option.value=String(replay.sourceIndex);receiverSelect.append(option);}
   receiverSelect.value=String(selectedSource);receiverLabel.append(receiverSelect);
   const timeLabel=node('label','Inspect an original time'),timeSelect=node('select');timeSelect.id='coverage-time-select';
   r.originalTimes.forEach(time=>{const option=node('option',originalLabel(time));option.value=String(time.index);timeSelect.append(option);});
   timeSelect.value=String(selectedTime);timeLabel.append(timeSelect);selection.append(receiverLabel,timeLabel);witnessHost.append(selection);
   const detail=node('div');detail.id='coverage-time-detail';witnessHost.append(detail);
   receiverSelect.addEventListener('input',()=>{if(!guard(receiverSelect))return;const index=Number(receiverSelect.value);if(!alternative.originalReplays.some(row=>row.sourceIndex===index))return;selectedSource=index;drawTime();});
   timeSelect.addEventListener('input',()=>{if(!guard(timeSelect))return;const index=Number(timeSelect.value);if(!Number.isInteger(index)||!r.originalTimes[index])return;selectedTime=index;drawTime();});
   const outside=alternative.originalObservations.some(row=>Object.values(row.endpointStatus).includes('outside-original-band'));
   const notice=node('p',outside?'An original numerical observation endpoint is outside its original band. Exact represented compatibility and the numerical replay status remain separate.':'Every separately replayed original observation endpoint is within its original band for this profile. This numerical check does not establish physical accuracy.');
   notice.id='coverage-replay-note';notice.className='replay-note'+(outside?' outside':'');notice.dataset.replay=outside?'outside-original-band':'within-original-band';witnessHost.append(notice);
   const observations=node('details');observations.id='coverage-observations';observations.append(node('summary','All '+r.readings.length+' original observations under this profile'),
    makeTable('Every original observation retains its band and numerical status',['Record / point','Original UTC / component','Original band °C','Represented value ≈ °C','Original replay lower / upper °C','Original replay status'],
     alternative.originalObservations.map(row=>{const original=r.readings[row.recordIndex];return [row.recordIndex+1+' / '+point(investigation.readings[row.recordIndex]),row.utc+' / '+(row.store==='surfaceC'?'surface':'lower store'),
      String(original.temperatureC)+' ± '+String(original.halfWidthC),number(row.additiveC.lower),String(row.originalC.lower)+' / '+String(row.originalC.upper),Object.values(row.endpointStatus).join(' / ')];})));
   witnessHost.append(observations,certificate);
   const profileProof=node('details');profileProof.className='coverage-proof';profileProof.append(node('summary','Exact profile masses and numerical replay weights'));const profileCode=node('pre');profileProof.append(profileCode);
   profileProof.addEventListener('toggle',()=>{if(!guard(profileProof)||!profileProof.open||profileCode.textContent)return;profileCode.textContent=JSON.stringify({phaseProfiles:alternative.phaseProfiles,productMasses:alternative.productMasses,
    requirements:alternative.requirements,normalizedReplays:alternative.originalReplays.map(row=>({sourceIndex:row.sourceIndex,approximateProfiles:row.approximateProfiles,maximumReplayResidualC:row.maximumReplayResidualC}))},null,2);});witnessHost.append(profileProof);
   function drawTime(){
    const replay=alternative.originalReplays.find(row=>row.sourceIndex===selectedSource),row=replay.originalCourse[selectedTime];
    detail.replaceChildren();Object.assign(detail.dataset,{pattern:String(selectedPattern),kind:selectedKind,source:String(selectedSource),time:String(selectedTime),utc:row.utc});
    detail.append(node('h4',row.utc+' · point '+point(investigation.readings[replay.representativeReadingIndex])),
     node('p','Original elapsed minutes: '+row.minute+'. Accumulated thermal minutes: '+row.thermalMinute+'. Both clocks are retained; no interpolated observation is introduced.'));
    const values=node('div');values.className='coverage-values';const exactRows=[];
    for(const [store,title]of stores){
     const additive={lower:profileFraction(sub(fraction(row.additiveC.proposal.lower[store]),fraction(row.additiveC.existing.upper[store]))),
      upper:profileFraction(sub(fraction(row.additiveC.proposal.upper[store]),fraction(row.additiveC.existing.lower[store])))};
     const original={lower:profileFraction(sub(q(row.originalC.proposal.lower[store]),q(row.originalC.existing.upper[store]))).lower,
      upper:profileFraction(sub(q(row.originalC.proposal.upper[store]),q(row.originalC.existing.lower[store]))).upper};
     const card=node('article');card.className='coverage-value';Object.assign(card.dataset,{store,additiveLower:String(additive.lower.lower),additiveUpper:String(additive.upper.upper),originalLower:String(original.lower),originalUpper:String(original.upper)});
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
  const patterns=node('details');patterns.id='coverage-all-patterns';patterns.append(node('summary','Inspect every examined pattern and its exact certificate'));
  patterns.append(makeTable('Every examined pattern; all original observations remain',['Pattern','Changes','Original change UTCs','Compatibility'],r.patterns.map(p=>[p.patternIndex+1,p.changes,patternName(p),p.compatibility])));
  const proofLabel=node('label','Choose an examined pattern'),proofSelect=node('select');proofSelect.id='coverage-proof-select';
  r.patterns.forEach(pattern=>{const option=node('option','Pattern '+(pattern.patternIndex+1)+' · '+pattern.compatibility+' · '+patternName(pattern));option.value=String(pattern.patternIndex);proofSelect.append(option);});proofLabel.append(proofSelect);patterns.append(proofLabel);
  const proof=node('details');proof.className='coverage-proof';proof.append(node('summary','Exact matrix, certificate and original numerical checks'));const proofCode=node('pre');proof.append(proofCode);patterns.append(proof);host.append(patterns);
  function drawProof(){
    if(!active(proofSelect)||!proof.open)return;
    const pattern=r.patterns.find(p=>p.patternIndex===Number(proofSelect.value));if(!pattern)return;
    proofCode.textContent=JSON.stringify({coordinateOrder:r.exactEvidence.coordinateOrder,pattern,proof:r.exactEvidence.result.minimum.analysis.cases[pattern.exactProofIndex]},null,2);
    proof.dataset.pattern=String(pattern.patternIndex);
  }
  proofSelect.addEventListener('input',()=>{if(active(proofSelect)){proofCode.textContent='';drawProof();}});proof.addEventListener('toggle',drawProof);
  const work=node('details');work.id='coverage-work';work.append(node('summary','Complete work, consistency checks and scope'),
    node('p',r.work.executedBasisCourses+' complete basis courses and '+r.work.executedWitnessCourses+' fixed-profile courses executed. '+r.work.reusedCompleteCourses+' requests reused an identical complete bin sequence within its original receiver source.'),
    node('p',r.work.geometryPasses+' original geometry passes; '+r.work.exactSolves+' exact solves, '+r.work.exactObjectives+' interval-order, existential and residual-maximum objectives, '+r.work.linearPivots+' pivots and '+r.work.linearRationalOperations+' counted solver rational operations. The inquiry reserves its entire declared search before returning a result.'),
    node('p',r.work.combinationStatesScreened+' original combination endpoint/component values were checked against the '+r.numericalEvidence.consistencyScreenC+' °C consistency screen. '+r.work.actualReplayEndpointRows+' common-profile receiver/time rows remain inspectable.'),
    node('p','Work counts are recorded by the fresh computation. Certificate verification checks their arithmetic and declared ceilings; the certificates do not independently prove the actual execution counts.'),
    node('p',r.numericalEvidence.scope),node('p',r.semantics));host.append(work);
}
