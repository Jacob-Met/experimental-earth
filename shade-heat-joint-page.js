import { node, point, table, locationFigure, drawEpochWitness } from './shade-heat-epoch-view.js';
import { checkShadeHeatBytes } from './shade-heat.js';
import { createShadeHeatComputation } from './shade-heat-computation.js';
import { parseJointOriginals } from './shade-heat-joint-inputs.js';
import { courseWitnessDifferences } from './shade-heat-course-inputs.js';

const $ = id => document.querySelector('#joint-' + id);
const computation = createShadeHeatComputation(() => new Worker(new URL('./shade-heat-joint-worker.js', import.meta.url), { type:'module' }));
const stores = [['surfaceC','Ground surface'],['subsurfaceC','Lower heat store']];
let originals = null, primary = 0, accepted = null, generation = 0, reading = false, selectedTime = 0;
const pending = () => reading || computation.pending;
const numeric = id => $(id).value.trim() ? Number($(id).value) : NaN;
const compact = value => (value > 0 ? '+' : '') + (value !== 0 && Math.abs(value) < 1e-7 ? value.toExponential(6)
  : Number(value).toLocaleString('en-US',{maximumSignificantDigits:10}));
const fractionText = value => value.exact.numerator + ' / ' + value.exact.denominator;
const timeText = utc => utc.slice(11,19);
const storeText = field => stores.find(([name]) => name === field)?.[1] ?? field;
function state(text, kind) { $('status').textContent = text; $('status').dataset.state = kind; }
function controls() { $('run').disabled = pending() || !originals; $('export').disabled = pending() || !accepted; }
function clearResult() {
  accepted = null; $('results').replaceChildren(); $('results').hidden = true;
  for (const key of Object.keys($('results').dataset)) delete $('results').dataset[key];
}
function invalidate(message) { generation++; reading = false; computation.cancel(); clearResult(); controls(); state(message,'not-compared'); }
function startFile(message) { computation.cancel(); const request = ++generation; reading = true; controls(); state(message,'file-pending'); return request; }
function originalTimes() {
  if (!originals) return [];
  const path = originals[0].source.declaration.path, start = Date.parse(path.startUtc), end = Date.parse(path.endUtc);
  const count = Math.ceil((end-start)/(path.stepMinutes*60000));
  return Array.from({length:count+1},(_,index) => ({index,utc:new Date(index===count?end:start+index*path.stepMinutes*60000).toISOString()}));
}
function updateBoundaryHint() {
  if (!originals) return;
  const times = originalTimes(), split = numeric('split'); $('split').max = String(times.length-2);
  $('boundary').textContent = Number.isInteger(split) && split >= 1 && split < times.length-1
    ? 'Declared sky change: '+times[split].utc+'. All '+times.length+' original times remain in each complete witness replay.'
    : 'Choose one original interval number from 1 to '+(times.length-2)+'.';
}
function updateTimeHints() {
  const times=originalTimes();
  for(const prefix of ['first','second']) {
    const selected=$(prefix+'-time').value,row=times.find(time=>String(time.index)===selected);
    $(prefix+'-time-hint').textContent=row?'Original UTC: '+row.utc:'Choose an original time from the loaded evidence.';
  }
}
function populateTimes() {
  const times = originalTimes();
  for (const prefix of ['first','second']) {
    const select = $(prefix+'-time'), prior = select.value; select.replaceChildren();
    const empty = node('option','Choose an original time'); empty.value = ''; select.append(empty);
    for (const row of times) { const option = node('option',timeText(row.utc)+' UTC · '+(row.index?'interval '+row.index:'initial state')); option.value=String(row.index);select.append(option); }
    select.value = times.some(row => String(row.index)===prior) ? prior : '';
  }
  updateBoundaryHint();updateTimeHints();
}
function drawSources() {
  const host = $('sources'); host.replaceChildren(); updateBoundaryHint();
  if (!originals) {host.append(node('p','No original readings loaded.'));return;}
  const context = originals;
  originals.forEach((input,index) => {
    const r=input.query.reading,card=node('article');card.className='source-card';Object.assign(card.dataset,{primary:String(index===primary),cell:String(r.cellIndex)});
    const label=node('label'),radio=node('input');radio.type='radio';radio.name='joint-comparison-point';radio.value=String(index);radio.checked=index===primary;
    radio.addEventListener('input',()=>{if(!radio.checked||originals!==context)return;primary=index;invalidate('Comparison point changed. Check both limits again using all three original final bands.');drawSources();});
    label.append(radio,node('span','Compare designs at '+point(input)));
    card.append(label,node('p',input.source.project.title),node('strong',String(r.temperatureC)+' ± '+String(r.halfWidthC)+' °C'),
      node('p','Original existing-surface reading · '+r.utc),node('p',r.source),node('p','Original inquiry: '+input.query.bins+' sky bins; this shared inquiry uses four.'));
    host.append(card);
  });
}
function query() {return {bins:4,splitAfterInterval:numeric('split'),sharingSource:$('sharing').value,
  limits:['first','second'].map(prefix=>({originalIndex:numeric(prefix+'-time'),store:$(prefix+'-store').value,maximumDifferenceC:numeric(prefix+'-ceiling')})),limitSource:$('purpose').value};}
