import {parseSkyAllowanceText,skyAllowanceFractionText} from './shade-heat-sky-allowance.js';
import {node,point,table} from './shade-heat-epoch-view.js';
import {originalSkyReadingTimes,sameSkyData} from './shade-heat-timed-reading-source.js';
import {checkShadeHeatBytes} from './shade-heat.js';
import {createShadeHeatComputation} from './shade-heat-computation.js';
import {prepareSkyConditionalSource,serializeSkyConditionalSource,parseSkyConditionalSource,inspectSkyConditionalWork} from './shade-heat-sky-conditional-course.js';
import {parseSkyConditionalOriginals} from './shade-heat-sky-conditional-inputs.js';
import {makeSkyConditionalExample} from './shade-heat-sky-conditional-example.js';
import {drawSkyConditionalReport} from './shade-heat-sky-conditional-view.js';

const $=id=>document.getElementById('conditional-'+id);
const computation=createShadeHeatComputation(()=>new Worker(new URL('./shade-heat-sky-conditional-worker.js',import.meta.url),{type:'module'}));
let originals=null,accepted=null,generation=0,reading=false;
const pending=()=>reading||computation.pending;
const query=()=>({bins:4,maximumChanges:Number($('maximum').value),sharingSource:$('sharing').value,searchSource:$('search-source').value,
 allowanceC:skyAllowanceFractionText(parseSkyAllowanceText($('allowance').value)),
 consequence:{receiverReadingIndex:Number($('c-receiver').value),utc:$('c-time').value,store:$('c-store').value,source:$('c-source').value},
 requirements:['a','b'].map(id=>({receiverReadingIndex:Number($(id+'-receiver').value),utc:$(id+'-time').value,store:$(id+'-store').value,relation:$(id+'-relation').value,differenceC:$(id+'-limit').value.trim()===''?NaN:Number($(id+'-limit').value),source:$(id+'-source').value}))});
