import {checkShadeHeatBytes} from './shade-heat.js';
import {createShadeHeatComputation} from './shade-heat-computation.js';
import {originalSkyReadingTimes} from './shade-heat-timed-reading-source.js';
import {node,point,table} from './shade-heat-epoch-view.js';

export function startSkyCourseTargetPage({prepareSource,serializeSource,makeExample,drawReport,workerUrl,readSource,calculationMessage,appliedMessage,statusMessage,downloadName}){
const $=id=>document.getElementById('target-'+id);
const stores=[['surfaceC','Ground surface'],['subsurfaceC','Lower heat store']];
const computation=createShadeHeatComputation(()=>new Worker(workerUrl,{type:'module'}));
let originalBase=null,admitted=null,currentResult=null,sourceContext=null,editorRows=[];
let generation=0,dirty=false,reading=false;
const baseQuery=q=>({bins:q.bins,splitAfterIntervals:[...q.splitAfterIntervals],sharingSource:q.sharingSource});
function state(text,kind){$('status').textContent=text;$('status').dataset.state=kind;}
function clearResult(){currentResult=null;const host=$('results');host.replaceChildren();host.hidden=true;for(const key of Object.keys(host.dataset))delete host.dataset[key];}
function controls(){
  const pending=reading||computation.pending;
  $('run').disabled=pending||!admitted||dirty;
  $('export').disabled=pending||!currentResult||!admitted||dirty;
  $('apply').disabled=reading||!originalBase||!dirty;
  $('cancel').disabled=reading||!admitted||!dirty;
  $('attribution').disabled=!originalBase;
  $('shift').disabled=!originalBase;
  $('shift-apply').disabled=!originalBase;
}
function editorSummary(){
  if(!originalBase)return;
  const selected=editorRows.filter(row=>row.select.checked).length;
  $('editor-summary').textContent=selected+' selected targets at '+point(originalBase.readings[0])+' · '+editorRows.length+' original time/component choices. '
    +(dirty?'Draft changes must be applied before calculation.':'These declared targets are ready to calculate.');
}
function markDirty(message='Desired targets changed. Apply this draft, then recalculate the complete inquiry.'){
  ++generation;reading=false;computation.cancel();dirty=true;clearResult();editorSummary();controls();state(message,'draft');
}
function drawOriginals(){
  const host=$('originals');host.replaceChildren();
  if(!originalBase)return;
  const times=originalSkyReadingTimes(originalBase.readings[0].source);
  const splits=originalBase.query.splitAfterIntervals.map(index=>times[index].utc);
  $('source-summary').textContent=originalBase.readings.length+' original observations · '+times.length+' original times · comparison point '+point(originalBase.readings[0])+'.';
  host.append(node('p','The same three four-bin profiles are shared across every original receiver. Declared changes: '+splits.join(' and ')+'.'),
    node('p','Shared-condition source: '+originalBase.query.sharingSource));
  const listing=table('Every unchanged original observation',
    ['Record / point','Original UTC','Component','Observed C ± half-width','Original attribution'],originalBase.readings.map((input,i)=>{
      const r=input.query.reading;return [i+1+' / '+point(input),r.utc,stores.find(([key])=>key===r.store)[1],String(r.temperatureC)+' ± '+String(r.halfWidthC),r.source];
    }));
  listing.id='target-original-records';
  listing.querySelectorAll('tbody tr').forEach((row,i)=>{
    const r=originalBase.readings[i].query.reading;
    Object.assign(row.dataset,{record:String(i),cell:String(r.cellIndex),utc:r.utc,store:r.store,temperature:String(r.temperatureC),halfWidth:String(r.halfWidthC)});
  });
  host.append(listing,node('p','To revise an observation or the original shared conditions, use the three-profile inquiry and open its newly saved inputs here.'));
}
function drawEditor(query){
  const context={};sourceContext=context;editorRows=[];$('editor').replaceChildren();
  const selected=new Map(query.targets.map(target=>[target.originalIndex+':'+target.store,target]));
  for(const time of originalSkyReadingTimes(originalBase.readings[0].source))for(const [store,label] of stores){
    const identity=time.index+':'+store,target=selected.get(identity),row=node('div');row.className='target-edit-row';
    Object.assign(row.dataset,{originalIndex:String(time.index),store,selected:String(Boolean(target))});
    const select=node('input');select.type='checkbox';select.checked=Boolean(target);select.id='target-choice-'+time.index+'-'+store;
    const title=node('span',time.utc);title.append(node('small',label+' · '+(time.index?'original boundary '+time.index:'original initial state')));
    const selectLabel=node('label');selectLabel.className='target-select-label';selectLabel.htmlFor=select.id;selectLabel.append(select,title);
    const ceiling=node('input');ceiling.type='number';ceiling.step='any';ceiling.value=String(target?.maximumDifferenceC??0);ceiling.disabled=!select.checked;
    ceiling.id='target-ceiling-'+time.index+'-'+store;
    const ceilingLabel=node('label','Desired difference ceiling (°C)');ceilingLabel.className='target-ceiling-label';ceilingLabel.htmlFor=ceiling.id;ceilingLabel.append(ceiling);
    row.append(selectLabel,ceilingLabel);$('editor').append(row);
    editorRows.push({row,select,ceiling,originalIndex:time.index,store});
    select.addEventListener('input',()=>{
      if(!row.isConnected||sourceContext!==context)return;
      row.dataset.selected=String(select.checked);ceiling.disabled=!select.checked;markDirty();
    });
    ceiling.addEventListener('input',()=>{if(row.isConnected&&sourceContext===context)markDirty();});
  }
  $('attribution').value=query.targetSource;editorSummary();controls();
}
function adopt(source,isTarget){
  ++generation;reading=false;computation.cancel();clearResult();
  originalBase={readings:source.readings,query:baseQuery(source.query)};
  admitted=isTarget?source:null;dirty=!isTarget;drawOriginals();
  const query=isTarget?source.query:{...originalBase.query,
    targets:originalSkyReadingTimes(source.readings[0].source).filter(time=>time.index>0).flatMap(time=>stores.map(([store])=>({originalIndex:time.index,store,maximumDifferenceC:0}))),
    targetSource:'Authored desired no-warming ceilings at selected original times; these are objectives, not observations.'};
  drawEditor(query);$('original-details').open=false;controls();
}
async function run(){
  if(!admitted||dirty||reading)return;
  const request=++generation,input=admitted,identity=JSON.stringify(input);clearResult();
  state(calculationMessage,'calculating');
  const pending=computation.compute({operation:'prepare',originals:input.readings,query:input.query});controls();
  try{
    const result=await pending;if(request!==generation)return;
    if(JSON.stringify(result.investigation)!==identity)throw Error('The completed calculation does not belong to the current complete input');
    admitted=result.investigation;currentResult=result;
    drawReport($('results'),result,()=>currentResult===result);$('results').hidden=false;
    state(statusMessage(result.report),result.report.targetCompatibility);
  }catch(error){if(request===generation)state(error.message,'refused');}
  finally{if(request===generation)controls();}
}

$('attribution').addEventListener('input',()=>{if(originalBase)markDirty();});
$('shift-apply').addEventListener('click',()=>{
  if(!originalBase)return;
  const delta=$('shift').value.trim()?Number($('shift').value):NaN,selected=editorRows.filter(row=>row.select.checked);
  const values=selected.map(row=>row.ceiling.value.trim()?Number(row.ceiling.value)+delta:NaN);
  if(!Number.isFinite(delta)||!selected.length||values.some(value=>!Number.isFinite(value))){state('Enter a finite adjustment and finite ceilings for at least one selected target.','refused');return;}
  markDirty('Selected draft ceilings changed. The observations are unchanged. Apply this draft, then recalculate.');
  selected.forEach((row,index)=>{row.ceiling.value=String(values[index]);});
});
$('apply').addEventListener('click',()=>{
  if(!originalBase||!dirty||reading)return;
  try{
    const targets=editorRows.filter(row=>row.select.checked).map(row=>({originalIndex:row.originalIndex,store:row.store,
      maximumDifferenceC:row.ceiling.value.trim()?Number(row.ceiling.value):NaN}));
    const next=prepareSource(originalBase.readings,{...originalBase.query,targets,targetSource:$('attribution').value});
    ++generation;computation.cancel();clearResult();admitted=next;dirty=false;drawEditor(next.query);
    state(appliedMessage,'inputs-ready');controls();
  }catch(error){state(error.message,'refused');controls();}
});
$('cancel').addEventListener('click',()=>{
  if(!admitted||!dirty||reading)return;
  ++generation;computation.cancel();clearResult();dirty=false;drawEditor(admitted.query);
  state('Draft discarded. The previously applied targets are restored; calculate them afresh.','inputs-ready');controls();
});
$('run').addEventListener('click',run);
$('example').addEventListener('click',()=>{
  try{const raw=makeExample();adopt(prepareSource(raw.readings,raw.query),true);run();}
  catch(error){state(error.message,'refused');controls();}
});
$('open').addEventListener('change',async()=>{
  const file=$('open').files[0];$('open').value='';if(!file)return;
  computation.cancel();const request=++generation;reading=true;controls();state('Reading the complete saved original inputs…','file-pending');
  try{
    checkShadeHeatBytes(file.size);const bytes=await file.arrayBuffer();if(request!==generation)return;
    const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),raw=JSON.parse(text);
    const {source,isTarget}=readSource(text,raw?.kind);if(request!==generation)return;
    adopt(source,isTarget);
    if(isTarget)await run();
    else state('Every original observation and both declared changes are loaded. Review the proposed zero ceilings, apply your desired targets, then calculate.','draft');
  }catch(error){if(request===generation){reading=false;state('Saved inputs refused: '+error.message,'file-refused');controls();}}
});
$('export').addEventListener('click',()=>{
  if(reading||computation.pending||dirty||!currentResult||!admitted||currentResult.investigation!==admitted)return;
  try{
    const blob=new Blob([serializeSource(admitted)],{type:'application/json'});checkShadeHeatBytes(blob.size);
    const url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download=downloadName;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){state('Download refused: '+error.message,'refused');}
});
controls();$('example').disabled=false;$('open').disabled=false;

}
