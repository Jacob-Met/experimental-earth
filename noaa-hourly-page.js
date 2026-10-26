import {renderHeatDeclarationEnvelope} from './heat-declaration-envelope-panel.js';
import {mountSoilEvidence} from './noaa-soil-panel.js';
import {mountHourlyCourseProposals} from './noaa-hourly-courses-panel.js';
import {receiveHourlyBytes,parseHourlyText} from './noaa-hourly.js';
import {compareHourlyInvestigation,parseHourlyRecipe,serializeHourlyRecipe} from './noaa-hourly-investigation.js';
import {checkProjectFileBytes} from './project-portability.js';
const $=id=>document.getElementById(id),node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const display=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:5});
const sampleUrl='https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/2025/CRNH0203-2025-AZ_Tucson_11_W.txt';
let original=null,accepted=null,generation=0,courseBusy=false,soilPanel=null,sourceLoadVersion=0;
$('hypotheses').value=JSON.stringify([60000,80000,160000].map(capacityJm2K=>({label:`Lower capacity ${capacityJm2K} J/(m² K)`,capacityJm2K,conductanceWm2K:20,source:'Offered illustrative capacity with fixed conductance; not fitted to original readings.'})),null,2);
function retire(message='Draft changed. Compare these original inputs again.'){
 soilPanel?.retire();generation++;accepted=null;$('download').disabled=true;$('results').replaceChildren();$('result-status').textContent=message;$('result-status').dataset.state='not-compared';$('compare').disabled=courseBusy;
}
function initialInstant(){const row=original?.rows[Number($('first-line').value)-1];return row?.intervalStartUtc;}
function showSource(){
 $('source-identity').textContent=original?`Declared URL: ${original.sourceUrl}\nSupplied bytes: ${original.byteLength}\nSHA-256 (supplied bytes, not an unprovided parent file): ${original.sha256}\nOriginal rows: ${original.rows.length}\nFirst original station: ${original.rows[0].raw.WBANNO}\nOriginal longitude/latitude: ${original.rows[0].raw.LONGITUDE}, ${original.rows[0].raw.LATITUDE}`:'';
 $('course-start').textContent=initialInstant()?`The selected course begins at ${initialInstant()}. The point initial temperatures below apply at that instant; they are not inferred from an hourly mean.`:'Select an available original starting row.';
}
for(const e of document.querySelectorAll('#investigation-form input,#investigation-form textarea,#investigation-form select'))e.addEventListener('input',()=>{retire();showSource();});
$('source-url').addEventListener('input',()=>{sourceLoadVersion++;original=null;coursePicker.reset();retire('Source URL changed. Choose the original file again.');$('source-status').textContent='Choose the original file for this declared URL.';showSource();});
// Only replace an investigation after candidate bytes and source identity pass
// intake. A later file, archive request, or URL edit invalidates pending work.
async function adoptSource(intake,ticket,version,{sourceUrl=null,archived=false}={}){
 if(ticket!==generation||version!==sourceLoadVersion)return false;
 coursePicker.reset();retire('Original source changed. Compare this course again.');
 original=intake;if(sourceUrl!==null)$('source-url').value=sourceUrl;
 $('first-line').value='1';$('hour-count').value=String(Math.min(9,intake.rows.length));$('calibration-count').value=String(Math.min(3,intake.rows.length));
 showSource();await coursePicker.refresh({selectFirst:true});if(original!==intake)return false;
 $('source-status').textContent=archived?'Archived nine-row Tucson source received with its exact excerpt digest. Inspect the proposed original course and authored assumptions before comparing.':
 `${intake.rows.length} original rows received. Source-only course discovery is complete; inspect availability, exclusions and the explicit model declarations.`;
 return true;
}
$('source-file').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 const ticket=generation,version=++sourceLoadVersion,url=$('source-url').value.trim();
 $('source-status').textContent='Checking candidate original source bytes; existing investigation remains available.';
 try{
  if(file.size>4_000_000)throw Error('Original source exceeds 4,000,000 bytes');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(ticket!==generation||version!==sourceLoadVersion)return;
  const intake=await receiveHourlyBytes(bytes,{sourceUrl:url});
  await adoptSource(intake,ticket,version);
 }catch(error){if(ticket===generation&&version===sourceLoadVersion)$('source-status').textContent='Source refused; previous investigation preserved: '+error.message;}
 finally{event.target.value='';}
});
$('archive-example').onclick=async()=>{
 const ticket=generation,version=++sourceLoadVersion;
 $('source-status').textContent='Checking archived original source; existing investigation remains available.';
 try{
  const response=await fetch('./examples/noaa-tucson-hourly/tucson-hourly-excerpt.txt');
  if(!response.ok)throw Error('Archived source is unavailable');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(ticket!==generation||version!==sourceLoadVersion)return;
  // This fixed excerpt has a separately documented identity, not the parent-year digest.
  const intake=await receiveHourlyBytes(bytes,{sourceUrl:sampleUrl,expectedSha256:'247bd26d2cdc1af26c933af2ced818d00dfbe629e4d1cdfae9a5a81b1b9547ac'});
  await adoptSource(intake,ticket,version,{sourceUrl:sampleUrl,archived:true});
 }catch(error){if(ticket===generation&&version===sourceLoadVersion)$('source-status').textContent='Source refused; previous investigation preserved: '+error.message;}
};
const numeric=id=>{const value=$(id).value.trim();if(!value)throw Error('Fill '+id);const number=Number(value);if(!Number.isFinite(number))throw Error('Use a finite value for '+id);return number;};
function recipe(){
 if(!original||original.sourceUrl!==$('source-url').value.trim())throw Error('Receive original source bytes for the declared URL first');
 return {schema:'experimental-earth-noaa-input/1',sourceUrl:original.sourceUrl,sha256:original.sha256,rawText:original.rawText,
  selection:{firstLine:numeric('first-line'),count:numeric('hour-count'),correctionType:$('correction').value,initialState:{timeUtc:initialInstant(),surfaceC:numeric('initial-surface'),lowerC:numeric('initial-lower'),assumption:$('initial-source').value}},
  surface:{capacityJm2K:numeric('surface-capacity'),exchangeWm2K:numeric('surface-exchange'),absorptivity:numeric('surface-absorption'),source:$('surface-source').value},hypotheses:JSON.parse($('hypotheses').value),
  band:{halfWidthC:numeric('band-width'),source:$('band-source').value},calibrationCount:numeric('calibration-count'),associationSource:$('association').value};
}
function table(headers,rows){const wrap=node('div');wrap.className='table-wrap';wrap.tabIndex=0;const t=node('table'),head=node('thead'),hr=node('tr');for(const h of headers){const th=node('th',h);th.scope='col';hr.append(th);}head.append(hr);t.append(head);const body=node('tbody');for(const row of rows){const tr=node('tr');for(const value of row)tr.append(node('td',value));body.append(tr);}t.append(body);wrap.append(t);return wrap;}
function draw(result,input){
 const {report,course}=result,host=$('results');host.replaceChildren();
 const descriptions={'calibration-rejected':'Every offered alternative conflicts with original calibration bands. Preserve this failed comparison; nothing was fitted to rescue it.',challenged:'Original challenge bands reject all calibration-compatible alternatives. No parameters were refitted.',ambiguous:'Several offered alternatives remain compatible. Their agreement does not identify a physical column.','one-survivor':'One offered alternative remains compatible with these declared bands. This does not establish unique physical properties.','needs-challenge':'Calibration-compatible alternatives remain; no challenge readings were declared.','need-calibration':'No calibration readings were declared. Candidate support has not been established.'};
 $('result-status').textContent=descriptions[report.status]??report.status;$('result-status').dataset.state=report.status;
 host.append(node('p',`Station ${course.rows[0].raw.WBANNO} · ${course.rows[0].intervalStartUtc} to ${course.rows.at(-1).intervalEndUtc}. ${report.counts.calibration} calibration and ${report.counts.challenge} challenge rows. Original selected source rows and all offered alternatives are retained.`));
 host.append(table(['Supplied line / UTC end','Original surface mean / QC','Original hourly solar / QC','Original hourly air mean','Use'],course.rows.map((r,i)=>[`${input.selection.firstLine+i} · ${r.intervalEndUtc}`,`${r.raw.SUR_TEMP} °C · ${r.raw.SUR_TEMP_TYPE}/${r.raw.SUR_TEMP_FLAG}`,`${r.raw.SOLARAD} W/m² · ${r.raw.SOLARAD_FLAG}`,`${r.raw.T_HR_AVG} °C`,i<input.calibrationCount?'calibration':'challenge'])));
 host.append(renderHeatDeclarationEnvelope(result.project.heatColumnEvidence));
 for(const candidate of report.candidates){const detail=node('details');detail.className='candidate';detail.open=report.candidates.length<=3;detail.append(node('summary',candidate.label+' · calibration '+candidate.calibration.withinCount+'/'+candidate.calibration.count+'; challenge '+candidate.challenge.withinCount+'/'+candidate.challenge.count));
  const rows=[...candidate.calibration.rows,...candidate.challenge.rows].sort((a,b)=>a.index-b.index);
  detail.append(table(['Original window / role','Observed mean ± band · °C','Predicted mean · °C','Observed − predicted · °C','Within declared band?'],rows.map(r=>{const observed=result.project.heatColumnEvidence.readings[r.index];return [`${r.fromMinute}–${r.minute} min · ${r.use}`,`${display(observed.temperatureC)} ± ${display(observed.halfWidthC)}`,display(r.predictionC),display(r.residualC),r.withinBand?'Yes':'No'];})));
  detail.append(node('p',`Offered source: ${input.hypotheses[report.candidates.indexOf(candidate)].source}`));host.append(detail);
 }
 const sources=node('details');sources.append(node('summary','Inspect complete selected original fixed-width rows'));const pre=node('pre',course.rows.map((r,i)=>`Supplied line ${input.selection.firstLine+i}: ${r.rawLine}`).join('\n'));sources.append(pre);host.append(sources);
 host.append(node('p','Predictions use the maintained uniform two-store thermal model and complete interval-mean operator. Engineering arithmetic guards are separate from the supplied bands and are not certified error bounds. Compatibility does not establish field accuracy, model completeness or independent validation.'));
}
$('investigation-form').onsubmit=async event=>{event.preventDefault();retire('Comparing the complete original course…');const ticket=generation;$('compare').disabled=true;
 try{const input=recipe(),result=await compareHourlyInvestigation(input);if(ticket!==generation)return;accepted=structuredClone(input);draw(result,input);$('download').disabled=false;}
 catch(error){if(ticket===generation){$('result-status').textContent='Comparison refused: '+error.message;$('result-status').dataset.state='refused';}}
 finally{if(ticket===generation)$('compare').disabled=false;}
};
$('download').onclick=()=>{if(!accepted)return;const blob=new Blob([serializeHourlyRecipe(accepted)],{type:'application/json'}),url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download='experimental-earth-noaa-investigation.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function fill(input){
 original={...parseHourlyText(input.rawText,{sourceUrl:input.sourceUrl}),sha256:input.sha256};
 const values={'source-url':input.sourceUrl,'first-line':input.selection.firstLine,'hour-count':input.selection.count,correction:input.selection.correctionType,'calibration-count':input.calibrationCount,'initial-surface':input.selection.initialState.surfaceC,'initial-lower':input.selection.initialState.lowerC,'initial-source':input.selection.initialState.assumption,'surface-capacity':input.surface.capacityJm2K,'surface-exchange':input.surface.exchangeWm2K,'surface-absorption':input.surface.absorptivity,'surface-source':input.surface.source,'band-width':input.band.halfWidthC,'band-source':input.band.source,association:input.associationSource,hypotheses:JSON.stringify(input.hypotheses,null,2)};
 for(const [key,value]of Object.entries(values))$(key).value=String(value);$('source-status').textContent='Original source and declarations reopened; all comparisons recomputed.';showSource();void coursePicker.refresh({selectFirst:false});
}
$('recipe-file').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;retire('Checking original investigation inputs…');const ticket=generation;
 try{checkProjectFileBytes(file.size);const input=parseHourlyRecipe(new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer())),result=await compareHourlyInvestigation(input);if(ticket!==generation)return;fill(input);accepted=structuredClone(input);draw(result,input);$('download').disabled=false;}
 catch(error){if(ticket===generation){$('result-status').textContent='Reopening refused: '+error.message;$('result-status').dataset.state='refused';}}
 finally{event.target.value='';}
});

const coursePicker=mountHourlyCourseProposals({host:$('hourly-course-proposals'),getSource:()=>original,getHours:()=>Number($('hour-count').value),getPolicy:()=>$('correction').value,getSelection:()=>Number($('first-line').value),
 applySelection:(window,automatic)=>{$('first-line').value=String(window.firstLine);retire(automatic?'First available original course proposed from source flags and continuity. Review the declarations before comparing.':'Original course changed. Compare these inputs again.');showSource();},
 busy:value=>{courseBusy=value;$('compare').disabled=value;}});
for(const id of ['hour-count','correction'])$(id).addEventListener('input',()=>{void coursePicker.refresh({selectFirst:false});});
$('first-line').addEventListener('input',()=>coursePicker.selectionChanged());

soilPanel=mountSoilEvidence({host:$('soil-evidence'),getOriginal:()=>{if(courseBusy)throw Error('Wait for original course discovery');return recipe();}});
