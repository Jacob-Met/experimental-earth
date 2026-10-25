import {LONGWAVE_EVIDENCE_SCHEMA,LONGWAVE_FAMILY_SCHEMA,compareLongwaveEvidence,serializeLongwaveEvidence,reopenLongwaveEvidence} from './longwave-heat-evidence.js';
const el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;};
const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:6});
const bandLabel={inside:'Inside at both settings',outside:'Outside at both settings',disagreement:'Settings disagree'};
function tableRegion(label,headers){
 const wrap=el('div');wrap.style.overflowX='auto';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',label);
 const table=el('table');table.style.tableLayout='auto';table.style.minWidth='48rem';const head=el('thead'),row=el('tr');
 for(const text of headers){const cell=el('th',text);cell.scope='col';row.append(cell);}head.append(row);const body=el('tbody');table.append(head,body);wrap.append(table);
 return {wrap,table,body,finish(){for(const cell of table.querySelectorAll('th,td')){cell.style.padding='.5rem .75rem';cell.style.whiteSpace='nowrap';cell.style.textAlign='left';cell.style.verticalAlign='top';}}};
}
function appendRow(body,values){const row=el('tr');values.forEach((value,i)=>{const cell=el(i?'td':'th',String(value));if(!i)cell.scope='row';row.append(cell);});body.append(row);return row;}
const summary=s=>s.count?`${s.rows.filter(r=>r.bandAtTestedSettings==='inside').length}/${s.count} inside both; ${s.settingDisagreements} disagreements`:'No readings in this role';

