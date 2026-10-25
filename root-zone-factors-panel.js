import {ROOT_ZONE_FACTOR_CASES, ROOT_ZONE_FACTOR_MEANING, rootZoneFactorsAtDay} from './root-zone-factors.js';
const node=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;};
const fmt=n=>n!==0&&(Math.abs(n)<0.0001||Math.abs(n)>=1e7)?Number(n).toExponential(3):Number(n).toLocaleString('en-US',{maximumSignificantDigits:5});
const measures=[['availableMm','Available water','mm'],['suppliedMm','Supplied transpiration','mm'],
 ['unmetMm','Unmet transpiration demand','mm'],['drainageMm','Immediate excess drainage','mm'],['demandLimitedDays','Days with reduced demand supply','days']];
const quantities=[['capacityMm','Declared available capacity','mm'],['initialAvailableMm','Available before recharge','mm'],
 ['rechargeMm','Modeled event infiltration','mm'],['retainedRechargeMm','Recharge retained in store','mm'],
 ['drainageMm','Immediate excess drainage','mm'],['suppliedMm','Transpiration supplied by selected day','mm'],
 ['unmetMm','Unmet demand by selected day','mm'],['availableMm','Available at selected day','mm'],
 ['demandLimitedDays','Days with reduced demand supply','days'],['balanceErrorMm','Water-account residual','mm']];

/** Matrix and selected case share the existing exact-day inspector. */
export function mountRootZoneFactors(host, report) {
 const section=node('section');section.id='rz-factors';section.className='rz-factors';
 section.append(node('h3','Separate the recharge and rooted-store changes'),node('p',ROOT_ZONE_FACTOR_MEANING));
 const label=node('label','Quantity to compare');label.className='input-label';label.htmlFor='rz-factor-metric';
 const select=node('select');select.id='rz-factor-metric';
 measures.forEach(([value,text])=>{const o=node('option',text);o.value=value;select.append(o);});label.append(select);section.append(label);
 const table=node('table');table.id='rz-factor-matrix';table.className='rz-table rz-factor-matrix';
 const caption=node('caption'),head=node('thead'),hr=node('tr');
 for(const text of ['Rooted-store declaration','Existing recharge','Proposed recharge']){const th=node('th',text);th.scope='col';hr.append(th);}head.append(hr);table.append(caption,head);
 const tbody=node('tbody'),buttons={};let selected='combined',day=report.existing.totalDays;
 for(const [store,label]of [['existing','Existing store'],['proposal','Proposed store']]){
  const tr=node('tr'),th=node('th',label);th.scope='row';tr.append(th);
  for(const spec of ROOT_ZONE_FACTOR_CASES.filter(c=>c.store===store)){
   const td=node('td'),button=node('button');button.type='button';button.dataset.case=spec.id;
   button.onclick=()=>{selected=spec.id;render();};buttons[spec.id]=button;td.append(button);tr.append(td);
  }tbody.append(tr);
 }table.append(tbody);section.append(table);
 const explanation=node('p','Each isolated change is relative to the existing case. Combined change = recharge-only change + rooted-store-only change + interaction. Signs follow the selected quantity; a larger number is not always preferable.');
 explanation.className='rz-note';section.append(explanation);
 const effectTable=node('table');effectTable.id='rz-factor-effects';effectTable.className='rz-table';
 const effectCaption=node('caption');effectTable.append(effectCaption);
 const effectBody=node('tbody');effectTable.append(effectBody);section.append(effectTable);
 const detail=node('div');detail.id='rz-factor-case';detail.setAttribute('aria-live','polite');section.append(detail);host.append(section);
 function render() {
  const values=rootZoneFactorsAtDay(report,day),[key,measure,unit]=measures.find(m=>m[0]===select.value);
  caption.textContent=measure+' · '+unit+' · day '+fmt(day)+' after the modeled event. Choose a case to inspect its account.';
  for(const spec of ROOT_ZONE_FACTOR_CASES){
   const button=buttons[spec.id],value=values.cases[spec.id][key];button.textContent=fmt(value)+' '+unit;
   button.dataset.value=String(value);button.setAttribute('aria-label',spec.label+': '+fmt(value)+' '+unit);button.setAttribute('aria-pressed',String(spec.id===selected));
  }
  effectCaption.textContent='Signed changes in '+measure.toLowerCase()+' · '+unit+' · day '+fmt(day);
  effectBody.replaceChildren();
  for(const [effect,title]of [['rechargeOnly','Change in recharge alone'],['storeOnly','Change in rooted store alone'],['combined','Both changes together'],['interaction','Interaction beyond the two isolated changes']]){
   const tr=node('tr'),th=node('th',title),td=node('td',fmt(values.effects[key][effect]));th.scope='row';
   tr.dataset.effect=effect;td.dataset.value=String(values.effects[key][effect]);tr.append(th,td);effectBody.append(tr);
  }
  const spec=report.factors.cases[selected],r=spec.result;detail.replaceChildren(node('h4',spec.label+' · day '+fmt(day)));
  detail.dataset.case=selected;detail.dataset.day=String(day);
  detail.append(node('p','Rooted-store source: '+r.root.source),node('p','Recharge source: '+(spec.recharge==='existing'?'existing':'proposed')+' original site cell; '+fmt(r.originalBudget.absorbedLiters)+' L / '+fmt(report.cellAreaM2)+' m².'),
   node('p','Fractions at field capacity / wilting point: '+fmt(r.root.fieldCapacity)+' / '+fmt(r.root.wiltingPoint)+'; root depth '+fmt(r.root.rootDepthM)+' m; depletion fraction '+fmt(r.root.depletionFraction)+'.'));
  const account=node('table');account.className='rz-table';account.id='rz-factor-account';
  account.append(node('caption','Selected case water account at day '+fmt(day)));
  const body=node('tbody');
  for(const [quantity,title,units]of quantities){const tr=node('tr'),th=node('th',title+' · '+units),td=node('td',fmt(values.cases[selected][quantity]));th.scope='row';tr.dataset.quantity=quantity;td.dataset.value=String(values.cases[selected][quantity]);tr.append(th,td);body.append(tr);}
  account.append(body);detail.append(account);
 }
 select.onchange=render;
 return nextDay=>{day=nextDay;render();};
}