function receive(next) {
  accepted=next;originals=next.investigation.readings;primary=0;reading=false;
  const q=next.investigation.query;$('split').value=String(q.splitAfterInterval);$('sharing').value=q.sharingSource;$('purpose').value=q.limitSource;
  populateTimes();q.limits.forEach((limit,i)=>{const prefix=i?'second':'first';$(prefix+'-time').value=String(limit.originalIndex);$(prefix+'-store').value=limit.store;$(prefix+'-ceiling').value=String(limit.maximumDifferenceC);});
  selectedTime=q.limits[0].originalIndex;updateTimeHints();drawSources();draw();controls();
  const status=next.report.jointCompatibility;
  state(status==='jointly-compatible'?'One common profile meets both ceilings in the exact represented model. Inspect its separate original numerical replay below.'
    :status==='jointly-incompatible'?'No common profile meets both ceilings under these original final bands. The individual ranges and joint region explain the result.'
      :'The three original final bands admit no common profile at this boundary. No consequence region or witness is invented.',status);
}
for (const id of ['split','sharing','first-time','first-store','first-ceiling','second-time','second-store','second-ceiling','purpose'])
  $(id).addEventListener('input',()=>{invalidate('The shared conditions or desired limits changed. Check both limits again.');updateBoundaryHint();updateTimeHints();});
