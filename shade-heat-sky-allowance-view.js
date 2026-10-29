import {node,table} from './shade-heat-epoch-view.js';
import {createSkyAllowanceReport,inspectSkyAllowanceReport} from './shade-heat-sky-allowance-report.js';
import {parseSkyAllowanceText,skyAllowanceFractionText,skyAllowanceAmountText,SKY_ALLOWANCE_LIMITS} from './shade-heat-sky-allowance.js';

const names={none:'No compatible profile meets both limits at this allowance','some-but-not-every':'Some, but not every, compatible profile meets both limits',every:'Every compatible profile meets both limits'};
const short={none:'None','some-but-not-every':'Some but not every',every:'Every'};
const amount=value=>'≈ '+skyAllowanceAmountText(value)+' °C';
const letter=i=>i===0?'A':'B';
const indices=items=>items.map(i=>i+1).join(', ')||'none';
const encode=value=>JSON.stringify(value,(_key,item)=>typeof item==='bigint'?String(item):item,2);
function gridTable(caption,headings,rows){const out=table(caption,headings,rows);out.classList.add('coverage-table');return out;}

/** An inspection of the accepted original report. Input and event changes have
 * no path to the worker or to saved source declarations.
 */
export function drawSkyAllowanceReport(host,report,isCurrent){
 const binding=createSkyAllowanceReport(report),section=node('section');section.id='coverage-allowance';section.className='allowance-panel';
 let version=0,current=null,selectedInput=null,selectedPattern=binding.patterns[0]?.patternIndex??null;
 const active=element=>host.isConnected&&section.isConnected&&element.isConnected&&isCurrent()&&!element.disabled;
 section.append(node('h3','Inspect a common allowance'),
  node('p','Choose the same nonnegative Celsius allowance for both requirements. Original observation bands and the complete original minimum family stay fixed. Equality is included.'),
  node('p','This allowance changes the inspection only. The saved input file retains the original source and requirements.'));
 host.append(section);
 if(!binding.patterns.length){
  section.dataset.state='original-incompatible';section.append(node('p','The original compatible family is empty. There are no allowance events, profile classifications or every-profile guarantee to inspect.'));return;
 }
 const controls=node('div');controls.className='allowance-controls';
 const label=node('label','Common allowance in °C'),input=node('input');input.id='allowance-input';input.type='text';input.inputMode='text';input.maxLength=SKY_ALLOWANCE_LIMITS.textCharacters;input.value='0';input.autocomplete='off';input.spellcheck=false;label.htmlFor=input.id;label.append(input);
 const hint=node('p','Decimal and scientific text mean exact base ten. Fractions retain exact rational boundaries. Examples: 0.001, 1e-3 or 1 / 1000.');hint.id='allowance-input-hint';hint.className='allowance-hint';
 const apply=node('button','Apply allowance');apply.id='allowance-apply';apply.type='button';
 const eventLabel=node('label','Choose an exact transition'),events=node('select');events.id='allowance-event-select';eventLabel.htmlFor=events.id;
 const blank=node('option','Choose an exact transition');blank.value='';events.append(blank);
 for(const [index,event]of binding.events.entries()){
  const roles=[];if(event.existencePatternIndices.length)roles.push('some begins: '+indices(event.existencePatternIndices));if(event.universalPatternIndices.length)roles.push('every begins: '+indices(event.universalPatternIndices));
  const option=node('option',amount(event.value)+' · '+(roles.join(' · ')||'domain start'));option.value=String(index);events.append(option);
 }
 eventLabel.append(events);controls.append(label,eventLabel,apply);section.append(controls,hint);
 const feedback=node('p');feedback.id='allowance-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');input.setAttribute('aria-describedby',hint.id+' '+feedback.id);section.append(feedback);
 const output=node('div');output.id='allowance-result';section.append(output);
 const eventDetail=node('details');eventDetail.id='allowance-events';eventDetail.append(node('summary','Every exact transition and its tied pattern roles'));
 let eventsDrawn=false;eventDetail.addEventListener('toggle',()=>{
  if(!active(eventDetail)||!eventDetail.open||eventsDrawn)return;eventsDrawn=true;
  eventDetail.append(node('p','Zero starts the allowed domain. A pattern can acquire both event roles at the same boundary and move directly from none to every. Each interval includes its lower boundary and excludes its upper boundary.'),
   gridTable('Exact event fractions retain every tied role',['Exact allowance in °C','At least one begins in patterns','Every begins in patterns'],binding.events.map(e=>[skyAllowanceFractionText(e.value),indices(e.existencePatternIndices),indices(e.universalPatternIndices)])));
 });section.append(eventDetail);
 function retire(message,state){
  version++;current=null;selectedInput=null;output.replaceChildren();section.dataset.state=state;delete section.dataset.allowance;delete section.dataset.globalStatus;events.value='';feedback.textContent=message;
 }
 input.addEventListener('input',()=>{if(!active(input))return;input.removeAttribute('aria-invalid');retire('The text has changed. Apply it to classify the original family.','editing');});
 function applyText(){
  if(!active(input)||!active(apply))return;
  try{const value=parseSkyAllowanceText(input.value);select(value,{kind:'text',text:input.value});}
  catch(error){retire(error.message,'invalid');input.setAttribute('aria-invalid','true');}
 }
 apply.addEventListener('click',applyText);input.addEventListener('keydown',event=>{if(event.key==='Enter'&&active(input)){event.preventDefault();applyText();}});
 events.addEventListener('input',()=>{
  if(!active(events)||events.value==='')return;const index=Number(events.value);
  if(!Number.isInteger(index)||!binding.events[index])return;
  input.value=skyAllowanceFractionText(binding.events[index].value);select(binding.events[index].value,{kind:'event',eventIndex:index});
 });
 function select(value,origin){
  const projected=inspectSkyAllowanceReport(binding,value);version++;current=projected;selectedInput=origin;
  input.removeAttribute('aria-invalid');events.value=origin.kind==='event'?String(origin.eventIndex):'';
  Object.assign(section.dataset,{state:'classified',allowance:skyAllowanceFractionText(projected.result.allowance),globalStatus:projected.result.globalStatus});
  feedback.textContent='Applied '+amount(projected.result.allowance)+'. '+names[projected.result.globalStatus]+'.';draw();
 }
 function draw(){
  const projected=current,p=projected.result,stamp=version,guard=element=>stamp===version&&current===projected&&active(element);
  output.replaceChildren();
  const verdict=node('div');verdict.id='allowance-verdict';verdict.className='allowance-verdict';verdict.dataset.status=p.globalStatus;
  verdict.append(node('strong',names[p.globalStatus]),node('p','Selected common allowance: '+amount(p.allowance)+'.'));
  const interval=p.interval;
  verdict.append(node('p','Current event interval (approximate endpoints): ['+skyAllowanceAmountText(interval.lower)+', '+(interval.upper===null?'unbounded':skyAllowanceAmountText(interval.upper))+') °C. The lower boundary is included; '+(interval.upper===null?'there is no upper boundary.':'the upper boundary is excluded. Displayed amounts are approximations; the exact fractions determine membership.')));
  output.append(verdict);
  const counts=node('div');counts.className='allowance-counts';counts.id='allowance-pattern-counts';
  for(const [key,label]of [['none','None'],['someButNotEvery','Some but not every'],['every','Every']]){
   const card=node('article');card.dataset.classification=key;card.append(node('strong',String(p.patternCounts[key])),node('span',label));counts.append(card);
  }
  output.append(node('h4','Pattern classifications'),counts,node('p','These counts describe compatible patterns. They are not probabilities or fractions of the profile family. A global “some but not every” result can contain separate “none” and “every” patterns.'));
  const limits=node('div');limits.className='allowance-limits';
  for(const [i,target]of binding.requirements.entries()){
   const card=node('article');card.append(node('h4','Requirement '+letter(i)),node('p',(target.relation==='at-most'?'Upper endpoint ≤ ':'Lower endpoint ≥ ')+amount(p.relaxedLimits[i])),node('p','Original limit: '+amount(target.limit)));
   card.dataset.requirement=String(i);card.dataset.originalLimit=skyAllowanceFractionText(target.limit);card.dataset.selectedLimit=skyAllowanceFractionText(p.relaxedLimits[i]);limits.append(card);
  }output.append(limits);
  const patterns=gridTable('Every compatible pattern at the selected common allowance',['Pattern','Classification','Own one-profile minimum','Own every-profile bound'],p.patterns.map(row=>[
   String(row.patternIndex+1),short[row.status],amount(row.someProfileRelaxation),amount(row.allProfileRelaxation)]));patterns.id='allowance-patterns';
  Array.from(patterns.querySelectorAll('tbody tr')).forEach((row,i)=>Object.assign(row.dataset,{pattern:String(p.patterns[i].patternIndex),status:p.patterns[i].status}));output.append(patterns);
  const chosenLabel=node('label','Inspect the three retained roles in a pattern'),chosen=node('select');chosen.id='allowance-pattern-select';chosenLabel.className='coverage-pattern-choice';chosenLabel.htmlFor=chosen.id;
  for(const row of p.patterns){const option=node('option','Pattern '+(row.patternIndex+1)+' · '+short[row.status]);option.value=String(row.patternIndex);chosen.append(option);}
  chosen.value=String(selectedPattern);chosenLabel.append(chosen);output.append(chosenLabel);
  const roles=node('div');roles.id='allowance-roles';output.append(roles);
  chosen.addEventListener('input',()=>{if(!guard(chosen))return;const index=Number(chosen.value);if(!p.patterns.some(x=>x.patternIndex===index))return;selectedPattern=index;drawRoles();});
  function drawRoles(){
   if(!guard(roles))return;roles.replaceChildren();const pattern=p.patterns.find(x=>x.patternIndex===selectedPattern);
   for(const w of pattern.witnesses){
    const numerical=projected.numerical.find(x=>x.patternIndex===pattern.patternIndex&&x.role===w.role&&x.requirementIndex===w.requirementIndex);
    const card=node('article');card.className='allowance-role';Object.assign(card.dataset,{pattern:String(pattern.patternIndex),role:w.role,requirement:w.requirementIndex===null?'none':String(w.requirementIndex),meetsBoth:String(w.meetsBoth),counterexample:String(w.designatedCounterexample)});
    card.append(node('h4',w.role==='some-profile'?'Minimum-relaxation profile for this pattern':'Profile attaining requirement '+letter(w.requirementIndex)+'’s signed maximum'),
     node('p','Pattern '+(pattern.patternIndex+1)+' · this same profile requires '+amount(w.requiredRelaxation)+' to meet both exact limits.'),
     node('p',w.meetsBoth?'This retained profile meets both exact limits at the selected allowance.':'This retained profile does not meet both exact limits at the selected allowance.'));
    if(w.maximumViolation!==null)card.append(node('p','Designated signed maximum: '+amount(w.maximumViolation)+'. '+(w.designatedCounterexample?'It is strictly above the allowance, so this profile is a counterexample.':'It does not exceed the allowance; exact contact is not a counterexample.')));
    const rows=gridTable('Both requirements for this one common profile',['Requirement','Exact original','Exact selected','Numerical original','Numerical selected'],binding.requirements.map((target,i)=>[letter(i),w.originalStatuses[i],w.selectedStatuses[i],numerical.originalStatuses[i],numerical.selectedStatuses[i]]));
    Array.from(rows.querySelectorAll('tbody tr')).forEach((row,i)=>Object.assign(row.dataset,{requirement:String(i),exactOriginal:w.originalStatuses[i],exactSelected:w.selectedStatuses[i],numericalOriginal:numerical.originalStatuses[i],numericalSelected:numerical.selectedStatuses[i]}));card.append(rows);roles.append(card);
   }
  }drawRoles();
  output.append(node('p','The minimum profile and the A and B maximum profiles remain separate, even when their coordinates coincide. Exact certificates establish the complete-family verdict. Original numerical replay statuses are reevaluated against the same selected limits and are shown separately.'));
  const proof=node('details');proof.id='allowance-selected-proof';proof.className='coverage-proof';proof.append(node('summary','Exact selected allowance, event interval and every retained role'));
  const code=node('pre');proof.append(code);proof.addEventListener('toggle',()=>{if(!guard(proof)||!proof.open||code.textContent)return;code.textContent=encode({events:binding.events,selection:{input:selectedInput,...projected}});});output.append(proof);
 }
 events.value='0';select(binding.events[0].value,{kind:'event',eventIndex:0});
}