const state=(text,kind)=>{$('status').textContent=text;$('status').dataset.state=kind;};
function current(result){try{return accepted===result&&!pending()&&originals===result.investigation.readings&&sameSkyData(query(),result.investigation.query);}catch{return false;}}
function controls(){
  $('run').disabled=pending()||!originals;$('export').disabled=!accepted||!current(accepted);
  for(const element of $('results').querySelectorAll('select,button,input'))element.disabled=pending();
}
function clearResult(){accepted=null;$('results').replaceChildren();$('results').hidden=true;for(const key of Object.keys($('results').dataset))delete $('results').dataset[key];}
function retire(message){generation++;reading=false;computation.cancel();clearResult();controls();state(message,'not-conditioned');drawClock();}
function drawClock(){
  if(!originals){$('clock').textContent='Load a complete original record to inspect its clock.';return;}
  const times=originalSkyReadingTimes(originals[0].source),n=times.length-1,max=Number($('maximum').value),singles=n-1,pairs=singles*(singles-1)/2;
  $('clock').textContent=times[0].utc+' to '+times.at(-1).utc+' · '+n+' original intervals · '+(1+(max>=1?singles:0)+(max>=2?pairs:0))+' declared patterns. The initial state and every original endpoint remain attached.';
}
function drawSources(){
  $('sources').replaceChildren();drawClock();
  $('source-summary').textContent=originals?originals.length+' original records loaded. All remain part of this inquiry.':'No original readings loaded.';
  if(!originals)return;
  const context=originals;
  $('sources').append(table('Complete original evidence',['Record / point','Original UTC','Component','Original temperature band °C','Attribution'],originals.map((input,index)=>{const r=input.query.reading;return [index+1+' / '+point(input),r.utc,r.store==='surfaceC'?'Ground surface':'Lower heat store',String(r.temperatureC)+' ± '+String(r.halfWidthC),r.source];})));
  const inspect=node('details');inspect.append(node('summary','Inspect the complete unchanged source declarations'));const code=node('pre');inspect.append(code);
  inspect.addEventListener('toggle',()=>{if(!inspect.isConnected||originals!==context||pending()||!inspect.open||code.textContent)return;code.textContent=JSON.stringify(context,null,2);});$('sources').append(inspect);
}
function drawRequirementChoices(requirements,consequence){
 for(const [position,id]of ['a','b','c'].entries()){
  const target=id==='c'?consequence:requirements?.[position];const receivers=$(id+'-receiver'),time=$(id+'-time');receivers.replaceChildren();time.replaceChildren();
  if(!originals)continue;
  const representatives=[];
  originals.forEach((input,index)=>{if(!representatives.some(i=>sameSkyData(input.source,originals[i].source)&&input.query.reading.cellIndex===originals[i].query.reading.cellIndex))representatives.push(index);});
  const choices=[...representatives];if(target&&!choices.includes(target.receiverReadingIndex))choices.push(target.receiverReadingIndex);
  for(const index of choices){
   const receiver=representatives.findIndex(i=>sameSkyData(originals[index].source,originals[i].source)&&originals[index].query.reading.cellIndex===originals[i].query.reading.cellIndex);
   const option=node('option','Receiver '+(receiver+1)+' · point '+point(originals[index])+' · from record '+(index+1));option.value=String(index);receivers.append(option);
  }
  const times=originalSkyReadingTimes(originals[0].source);
  for(const row of times){const option=node('option',row.utc+' · '+(row.index?'original interval '+row.index:'initial state'));option.value=row.utc;time.append(option);}
  receivers.value=String(target?.receiverReadingIndex??representatives[0]);time.value=target?.utc??times[position?times.length-1:Math.floor((times.length-1)/2)].utc;
  $(id+'-store').value=target?.store??(id==='c'?'subsurfaceC':'surfaceC');$(id+'-source').value=target?.source??'';
  if(id!=='c'){$(id+'-relation').value=target?.relation??'at-most';$(id+'-limit').value=target?String(target.differenceC):'0';}
 }
}
function loadSource(readings,ownQuery,sharingSource){
  originals=readings;clearResult();
  if(ownQuery){$('maximum').value=String(ownQuery.maximumChanges);$('sharing').value=ownQuery.sharingSource;$('search-source').value=ownQuery.searchSource;}
  else $('sharing').value=sharingSource;
  $('allowance').value=ownQuery?.allowanceC??'0';drawRequirementChoices(ownQuery?.requirements,ownQuery?.consequence);drawSources();controls();
}
function beginFile(){computation.cancel();const ticket=++generation;reading=true;controls();state('Reading complete original inputs; prior result controls are held.','file-pending');return ticket;}
async function fileText(file){checkShadeHeatBytes(file.size);const bytes=await file.arrayBuffer();checkShadeHeatBytes(bytes.byteLength);try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('Original input must be valid UTF-8 JSON');}}
async function compare(){
  if(!originals)return;
  let source,work;try{source=prepareSkyConditionalSource(originals,query());work=inspectSkyConditionalWork(source.readings,source.query);}catch(error){retire(error.message);state(error.message,'refused');return;}
  computation.cancel();const ticket=++generation;reading=false;clearResult();
  const calculation=computation.compute({operation:'prepare',originals:source.readings,query:source.query});controls();
  state('Checking up to '+work.declaredPatterns+' complete original-clock patterns. Both conditions are applied to every original minimum pattern; each surviving interval needs two separate extreme profiles.','calculating');
  try{
    const result=await calculation;if(ticket!==generation)return;
    if(!sameSkyData(result.investigation,source))throw Error('The complete result no longer belongs to the requested original inputs');
    originals=result.investigation.readings;accepted=result;drawSources();drawSkyConditionalReport($('results'),result,()=>current(result));
    state(result.report.conditionalStatus==='conditional-range'?'Complete conditional consequence: original minimum '+result.report.minimumChanges+' changes; '+result.report.conditionalPatternIndices.length+' surviving patterns and '+result.report.components.length+' interval components.':
     result.report.conditionalStatus==='conditional-empty'?'Complete inquiry: the two conditions exclude every pattern in the original minimum class; no consequence range is assessed.':
     'Complete inquiry: no original-compatible pattern in the declared class; no consequence range is assessed.','conditioned');
  }catch(error){if(ticket!==generation||error.code==='superseded')return;clearResult();state(error.message,'refused');}
  finally{if(ticket===generation)controls();}
}
$('form').addEventListener('submit',event=>{event.preventDefault();if(!pending())compare();});
const queryControls=['maximum','sharing','search-source','allowance',...['receiver','time','store','source'].map(field=>'c-'+field),...['a','b'].flatMap(id=>['receiver','time','store','relation','limit','source'].map(field=>id+'-'+field))];
for(const id of queryControls)$(id).addEventListener('input',()=>retire('A requirement or model declaration changed. Run a fresh complete conditional consequence inquiry.'));
$('example').addEventListener('click',()=>{
 retire('Loading the authored complete original record.');const example=makeSkyConditionalExample();
 loadSource(example.readings,example.query);compare();
});
$('originals').addEventListener('change',async()=>{
  const files=Array.from($('originals').files||[]);$('originals').value='';if(!files.length)return;
  const ticket=beginFile();
  try{
    if(files.length>24)throw Error('Open at most 24 complete original reading files');
    checkShadeHeatBytes(files.reduce((sum,file)=>sum+file.size,0));
    const texts=await Promise.all(files.map(fileText));if(ticket!==generation)return;
    checkShadeHeatBytes(new Blob(texts).size);const loaded=parseSkyConditionalOriginals(texts);if(ticket!==generation)return;
    reading=false;loadSource(loaded.readings,loaded.ownQuery??loaded.modelQuery,loaded.sharingSource);
    state('Every original reading is retained. Review the declared model class, then run the complete conditional inquiry.','not-conditioned');
  }catch(error){if(ticket!==generation)return;reading=false;state(error.message+' The prior accepted inquiry remains available.','file-refused');}
  finally{if(ticket===generation)controls();}
});
$('reopen').addEventListener('change',async()=>{
  const file=$('reopen').files?.[0];$('reopen').value='';if(!file)return;const ticket=beginFile();
  try{
    const text=await fileText(file);if(ticket!==generation)return;const source=parseSkyConditionalSource(text);if(ticket!==generation)return;
    reading=false;loadSource(source.readings,source.query);await compare();
  }catch(error){if(ticket!==generation)return;reading=false;state(error.message+' The prior accepted inquiry remains available.','file-refused');}
  finally{if(ticket===generation)controls();}
});
$('export').addEventListener('click',()=>{
  const result=accepted;if(!result||!current(result))return;
  try{
    const text=serializeSkyConditionalSource(result.investigation);if(!current(result))return;
    const blob=new Blob([text],{type:'application/json'});checkShadeHeatBytes(blob.size);const url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download='conditional-sky-consequence-inputs.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
    state('Downloaded the original inputs, both original requirements, exact fixed allowance, third target and model class. Reopening recomputes every result.','conditioned');
  }catch(error){state(error.message,'refused');}
});
drawSources();controls();for(const id of ['example','originals','reopen',...queryControls])$(id).disabled=false;
