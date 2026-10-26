import {inferPairedTrendOnset,TREND_ONSET_SCHEMA} from './paired-trend-onset.js';
import {parsePortableProject,serializePortableProject,checkProjectFileBytes} from './project-portability.js';
export function mountPairedTrendOnset({host,getAccepted}){
 const box=document.createElement('details');box.id='paired-trend-onset';box.innerHTML=`<summary>Could a continuous trend change occur between the original readings?</summary><p>Compare an explicit continuous change in slope somewhere from the last earlier reading through the first later reading, including either endpoint. Infer all supported times without selecting a time grid or moving original readings between periods. These are conditional descriptive change times, not the onset of an intervention effect.</p><button type="button" id="pto-current">Use current accepted separate histories</button><p id="pto-source">Compare the separate original histories above, or reopen an original continuous-change investigation.</p><button type="button" id="pto-run">Infer continuous-change times in the original gap</button><button type="button" id="pto-save" disabled>Download original continuous-change investigation</button><label>Reopen original continuous-change investigation<input id="pto-open" type="file" accept=".json,application/json"></label><div id="pto-result" role="status" aria-live="polite"></div><p>Both original period regions and the declared intervention instant remain unchanged. No change time is selected or adopted. Unchanged-history support does not identify an onset.</p>`;host.append(box);
 const q=id=>box.querySelector('#pto-'+id);let ownSource=null,accepted=null,revision=0;
 const line=(host,text)=>{const p=document.createElement('p');p.textContent=text;host.append(p);};
 const fmt=x=>Number(x.toPrecision(7)).toString(),range=x=>`${fmt(x.lower.lower)} to ${fmt(x.upper.upper)}`;
 function refresh(){revision++;accepted=null;q('save').disabled=true;q('result').textContent='Source changed. Infer continuous-change times again.';}
 function show(input,project){
  const r=inferPairedTrendOnset(input),series=input.response.inquiry.series;
  accepted={schema:'experimental-earth-paired-trend-onset-bundle/1',project:JSON.parse(serializePortableProject(project)),input:r.source};
  q('source').textContent=`Original workspace ${project.title}; ${series.quantity} (${series.unit}); ${ownSource?'own reopened source':'current accepted separate histories'}.`;
  q('result').replaceChildren();line(q('result'),`Continuous trend-change comparison: ${r.status}.`);
  if(r.status==='response-unavailable')line(q('result'),`The underlying separate-history comparison is ${r.response.status}. No continuous-change time is inferred.`);
  else{
   line(q('result'),`Original observation gap: ${r.gap.start} through ${r.gap.end}, both endpoints included. Times below are offsets after the last earlier reading, in 86400-second days.`);
   for(const b of r.branches)line(q('result'),`${b.slopeChangeDirection==='positive'?'Positive':'Negative'} slope-change branch: ${range(b.offsetAfterLastEarlierDays)} days after ${r.gap.offsetOrigin} (rounded). Every time in this interval has a supported nonzero change; the branches are retained separately.`);
   if(r.unchangedSupported)line(q('result'),'An unchanged line also fits all original bands. That alternative does not identify any change time, even when nonzero-change branches are also possible.');
   else line(q('result'),'An unchanged line does not fit all original bands under this linear model.');
   if(r.status==='continuous-change-incompatible')line(q('result'),'No continuous nonzero slope change in this gap joins any supported earlier and later lines. Separate linear histories alone do not establish a continuous transition.');
   if(r.status==='unchanged-only')line(q('result'),'Only unchanged history remains within this continuous-transition comparison; no nonzero-change onset is supported.');
  }
  line(q('result'),'Compatibility concerns supplied reading bands and the explicit two-line continuity model. Shared sensor errors, measurement truth, statistical confidence and causal attribution remain unestablished.');
  const detail=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Inspect exact onset branches, endpoint witnesses and original histories';pre.textContent=JSON.stringify(r,null,2);pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';detail.append(summary,pre);q('result').append(detail);q('save').disabled=false;
 }
 q('current').onclick=()=>{ownSource=null;q('source').textContent='Next inference uses the current accepted original separate histories.';refresh();};
 q('run').onclick=()=>{refresh();try{const source=ownSource||getAccepted();if(!source)throw Error('Compare or reopen the original separate histories first');show({schema:TREND_ONSET_SCHEMA,model:'continuous-change-in-original-gap',response:source.input},source.project);}catch(e){q('result').textContent=e.message;}};
 q('save').onclick=()=>{try{if(!accepted)throw Error('Infer first');const json=JSON.stringify(accepted,null,2);checkProjectFileBytes(new Blob([json]).size);const url=URL.createObjectURL(new Blob([json],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='experimental-earth-paired-trend-onset.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){q('result').textContent=e.message;}};
 q('open').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;refresh();const serial=revision;try{checkProjectFileBytes(file.size);const b=JSON.parse(await file.text());if(serial!==revision)return;if(!b||b.schema!=='experimental-earth-paired-trend-onset-bundle/1'||Object.keys(b).sort().join(',')!=='input,project,schema')throw Error('Unsupported original continuous-change bundle');const project=parsePortableProject(JSON.stringify(b.project));inferPairedTrendOnset(b.input);ownSource={project,input:b.input.response};show(b.input,project);}catch(e){if(serial===revision)q('result').textContent=e.message;}finally{event.target.value='';}};
 return {refresh};
}
