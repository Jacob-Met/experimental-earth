import {inferPairedMeanHistory,PAIRED_MEAN_SCHEMA} from './paired-mean-history.js';
import {receiveNoaaPairedMeans,NOAA_PAIRED_MEAN_SCHEMA} from './noaa-paired-means.js';
import {serializePortableProject,parsePortableProject} from './project-portability.js';
const EXAMPLE_HASH='247bd26d2cdc1af26c933af2ced818d00dfbe629e4d1cdfae9a5a81b1b9547ac';
const EXAMPLE_URL='https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/2025/CRNH0203-2025-AZ_Tucson_11_W.txt';
export function mountPairedMeanHistory({host,getProject}){
 const box=document.createElement('details');box.id='paired-mean-history';box.innerHTML=`<summary>Compare original interval means across a declared phase split</summary>
 <p>Receive retained NOAA surface and air hourly means, or reopen an original paired-mean investigation. Each complete observation window stays intact. The earlier and later lines are descriptive models; the split is not evidence of an intervention or its effect.</p>
 <button type="button" id="pm-example">Load retained Tucson excerpt</button><label>Original NOAA hourly ASCII file<input id="pm-file" type="file" accept=".txt,text/plain"></label><p id="pm-source">No original file selected.</p>
 <label>Original source URL<input id="pm-url" type="url"></label>
 <label>First original file line<input id="pm-first" type="number" min="1" step="1" value="1"></label><label>Number of complete hourly means (3–64)<input id="pm-count" type="number" min="3" max="64" step="1" value="4"></label>
 <label>Surface correction policy<select id="pm-correction"><option value="C">Corrected (C)</option><option value="R">Raw (R)</option></select></label>
 <label>Gap direction<select id="pm-direction"><option value="surface">Surface minus air</option><option value="air">Air minus surface</option></select></label>
 <label>Declared phase boundary (exact UTC)<input id="pm-boundary" placeholder="2025-01-01T17:00:00Z"></label><label>Basis for this descriptive split<textarea id="pm-boundary-basis"></textarea></label>
 <label>Source channel association<textarea id="pm-association"></textarea></label>
 <label>First channel comparison half-width (C)<input id="pm-width-treated" type="number" min="0" max="100" step="any"></label><label>First channel band basis<textarea id="pm-band-treated"></textarea></label>
 <label>Second channel comparison half-width (C)<input id="pm-width-comparison" type="number" min="0" max="100" step="any"></label><label>Second channel band basis<textarea id="pm-band-comparison"></textarea></label>
 <p>NOAA reports preceding-hour averages but does not supply the exact temporal weights for each row. Matching windows alone does not establish matching weighting. This comparison is conditional on the following explicit model choice.</p>
 <label><input id="pm-uniform" type="checkbox"> Compare both channels using a uniform-time mean operator over their full original windows</label><label>Basis or limitation of this model assumption<textarea id="pm-operator-basis"></textarea></label>
 <button type="button" id="pm-run">Compare retained mean histories</button><button type="button" id="pm-save" disabled>Download original mean investigation</button><label>Reopen original mean investigation<input id="pm-open" type="file" accept=".json,application/json"></label>
 <div id="pm-result" role="status" aria-live="polite"></div><p>No observation is replaced by a midpoint or endpoint reading. The active workspace is not changed. Source-only downloads retain original bytes or original mean records and all declared assumptions; derived regions are recomputed on reopening.</p>`;
 box.style.overflowWrap='anywhere';box.style.minWidth='0';
 for(const label of box.querySelectorAll('label'))label.style.display='block';
 for(const control of box.querySelectorAll('input,textarea,select')){control.style.minWidth='0';control.style.maxWidth='100%';control.style.boxSizing='border-box';if(control.type==='checkbox'){control.style.width='auto';control.style.display='inline-block';control.style.margin='0 .4em 0 0';}else control.style.width='100%';}
 host.append(box);const q=id=>box.querySelector('#pm-'+id);let revision=0,raw=null,accepted=null;
 const invalidate=()=>{revision++;accepted=null;q('save').disabled=true;q('result').textContent='Source or assumptions changed. Compare again.';};
 for(const node of box.querySelectorAll('input:not([type=file]),textarea,select'))node.addEventListener('input',invalidate);
 const line=t=>{const p=document.createElement('p');p.textContent=t;q('result').append(p);};
 const range=x=>`${Number(x.lower.lower.toPrecision(7))} to ${Number(x.upper.upper.toPrecision(7))}`;
 const noaaFields=['url','first','count','correction','direction','boundary','boundary-basis','association','width-treated','band-treated','width-comparison','band-comparison','uniform','operator-basis'];
 function enableNoaa(enabled){for(const id of noaaFields)q(id).disabled=!enabled;q('run').disabled=!enabled;}
 function restoreSource(input){
  if(input.schema===NOAA_PAIRED_MEAN_SCHEMA){
   raw={rawText:input.source.rawText,sha256:input.source.sha256};enableNoaa(true);
   for(const [id,value]of Object.entries({url:input.source.sourceUrl,first:input.selection.firstLine,count:input.selection.count,correction:input.selection.correctionType,direction:input.channels.treated==='SUR_TEMP'?'surface':'air',boundary:input.boundary,'boundary-basis':input.boundaryBasis,association:input.association,'operator-basis':input.comparisonOperator.basis}))q(id).value=String(value);
   for(const name of ['treated','comparison']){q('width-'+name).value=String(input.bands[name].halfWidth);q('band-'+name).value=input.bands[name].source;}q('uniform').checked=true;
   q('source').textContent=`Reopened original NOAA source (${input.source.rawText.length} ASCII bytes), SHA-256 ${input.source.sha256}. Displayed declarations match this accepted investigation.`;
  }else{
   raw=null;for(const id of noaaFields){const field=q(id);if(field.type==='checkbox')field.checked=false;else if(field.tagName==='SELECT')field.selectedIndex=0;else field.value='';}enableNoaa(false);
   q('source').textContent=`Reopened native mean records: ${input.pairs.length} original pairs, ${input.quantity} (${input.unit}). NOAA-only controls are cleared and disabled. Load an original NOAA file or the retained excerpt to start a separate NOAA comparison.`;
  }
 }
 function show(r,input,project,receipt){
  accepted={schema:'experimental-earth-paired-mean-bundle/1',project:JSON.parse(serializePortableProject(project)),input:structuredClone(input)};
  q('result').replaceChildren();line(`Original workspace: ${project.title}. Mean-history comparison: ${r.status}. Declared phase boundary: ${r.intervention}.`);
  line(r.operatorQualification);line(`Original earlier supports: ${r.earlier.timeSupport.join(' to ')}. ${r.later?'Original later supports: '+r.later.timeSupport.join(' to ')+'.':''}`);
  if(r.status==='response-compatible'){
   line(`Conditional gap jump at the declared boundary, rounded: ${range(r.jump)} ${r.source.unit}. Slope change: ${range(r.slopeChange)} ${r.source.unit}/day (86400 seconds). These are joint constraints; marginal endpoints cannot be combined arbitrarily.`);
   line(r.zeroSlopeChange.status==='compatible'?`A common slope remains supported with jump ${range(r.zeroSlopeChange.jump)} ${r.source.unit} (rounded).`:'No common slope fits both original mean histories.');
   line(`Continuous nonzero trend change within the actual support gap: ${r.onset.status}. Inclusive gap: ${r.onset.gap.start} to ${r.onset.gap.end}.`);
   for(const b of r.onset.branches)line(`${b.slopeChangeDirection} slope change: onset ${range(b.offsetAfterLastEarlierDays)} days after ${r.onset.gap.start} (rounded).`);
   if(r.onset.unchangedSupported)line('An unchanged line also remains compatible; this does not establish a change time.');
  }else line('No bounded joint response is reported. Inspect the original-period result for incompatible bands or insufficient distinct mean operators. No line or missing observation is invented.');
  line('Exactness concerns the supplied values, support boundaries and declared uniform-time operator. It does not establish source sensor weights, measurement truth, statistical confidence or causality.');
  if(receipt)line(`Original NOAA bytes: SHA-256 ${receipt.sha256}; selected original lines ${receipt.selectedLines.join(', ')}. Surface and air are descriptive channels at one station, not an inferred treatment/control study.`);
  const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Inspect original windows, reported weighting, exact mean constraints and joint regions';pre.textContent=JSON.stringify(r,null,2);pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';details.append(summary,pre);q('result').append(details);q('save').disabled=false;
 }
 async function compare(input,project,serial,{restore=false}={}){const result=input.schema===NOAA_PAIRED_MEAN_SCHEMA?await receiveNoaaPairedMeans(input):{report:inferPairedMeanHistory(input)};if(serial!==revision)return;if(restore)restoreSource(input);show(result.report,input,project,result.source);}
 async function readOriginal(bytes,serial,expected){
  if(bytes.byteLength>4000000)throw Error('Original ASCII file exceeds 4 MB');const rawText=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(/[^\x00-\x7f]/.test(rawText))throw Error('Retain original ASCII bytes');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(expected&&hash!==expected)throw Error('Retained example source hash differs');if(serial!==revision)return;
  raw={rawText,sha256:hash};enableNoaa(true);if(!q('first').value)q('first').value='1';if(!q('count').value)q('count').value='4';q('source').textContent=`Original file retained (${bytes.byteLength} bytes), SHA-256 ${hash}. No source row has been discarded or changed.`;
 }
 q('file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;invalidate();const previousSource=q('source').textContent;q('run').disabled=true;q('source').textContent='Reading selected original file…';const serial=revision;try{if(f.size>4000000)throw Error('Original ASCII file exceeds 4 MB');await readOriginal(await f.arrayBuffer(),serial);}catch(err){if(serial===revision){q('source').textContent='Replacement file unavailable. '+previousSource;q('run').disabled=!raw;q('result').textContent=err.message;}}finally{e.target.value='';}};
 q('example').onclick=async()=>{invalidate();const previousSource=q('source').textContent;q('run').disabled=true;q('source').textContent='Reading retained original excerpt…';const serial=revision;try{const res=await fetch('./examples/noaa-tucson-hourly/tucson-hourly-excerpt.txt');if(!res.ok)throw Error('Original retained excerpt unavailable');await readOriginal(await res.arrayBuffer(),serial,EXAMPLE_HASH);if(serial!==revision)return;
  q('url').value=EXAMPLE_URL;q('first').value='1';q('count').value='4';q('correction').value='C';q('direction').value='surface';q('boundary').value='2025-01-01T17:00:00Z';q('boundary-basis').value='Authored descriptive split of this archived course; not a recorded intervention';q('association').value='Original same-station infrared surface minus air means';for(const n of ['treated','comparison']){q('width-'+n).value='0';q('band-'+n).value='Exact printed-value comparison only; not a sensor uncertainty estimate';}q('uniform').checked=false;q('operator-basis').value='Conditional affine uniform-time comparison; actual per-row temporal weights remain unknown';q('result').textContent='Original excerpt loaded. The split and zero comparison half-widths are authored choices. Review them and explicitly confirm the uniform-time model before comparing.';
 }catch(e){if(serial===revision){q('source').textContent='Replacement excerpt unavailable. '+previousSource;q('run').disabled=!raw;q('result').textContent=e.message;}}};
 q('run').onclick=async()=>{invalidate();const serial=revision;try{if(!raw)throw Error('Load an original NOAA file or reopen an original mean investigation');if(!q('uniform').checked)throw Error('Explicitly confirm the uniform-time model; unknown source weights are not inferred');
  const input={schema:NOAA_PAIRED_MEAN_SCHEMA,source:{...raw,sourceUrl:q('url').value},selection:{firstLine:Number(q('first').value),count:Number(q('count').value),correctionType:q('correction').value},channels:q('direction').value==='surface'?{treated:'SUR_TEMP',comparison:'T_HR_AVG'}:{treated:'T_HR_AVG',comparison:'SUR_TEMP'},boundary:q('boundary').value,boundaryBasis:q('boundary-basis').value,association:q('association').value,comparisonOperator:{kind:'uniform-time-mean',basis:q('operator-basis').value},bands:{}};
  for(const n of ['treated','comparison']){if(!q('width-'+n).value.trim())throw Error('Declare both comparison half-widths');input.bands[n]={halfWidth:Number(q('width-'+n).value),source:q('band-'+n).value};}await compare(input,JSON.parse(serializePortableProject(getProject())),serial);
 }catch(e){if(serial===revision)q('result').textContent=e.message;}};
 q('save').onclick=()=>{if(!accepted)return;const url=URL.createObjectURL(new Blob([JSON.stringify(accepted,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='experimental-earth-paired-means.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 q('open').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;invalidate();const serial=revision;try{if(file.size>8000000)throw Error('Original mean bundle exceeds 8 MB');const b=JSON.parse(await file.text());if(serial!==revision)return;if(!b||b.schema!=='experimental-earth-paired-mean-bundle/1'||Object.keys(b).sort().join(',')!=='input,project,schema'||![PAIRED_MEAN_SCHEMA,NOAA_PAIRED_MEAN_SCHEMA].includes(b.input?.schema))throw Error('Open an original mean bundle, not a derived result');const project=parsePortableProject(JSON.stringify(b.project));await compare(b.input,project,serial,{restore:true});}catch(err){if(serial===revision)q('result').textContent=err.message;}finally{e.target.value='';}};
 return{refresh:invalidate};
}
