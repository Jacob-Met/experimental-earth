import {node,table,point} from './shade-heat-epoch-view.js';
import {skyAllowanceFractionText} from './shade-heat-sky-allowance.js';
const fraction=v=>[BigInt(v.exact.numerator),BigInt(v.exact.denominator)];
function amount(v){
 const [signed,denominator]=fraction(v);if(signed===0n)return '0';
 const numerator=signed<0n?-signed:signed,sign=signed<0n?'-':'';
 let exponent=numerator.toString().length-denominator.toString().length;
 if(exponent>=0?numerator<denominator*10n**BigInt(exponent):numerator*10n**BigInt(-exponent)<denominator)exponent--;
 const shift=6-exponent,scaled=shift>=0?numerator*10n**BigInt(shift)/denominator:numerator/(denominator*10n**BigInt(-shift));
 const digits=scaled.toString().padStart(7,'0');
 if(exponent>=-2&&exponent<=3){
  const position=exponent+1,text=position<=0?'0.'+'0'.repeat(-position)+digits:digits.slice(0,position)+'.'+digits.slice(position);
  return sign+text.replace(/0+$/,'').replace(/\.$/,'');
 }
 return sign+digits[0]+'.'+digits.slice(1)+'e'+String(exponent);
}
const exact=v=>skyAllowanceFractionText(fraction(v));
const interval=p=>'['+amount(p.lower)+', '+amount(p.upper)+'] °C';
const intervalExact=p=>'['+exact(p.lower)+', '+exact(p.upper)+'] °C';
const patterns=ids=>ids.length?ids.map(i=>'P'+(i+1)).join(', '):'None';
const storeName=store=>store==='surfaceC'?'Ground surface':'Lower heat store';
const choice=(label,id,values)=>{
 const wrap=node('label',label),select=node('select');select.id=id;
 for(const [value,text]of values){const option=node('option',text);option.value=String(value);select.append(option);}
 wrap.append(select);return {wrap,select};
};
function detail(title,rows){const el=node('details');el.append(node('summary',title));const pre=node('pre',rows);el.append(pre);return el;}
function exactValue(title,value){const el=node('div');el.className='conditional-value';el.append(node('h4',title),node('strong',amount(value)+' °C'),detail('Exact value',exact(value)+' °C'));return el;}
export function drawSkyConditionalReport(container,output,isCurrent){
 const {report:r,investigation}=output;let revision=0;container.replaceChildren();container.hidden=false;
 Object.assign(container.dataset,{status:r.conditionalStatus,original:r.compatibility,minimum:r.minimumChanges===null?'none':String(r.minimumChanges),
  patterns:String(r.patterns.length),alternatives:String(r.alternatives.length),survivors:String(r.conditionalPatternIndices.length),excluded:String(r.conditionalExcludedPatternIndices.length),
  components:String(r.components.length),gaps:String(r.gaps.length),records:String(r.readings.length),originalTimes:String(r.originalTimes.length),sources:String(r.work.uniqueSources)});
 const live=()=>container.isConnected&&isCurrent();
 const verdict=node('div');verdict.className='conditional-verdict';verdict.dataset.status=r.conditionalStatus;
 verdict.append(node('p','03 / The conditioned original family'));verdict.firstChild.className='eyebrow';
 const title=r.conditionalStatus==='original-incompatible'?'The original observations have no compatible pattern':
  r.conditionalStatus==='conditional-empty'?'No original minimum pattern satisfies both selected requirements':'The third consequence after both requirements are satisfied';
 verdict.append(node('h2',title));
 verdict.append(node('p',r.conditionalStatus==='original-incompatible'?'No consequence range is assessed. The original observations remain unchanged.':
  r.conditionalStatus==='conditional-empty'?'The original minimum is '+r.minimumChanges+' changes. Applying both conditions removes every compatible pattern in that class. A higher-change class is not substituted.':
  r.conditionalPatternIndices.length+' of '+r.alternatives.length+' original minimum patterns survive. The original minimum remains '+r.minimumChanges+' changes.'));
 container.append(verdict);
 const target=node('p','Third consequence: receiver '+(r.consequence.sourceIndex+1)+' · point '+point(investigation.readings[r.consequence.receiverReadingIndex])+' · '+r.consequence.utc+' · '+storeName(r.consequence.store)+'. Proposal minus existing.');target.id='conditional-target-summary';container.append(target);
 container.append(node('p',r.consequence.source));
 const selected=node('div');selected.className='conditional-allowance';selected.id='conditional-selected-allowance';
 selected.append(node('strong','Fixed allowance: '+amount(r.allowanceC)+' °C'),detail('Exact allowance',exact(r.allowanceC)+' °C'),
  node('p','This input applies to both requirements. Changing it starts a new computation. The original thresholds stay visible.'));
 container.append(selected);
 container.append(table('Original thresholds and selected conditions',['Requirement','Original receiver / clock / component','Entire interval','Original limit °C','Selected limit °C','Basis'],r.requirements.map(t=>[
  t.requirementIndex?'B':'A','Receiver '+(t.sourceIndex+1)+' / '+t.utc+' / '+storeName(t.store),t.relation==='at-most'?'At most':'At least',exact(t.limitC),exact(t.selectedLimitC),t.source])));
 if(r.hullC){
  const bounds=node('div');bounds.className='conditional-bounds';bounds.id='conditional-hull';
  bounds.append(exactValue('Outer lower endpoint',r.hullC.lower),exactValue('Outer upper endpoint',r.hullC.upper));container.append(bounds);
  container.append(node('p','Displayed decimals are approximate. Expand exact values or exact component endpoints to inspect the retained fractions.'));
  container.append(node('p','Lower endpoint attained by '+patterns(r.lowerAttainingPatternIndices)+'; upper endpoint attained by '+patterns(r.upperAttainingPatternIndices)+'. These can be different profiles and patterns.'));
  container.append(table('Closed interval components of the conditioned consequence',['Component','Range °C','Contributing patterns','Lower endpoint attainers','Upper endpoint attainers'],r.components.map((c,i)=>[
   String(i+1),interval(c),patterns(c.patternIndices),patterns(c.lowerAttainingPatternIndices),patterns(c.upperAttainingPatternIndices)])));
  const exactComponents=detail('Exact component endpoints',r.components.map((c,i)=>'Component '+(i+1)+' '+intervalExact(c)+'; '+patterns(c.patternIndices)).join('\n'));exactComponents.id='conditional-exact-components';container.append(exactComponents);
  if(r.gaps.length){
   const gaps=table('Open gaps retained between components',['Gap','Exact lower endpoint °C','Exact upper endpoint °C','Boundary membership'],r.gaps.map((g,i)=>[i+1,exact(g.lower),exact(g.upper),'Both endpoints belong to adjacent closed components; the intervening gap is open']));
   gaps.id='conditional-gaps';container.append(gaps);
   container.append(node('p','The outer interval spans these gaps. It does not supply a profile inside a gap.'));
  }else container.append(node('p','The conditioned intervals form one closed component with no gaps.'));
  container.append(node('p','A contributing pattern need not span its whole merged component. The intervals describe this represented model; their interior values are not a claim of physical attainability.'));
 }
 const list=table('Every original minimum pattern after both conditions',['Pattern','Original change boundaries','Conditioned status','Own closed range °C'],r.alternatives.map(p=>[
  'P'+(p.patternIndex+1),p.splitUtcs.join(' / ')||'No change',p.conditionalStatus==='compatible'?'Both requirements satisfied by a common profile':'Excluded by the combined conditions',p.rangeC?interval(p.rangeC):'Unevaluated']));
 list.id='conditional-pattern-table';container.append(list);
 const examined=node('details');examined.append(node('summary','Inspect all '+r.patterns.length+' examined original patterns'));
 examined.append(table('Original observation compatibility',['Pattern','Changes','Original boundaries','Original compatibility'],r.patterns.map(p=>['P'+(p.patternIndex+1),p.changes,p.splitUtcs.join(' / ')||'No change',p.compatibility])));container.append(examined);
 if(r.alternatives.length){
  const select=choice('Inspect an original minimum pattern','conditional-pattern',r.alternatives.map(p=>[p.patternIndex,'P'+(p.patternIndex+1)+' · '+(p.splitUtcs.join(' / ')||'No change')+' · '+(p.conditionalStatus==='compatible'?'survives':'excluded')]));
  select.wrap.className='conditional-pattern-choice';container.append(select.wrap);const pane=node('section');pane.id='conditional-pattern-detail';container.append(pane);
  function drawPattern(){
   if(!live())return;revision++;const ticket=revision,p=r.alternatives.find(x=>x.patternIndex===Number(select.select.value));pane.replaceChildren();
   container.dataset.pattern=String(p.patternIndex);delete container.dataset.role;delete container.dataset.receiver;delete container.dataset.time;
   pane.append(node('h3','P'+(p.patternIndex+1)+' · '+(p.splitUtcs.join(' / ')||'One fixed original profile')));
   if(!p.extremes){pane.append(node('p','This original-compatible pattern is excluded by the two selected requirements. Its complete incompatibility certificate is retained; no extreme profile or consequence range is offered.'));return;}
   pane.append(node('p','This pattern’s closed consequence interval is '+interval(p.rangeC)+'. The two endpoint roles each satisfy both selected requirements.'));
   const roles=choice('Extreme profile','conditional-role',[['lower','Lower endpoint profile'],['upper','Upper endpoint profile']]);pane.append(roles.wrap);
   const profilePane=node('div');profilePane.id='conditional-role-detail';pane.append(profilePane);
   const drawRole=()=>{
    if(!live()||ticket!==revision||!roles.select.isConnected)return;
    const role=roles.select.value,w=p.extremes[role];container.dataset.role=role;profilePane.replaceChildren();
    profilePane.append(node('h3',role==='lower'?'Profile attaining this pattern’s lower endpoint':'Profile attaining this pattern’s upper endpoint'));
    profilePane.append(exactValue('Attained consequence endpoint',w.valueC));
    profilePane.append(node('p','Required allowance for this profile: '+amount(w.requiredRelaxationC)+' °C. Selected allowance: '+amount(w.allowanceC)+' °C.'));
    profilePane.append(table('Both requirements on this same profile',['Requirement','Represented pair °C','Original represented status','Selected represented status','Original numerical pair °C','Original numerical status','Selected numerical status'],w.requirements.map(v=>[
     v.requirementIndex?'B':'A',interval(v.representedPairC),v.representedStatus,v.selectedRepresentedStatus,interval(v.originalNumericalPairC),v.originalNumericalStatus,v.selectedOriginalNumericalStatus])));
    profilePane.append(node('p','Represented and original numerical statuses are separate. A numerical “not met” is retained even when the exact represented profile meets the selected condition.'));
    const pairs=table('Third consequence on this same profile',['Evaluation','Lower endpoint °C','Upper endpoint °C'],[
     ['Exact represented pair',exact(w.consequenceRepresentedPairC.lower),exact(w.consequenceRepresentedPairC.upper)],
     ['Original numerical pair',exact(w.consequenceOriginalNumericalPairC.lower),exact(w.consequenceOriginalNumericalPairC.upper)]]);pairs.id='conditional-role-pair';profilePane.append(pairs);
    profilePane.append(table('Common sky profiles by original epoch',['Epoch','Bin 0','Bin 1','Bin 2','Bin 3'],w.phaseProfiles.map((profile,i)=>['Epoch '+(i+1),...profile.map(exact)])));
    profilePane.append(table('Original observations on this profile',['Record','Original UTC','Component','Exact represented temperature °C','Original numerical lower °C','Lower band status','Original numerical upper °C','Upper band status'],w.originalObservations.map(o=>[
     o.recordIndex+1,o.utc,storeName(o.store),exact(o.additiveC),String(o.originalC.lower),o.endpointStatus.lower,String(o.originalC.upper),o.endpointStatus.upper])));
    const selectors=node('div');selectors.className='conditional-selection';
    const receiver=choice('Original receiver','conditional-receiver',w.originalReplays.map(replay=>[replay.sourceIndex,'Receiver '+(replay.sourceIndex+1)+' · point '+point(investigation.readings[replay.representativeReadingIndex])]));
    const time=choice('Original clock endpoint','conditional-time',r.originalTimes.map((t,i)=>[i,t.utc+' · '+(i?'interval '+i:'initial state')]));
    selectors.append(receiver.wrap,time.wrap);profilePane.append(selectors);
    const coursePane=node('div');coursePane.id='conditional-time-detail';profilePane.append(coursePane);
    const drawTime=()=>{
     if(!live()||ticket!==revision||!receiver.select.isConnected||!time.select.isConnected||roles.select.value!==role)return;
     const sourceIndex=Number(receiver.select.value),timeIndex=Number(time.select.value),row=w.originalReplays[sourceIndex].originalCourse[timeIndex];
     container.dataset.receiver=String(sourceIndex);container.dataset.time=String(timeIndex);coursePane.replaceChildren();
     coursePane.append(node('h4',row.utc+' · receiver '+(sourceIndex+1)+' · '+(role==='lower'?'lower':'upper')+' endpoint profile'));
     const rows=[];
     for(const design of ['existing','proposal'])for(const endpoint of ['lower','upper'])for(const store of ['surfaceC','subsurfaceC']){
      rows.push([design,endpoint,storeName(store),exact(row.additiveC[design][endpoint][store]),String(row.originalC[design][endpoint][store])]);
     }
     const t=table('Original course on the selected profile',['Design','Endpoint','Component','Exact represented temperature °C','Original numerical temperature °C'],rows);t.classList.add('conditional-course-table');coursePane.append(t);
    };
    receiver.select.addEventListener('change',drawTime);time.select.addEventListener('change',drawTime);drawTime();
   };
   roles.select.addEventListener('change',drawRole);drawRole();
  }
  select.select.addEventListener('change',()=>{if(live()&&select.select.isConnected)drawPattern();});drawPattern();
 }
 const proof=node('details');proof.className='conditional-proof';proof.append(node('summary','Inspect the complete proof and numerical evidence'));const pre=node('pre');proof.append(pre);
 proof.addEventListener('toggle',()=>{if(live()&&proof.isConnected&&proof.open&&!pre.textContent)pre.textContent=JSON.stringify(r,null,2);});container.append(proof);
 const scope=node('p',r.semantics);scope.className='quiet';container.append(scope);
}
