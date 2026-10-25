import {LONGWAVE_EVIDENCE_SCHEMA,compareLongwaveEvidence,serializeLongwaveEvidence,reopenLongwaveEvidence} from './longwave-heat-evidence.js';
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
 panel.innerHTML=`<h3>Do the original readings challenge this radiation model?</h3><p>Use the saved temperature evidence and its original declared layer alternatives. Every alternative receives the accepted investigation's emissivity for the observed layer and the same radiative surroundings. The original linear prediction stays visible beside both numerical settings.</p>
 <form id="longwave-evidence-form"><label><input id="longwave-evidence-basis" type="checkbox" required> I declare that every candidate's linear exchange excludes the added radiation term.</label><label class="input-label">Source or assumption for that declaration<textarea id="longwave-evidence-source" maxlength="600" rows="2" required></textarea></label>
 <div class="obs-actions"><button id="longwave-evidence-run" type="submit">Compare original saved readings</button><button id="longwave-evidence-download" type="button" disabled>Download original evidence inquiry</button></div></form>
 <label class="input-label">Reopen an original evidence inquiry<input id="longwave-evidence-upload" type="file" accept=".json,application/json"></label><p id="longwave-evidence-status" role="status"></p><div id="longwave-evidence-results"></div>`;
 host.append(panel);const $=id=>panel.querySelector('#'+id);let accepted=null,generation=0;
 function clear(message){generation++;accepted=null;$('longwave-evidence-results').replaceChildren();$('longwave-evidence-download').disabled=true;$('longwave-evidence-status').textContent=message;}
 $('longwave-evidence-form').addEventListener('input',()=>clear('Candidate exchange declaration changed; compare again.'));
 function draw(report,reopened=false){
  accepted=report.source;$('longwave-evidence-download').disabled=false;const out=$('longwave-evidence-results');out.replaceChildren();
  const {evidence,radiation}=report.source;
  $('longwave-evidence-status').textContent=`${reopened?'Recomputed original file.':'Compared original saved sources.'} ${report.candidates.length} alternatives, ${evidence.readings.length} temperature readings and ${evidence.energyReadings?.length??0} absorbed-input readings. ${report.work.attempts}/${report.work.limit} integration attempts. Current project unchanged.`;
  out.append(el('p',`Observed layer: ${evidence.target}. Fixed declared emissivity: ${radiation[evidence.target].emissivity} (${radiation[evidence.target].source}). Candidate exchange basis: ${report.source.exchangeBasisSource}`),el('p',report.semantics));
  const summaries=tableRegion('Candidate comparisons; scroll horizontally for all columns',['Original alternative','Calibration','Held-aside challenge','Original linear readings inside']);summaries.wrap.id='longwave-evidence-summary-scroll';summaries.table.id='longwave-evidence-summary';
  for(const c of report.candidates){const row=appendRow(summaries.body,[c.label,summary(c.calibration),summary(c.challenge),`${c.calibration.linearInsideCount+c.challenge.linearInsideCount}/${c.calibration.count+c.challenge.count}`]);row.dataset.label=c.label;row.dataset.calibration=String(c.calibration.insideAtBoth);row.dataset.challenge=String(c.challenge.insideAtBoth);}summaries.finish();out.append(summaries.wrap);
  const label=el('label','Inspect an original alternative');label.className='input-label';const select=el('select');select.id='longwave-evidence-candidate';report.candidates.forEach((c,i)=>{const option=el('option',c.label);option.value=String(i);select.append(option);});label.append(select);const details=el('div');details.id='longwave-evidence-candidate-results';out.append(label,details);
  function inspect(){
   details.replaceChildren();const c=report.candidates[Number(select.value)],hypothesis=evidence.hypotheses[Number(select.value)];
   details.append(el('h4',c.label),el('p',hypothesis.source));
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
  const input={schema:LONGWAVE_EVIDENCE_SCHEMA,radiation,evidence,hypothesisExchangeBasis:'excludes-longwave',exchangeBasisSource:$('longwave-evidence-source').value};draw(compareLongwaveEvidence(input));
 }catch(error){clear(error.message);}});
 $('longwave-evidence-download').addEventListener('click',()=>{if(!accepted)return;const url=URL.createObjectURL(new Blob([serializeLongwaveEvidence(accepted)],{type:'application/json'})),a=el('a');a.href=url;a.download='longwave-evidence-inquiry.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 $('longwave-evidence-upload').addEventListener('change',async()=>{clear('Reading original evidence inquiry…');const token=generation,file=$('longwave-evidence-upload').files[0];try{if(!file||file.size>300000)throw Error('Choose an original inquiry no larger than 300000 bytes.');const bytes=await file.arrayBuffer();if(token!==generation)return;const report=reopenLongwaveEvidence(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(token===generation)draw(report,true);}catch(error){if(token===generation)clear(error.message);}finally{$('longwave-evidence-upload').value='';}});
 return {refresh(){clear('Accept matching original sources and compare, or reopen an original inquiry.');}};
}
