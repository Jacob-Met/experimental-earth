import {node,point,table} from './shade-heat-epoch-view.js';
import {originalSkyReadingTimes,sameSkyData} from './shade-heat-timed-reading-source.js';
import {checkShadeHeatBytes} from './shade-heat.js';
import {createShadeHeatComputation} from './shade-heat-computation.js';
import {prepareSkyConsequenceSource,serializeSkyConsequenceSource,parseSkyConsequenceSource,inspectSkyConsequenceWork} from './shade-heat-sky-consequence-course.js';
import {parseSkyConsequenceOriginals} from './shade-heat-sky-consequence-inputs.js';
import {makeThreeEpochSkyExample} from './shade-heat-three-epoch-example.js';
import {drawSkyConsequenceReport} from './shade-heat-sky-consequence-view.js';

const $=id=>document.getElementById('consequence-'+id);
const computation=createShadeHeatComputation(()=>new Worker(new URL('./shade-heat-sky-consequence-worker.js',import.meta.url),{type:'module'}));
let originals=null,accepted=null,generation=0,reading=false;
const pending=()=>reading||computation.pending;
const query=()=>({bins:4,maximumChanges:Number($('maximum').value),sharingSource:$('sharing').value,searchSource:$('search-source').value,
  target:{receiverReadingIndex:Number($('target-receiver').value),utc:$('target-time').value,store:$('target-store').value}});
