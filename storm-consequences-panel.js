import {compareStormConsequences} from './storm-consequences.js';
import {INTERVENTION_METRICS} from './intervention-study.js';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const range=(m,unit)=>m.min.toFixed(3)+' to '+m.max.toFixed(3)+' '+unit+' ('+m.direction+')';
/** Owned by the parent's original-source result; removing it retires this view. */
export function createStormConsequencePanel(bundle){
 const section=node('section');section.id='storm-consequences';
 section.append(node('h4','Does the same proposal help in both source storms?'),
  node('p','A rate that survives another storm does not guarantee that the proposal has the same effect under that forcing. Compare both declared plans in each original event. Both physical plans must match; no plan is copied into an observed source.'));
 const run=node('button','Compare the plan in both source storms');run.type='button';run.id='storm-consequence-run';
 const status=node('p','Not compared.');status.id='storm-consequence-status';status.setAttribute('role','status');status.dataset.state='not-compared';
 const out=node('div');out.id='storm-consequence-results';section.append(run,status,out);
 run.addEventListener('click',()=>{
  out.replaceChildren();status.dataset.state='not-compared';
  try{
   const r=compareStormConsequences(bundle);status.dataset.state=r.status;
   if(r.status!=='compared'){status.textContent=r.status==='work-limit'?'Complete evidence and paired-storm work exceeds the calculation limit. Reduce the original grid, duration or offered rate count.':'No two-storm consequences were computed: '+r.status+'.';return;}
   status.textContent='Compared '+r.candidates.length+' unchanged rate(s) under both original storms.';
   out.append(node('p',r.semantics),node('p',r.firstReference+': '+bundle.calibrationProject.weather.durationMinutes+' min modeled horizon. '+r.secondReference+': '+bundle.challengeProject.weather.durationMinutes+' min. These are separate event totals, not normalized rates.'));
   for(const [key,m] of Object.entries(r.metrics)){
    const metric=INTERVENTION_METRICS[key],detail=node('section');detail.append(node('h5',metric.label+' — proposal minus existing'),
     node('p',r.firstReference+': '+range(m.first,metric.unit)),node('p',r.secondReference+': '+range(m.second,metric.unit)),
     node('p',m.ratesWithStormSignReversal.length?'Same-rate direction reversal at '+m.ratesWithStormSignReversal.join(', ')+' mm/h.':'No same-rate direction reversal among the retained rates.'));
    out.append(detail);
   }
   for(const c of r.candidates){
    const detail=node('details');detail.append(node('summary',c.rateMmHr+' mm/h: both original paired accounts'));
    for(const [side,label] of [['first',r.firstReference],['second',r.secondReference]]){
     detail.append(node('p',label));
     for(const [key,m] of Object.entries(c[side].metrics))detail.append(node('p',INTERVENTION_METRICS[key].label+': '+m.existing.toFixed(3)+' → '+m.proposal.toFixed(3)+' '+INTERVENTION_METRICS[key].unit+'; change '+m.delta.toFixed(3)+'.'));
     detail.append(node('p','Water-account residuals: existing '+c[side].massErrorLiters.existing+' L; proposal '+c[side].massErrorLiters.proposal+' L.'));
    }out.append(detail);
   }
   const local=node('details');local.append(node('summary','Every cell: separate peak-depth change in each storm'));
   const width=bundle.calibrationProject.width;
   for(const c of r.cells)local.append(node('p',String.fromCharCode(65+c.cellIndex%width)+(Math.floor(c.cellIndex/width)+1)+': '+r.firstReference+' '+range(c.first,'mm')+'; '+r.secondReference+' '+range(c.second,'mm')+'. Same-rate sign reversals: '+(c.ratesWithStormSignReversal.join(', ')||'none')+'.'));
   out.append(local);
  }catch(error){status.dataset.state='refused';status.textContent=error.message;}
 });
 return section;
}
