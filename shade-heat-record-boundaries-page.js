import {node,number,point,table} from './shade-heat-epoch-view.js';
import {drawManyWitness} from './shade-heat-many-view.js';
import {drawRecordBoundaryPlots} from './shade-heat-record-boundaries-view.js';
import {originalSkyReadingTimes} from './shade-heat-timed-reading-source.js';
import {parseRecordBoundaryOriginals} from './shade-heat-record-boundaries-inputs.js';
import {makeManySkyExample} from './shade-heat-many-example.js';
import {createShadeHeatComputation} from './shade-heat-computation.js';
import {checkShadeHeatBytes} from './shade-heat.js';

const $=id=>document.querySelector('#record-boundary-'+id);
const computation=createShadeHeatComputation(()=>new Worker(new URL('./shade-heat-record-boundaries-worker.js',import.meta.url),{type:'module'}));
const stores=[['surfaceC','Ground surface'],['subsurfaceC','Lower heat store']];
const component=value=>value==='surfaceC'?'ground surface':'lower heat store';
const timeText=utc=>utc.slice(11,16)+' UTC';
const exactText=value=>value.exact.numerator+'/'+value.exact.denominator;
const rangeText=range=>range?number(range.lower.differenceC.lower)+' to '+number(range.upper.differenceC.upper)+' °C':'No compatible offered boundary';
let originals=null,primary=0,accepted=null,generation=0,reading=false;
let selectedTime=0,selectedBoundary=0,selectedWitness=null;
const pending=()=>reading||computation.pending;
const ordered=()=>originals?[originals[primary],...originals.filter((_value,index)=>index!==primary)]:null;
const offered=()=>$('splits').value.split(',').map(value=>value.trim()?Number(value.trim()):NaN);
function state(text,kind){$('status').textContent=text;$('status').dataset.state=kind;}
function controls(){
  $('run').disabled=pending()||!originals;$('export').disabled=pending()||!accepted;
  $('primary').disabled=!originals;$('all').disabled=!originals;
}
function clearResult(){accepted=null;$('results').replaceChildren();$('results').hidden=true;for(const key of Object.keys($('results').dataset))delete $('results').dataset[key];}
function invalidate(message){generation++;reading=false;computation.cancel();clearResult();controls();state(message,'not-compared');}
function updateHint(){
  if(!originals){$('hint').textContent='Load a record to inspect its original clock.';return;}
  const times=originalSkyReadingTimes(originals[0].source),values=offered();
  const valid=values.length>0&&values.length<=23&&values.every(v=>Number.isInteger(v)&&v>0&&v<times.length-1)&&new Set(values).size===values.length;
  $('hint').dataset.valid=String(valid);
  $('hint').textContent=valid?values.length+' offered original boundaries, in this order: '+values.map(v=>v+' → '+times[v].utc).join('; ')+'.'
    :'Offer distinct whole-number interval indices from 1 to '+(times.length-2)+'. Every choice must leave an original interval on both sides; the complete list is subject to one aggregate work allowance.';
}
function drawSources(){
  const select=$('primary');select.replaceChildren();
  if(!originals){select.append(new Option('No record loaded',''));return;}
  originals.forEach((input,index)=>select.append(new Option((index+1)+' · '+point(input)+' · '+input.query.reading.utc+' · '+component(input.query.reading.store),String(index))));
  select.value=String(primary);
  const readings=ordered(),unique=new Set(readings.map(r=>r.query.reading.cellIndex)).size;
  $('source-summary').textContent=readings.length+' original readings across '+unique+' complete receiver sources. First record: '+point(readings[0])+', '+readings[0].query.reading.utc+'. All records remain in every offered alternative.';
  $('source-summary').dataset.records=String(readings.length);
  const host=$('source-table');host.replaceChildren();
  const rows=readings.map((input,index)=>{
    const r=input.query.reading;
    return [(index+1)+(index<3?' · reference':''),point(input),r.utc,component(r.store),String(r.temperatureC)+' ± '+String(r.halfWidthC)+' °C',String(input.query.bins),r.source];
  });
  const originalTable=table('All original observations in the declared evidence order',['Record','Receiver','Original UTC','Component','Original band','Original sky bins','Original attribution'],rows);
  originalTable.id='record-boundary-original-table';host.append(originalTable);
  const seen=new Set();
  readings.forEach(input=>{
    const cell=input.query.reading.cellIndex;if(seen.has(cell))return;seen.add(cell);
    const detail=node('details');detail.append(node('summary','Complete original declaration at '+point(input)),node('pre',JSON.stringify(input.source,null,2)));host.append(detail);
  });
  updateHint();controls();
}
function chooseBoundary(index,witnessId=null){
  if(!accepted)return;selectedBoundary=index;
  const r=accepted.report.boundaries[index].report;
  selectedWitness=witnessId!==null?witnessId:r.witnesses[0]?.id??null;
  drawSelectedBoundary();drawPlots();
  for(const button of $('offers').querySelectorAll('button'))button.setAttribute('aria-pressed',String(Number(button.dataset.offer)===selectedBoundary));
}
function drawPlots(){if(accepted)drawRecordBoundaryPlots($('plots'),accepted.report,selectedTime,selectedBoundary,selectedWitness);}
function drawWitness(){
  if(!accepted||selectedWitness===null)return;
  const boundary=accepted.report.boundaries[selectedBoundary];
  drawManyWitness($('witness'),{report:boundary.report,readings:accepted.investigation.readings,witnessId:selectedWitness});
}
function drawSelectedBoundary(){
  const context=accepted,viewGeneration=generation,r=context.report,boundary=r.boundaries[selectedBoundary],br=boundary.report;
  const alive=()=>accepted===context&&generation===viewGeneration;
  const host=$('selected');host.replaceChildren();host.dataset.offer=String(boundary.offeredIndex);host.dataset.split=String(boundary.splitAfterInterval);host.dataset.status=br.compatibility;
  host.append(node('h3',timeText(boundary.splitUtc)+' · after original interval '+boundary.splitAfterInterval),
    node('p','Full original UTC: '+boundary.splitUtc+'. The same '+br.readings.length+' original bands remain constraints at this offered time.'));
  const status=node('p',br.compatibility==='compatible'
    ?'The complete record admits shared profiles at this offered boundary. Inspect one fixed profile pair below; this is conditional compatibility, not a recovered physical time.'
    :'No shared profile pair satisfies the complete original record at this offered boundary. This alternative remains in the comparison with its incompatible result.');
  status.id='record-boundary-selected-status';host.append(status,
    node('p','First-three reference: '+br.firstThree.compatibility+'. Complete record: '+br.compatibility+'.'));
  if(br.compatibility==='compatible'){
    const label=node('label','One fixed profile at this boundary'),select=node('select');select.id='record-boundary-profile';
    br.witnesses.forEach(w=>select.append(new Option('Profile '+w.id+' · the same pair through every receiver and original time',String(w.id))));
    select.value=String(selectedWitness);label.append(select);host.append(label);
    select.addEventListener('change',()=>{if(!alive()||!select.isConnected)return;selectedWitness=Number(select.value);drawWitness();drawPlots();});
    const details=node('details');details.id='record-boundary-profile-details';
    details.append(node('summary','Follow this profile through all original observations and source courses'));
    const witness=node('div');witness.id='record-boundary-witness';details.append(witness);host.append(details);drawWitness();
  }
  const proof=node('details');proof.className='record-proof';proof.append(node('summary',br.compatibility==='compatible'?'Inspect the original-matrix feasibility certificate':'Inspect the original-matrix incompatibility certificate'));
  proof.append(node('p','This exact certificate refers to the unchanged original band inequalities at this boundary. Original numerical replay is checked separately for every displayed compatible profile.'),
    node('pre',JSON.stringify({splitAfterInterval:boundary.splitAfterInterval,splitUtc:boundary.splitUtc,
      originalRecordCount:br.readings.length,status:br.exactEvidence.all.status,
      linearModel:br.exactEvidence.all.linearModel,certificate:br.exactEvidence.all.certificate},null,2)));host.append(proof);
}
function drawTime(){
  const context=accepted,viewGeneration=generation,r=context.report,row=r.pointwiseCourse[selectedTime],reference=r.firstThree.pointwiseCourse[selectedTime];
  const alive=()=>accepted===context&&generation===viewGeneration;
  $('time-output').textContent=row.utc+' · original minute '+row.minute+' · accumulated thermal minute '+row.thermalMinute;
  const host=$('time-detail');host.replaceChildren();host.dataset.index=String(row.index);host.dataset.utc=row.utc;
  host.append(node('h3','Design consequences at '+timeText(row.utc)),node('p','Proposal minus existing at '+point(context.investigation.readings[0])+'. These unions include every compatible offered boundary; the selected boundary above does not filter them.'));
  const comparison=table('First-three and complete-record pointwise unions, in °C',['Temperature','First-three reference','Complete original record'],stores.map(([store,title])=>[title,rangeText(reference.ranges?.[store]),rangeText(row.ranges?.[store])]));
  comparison.id='record-boundary-range-table';host.append(comparison);
  if(!row.ranges){host.append(node('p','The full record rejects every offered boundary. No full-record range or profile is substituted from the reference family.'));return;}
  const origins=node('div');origins.className='record-origins';
  for(const [store,title] of stores){
    const section=node('section');section.append(node('h4',title));
    const before=reference.ranges[store].upper.differenceC.upper-reference.ranges[store].lower.differenceC.lower;
    const after=row.ranges[store].upper.differenceC.upper-row.ranges[store].lower.differenceC.lower;
    const width=node('p','Displayed range width: '+number(before)+' → '+number(after)+' °C.');
    width.className='record-width-change';Object.assign(width.dataset,{store,before:String(before),after:String(after)});section.append(width);
    for(const side of ['lower','upper']){
      const endpoint=row.ranges[store][side];
      host.dataset[store+(side==='lower'?'Lower':'Upper')]=String(endpoint.differenceC[side]);
      section.append(node('p',(side==='lower'?'Minimum':'Maximum')+': '+number(endpoint.differenceC[side])+' °C. '+endpoint.attainments.length+' attaining offered '+(endpoint.attainments.length===1?'boundary':'boundaries')+'.'));
      for(const origin of endpoint.attainments){
        const button=node('button',timeText(origin.splitUtc)+' · profile '+origin.witnessId);button.type='button';
        Object.assign(button.dataset,{origin:'true',store,side,offer:String(origin.offeredIndex),split:String(origin.splitAfterInterval),witness:String(origin.witnessId),proof:String(origin.proofIndex)});
        button.addEventListener('click',()=>{if(!alive()||!button.isConnected||selectedTime!==row.index)return;chooseBoundary(origin.offeredIndex,origin.witnessId);});section.append(button);
      }
      const detail=node('details');detail.append(node('summary','Exact '+side+' endpoint and every origin'),node('p',exactText(endpoint.differenceC)+' °C'),node('pre',JSON.stringify(endpoint.attainments,null,2)));section.append(detail);
    }
    origins.append(section);
  }
  host.append(origins);
}
function drawResults(result,reset=true){
  const host=$('results');host.replaceChildren();host.hidden=false;
  const r=result.report,viewGeneration=generation,alive=()=>accepted===result&&generation===viewGeneration;
  if(reset){selectedTime=Math.min(4,r.originalTimes.length-1);selectedBoundary=r.boundaryComparison.allRecordsCompatible[0]??0;selectedWitness=r.boundaries[selectedBoundary].report.witnesses[0]?.id??null;}
  Object.assign(host.dataset,{status:r.compatibility,offered:String(r.boundaries.length),compatible:String(r.boundaryComparison.allRecordsCompatible.length),referenceCompatible:String(r.boundaryComparison.firstThreeCompatible.length),records:String(r.originalRecordCount),cell:String(r.cellIndex)});
  const eyebrow=node('p','03 / Read what the complete record rules out');eyebrow.className='eyebrow';host.append(eyebrow,node('h2','Every offered time keeps its result'));
  const counts=node('div');counts.className='record-counts';
  for(const [count,label,kind] of [[r.boundaries.length,'original change times offered','offered'],[r.boundaryComparison.firstThreeCompatible.length,'allowed by the first three readings','reference'],[r.boundaryComparison.allRecordsCompatible.length,'allowed by the whole record','full']]){
    const item=node('div');item.className='record-count';item.dataset.kind=kind;item.append(node('strong',String(count)),node('span',label));counts.append(item);
  }
  host.append(counts,node('p',r.boundaryComparison.rejectedByAdditionalRecords.length+' offered times are ruled out by the additional original records. The list stays in the supplied order; no rejected alternative or observation is dropped.'));
  const note=node('p','Compatibility is conditional on the declared two-epoch sky model and original thermal sources. Even one surviving offered time does not establish a physical time of change; unoffered times and other models have not been assessed.');note.className='many-notice';host.append(note);
  const offers=node('div');offers.id='record-boundary-offers';offers.className='record-offers';
  for(const boundary of r.boundaries){
    const button=node('button');button.type='button';button.className='record-offer';button.dataset.offer=String(boundary.offeredIndex);button.dataset.split=String(boundary.splitAfterInterval);button.dataset.status=boundary.report.compatibility;
    button.setAttribute('aria-pressed',String(boundary.offeredIndex===selectedBoundary));button.setAttribute('aria-label',boundary.splitUtc+', interval '+boundary.splitAfterInterval+', whole record '+boundary.report.compatibility+', first three '+boundary.report.firstThree.compatibility);
    button.append(node('strong',timeText(boundary.splitUtc)),node('span',boundary.report.compatibility==='compatible'?'Compatible':'Rejected'),node('small','First three: '+(boundary.report.firstThree.compatibility==='compatible'?'allowed':'rejected')+' · interval '+boundary.splitAfterInterval));
    button.addEventListener('click',()=>{if(alive()&&button.isConnected)chooseBoundary(boundary.offeredIndex);});offers.append(button);
  }
  host.append(offers);
  const selected=node('section');selected.id='record-boundary-selected';selected.className='record-selected';host.append(selected);
  host.append(node('h2','Consequences across all compatible offered times'));
  const envelope=node('p','The first-three and whole-record envelopes optimize each original time separately. Different endpoints can use different change times and profiles, so neither envelope is one realized course. Orange markers belong to the single selected boundary and profile.');envelope.className='many-notice';host.append(envelope);
  const legend=node('div');legend.className='record-legend';
  for(const [className,text] of [['legend-prior','First-three union'],['legend-range','Whole-record union'],['legend-profile','Selected fixed profile'],['legend-change','Selected change boundary']]){
    const item=node('span'),key=node('i');key.className=className;item.append(key,document.createTextNode(text));legend.append(item);
  }
  host.append(legend);const plots=node('div');plots.id='record-boundary-plots';plots.className='many-plots';host.append(plots);
  const time=node('label','Inspect an original time');time.className='record-time';
  const slider=node('input');slider.type='range';slider.min='0';slider.max=String(r.originalTimes.length-1);slider.step='1';slider.value=String(selectedTime);slider.id='record-boundary-time';
  const output=node('output');output.id='record-boundary-time-output';output.htmlFor=slider.id;time.append(slider,output);host.append(time);
  slider.addEventListener('input',()=>{if(!alive()||!slider.isConnected)return;selectedTime=Number(slider.value);drawTime();drawPlots();});
  const detail=node('section');detail.id='record-boundary-time-detail';detail.className='record-range';host.append(detail);
  const work=node('details');work.append(node('summary','Complete comparison work and qualifications'),node('p',r.work.executedBasisCourses+' complete basis courses and '+r.work.executedWitnessCourses+' fixed-profile witness courses executed across all '+r.boundaries.length+' offered boundaries. The whole inquiry reserved '+r.work.reservedCourseIntervals+' thermal intervals before execution. No partial comparison is accepted on exhaustion.'),node('p',r.semantics));host.append(work);
  drawSelectedBoundary();drawTime();drawPlots();controls();
}
function admitResult(result){accepted=result;reading=false;drawResults(result);controls();state('Compared all '+result.report.boundaries.length+' offered times against all '+result.investigation.readings.length+' original records. '+result.report.boundaryComparison.allRecordsCompatible.length+' offered times remain compatible.','compared');}
async function run(){
  if(!originals)return;const list=ordered(),query={bins:4,splitAfterIntervals:offered(),sharingSource:$('sharing').value};
  const request=++generation;reading=false;computation.cancel();clearResult();
  state('Comparing the entire offered list and original record…','running');
  const job=computation.compute({operation:'prepare',originals:list,query});controls();
  try{const result=await job;if(request!==generation)return;admitResult(result);}
  catch(error){if(request!==generation||error.code==='superseded')return;clearResult();state(error.message,'refused');controls();}
}
const decode=buffer=>new TextDecoder('utf-8',{fatal:true}).decode(buffer);
async function openFiles(input,reopen){
  const files=[...input.files];if(!files.length)return;
  const request=++generation;reading=true;computation.cancel();controls();state('Reading original evidence…','file-pending');
  try{
    if(reopen?files.length!==1:!(files.length===1||(files.length>=3&&files.length<=24)))throw Error(reopen?'Choose one saved inquiry':'Choose three to 24 original reading files or one saved inquiry');
    checkShadeHeatBytes(files.reduce((sum,file)=>sum+file.size,0));
    const texts=(await Promise.all(files.map(file=>file.arrayBuffer()))).map(decode);
    if(request!==generation)return;
    if(reopen){
      const job=computation.compute({operation:'parse',text:texts[0]});controls();const result=await job;
      if(request!==generation)return;
      originals=result.investigation.readings;primary=0;
      $('splits').value=result.investigation.query.splitAfterIntervals.join(', ');$('sharing').value=result.investigation.query.sharingSource;
      drawSources();admitResult(result);
    }else{
      const value=parseRecordBoundaryOriginals(texts);if(request!==generation)return;
      originals=value.readings;primary=0;$('sharing').value=value.sharingSource??'';reading=false;clearResult();drawSources();controls();
      state('Original record loaded. Your offered boundary list is retained; declare shared conditions and compare the whole list.','not-compared');
    }
  }catch(error){
    if(request!==generation||error.code==='superseded')return;reading=false;
    if(accepted)drawResults(accepted,false);
    state('File refused: '+error.message+'. The last admitted original record is retained.','file-refused');controls();
  }finally{if(request===generation){reading=false;input.value='';controls();}}
}
$('form').addEventListener('submit',event=>{event.preventDefault();run();});
$('example').addEventListener('click',()=>{
  const input=makeManySkyExample();invalidate('Authored original record loaded.');originals=input.readings;primary=0;
  $('sharing').value=input.query.sharingSource;$('splits').value=Array.from({length:15},(_,i)=>i+1).join(', ');drawSources();run();
});
$('originals').addEventListener('change',()=>openFiles($('originals'),false));
$('reopen').addEventListener('change',()=>openFiles($('reopen'),true));
$('primary').addEventListener('change',()=>{primary=Number($('primary').value);invalidate('First record changed. Compare again with the explicit new reference order and comparison point.');drawSources();});
for(const id of ['splits','sharing'])$(id).addEventListener('input',()=>{invalidate('Conditions changed. Compare again before inspecting or downloading a result.');updateHint();});
$('all').addEventListener('click',()=>{
  if(!originals)return;$('splits').value=originalSkyReadingTimes(originals[0].source).slice(1,-1).map(row=>row.index).join(', ');
  invalidate('Every internal original boundary is now explicitly offered. Compare the complete list.');updateHint();
});
$('export').addEventListener('click',()=>{
  if(!accepted||pending())return;const text=JSON.stringify(accepted.investigation,null,2)+'\n';checkShadeHeatBytes(new Blob([text]).size);
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),anchor=node('a');anchor.href=url;anchor.download='complete-record-sky-boundary-inputs.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),0);
});
for(const id of ['example','originals','reopen','splits','sharing'])$(id).disabled=false;
controls();document.documentElement.dataset.recordBoundaryReady='true';
