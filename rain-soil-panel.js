import {mountRainGauge} from './rain-gauge-panel.js';
import {mountRainSoilQuestion} from './rain-soil-question-panel.js';
import {compareRainSoil,exportRainSoil,importRainSoil} from './rain-soil-evidence.js';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
export function mountRainSoilPanel({getProject,notice}){
 const host=node('section');host.id='rain-soil-investigation';host.append(node('h3','Could uncertain rainfall change the soil explanation?'),node('p','Compare finite constant-rainfall and soil alternatives against original notebook readings. These are conditional computations, not field-validated soil estimates.'));
 document.getElementById('infiltration-form').after(host);
 const form=node('form');host.append(form);
 function input(label,value){const wrap=node('label',label),e=node('input');e.value=value;wrap.append(e);form.append(wrap);return e;}
 const rain=input('Offered rainfall intensities (mm/h, comma separated)','30, 40');
 const lower=input('Optional original rainfall lower bound (mm/h)',''),upper=input('Upper bound (mm/h)',''),source=input('Rainfall source and constant-forcing association','');
 const compare=node('button','Compare current soil choices and rainfall');compare.type='submit';form.append(compare);
 const save=node('button','Download original investigation');save.type='button';save.disabled=true;host.append(save);
 const wrap=node('label','Reopen original investigation without replacing the working site'),file=node('input');file.type='file';file.accept='.json';wrap.append(file);host.append(wrap);
 const status=node('p'),out=node('div');status.setAttribute('role','status');host.append(status,out);let accepted=null,generation=0;
 function clear(){gauge.clear();question.clear();generation++;accepted=null;save.disabled=true;out.replaceChildren();status.textContent='Inputs changed. Compare again.';}
 form.addEventListener('input',clear);
 function display(p,q,r){out.replaceChildren();accepted={project:structuredClone(p),request:structuredClone(q)};save.disabled=false;status.textContent=`${r.status}: ${r.compatiblePairs?.length??0} calibration-compatible pairs; ${r.survivingPairs?.length??0} not contradicted by held-aside readings. ${r.counts.calibration} calibration, ${r.counts.challenge} held aside, ${r.counts.ignored} excluded.`;
 out.append(node('p',`Original site: ${p.title}; observed scenario: ${q.target}; varied surface: ${q.surface}. Offered rain: ${q.rainRatesMmHr.join(', ')} mm/h; offered soil: ${q.ratesMmHr.join(', ')} mm/h.`));
 out.append(node('p',q.gauge?`Rainfall bound ${q.gauge.lowerMmHr}–${q.gauge.upperMmHr} mm/h. Source: ${q.gauge.source}`:'No measured rainfall bound supplied. The weather default is not independent evidence.'));
 for(const c of r.candidates){const card=node('details');card.append(node('summary',`Rain ${c.rainMmHr}, soil ${c.rateMmHr} mm/h: ${c.compatible?'calibration compatible':'not supported by calibration'}; held aside ${c.challenge.compatible===null?'absent':c.challenge.compatible?'inside bands':'contradicted'}; rainfall ${c.gaugeCompatible===null?'unconstrained':c.gaugeCompatible?'inside bound':'contradicted'}`));
 for(const role of ['calibration','challenge'])for(const e of c[role].errors){const reading=p.observations[e.index];card.append(node('p',`${role}, cell ${reading.cellIndex}, minute ${reading.minute}: original ${reading.depthMm} ± ${reading.uncertaintyMm} mm; predicted ${e.depthMm} mm; residual ${e.residualMm} mm. Source: ${reading.source}`));}out.append(card);}question.enable();gauge.enable();}
 form.addEventListener('submit',e=>{e.preventDefault();clear();try{const p=getProject();const rates=document.getElementById('study-rates').value;const parse=s=>s.split(',').map(x=>x.trim()===''?NaN:Number(x));const q={target:document.getElementById('study-target').value,surface:document.getElementById('study-surface').value,ratesMmHr:parse(rates),rainRatesMmHr:parse(rain.value),gauge:lower.value||upper.value||source.value?{lowerMmHr:lower.value.trim()===''?NaN:Number(lower.value),upperMmHr:upper.value.trim()===''?NaN:Number(upper.value),source:source.value}:null};display(p,q,compareRainSoil(p,q));}catch(error){status.textContent=error.message;notice(error.message);}});
 save.addEventListener('click',()=>{if(!accepted)return;try{const blob=new Blob([exportRainSoil(accepted.project,accepted.request)],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='rain-soil-original-inputs.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){notice(error.message);}});
 file.addEventListener('change',async()=>{const f=file.files[0];if(!f)return;clear();const token=generation;try{if(f.size>4*1024*1024)throw Error('File exceeds 4 MiB.');const text=await f.text();if(token!==generation)return;const r=importRainSoil(text);display(r.project,r.request,r.result);status.textContent='Reopened original source; working site unchanged. '+status.textContent;}catch(error){if(token===generation){status.textContent=error.message;notice(error.message);}}finally{if(token===generation)file.value='';}});
 document.getElementById('infiltration-form').addEventListener('input',clear);
 const question=mountRainSoilQuestion({host,getAccepted:()=>accepted,notice});
 const gauge=mountRainGauge({host,getAccepted:()=>accepted,notice});
 return {refresh:clear};
}
