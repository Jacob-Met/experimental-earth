import {node,number,signed,point,table} from './shade-heat-epoch-view.js';
import {drawThreeEpochWitness} from './shade-heat-three-epoch-view.js';
import {drawTargetReport} from './shade-heat-course-target-view.js';
import {profileFraction} from './shade-heat-profile-band.js';
import {rational as q,sub} from './vendor/chronos/exact-halfplanes.mjs';

const stores=[['surfaceC','Ground surface'],['subsurfaceC','Lower heat store']];
const label=store=>stores.find(([key])=>key===store)[1];
const exact=v=>[BigInt(v.exact.numerator),BigInt(v.exact.denominator)];
const range=(lower,upper)=>signed(lower)+' / '+signed(upper)+' °C';

export function drawTargetConflictReport(host,result,isCurrent){
  const r=result.report,readings=result.investigation.readings,c=r.conflict;
  host.replaceChildren();for(const key of Object.keys(host.dataset))delete host.dataset[key];
  Object.assign(host.dataset,{observation:r.observationCompatibility,targets:r.targetCompatibility,records:String(readings.length),
    times:String(r.originalTimes.length),targetCount:String(r.targets.length),courses:String(r.work.executedThermalCourses),sources:String(r.work.uniqueSources),
    conflictSize:String(c?.targetIndices.length??0),conflictIndices:c?.targetIndices.join(',')??'',
    conflictSolves:String(r.work.conflictFeasibility?.feasibilitySolves??0),conflictOperations:String(r.work.conflictFeasibility?.rationalOperations??0)});
  host.append(node('p','03 / Understand the target conflict'),node('h2','Which desired ceilings cannot hold together?'),
    node('p',readings.length+' original observations, '+r.targets.length+' desired ceilings and both declared changes at '+r.splitUtcs.join(' and ')+'. Comparison point '+point(readings[0])+'.'));
  const summary=node('div');summary.className='conflict-summary';summary.id='conflict-summary';
  if(r.observationCompatibility==='incompatible')summary.append(node('h3','The original observations are already incompatible'),
    node('p','No target conflict or removal profile is reported. The original observations do not admit a common three-profile history at these declared changes. Every authored target remains available below.'));
  else if(!c)summary.append(node('h3','All declared ceilings admit one common profile'),
    node('p','There is no conflicting target group. Inspect the common profile, every declared ceiling and the separate original numerical replay below.'));
  else summary.append(node('h3',c.targetIndices.length+' necessary ceilings form one conflicting group'),
    node('p','This group cannot hold under a single shared history that keeps all '+readings.length+' original observations. Removing any one group member admits a shared profile for the remaining group.'),
    node('p','The group is inclusion-minimal. Another conflicting group may have fewer members; this inquiry does not search for the smallest group.'));
  host.append(summary);

  if(c){
    const memberTable=table('The identified conflicting group',
      ['Target','Original UTC','Component','Desired ceiling °C','Inspect removal proof'],c.targetIndices.map(i=>{
        const t=r.targets[i];return [i+1,t.utc,label(t.store),String(t.maximumDifferenceC),''];
      }));memberTable.id='conflict-members';
    const controls=node('div');controls.className='conflict-controls';
    const removal=node('select');removal.id='conflict-removal';const removalLabel=node('label','Inspect the proof with one group member omitted');removalLabel.htmlFor=removal.id;removalLabel.append(removal);
    for(const i of c.targetIndices){const t=r.targets[i],option=node('option','Target '+(i+1)+' · '+t.utc+' · '+label(t.store));option.value=String(i);removal.append(option);}
    controls.append(removalLabel);host.append(memberTable,controls);
    host.append(node('p','These are proof views. All '+r.targets.length+' targets stay in the saved inquiry. A removal profile must meet the other group members; targets outside the group are also shown, with their own achieved values.'));
    const witnessSummary=node('div');witnessSummary.className='conflict-witness-summary';witnessSummary.id='conflict-witness-summary';
    const values=node('div');values.id='conflict-values-host';
    const inspection=node('div');inspection.className='conflict-controls';
    const time=node('select');time.id='conflict-time';const timeLabel=node('label','Inspect an original time');timeLabel.htmlFor=time.id;timeLabel.append(time);
    for(const t of r.originalTimes){const option=node('option',t.utc+' · '+(t.index?'original boundary '+t.index:'initial state'));option.value=String(t.index);time.append(option);}
    const receiver=node('select');receiver.id='conflict-receiver';const receiverLabel=node('label','Inspect an original receiver');receiverLabel.htmlFor=receiver.id;receiverLabel.append(receiver);
    c.removalWitnesses[0].witness.originalReplays.forEach((replay,i)=>{const option=node('option',point(readings[replay.representativeReadingIndex])+(i===0?' · target comparison point':' · original receiver'));option.value=String(i);receiver.append(option);});
    inspection.append(timeLabel,receiverLabel);const timeHost=node('div');timeHost.id='conflict-time-view';
    const profile=node('div');profile.id='conflict-profile';host.append(witnessSummary,values,inspection,timeHost,profile);
    removal.value=String(c.targetIndices[0]);time.value=String(r.targets[c.targetIndices[0]].originalIndex);receiver.value='0';
    const active=()=>isCurrent()&&host.isConnected&&removal.isConnected&&time.isConnected&&receiver.isConnected;
    const selected=()=>c.removalWitnesses.find(v=>v.removedTargetIndex===Number(removal.value));
    function drawTime(){
      if(!active())return;const w=selected(),sourceIndex=Number(receiver.value),originalIndex=Number(time.value);
      const replay=w?.witness.originalReplays[sourceIndex],p=replay?.originalCourse[originalIndex];if(!p)return;
      timeHost.replaceChildren();Object.assign(timeHost.dataset,{removedTargetIndex:String(w.removedTargetIndex),originalIndex:String(originalIndex),receiver:String(sourceIndex),cell:String(replay.cellIndex),utc:p.utc});
      timeHost.append(node('h3',p.utc+' · '+point(readings[replay.representativeReadingIndex])),node('p','This view uses the same removal profile at every receiver and original time. Changing the inspected time does not choose a new sky history.'));
      const cards=node('div');cards.className='target-time-cards';
      for(const [store,title]of stores){
        const model=Object.fromEntries(['lower','upper'].map(side=>[side,profileFraction(sub(exact(p.additiveC.proposal[side][store]),exact(p.additiveC.existing[side==='lower'?'upper':'lower'][store])))]));
        const numeric=Object.fromEntries(['lower','upper'].map(side=>[side,profileFraction(sub(q(p.originalC.proposal[side][store]),q(p.originalC.existing[side==='lower'?'upper':'lower'][store])))]));
        const target=sourceIndex===0?w.targets.find(t=>t.originalIndex===originalIndex&&t.store===store):null;
        const card=node('article');card.className='target-time-card conflict-time-card';
        Object.assign(card.dataset,{removedTargetIndex:String(w.removedTargetIndex),store,utc:p.utc,originalIndex:String(originalIndex),receiver:String(sourceIndex),
          modelLower:String(model.lower.lower),modelUpper:String(model.upper.upper),numericalLower:String(numeric.lower.lower),numericalUpper:String(numeric.upper.upper),targetIndex:target?String(target.targetIndex):''});
        card.append(node('h4',title),node('p','Exact additive paired difference, displayed approximately: '+range(model.lower.lower,model.upper.upper)),
          node('p','Additive existing lower / upper: '+range(p.additiveC.existing.lower[store].lower,p.additiveC.existing.upper[store].upper)),
          node('p','Additive proposal lower / upper: '+range(p.additiveC.proposal.lower[store].lower,p.additiveC.proposal.upper[store].upper)),
          node('p','Original numerical existing lower / upper: '+range(p.originalC.existing.lower[store],p.originalC.existing.upper[store])),
          node('p','Original numerical proposal lower / upper: '+range(p.originalC.proposal.lower[store],p.originalC.proposal.upper[store])),
          node('p','Original numerical paired difference: '+range(numeric.lower.lower,numeric.upper.upper)));
        if(target){
          Object.assign(card.dataset,{ceiling:String(target.maximumDifferenceC),ceilingStatus:target.withinDeclaredCeiling?'within-authored-ceiling':'above-authored-ceiling',
            required:String(target.requiredAfterRemoval),removed:String(target.removedHere),replayLowerStatus:target.originalReplay.endpointStatus.lower,replayUpperStatus:target.originalReplay.endpointStatus.upper});
          card.append(node('p','Desired ceiling: '+String(target.maximumDifferenceC)+' °C. Additive profile: '+(target.withinDeclaredCeiling?'within this ceiling.':'above this ceiling.')),
            node('p',target.removedHere?'This is the omitted group member.':target.requiredAfterRemoval?'This group ceiling is required by the removal proof.':'This authored target lies outside the conflicting group.'),
            node('p','Original numerical lower / upper endpoint status: '+Object.values(target.originalReplay.endpointStatus).map(s=>s==='within-authored-ceiling'?'within ceiling':'above ceiling').join(' / ')+'.'));
        }else card.append(node('p','No authored target at this receiver, original time and component.'));
        cards.append(card);
      }
      timeHost.append(cards);
    }
    function drawWitness(){
      if(!active())return;const w=selected();if(!w)return;const omitted=w.targets[w.removedTargetIndex];
      Object.assign(witnessSummary.dataset,{removedTargetIndex:String(w.removedTargetIndex),requiredTargets:w.requiredTargetIndices.join(','),omittedExcess:String(omitted.excessC.lower)});
      witnessSummary.replaceChildren(node('h3','Without target '+(w.removedTargetIndex+1)+': '+omitted.utc+' · '+label(omitted.store)),
        node('p','One fixed set of three profiles meets all '+readings.length+' original observations and the '+w.requiredTargetIndices.length+' remaining group ceiling'+(w.requiredTargetIndices.length===1?'':'s')+'.'),
        node('p','It exceeds the omitted ceiling by approximately '+number(omitted.excessC.lower)+' °C. That ceiling is necessary for this group’s conflict.'),
        node('p','The original numerical replay has separate observation and target statuses. Exact feasibility here concerns the represented additive model.'));
      values.replaceChildren();const listing=table('Every authored target under this same removal profile, approximately in °C',
        ['Original UTC / component','Role in this proof','Desired ceiling','Profile difference','Excess','Exact model','Original numerical endpoints','Inspect'],w.targets.map(t=>[
          t.utc+' / '+label(t.store),t.removedHere?'Omitted group member':t.requiredAfterRemoval?'Required group member':'Outside this group',String(t.maximumDifferenceC),signed(t.differenceC.lower),signed(t.excessC.lower),
          t.withinDeclaredCeiling?'within ceiling':'above ceiling',Object.values(t.originalReplay.endpointStatus).map(s=>s==='within-authored-ceiling'?'within':'above').join(' / '),'']));
      listing.id='conflict-values';
      listing.querySelectorAll('tbody tr').forEach((row,i)=>{
        const t=w.targets[i];Object.assign(row.dataset,{targetIndex:String(i),originalIndex:String(t.originalIndex),utc:t.utc,store:t.store,required:String(t.requiredAfterRemoval),removed:String(t.removedHere),
          ceiling:String(t.maximumDifferenceC),difference:String(t.differenceC.lower),excess:String(t.excessC.lower),within:String(t.withinDeclaredCeiling),replayLowerStatus:t.originalReplay.endpointStatus.lower,replayUpperStatus:t.originalReplay.endpointStatus.upper});
        const button=node('button','Inspect');button.type='button';button.setAttribute('aria-label','Inspect '+t.utc+' '+label(t.store));row.lastElementChild.append(button);
        button.addEventListener('click',()=>{if(!button.isConnected||!active()||selected()!==w)return;time.value=String(t.originalIndex);receiver.value='0';drawTime();});
      });values.append(listing);
      drawThreeEpochWitness(profile,{report:{witnesses:[w.witness],splitUtcs:r.splitUtcs,readings:r.originalTargetMargin.original.readings},readings,witnessId:w.witness.id});
      profile.querySelectorAll('[id]').forEach(e=>{e.id='conflict-'+e.id;});drawTime();
    }
    memberTable.querySelectorAll('tbody tr').forEach((row,i)=>{
      const index=c.targetIndices[i];row.dataset.targetIndex=String(index);const button=node('button','Inspect without this ceiling');button.type='button';row.lastElementChild.append(button);
      button.addEventListener('click',()=>{if(!button.isConnected||!active())return;removal.value=String(index);drawWitness();});
    });
    removal.addEventListener('change',drawWitness);time.addEventListener('change',drawTime);receiver.addEventListener('change',drawTime);drawWitness();
    const proof=node('details');proof.className='conflict-certificate';proof.append(node('summary','Inspect the exact conflict and necessity certificates'));
    proof.append(node('p','The original observation rows remain in every proof. The nonnegative Farkas multipliers prove this group incompatible; each removal point proves the final smaller group feasible.'));
    const pre=node('pre');pre.textContent=JSON.stringify({targetIndices:c.targetIndices,originalConstraintCount:r.exactEvidence.analysis.conflict.originalConstraintCount,
      certificate:r.exactEvidence.analysis.conflict.certificate,removalCertificates:r.exactEvidence.analysis.conflict.removalWitnesses.map(w=>({removedTargetIndex:w.removedTargetIndex,requiredTargetIndices:w.requiredTargetIndices,certificate:w.feasibilityCertificate}))},null,2);proof.append(pre);host.append(proof);
  }
  const parentDetail=node('details');parentDetail.className='conflict-full-margin';parentDetail.id='conflict-full-margin';
  parentDetail.append(node('summary','Inspect the full original common-margin comparison'));
  const parentHost=node('div');parentDetail.append(parentHost);host.append(parentDetail);let parentDrawn=false;
  function drawParent(){if(!isCurrent()||!parentDetail.isConnected||!parentDetail.open||parentDrawn)return;parentDrawn=true;drawTargetReport(parentHost,{investigation:result.investigation,report:r.originalTargetMargin},isCurrent);}
  parentDetail.addEventListener('toggle',drawParent);if(!c){parentDetail.open=true;drawParent();}
}
