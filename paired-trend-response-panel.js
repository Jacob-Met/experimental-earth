import {mountPairedTrendOnset} from './paired-trend-onset-panel.js';
import {inferPairedTrendResponse,TREND_RESPONSE_SCHEMA} from './paired-trend-response.js';
import {parsePortableProject,serializePortableProject,checkProjectFileBytes} from './project-portability.js';
export function mountPairedTrendResponse({host,getAccepted}){
 const box=document.createElement('details');box.id='paired-trend-response';box.innerHTML=`<summary>Could the later between-place trend have changed?</summary><p>Compare a broader descriptive model: separate earlier and later linear relations. Retain every supported line, then infer the joint gap jump and slope change at the fixed declared intervention instant. Neither quantity identifies an intervention effect. Only the supplied reading bands constrain this comparison; additional shared-error constraints are not supplied.</p><button type="button" id="ptrs-current">Use current accepted earlier history</button><p id="ptrs-source">Infer the original earlier region above, or reopen an original response investigation.</p><button type="button" id="ptrs-run">Compare separate earlier and later lines</button><button type="button" id="ptrs-save" disabled>Download original response investigation</button><label>Reopen original response investigation<input id="ptrs-open" type="file" accept=".json,application/json"></label><div id="ptrs-result" role="status" aria-live="polite"></div><p>The original earlier region stays unchanged. At least two distinct later instants are required for bounded later slope support. No line, response or intervention time is selected or adopted.</p>`;host.append(box);
 const q=id=>box.querySelector('#ptrs-'+id);let ownSource=null,accepted=null,revision=0,onset=null;
 const line=(host,text)=>{const p=document.createElement('p');p.textContent=text;host.append(p);};
 const fmt=x=>Number(x.toPrecision(7)).toString(),range=x=>`${fmt(x.lower.lower)} to ${fmt(x.upper.upper)}`;
 function refresh(){onset?.refresh();revision++;accepted=null;q('save').disabled=true;q('result').textContent='Source changed. Compare the response model again.';}
 function show(input,project){
  const r=inferPairedTrendResponse(input),series=input.inquiry.series;
  accepted={schema:'experimental-earth-paired-trend-response-bundle/1',project:JSON.parse(serializePortableProject(project)),input:r.source};
  q('source').textContent=`Original workspace ${project.title}; ${series.quantity} (${series.unit}); ${ownSource?'own reopened source':'current accepted earlier history'}.`;
  q('result').replaceChildren();line(q('result'),`Separate linear histories: ${r.status}. Fixed declared intervention: ${r.intervention}.`);
  if(r.status==='earlier-incompatible')line(q('result'),'The original earlier bands reject a linear history. No jump or slope change is inferred.');
  else if(r.status==='insufficient-later-history')line(q('result'),'At least two distinct later instants are needed. No later slope bound or response is invented.');
  else if(r.status==='later-incompatible')line(q('result'),'No later line fits all original later bands. The earlier region is preserved; a more flexible two-line model still fails.');
  else{
   line(q('result'),`Gap jump at the declared intervention, rounded: ${range(r.jump)} ${series.unit}. Slope change, rounded: ${range(r.slopeChange)} ${series.unit}/day (86400 seconds).`);
   line(q('result'),`The complete joint response has ${r.vertices.length} vertices. The two displayed marginal ranges cannot be combined arbitrarily. Earlier support retains ${r.earlier.vertices.length} vertices; later support has ${r.later.vertices.length} vertices over ${r.later.timeSupport.join(' to ')}.`);
   line(q('result'),r.zeroSlopeChange.status==='compatible'
    ? `A common slope remains possible: the exact zero-slope-change slice supports gap jump ${range(r.zeroSlopeChange.jump)} ${series.unit} (rounded).`
    : 'A common slope is incompatible with the original bands, although separate linear histories remain possible. This distinguishes a descriptive trend change from one constant gap shift.');
   line(q('result'),'The jump compares extrapolated line values at the declared instant, not necessarily a reading taken there. Exactness concerns supplied binary64 values and UTC times, not measurement truth, statistical confidence or causal attribution.');
  }
  const detail=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Inspect both exact period regions, joint response, slice and original sources';pre.textContent=JSON.stringify(r,null,2);pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';detail.append(summary,pre);q('result').append(detail);q('save').disabled=false;
 }
 q('current').onclick=()=>{ownSource=null;q('source').textContent='Next comparison uses the current accepted original earlier history.';refresh();};
 q('run').onclick=()=>{refresh();try{const source=ownSource||getAccepted();if(!source)throw Error('Infer or reopen the original earlier region first');show({schema:TREND_RESPONSE_SCHEMA,model:'separate-linear-periods',inquiry:source.input},source.project);}catch(e){q('result').textContent=e.message;}};
 q('save').onclick=()=>{try{if(!accepted)throw Error('Compare first');const json=JSON.stringify(accepted,null,2);checkProjectFileBytes(new Blob([json]).size);const url=URL.createObjectURL(new Blob([json],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='experimental-earth-paired-trend-response.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){q('result').textContent=e.message;}};
 q('open').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;refresh();const serial=revision;try{checkProjectFileBytes(file.size);const b=JSON.parse(await file.text());if(serial!==revision)return;if(!b||b.schema!=='experimental-earth-paired-trend-response-bundle/1'||Object.keys(b).sort().join(',')!=='input,project,schema')throw Error('Unsupported original response bundle');const project=parsePortableProject(JSON.stringify(b.project));inferPairedTrendResponse(b.input);ownSource={project,input:b.input.inquiry};show(b.input,project);}catch(e){if(serial===revision)q('result').textContent=e.message;}finally{event.target.value='';}};
 onset=mountPairedTrendOnset({host:box,getAccepted:()=>accepted});
 return {refresh};
}