$('originals').addEventListener('change',async()=>{
  const files=[...($('originals').files??[])];if(!files.length)return;$('originals').value='';
  const request=startFile('Reading the complete original temperature evidence…');
  try{
    if(![1,3].includes(files.length))throw Error('Choose three original readings or one saved three-reading inquiry');
    checkShadeHeatBytes(files.reduce((sum,file)=>sum+file.size,0));
    const texts=await Promise.all(files.map(async file=>{checkShadeHeatBytes(file.size);return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await file.arrayBuffer());}));
    if(request!==generation)return;const next=parseJointOriginals(texts);originals=next.readings;primary=0;
    if(next.sharingSource!==null)$('sharing').value=next.sharingSource;
    clearResult();populateTimes();drawSources();state('Original evidence loaded. Choose the comparison point, change boundary and two desired limits.','inputs-ready');
  }catch(error){if(request===generation)state('Files refused: '+error.message+(accepted?' The prior accepted inquiry is retained.':''),'file-refused');}
  finally{if(request===generation){reading=false;controls();}}
});
$('form').addEventListener('submit',async event=>{
  event.preventDefault();if(!originals||pending())return;
  const ordered=[originals[primary],...originals.filter((_,index)=>index!==primary)],limits=query();
  invalidate('Completing all original pair courses, the common profile family and both desired limits…');const request=generation;
  try{const promise=computation.compute({operation:'prepare',originals:ordered,query:limits});controls();const next=await promise;if(request===generation)receive(next);}
  catch(error){if(request===generation&&error.code!=='superseded')state(error.message,'refused');}
  finally{if(request===generation)controls();}
});
$('reopen').addEventListener('change',async()=>{
  const file=$('reopen').files?.[0];if(!file)return;$('reopen').value='';const request=startFile('Reopening original evidence and desired limits, then recomputing the complete inquiry…');
  try{checkShadeHeatBytes(file.size);const bytes=await file.arrayBuffer();if(request!==generation)return;
    const next=await computation.compute({operation:'parse',text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)});if(request===generation)receive(next);
  }catch(error){if(request===generation&&error.code!=='superseded')state('File refused: '+error.message+(accepted?' The prior accepted inquiry is retained.':''),'file-refused');}
  finally{if(request===generation){reading=false;controls();}}
});
for(const [id,feasible] of [['example',false],['example-feasible',true]])$(id).addEventListener('click',async()=>{
  const request=startFile('Opening unchanged authored originals and the declared pair of desired limits…');
  try{const {makeJointCourseExample}=await import('./shade-heat-joint-example.js');if(request!==generation)return;const raw=makeJointCourseExample(feasible);
    const next=await computation.compute({operation:'prepare',originals:raw.readings,query:raw.query});if(request===generation)receive(next);
  }catch(error){if(request===generation&&error.code!=='superseded')state('Example refused: '+error.message,'file-refused');}
  finally{if(request===generation){reading=false;controls();}}
});
$('export').addEventListener('click',()=>{
  if(!accepted||pending())return;const text=JSON.stringify(accepted.investigation);checkShadeHeatBytes(new Blob([text]).size);
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=node('a');link.href=url;link.download='experimental-earth-joint-original-time-inputs.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
const svgNode=(tag,attributes={},text='')=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attributes))el.setAttribute(key,String(value));el.textContent=text;return el;};
function regionFigure(r) {
  const figure=node('figure');figure.className='joint-region';figure.id='joint-region';
  const svg=svgNode('svg',{viewBox:'0 0 440 330',role:'img','aria-label':'Joint paired temperature region at two original times. Blue is the common profile family; green satisfies both ceilings; orange is the replayed common profile.'});
  svg.append(svgNode('title',{},'Two consequences of the same shared profiles'),svgNode('desc',{},'Coordinates are approximate displays of exact model values. This is a region across profile choices, not an interpolated temperature path.'));
  const raw=r.hull.map(p=>p.differencesC.map(v=>v.lower)),bounds=[0,1].map(axis=>{
    const lo=Math.min(...raw.map(p=>p[axis])),hi=Math.max(...raw.map(p=>p[axis])),pad=Math.max((hi-lo)*.12,1e-6);return [lo-pad,hi+pad];
  });
  const x=v=>96+328*(v-bounds[0][0])/(bounds[0][1]-bounds[0][0]);
  const y=v=>270-246*(v-bounds[1][0])/(bounds[1][1]-bounds[1][0]);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const capX=x(clamp(r.query.limits[0].maximumDifferenceC,...bounds[0])),capY=y(clamp(r.query.limits[1].maximumDifferenceC,...bounds[1]));
  svg.append(svgNode('rect',{x:96,y:capY,width:Math.max(0,capX-96),height:Math.max(0,270-capY),fill:'#ecf4e9'}));
  const tick=v=>Number(v.toPrecision(6)).toString();
  for(let i=0;i<=4;i++){
    const value=bounds[1][0]+(bounds[1][1]-bounds[1][0])*i/4;
    svg.append(svgNode('line',{x1:96,x2:424,y1:y(value),y2:y(value),stroke:'#dce6df'}),svgNode('text',{x:88,y:y(value)+5,'text-anchor':'end','font-size':14,fill:'#506c69'},tick(value)));
  }
  for(let i=0;i<=2;i++){
    const value=bounds[0][0]+(bounds[0][1]-bounds[0][0])*i/2;
    svg.append(svgNode('text',{x:x(value),y:296,'text-anchor':i===0?'start':i===2?'end':'middle','font-size':14,fill:'#506c69'},tick(value)));
  }
  const shape=(values,kind,fill,stroke)=>{
    if(!values.length)return;const coords=values.map(p=>[x(p[0].lower),y(p[1].lower)]);
    if(coords.length===1)svg.append(svgNode('circle',{cx:coords[0][0],cy:coords[0][1],r:4,fill,stroke,'data-region':kind}));
    else svg.append(svgNode(coords.length===2?'polyline':'polygon',{points:coords.map(p=>p.join(',')).join(' '),fill:coords.length===2?'none':fill,stroke,'stroke-width':2,'data-region':kind}));
  };
  shape(r.hull.map(p=>p.differencesC),'family','#e0eaf4','#557ca0');shape(r.feasibleRegion,'feasible','#89b6a1','#205b4e');
  svg.append(svgNode('line',{x1:capX,x2:capX,y1:24,y2:270,stroke:'#527b47','stroke-dasharray':'5 4'}),svgNode('line',{x1:96,x2:424,y1:capY,y2:capY,stroke:'#527b47','stroke-dasharray':'5 4'}));
  if(r.witness){const v=r.witness.jointValuesC,marker=svgNode('circle',{cx:x(v[0].lower),cy:y(v[1].lower),r:4.5,fill:'#ba671d',stroke:'#fff','stroke-width':1.5,'data-joint-witness':'0','data-x':v[0].lower,'data-y':v[1].lower});marker.append(svgNode('title',{},'One common profile: '+compact(v[0].lower)+', '+compact(v[1].lower)+' °C'));svg.append(marker);}
  figure.append(svg);
  for(const [i,label]of [[0,'Horizontal'],[1,'Vertical']])figure.append(Object.assign(node('p',label+': '+storeText(r.axes[i].store)+' at '+timeText(r.axes[i].utc)+' UTC · proposal − existing, °C'),{className:'joint-axis-label'}));
  figure.append(node('figcaption','Blue: the joint model region. Green: both desired limits. Orange: one replayed shared profile. Dashed ceilings outside the region’s scale are shown at its edge; exact values are listed beside the plot. No values between the two original times are implied.'));
  return figure;
}
function chooseTime(index) {
  if(!accepted?.report.witness||!Number.isInteger(index)||index<0||index>=accepted.report.originalBoundaries.length)return;
  selectedTime=index;$('time-select').value=String(index);$('time-slider').value=String(index);drawTime();
}
function drawTime() {
  const r=accepted.report,host=$('time-detail'),row=courseWitnessDifferences(r.witness)[selectedTime];host.replaceChildren();
  Object.assign(host.dataset,{index:String(row.index),utc:row.utc,minute:String(row.minute),thermalMinute:String(row.thermalMinute)});
  host.append(node('h3','The same profile at '+row.utc),node('p','Original elapsed minutes: '+row.minute+'. Accumulated thermal minutes: '+row.thermalMinute+'.'));
  host.append(table('One unchanged shared profile · paired temperature difference in °C',['Component','Exact additive model · outward display','Original numerical replay'],stores.map(([field,title])=>{
    host.dataset[field+'Lower']=String(row.differenceC[field].lower.lower);host.dataset[field+'Upper']=String(row.differenceC[field].upper.upper);
    return [title,compact(row.differenceC[field].lower.lower)+' / '+compact(row.differenceC[field].upper.upper),String(row.originalDifferenceC[field].lower)+' / '+String(row.originalDifferenceC[field].upper)];
  })));
}
function drawWitness(context,r,host) {
  const w=r.witness,section=node('div');section.id='joint-witness';host.append(section);
  drawEpochWitness(section,{report:{...r,witnesses:[w]},readings:context.investigation.readings,witnessId:w.id,prefix:'joint'});
  const missed=w.originalLimits.some(limit=>Object.values(limit.endpointStatus).includes('above-authored-ceiling'));
  const notice=node('p',missed?'An original numerical replay endpoint is above a desired ceiling. The exact represented profile meets both limits; the separate numerical replay must not be reported as meeting that ceiling.'
    :'The original numerical replay endpoints also meet both desired ceilings for this witness. This separate check does not establish physical accuracy.');
  notice.id='joint-limit-replay-note';notice.className=missed?'joint-replay-alert':'replay-note';notice.dataset.status=missed?'above-authored-ceiling':'within-authored-ceiling';section.append(notice);
  section.append(table('The two goals · exact model and original numerical replay remain separate',['Original time / component','Desired ceiling °C','Exact additive witness · outward °C','Original replay endpoint °C','Original replay status'],w.originalLimits.map((limit,i)=>[limit.utc+' · '+storeText(limit.store),String(limit.maximumDifferenceC),String(w.jointValuesC[i].lower)+' / '+String(w.jointValuesC[i].upper),String(limit.differenceC.lower.lower)+' / '+String(limit.differenceC.upper.upper),limit.endpointStatus.upper])));
  const proof=node('details');proof.className='joint-exact';proof.append(node('summary','Exact construction of this shared profile'));
  for(const part of w.construction)proof.append(node('p','Original feasible candidate '+part.candidateId+' with weight '+fractionText(part.weight)+'.'));
  w.jointValuesC.forEach((value,i)=>proof.append(node('p','Consequence '+(i+1)+': '+fractionText(value)+' °C; ceiling '+fractionText(r.axes[i].maximumDifferenceC)+' °C.')));section.append(proof);
  const selection=node('div');selection.className='course-selection';
  const label=node('label','Inspect this profile at an original time'),select=node('select');select.id='joint-time-select';
  for(const row of r.originalBoundaries){const option=node('option',(row.index?'After interval '+row.index:'Initial state')+' · '+row.utc);option.value=String(row.index);select.append(option);}select.value=String(selectedTime);
  select.addEventListener('input',()=>{if(accepted===context)chooseTime(Number(select.value));});label.append(select);
  const sliderLabel=node('label','Move through the unchanged original course'),slider=node('input');slider.type='range';slider.id='joint-time-slider';slider.min='0';slider.max=String(r.originalBoundaries.length-1);slider.step='1';slider.value=String(selectedTime);
  slider.addEventListener('input',()=>{if(accepted===context)chooseTime(Number(slider.value));});sliderLabel.append(slider);selection.append(label,sliderLabel);section.append(selection);
  const detail=node('div');detail.id='joint-time-detail';section.append(detail);
  const all=node('details');all.append(node('summary','Original temperatures at all three receivers and all original times'));
  w.originalReplays.forEach((replay,i)=>all.append(table('Original numerical replay at '+point(context.investigation.readings[i])+' · lower / upper °C',['Original UTC','Existing surface','Proposal surface','Existing lower store','Proposal lower store'],replay.originalCourse.map(row=>[row.utc,...stores.flatMap(([field])=>['existing','proposal'].map(target=>String(row.originalC[target].lower[field])+' / '+String(row.originalC[target].upper[field])))]))));section.append(all);drawTime();
}
function draw() {
  const context=accepted,r=context.report,host=$('results');host.hidden=false;host.replaceChildren();
  Object.assign(host.dataset,{status:r.jointCompatibility,observations:r.observationCompatibility,cell:String(r.cellIndex),first:String(r.axes[0].index),second:String(r.axes[1].index),basis:String(r.work.executedBasisCourses),courses:String(r.work.executedThermalCourses),hull:String(r.hull.length),feasible:String(r.feasibleRegion.length),witness:String(Boolean(r.witness))});
  const intro=node('div');intro.className='course-intro';const text=node('div');text.append(Object.assign(node('p','03 / Read the two consequences together'),{className:'eyebrow'}),node('h2','One shared profile, two original times'),node('p','Comparison point '+point(context.investigation.readings[0])+'. Final readings: '+r.finalUtc+'. Declared sky change: '+r.splitUtc+'.'));
  const location=locationFigure(context.investigation.readings);location.querySelector('figcaption').textContent=context.investigation.readings.map((input,i)=>(i?'Final reading ':'Comparison ')+point(input)).join(' · ');intro.append(text,location);host.append(intro);
  const summary=node('section');summary.className='joint-summary'+(r.witness?'':' incompatible');summary.id='joint-summary';
  summary.append(node('h3',r.witness?'Both limits are possible under one exact model profile':r.observationCompatibility==='incompatible'?'No common profile satisfies the original final readings':'No common profile meets both desired limits'));
  summary.append(node('p',r.witness?'The witness below retains one early and one late profile across both selected times, every original receiver and both designs.'
    :r.individualRanges?.every(range=>range.individuallyPossible)?'Each ceiling is possible separately. Their combination is excluded by the common profile family; choosing a different favorable profile at each time would answer a different question.'
      :r.individualRanges?'At least one desired ceiling is already outside its individual model range. Both cannot hold together.':'All original sources and times remain available. No joint region or profile is fabricated.'));
  summary.append(node('p','The ceilings are desired consequences. They do not change, widen or replace any original observation band.'));host.append(summary);
  if(r.hull.length){
    const comparison=node('div');comparison.className='joint-comparison';comparison.append(regionFigure(r));const ranges=node('div');
    r.individualRanges.forEach((range,i)=>{const card=node('section');card.className='joint-range-card';Object.assign(card.dataset,{axis:String(i),possible:String(range.individuallyPossible),minimum:String(range.lower.lower),maximum:String(range.upper.upper),ceiling:String(r.query.limits[i].maximumDifferenceC)});
      card.append(node('h3',(i?'Second':'First')+' · '+timeText(r.axes[i].utc)+' UTC · '+storeText(r.axes[i].store)),node('p','Separately possible model differences:'),node('strong',compact(range.lower.lower)+' to '+compact(range.upper.upper)+' °C'),node('p','Desired maximum: '+String(r.query.limits[i].maximumDifferenceC)+' °C'),node('p',range.individuallyPossible?'Possible on its own':'Not possible on its own'));
      const exact=node('details');exact.className='joint-exact';exact.append(node('summary','Exact individual endpoints'),node('p','Minimum: '+fractionText(range.lower)+' °C.'),node('p','Maximum: '+fractionText(range.upper)+' °C.'));card.append(exact);ranges.append(card);
    });comparison.append(ranges);host.append(comparison);
    host.append(Object.assign(node('p','The blue region combines consequences across possible profiles at these two times. It is not a curve through time. Exact intersection with both ceilings establishes the model result; rounded plotted coordinates are only a display.'),{className:'course-notice'}));
  }
  if(r.witness)drawWitness(context,r,host);
  const work=node('details');work.append(node('summary','Complete work, original time identities and scope'),node('p',r.work.executedBasisCourses+' complete basis courses and '+r.work.executedWitnessCourses+' complete witness courses ran across '+r.work.intervals+' original intervals. The inquiry reserved '+r.work.reservedThermalCourses+' thermal courses before execution.'),node('p',r.work.profileIntersection.candidates+' feasible candidate vertices were projected; the complete joint region has '+r.hull.length+' vertices. No partial region is substituted if a capacity is exceeded.'),node('p',r.numericalEvidence.scope),node('p',r.semantics));
  work.append(table('All retained original times',['Original index','UTC','Source elapsed minutes','Thermal elapsed minutes'],r.originalBoundaries.map(row=>[row.index,row.utc,row.minute,row.thermalMinute])));host.append(work);
}
drawSources();controls();
for(const id of ['example','example-feasible','originals','reopen','split','sharing','first-time','first-store','first-ceiling','second-time','second-store','second-ceiling','purpose'])$(id).disabled=false;