const state=(text,kind)=>{$('status').textContent=text;$('status').dataset.state=kind;};
function current(result){return accepted===result&&!pending()&&originals===result.investigation.readings&&sameSkyData(query(),result.investigation.query);}
function controls(){
  $('run').disabled=pending()||!originals;$('export').disabled=!accepted||!current(accepted);
  for(const element of $('results').querySelectorAll('select,button,input'))element.disabled=pending();
}
function clearResult(){accepted=null;$('results').replaceChildren();$('results').hidden=true;for(const key of Object.keys($('results').dataset))delete $('results').dataset[key];}
function retire(message){generation++;reading=false;computation.cancel();clearResult();controls();state(message,'not-compared');drawClock();}
function drawClock(){
  if(!originals){$('clock').textContent='Load a complete original record to inspect its clock.';return;}
  const times=originalSkyReadingTimes(originals[0].source),n=times.length-1,max=Number($('maximum').value),singles=n-1,pairs=singles*(singles-1)/2;
  $('clock').textContent=times[0].utc+' to '+times.at(-1).utc+' · '+n+' original intervals · '+(1+(max>=1?singles:0)+(max>=2?pairs:0))+' declared patterns. The initial state and every original endpoint remain attached.';
}
function drawSources(){
  $('sources').replaceChildren();drawClock();
  $('source-summary').textContent=originals?originals.length+' original records loaded. All are required by this comparison.':'No original readings loaded.';
  if(!originals)return;
  const context=originals;
  $('sources').append(table('Complete original evidence',['Record / point','Original UTC','Component','Original temperature band °C','Attribution'],originals.map((input,index)=>{const r=input.query.reading;return [index+1+' / '+point(input),r.utc,r.store==='surfaceC'?'Ground surface':'Lower heat store',String(r.temperatureC)+' ± '+String(r.halfWidthC),r.source];})));
  const inspect=node('details');inspect.append(node('summary','Inspect the complete unchanged source declarations'));const code=node('pre');inspect.append(code);
  inspect.addEventListener('toggle',()=>{if(!inspect.isConnected||originals!==context||pending()||!inspect.open||code.textContent)return;code.textContent=JSON.stringify(context,null,2);});$('sources').append(inspect);
}
function drawTargetChoices(target){
  const receivers=$('target-receiver'),time=$('target-time');receivers.replaceChildren();time.replaceChildren();
  if(!originals)return;
  const representatives=[];
  originals.forEach((input,index)=>{if(!representatives.some(i=>sameSkyData(input.source,originals[i].source)&&input.query.reading.cellIndex===originals[i].query.reading.cellIndex))representatives.push(index);});
  const choices=[...representatives];
  if(target&&!choices.includes(target.receiverReadingIndex))choices.push(target.receiverReadingIndex);
  for(const index of choices){
    const receiver=representatives.findIndex(i=>sameSkyData(originals[index].source,originals[i].source)&&originals[index].query.reading.cellIndex===originals[i].query.reading.cellIndex);
    const option=node('option','Receiver '+(receiver+1)+' · point '+point(originals[index])+' · from record '+(index+1));option.value=String(index);receivers.append(option);
  }
  const times=originalSkyReadingTimes(originals[0].source);
  for(const row of times){const option=node('option',row.utc+' · '+(row.index?'original interval '+row.index:'initial state'));option.value=row.utc;time.append(option);}
  receivers.value=String(target?.receiverReadingIndex??representatives.at(-1));
  time.value=target?.utc??times.at(-1).utc;$('target-store').value=target?.store??'surfaceC';
}
function loadSource(readings,ownQuery,sharingSource){
  originals=readings;clearResult();
  if(ownQuery){$('maximum').value=String(ownQuery.maximumChanges);$('sharing').value=ownQuery.sharingSource;$('search-source').value=ownQuery.searchSource;}
  else $('sharing').value=sharingSource;
  drawTargetChoices(ownQuery?.target);drawSources();controls();
}
function beginFile(){computation.cancel();const ticket=++generation;reading=true;controls();state('Reading complete original inputs; prior result controls are held.','file-pending');return ticket;}
async function fileText(file){checkShadeHeatBytes(file.size);const bytes=await file.arrayBuffer();checkShadeHeatBytes(bytes.byteLength);try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('Original input must be valid UTF-8 JSON');}}
async function compare(){
  if(!originals)return;
  let source,work;try{source=prepareSkyConsequenceSource(originals,query());work=inspectSkyConsequenceWork(source.readings,source.query);}catch(error){retire(error.message);state(error.message,'refused');return;}
  computation.cancel();const ticket=++generation;reading=false;clearResult();
  const calculation=computation.compute({operation:'prepare',originals:source.readings,query:source.query});controls();
  state('Checking up to '+work.declaredPatterns+' complete original-clock patterns. Both extreme profiles and all original numerical checks must finish before a result is offered.','calculating');
  try{
    const result=await calculation;if(ticket!==generation)return;
    if(!sameSkyData(result.investigation,source))throw Error('The complete result no longer belongs to the requested original inputs');
    originals=result.investigation.readings;accepted=result;drawSources();drawSkyConsequenceReport($('results'),result,()=>current(result));
    state(result.report.compatibility==='compatible'?'Complete consequence calculation: minimum '+result.report.minimumChanges+' changes; every compatible profile in '+result.report.alternatives.length+' patterns is included.':'Complete comparison: no compatible pattern in the declared class.','compared');
  }catch(error){if(ticket!==generation||error.code==='superseded')return;clearResult();state(error.message,'refused');}
  finally{if(ticket===generation)controls();}
}
$('form').addEventListener('submit',event=>{event.preventDefault();if(!pending())compare();});
for(const id of ['maximum','sharing','search-source','target-receiver','target-time','target-store'])$(id).addEventListener('input',()=>retire('The target or model declaration changed. Run a fresh complete consequence calculation.'));
$('example').addEventListener('click',()=>{
  retire('Loading the authored complete original record.');const example=makeThreeEpochSkyExample();
  loadSource(example.readings,{bins:4,maximumChanges:2,sharingSource:'Authored unchanged original site, forcing and receiver thermal declarations. Common sky profiles across the original receivers; this is a numerical example.',
    searchSource:'Compare every original boundary under at most two changes. The example observations were authored from a complete course; the declared search does not receive its generating cuts.'});
  compare();
});
$('originals').addEventListener('change',async()=>{
  const files=Array.from($('originals').files||[]);$('originals').value='';if(!files.length)return;
  const ticket=beginFile();
  try{
    if(files.length>24)throw Error('Open at most 24 complete original reading files');
    checkShadeHeatBytes(files.reduce((sum,file)=>sum+file.size,0));
    const texts=await Promise.all(files.map(fileText));if(ticket!==generation)return;
    checkShadeHeatBytes(new Blob(texts).size);const loaded=parseSkyConsequenceOriginals(texts);if(ticket!==generation)return;
    reading=false;loadSource(loaded.readings,loaded.ownQuery??loaded.modelQuery,loaded.sharingSource);
    state('Every original reading is retained. Review the declared model class, then run the complete comparison.','not-compared');
  }catch(error){if(ticket!==generation)return;reading=false;state(error.message+' The prior accepted inquiry remains available.','file-refused');}
  finally{if(ticket===generation)controls();}
});
$('reopen').addEventListener('change',async()=>{
  const file=$('reopen').files?.[0];$('reopen').value='';if(!file)return;const ticket=beginFile();
  try{
    const text=await fileText(file);if(ticket!==generation)return;const source=parseSkyConsequenceSource(text);if(ticket!==generation)return;
    reading=false;loadSource(source.readings,source.query);await compare();
  }catch(error){if(ticket!==generation)return;reading=false;state(error.message+' The prior accepted inquiry remains available.','file-refused');}
  finally{if(ticket===generation)controls();}
});
$('export').addEventListener('click',()=>{
  const result=accepted;if(!result||!current(result))return;
  try{
    const text=serializeSkyConsequenceSource(result.investigation);if(!current(result))return;
    const blob=new Blob([text],{type:'application/json'});checkShadeHeatBytes(blob.size);const url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download='original-clock-sky-consequence-inputs.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
    state('Downloaded the original inputs, selected target and declared model class. Reopening recomputes every result.','compared');
  }catch(error){state(error.message,'refused');}
});
drawSources();controls();for(const id of ['example','originals','reopen','maximum','sharing','search-source','target-receiver','target-time','target-store'])$(id).disabled=false;