export function mountLongwaveHeatEvidence({getProject,getInvestigation,host}){
 const panel=el('section');panel.id='longwave-heat-evidence';panel.className='heat-result-card';
 panel.innerHTML=`<h3>Do the original readings challenge this radiation model?</h3><p>Use the saved temperature evidence and its original declared layer alternatives. Keep the observed layer's emissivity fixed, or explicitly declare a separate emissivity for every original alternative. All receive the same original radiative surroundings. The original linear prediction stays visible beside both numerical settings.</p>
 <form id="longwave-evidence-form"><label><input id="longwave-evidence-basis" type="checkbox" required> I declare that every candidate's linear exchange excludes the added radiation term.</label><label class="input-label">Source or assumption for that declaration<textarea id="longwave-evidence-source" maxlength="600" rows="2" required></textarea></label>
 <label><input id="longwave-family-mode" type="checkbox" style="display:inline-block;width:1.1rem;min-height:1.1rem;margin-right:.5rem"> Declare a separate emissivity for every original layer alternative</label><p class="mini-note">These are explicitly offered coefficient families. Matching temperature and energy does not identify a unique material or establish physical validity. No value or source is filled in for you.</p><div id="longwave-family-fields" class="heat-layers" hidden></div>
 <div class="obs-actions"><button id="longwave-evidence-run" type="submit">Compare original saved readings</button><button id="longwave-evidence-download" type="button" disabled>Download original evidence inquiry</button></div></form>
 <label class="input-label">Reopen an original evidence inquiry<input id="longwave-evidence-upload" type="file" accept=".json,application/json"></label><p id="longwave-evidence-status" role="status"></p><div id="longwave-evidence-results"></div>`;
 host.append(panel);const $=id=>panel.querySelector('#'+id);let accepted=null,generation=0,familySignature='';
 function clear(message){generation++;accepted=null;$('longwave-evidence-results').replaceChildren();$('longwave-evidence-download').disabled=true;$('longwave-evidence-status').textContent=message;}
 function syncFamilyRows(){
  const hypotheses=getProject().surfaceHeatEvidence?.hypotheses??[],signature=JSON.stringify(hypotheses),host=$('longwave-family-fields');
  if(signature!==familySignature){
   familySignature=signature;host.replaceChildren();
   if(!hypotheses.length)host.append(el('p','Save original layer hypotheses in the temperature-evidence panel first.'));
   hypotheses.forEach((hypothesis,index)=>{
    const row=el('fieldset');row.dataset.label=hypothesis.label;row.append(el('legend',hypothesis.label));
    const label=el('label','Longwave emissivity · 0–1');label.className='input-label';const value=el('input');value.id='longwave-family-emissivity-'+index;value.className='family-emissivity';value.type='number';value.min='0';value.max='1';value.step='any';value.required=true;label.append(value);
    const sourceLabel=el('label','Source or assumption for this emissivity');sourceLabel.className='input-label';const source=el('textarea');source.id='longwave-family-source-'+index;source.className='family-source';source.maxLength=600;source.rows=2;source.required=true;sourceLabel.append(source);row.append(label,sourceLabel);host.append(row);
   });
  }
  const enabled=$('longwave-family-mode').checked;host.hidden=!enabled;host.style.display=enabled?'grid':'none';for(const control of host.querySelectorAll('input,textarea'))control.disabled=!enabled;
 }
 $('longwave-family-mode').addEventListener('input',syncFamilyRows);
 $('longwave-evidence-form').addEventListener('input',()=>clear('Candidate exchange declaration changed; compare again.'));
 function draw(report,reopened=false){
  accepted=report.source;$('longwave-evidence-download').disabled=false;const out=$('longwave-evidence-results');out.replaceChildren();
  const {evidence,radiation}=report.source;
  $('longwave-evidence-status').textContent=`${reopened?'Recomputed original file.':'Compared original saved sources.'} ${report.candidates.length} alternatives, ${evidence.readings.length} temperature readings and ${evidence.energyReadings?.length??0} absorbed-input readings. ${report.work.attempts}/${report.work.limit} integration attempts. Current project unchanged.`;
  const familyMode=report.source.schema===LONGWAVE_FAMILY_SCHEMA;
  out.append(el('p',`Observed layer: ${evidence.target}. ${familyMode?'Each original alternative uses its own sourced emissivity below.':`Fixed declared emissivity: ${radiation[evidence.target].emissivity} (${radiation[evidence.target].source}).`} Candidate exchange basis: ${report.source.exchangeBasisSource}`),el('p',report.semantics));
  const summaries=tableRegion('Candidate comparisons; scroll horizontally for all columns',['Original alternative','Longwave emissivity','Calibration','Held-aside challenge','Original linear readings inside']);summaries.wrap.id='longwave-evidence-summary-scroll';summaries.table.id='longwave-evidence-summary';
  for(const c of report.candidates){const row=appendRow(summaries.body,[c.label,fmt(c.radiative.emissivity),summary(c.calibration),summary(c.challenge),`${c.calibration.linearInsideCount+c.challenge.linearInsideCount}/${c.calibration.count+c.challenge.count}`]);row.dataset.label=c.label;row.dataset.calibration=String(c.calibration.insideAtBoth);row.dataset.challenge=String(c.challenge.insideAtBoth);}summaries.finish();out.append(summaries.wrap);
  const label=el('label','Inspect an original alternative');label.className='input-label';const select=el('select');select.id='longwave-evidence-candidate';report.candidates.forEach((c,i)=>{const option=el('option',c.label);option.value=String(i);select.append(option);});label.append(select);const details=el('div');details.id='longwave-evidence-candidate-results';out.append(label,details);
  function inspect(){
   details.replaceChildren();const c=report.candidates[Number(select.value)],hypothesis=evidence.hypotheses[Number(select.value)];
   details.append(el('h4',c.label),el('p',hypothesis.source),el('p',`Longwave emissivity ${c.radiative.emissivity}: ${c.radiative.source}`));
   if(c.rows.length){
    const table=tableRegion('Original temperature residuals; scroll horizontally',['Minute / role','Observed °C ± band','Linear-only °C','Radiation · 10⁻⁸ °C local','Radiation · 10⁻¹⁰ °C local','Residuals · observed minus prediction','Change across settings °C','Band comparison']);table.table.id='longwave-evidence-temperatures';
    for(const row of c.rows){const r=row.reading;appendRow(table.body,[`${fmt(r.minute)} / ${r.use}`,`${fmt(r.temperatureC)} ± ${fmt(r.halfWidthC)}`,fmt(row.linearPredictionC),fmt(row.predictedC[0]),fmt(row.predictedC[1]),row.residualC.map(fmt).join(' / '),row.predictionChangeC.toExponential(3),bandLabel[row.bandAtTestedSettings]]);}table.finish();details.append(table.wrap);
   }
   if(c.energyRows.length){const table=tableRegion('Original absorbed-input readings; scroll horizontally',['Interval / role','Observed J/m² ± band','Predicted J/m² · both models','Residual J/m²','Band comparison']);table.table.id='longwave-evidence-energies';for(const row of c.energyRows){const r=row.reading;appendRow(table.body,[`${fmt(r.fromMinute)}–${fmt(r.toMinute)} / ${r.use}`,`${fmt(r.energyJm2)} ± ${fmt(r.halfWidthJm2)}`,fmt(row.predictionJm2),fmt(row.residualJm2),bandLabel[row.bandAtTestedSettings]]);}table.finish();details.append(table.wrap);}
   const sources=el('details');sources.append(el('summary','Every original reading and association source'),el('p',evidence.associationSource));for(const row of [...c.rows,...c.energyRows]){const r=row.reading;sources.append(el('p',`${row.kind==='temperature'?fmt(r.minute)+' min':fmt(r.fromMinute)+'–'+fmt(r.toMinute)+' min'} · ${r.use}: ${r.source}`));}details.append(sources);
   details.append(el('p','The two numbers are independently integrated at the original reading time. Their agreement does not bound the true numerical error. A disagreement remains visible and is not counted as inside both settings. Linear-only temperature and absorbed-input comparisons retain the existing arithmetic guard.'));
  }
  select.addEventListener('change',inspect);inspect();
 }
 $('longwave-evidence-form').addEventListener('submit',event=>{event.preventDefault();clear('Comparing original sources…');try{
  if(!$('longwave-evidence-basis').checked)throw Error('Declare the exchange basis for every original candidate.');const radiation=getInvestigation(),evidence=getProject().surfaceHeatEvidence;
  if(!radiation)throw Error('Accept a longwave comparison or reopen its original investigation above first.');if(!evidence)throw Error('Save original surface-temperature evidence in the temperature-evidence panel first.');
  const separate=$('longwave-family-mode').checked;
  const input={schema:separate?LONGWAVE_FAMILY_SCHEMA:LONGWAVE_EVIDENCE_SCHEMA,radiation,evidence,hypothesisExchangeBasis:'excludes-longwave',exchangeBasisSource:$('longwave-evidence-source').value};
  if(separate){
   if(familySignature!==JSON.stringify(evidence.hypotheses))throw Error('Original layer hypotheses changed; declare every emissivity again.');
   const rows=[...$('longwave-family-fields').querySelectorAll('fieldset')];
   if(rows.length!==evidence.hypotheses.length)throw Error('Declare an emissivity for every original layer hypothesis.');
   input.radiativeHypotheses=rows.map((row,index)=>{const value=row.querySelector('.family-emissivity').value;if(!value.trim()||row.dataset.label!==evidence.hypotheses[index].label)throw Error('Every original alternative needs its own explicit emissivity.');return {label:row.dataset.label,emissivity:Number(value),source:row.querySelector('.family-source').value};});
  }
  draw(compareLongwaveEvidence(input));
 }catch(error){clear(error.message);}});
 $('longwave-evidence-download').addEventListener('click',()=>{if(!accepted)return;const url=URL.createObjectURL(new Blob([serializeLongwaveEvidence(accepted)],{type:'application/json'})),a=el('a');a.href=url;a.download='longwave-evidence-inquiry.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 $('longwave-evidence-upload').addEventListener('change',async()=>{clear('Reading original evidence inquiry…');const token=generation,file=$('longwave-evidence-upload').files[0];try{if(!file||file.size>300000)throw Error('Choose an original inquiry no larger than 300000 bytes.');const bytes=await file.arrayBuffer();if(token!==generation)return;const report=reopenLongwaveEvidence(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(token===generation)draw(report,true);}catch(error){if(token===generation)clear(error.message);}finally{$('longwave-evidence-upload').value='';}});
 syncFamilyRows();
 return {refresh(){syncFamilyRows();clear('Accept matching original sources and compare, or reopen an original inquiry.');}};
}
