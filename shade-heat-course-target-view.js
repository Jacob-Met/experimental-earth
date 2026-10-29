import {node,number,signed,point,table} from './shade-heat-epoch-view.js';
import {drawThreeEpochWitness} from './shade-heat-three-epoch-view.js';
import {profileFraction} from './shade-heat-profile-band.js';
import {rational as q,sub} from './vendor/chronos/exact-halfplanes.mjs';

const stores=[['surfaceC','Ground surface'],['subsurfaceC','Lower heat store']];
const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const range=(lower,upper)=>signed(lower)+' / '+signed(upper)+' °C';
const paired=states=>({lower:profileFraction(sub(exact(states.proposal.lower),exact(states.existing.upper))),
  upper:profileFraction(sub(exact(states.proposal.upper),exact(states.existing.lower)))});
function targetFigure(r){
  const figure=node('figure');figure.className='target-figure';
  const plot=node('div');plot.className='target-plot';plot.tabIndex=0;plot.setAttribute('role','region');plot.setAttribute('aria-label','Original sampled target excess plot');
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 840 320');svg.setAttribute('role','img');
  svg.setAttribute('aria-label','One shared profile: excess above each declared ceiling at its original sampled UTC. Markers are not connected.');
  const element=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))e.setAttribute(key,String(value));if(text!==undefined)e.textContent=text;svg.append(e);return e;};
  const values=r.targets.map(target=>target.excessC.lower),scale=Math.max(1e-12,...values.map(Math.abs));
  const normalized=values.map(value=>value/scale);let lo=Math.min(0,...normalized),hi=Math.max(0,...normalized);if(lo===hi){lo=-1;hi=1;}
  const first=Date.parse(r.originalTimes[0].utc),last=Date.parse(r.originalTimes.at(-1).utc);
  const x=utc=>104+(Date.parse(utc)-first)/(last-first||1)*702,y=value=>250-(value/scale-lo)/(hi-lo)*204;
  const tick=value=>value!==0&&(Math.abs(value)<.001||Math.abs(value)>=10000)?(value>0?'+':'')+value.toExponential(3):signed(value);
  for(const value of [...new Set([lo*scale,0,hi*scale])]){
    element('line',{x1:104,x2:806,y1:y(value),y2:y(value),stroke:value===0?'#789186':'#dce6df','stroke-dasharray':value===0?'':'4 5'});
    element('text',{x:94,y:y(value)+5,'text-anchor':'end','font-size':14,fill:'#455f55'},tick(value));
  }
  element('text',{x:104,y:22,'font-size':15,fill:'#254f42'},'Excess above the desired ceiling (°C)');
  for(const index of [...new Set([0,Math.floor((r.originalTimes.length-1)/2),r.originalTimes.length-1])]){
    const time=r.originalTimes[index];element('text',{x:x(time.utc),y:280,'text-anchor':index===0?'start':index===r.originalTimes.length-1?'end':'middle','font-size':14,fill:'#455f55'},time.utc.slice(11,19)+' UTC');
  }
  r.targets.forEach(target=>{
    const dot=element('circle',{cx:x(target.utc),cy:y(target.excessC.lower),r:target.attainsWorstExcess?6:4.5,
      fill:target.store==='surfaceC'?'#205b4e':'#356aa0',stroke:target.attainsWorstExcess?'#a46d35':'white','stroke-width':target.attainsWorstExcess?2.5:1});
    Object.assign(dot.dataset,{targetIndex:String(target.targetIndex),originalIndex:String(target.originalIndex),utc:target.utc,store:target.store,
      excess:String(target.excessC.lower),limiting:String(target.attainsWorstExcess)});
    const title=document.createElementNS(ns,'title');title.textContent=target.utc+' · '+stores.find(([key])=>key===target.store)[1]+': '+signed(target.excessC.lower)+' °C above its desired ceiling';dot.append(title);
  });
  plot.append(svg);figure.append(plot);
  const legend=node('div');legend.className='target-legend';
  for(const [store,label]of stores){const entry=node('span'),dot=node('i');if(store==='subsurfaceC')dot.className='target-lower-dot';entry.append(dot,document.createTextNode(label));legend.append(entry);}
  legend.append(node('span','Orange outline · limits the common margin'));
  figure.append(legend,node('figcaption','Each marker uses the same three profiles. Values above zero exceed that target’s ceiling. Only declared original samples are shown; no values between times are inferred.'));return figure;
}
export function drawTargetReport(host,result,isCurrent){
  const r=result.report,readings=result.investigation.readings;host.replaceChildren();
  for(const key of Object.keys(host.dataset))delete host.dataset[key];
  Object.assign(host.dataset,{observation:r.observationCompatibility,targets:r.targetCompatibility,records:String(readings.length),
    times:String(r.originalTimes.length),targetCount:String(r.targets.length),courses:String(r.work.executedThermalCourses),sources:String(r.work.uniqueSources)});
  host.append(node('p','03 / Read the common result'),node('h2','Every declared target, one shared profile'),
    node('p','Comparison point '+point(readings[0])+'. The '+readings.length+' original observations and both changes at '+r.splitUtcs.join(' and ')+' are retained.'));
  const outcome=node('div');outcome.className='target-outcome';outcome.dataset.compatibility=r.targetCompatibility;
  if(r.observationCompatibility==='incompatible'){
    outcome.append(node('h3','The original observations admit no common three-profile history'),
      node('p','Target optimization is not evaluated. There is no best-profile margin, target course or numerical replay to substitute for this incompatible original record.'),
      node('p','The first three original records are '+r.original.firstThree.compatibility+'; every original band still belongs to this inquiry.'));
    host.append(outcome,table('Declared targets retained without fabricated values',['Original UTC','Component','Desired ceiling °C'],r.targets.map(target=>[target.utc,stores.find(([key])=>key===target.store)[1],String(target.maximumDifferenceC)])));return;
  }
  host.dataset.minimumWorstExcess=String(r.margin.minimumWorstExcessC.lower);host.dataset.maximumCommonMargin=String(r.margin.maximumCommonMarginC.lower);
  outcome.append(node('h3',r.targetCompatibility==='compatible'?'One common profile meets all the declared ceilings':'The declared ceilings cannot all hold under one common profile'));
  const margin=node('p',r.targetCompatibility==='compatible'
    ?'Best common margin: ≈ '+signed(r.margin.maximumCommonMarginC.lower)+' °C'
    :'Best common profile still exceeds a ceiling by ≈ '+number(r.margin.minimumWorstExcessC.lower)+' °C');margin.className='target-margin';outcome.append(margin);
  outcome.append(node('p',r.margin.individuallyPossibleTargets+' of '+r.targets.length+' targets are separately attainable. The common result optimizes one shared profile across all of them while retaining every original observation.'),
    node('p','This is exact compatibility within the represented additive model. The full original numerical replay below has its own observation-band and target-ceiling statuses.'));
  const counts=node('p');counts.className='target-counts';
  for(const value of [r.targets.length+' declared targets',r.margin.activeTargetIndices.length+' targets limiting the margin',r.work.uniqueSources+' original receivers',r.originalTimes.length+' original times'])counts.append(node('span',value));
  host.append(outcome,counts,targetFigure(r));
  const listing=table('Every desired ceiling and the same common profile, approximately in °C',
    ['Original UTC / component','Desired ceiling','Separately attainable minimum','Common profile','Excess','Margin limiting','Inspect'],
    r.targets.map(target=>[target.utc+' / '+stores.find(([key])=>key===target.store)[1],String(target.maximumDifferenceC),signed(target.individualRange.lower.lower),signed(target.differenceC.lower),signed(target.excessC.lower),target.attainsWorstExcess?'yes':'no','']));
  listing.classList.add('target-result-table');listing.id='target-values';
  const rows=[...listing.querySelectorAll('tbody tr')];
  rows.forEach((row,index)=>{
    const target=r.targets[index];Object.assign(row.dataset,{targetIndex:String(index),originalIndex:String(target.originalIndex),utc:target.utc,store:target.store,
      ceiling:String(target.maximumDifferenceC),difference:String(target.differenceC.lower),excess:String(target.excessC.lower),limiting:String(target.attainsWorstExcess)});
    const button=node('button','Inspect');button.type='button';button.setAttribute('aria-label','Inspect '+target.utc+' '+stores.find(([key])=>key===target.store)[1]);row.lastElementChild.append(button);
    button.addEventListener('click',()=>{if(!button.isConnected||!isCurrent())return;time.value=String(target.originalIndex);receiver.value='0';drawTime();});
  });host.append(listing);
  const controls=node('div');controls.className='target-inspection-controls';
  const time=node('select');time.id='target-time';const timeLabel=node('label','Inspect an original time');timeLabel.htmlFor=time.id;timeLabel.append(time);
  for(const value of r.originalTimes){const option=node('option',value.utc+' · '+(value.index?'original boundary '+value.index:'initial state'));option.value=String(value.index);time.append(option);}
  const receiver=node('select');receiver.id='target-receiver';const receiverLabel=node('label','Inspect an original receiver');receiverLabel.htmlFor=receiver.id;receiverLabel.append(receiver);
  r.witness.originalReplays.forEach((replay,index)=>{const option=node('option',point(readings[replay.representativeReadingIndex])+(index===0?' · target comparison point':' · original receiver'));option.value=String(index);receiver.append(option);});
  controls.append(timeLabel,receiverLabel);const timeHost=node('div');timeHost.id='target-time-view';host.append(controls,timeHost);
  time.value=String(r.targets[0].originalIndex);receiver.value='0';
  const active=()=>isCurrent()&&host.isConnected&&time.isConnected&&receiver.isConnected;
  function drawTime(){
    if(!active())return;const index=Number(time.value),source=Number(receiver.value),replay=r.witness.originalReplays[source],value=replay?.originalCourse[index];if(!value)return;
    timeHost.replaceChildren();Object.assign(timeHost.dataset,{originalIndex:String(index),receiver:String(source),cell:String(replay.cellIndex),utc:value.utc});
    timeHost.append(node('h3',value.utc+' · '+point(readings[replay.representativeReadingIndex])),node('p','The same best common profile is inspected here. Changing this view does not calculate a new profile.'));
    const cards=node('div');cards.className='target-time-cards';
    for(const [store,label]of stores){
      const additive=Object.fromEntries(['existing','proposal'].map(design=>[design,Object.fromEntries(['lower','upper'].map(bound=>[bound,value.additiveC[design][bound][store]]))]));
      const original=Object.fromEntries(['existing','proposal'].map(design=>[design,Object.fromEntries(['lower','upper'].map(bound=>[bound,profileFraction(q(value.originalC[design][bound][store]))]))]));
      const model=paired(additive),numeric=paired(original),target=source===0?r.targets.find(target=>target.originalIndex===index&&target.store===store):null;
      const card=node('article');card.className='target-time-card';
      Object.assign(card.dataset,{store,utc:value.utc,originalIndex:String(index),receiver:String(source),modelLower:String(model.lower.lower),modelUpper:String(model.upper.upper),
        numericalLower:String(numeric.lower.lower),numericalUpper:String(numeric.upper.upper),targetIndex:target?String(target.targetIndex):''});
      card.append(node('h4',label),node('p','Exact additive paired difference, displayed approximately: '+range(model.lower.lower,model.upper.upper)),
        node('p','Additive existing lower / upper: '+range(additive.existing.lower.lower,additive.existing.upper.upper)),
        node('p','Additive proposal lower / upper: '+range(additive.proposal.lower.lower,additive.proposal.upper.upper)),
        node('p','Original numerical existing lower / upper: '+range(value.originalC.existing.lower[store],value.originalC.existing.upper[store])),
        node('p','Original numerical proposal lower / upper: '+range(value.originalC.proposal.lower[store],value.originalC.proposal.upper[store])),
        node('p','Original numerical paired difference: '+range(numeric.lower.lower,numeric.upper.upper)));
      if(target){
        Object.assign(card.dataset,{ceiling:String(target.maximumDifferenceC),ceilingStatus:target.withinDeclaredCeiling?'within-authored-ceiling':'above-authored-ceiling',
          replayLowerStatus:target.originalReplay.endpointStatus.lower,replayUpperStatus:target.originalReplay.endpointStatus.upper});
        card.append(node('p','Desired ceiling: '+String(target.maximumDifferenceC)+' °C. Common additive profile: '+(target.withinDeclaredCeiling?'within this ceiling.':'above this ceiling.')),
          node('p','Original numerical lower / upper endpoint status: '+Object.values(target.originalReplay.endpointStatus).map(status=>status==='within-authored-ceiling'?'within ceiling':'above ceiling').join(' / ')+'.'));
      }else card.append(node('p','No declared target at this receiver, original time and component.'));
      cards.append(card);
    }
    timeHost.append(cards);rows.forEach((row,i)=>{row.dataset.selected=String(source===0&&r.targets[i].originalIndex===index);});
  }
  time.addEventListener('change',drawTime);receiver.addEventListener('change',drawTime);drawTime();
  const profile=node('div');profile.id='target-profile';
  drawThreeEpochWitness(profile,{report:{witnesses:[r.witness],splitUtcs:r.splitUtcs,readings:r.original.readings},readings,witnessId:0});host.append(profile);
  const proof=node('details');proof.append(node('summary','Inspect the exact common-margin certificate'));
  proof.append(node('p','The certificate uses all original observation constraints and every declared target. It proves the best common excess for this represented model; it does not turn numerical replay into physical validation.'));
  const pre=node('pre');pre.textContent=JSON.stringify({minimumWorstExcessC:r.margin.minimumWorstExcessC.exact,maximumCommonMarginC:r.margin.maximumCommonMarginC.exact,
    lowerAnchorC:r.exactEvidence.lowerAnchorC,activeTargetIndices:r.margin.activeTargetIndices,certificate:r.exactEvidence.certificate},null,2);proof.append(pre);host.append(proof);
}
