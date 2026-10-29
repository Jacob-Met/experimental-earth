import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseSkyAllowanceText,skyAllowanceFractionText,skyAllowanceAmountText,createSkyAllowanceModel,projectSkyAllowance,SKY_ALLOWANCE_LIMITS} from '../shade-heat-sky-allowance.js';
import {compareMinimumSkyCoverage} from '../shade-heat-sky-coverage.js';
import {rational,add,sub,mul,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
const Q=x=>{const [n,d='1']=String(x).split('/');return [BigInt(n),BigInt(d)];},Z=()=>Q(0),eq=(a,b)=>assert.equal(cmp(a,b),0);
const encode=x=>JSON.stringify(x,(_k,v)=>typeof v==='bigint'?String(v):v);
const row=(values,c=0)=>({constant:Q(c),coefficients:values.map(v=>[Q(v),Z(),Z()])});
const input=c=>({observed:c.observations.map(o=>row(o.coefficients)),bands:c.observations.map(o=>({lower:Q(o.lower),upper:Q(o.upper)})),
 requirements:c.requirements.map(r=>({relation:r.relation,limit:Q(r.limit),lower:row(r.lower.coefficients,r.lower.constant),upper:row(r.upper.coefficients,r.upper.constant)}))});
const fixture=JSON.parse(fs.readFileSync(new URL('./sky-coverage-oracles.json',import.meta.url),'utf8'));
function prepare(raw){const coverage=compareMinimumSkyCoverage(raw.observed,raw.bands,raw.requirements);return {coverage,model:createSkyAllowanceModel(raw.observed,raw.bands,raw.requirements,coverage)};}
function selections(values){
 const sorted=[...new Map(values.map(v=>[skyAllowanceFractionText(v),v])).values()].sort(cmp),out=[...sorted];
 for(let i=1;i<sorted.length;i++)out.push(mul(add(sorted[i-1],sorted[i]),Q('1/2')));
 out.push(add(sorted.at(-1),Q(1)));return out;
}
function inspectRoles(model,result){
 for(const p of result.patterns){
  const original=model.patterns.find(c=>c.patternIndex===p.patternIndex);assert.equal(p.witnesses.length,3);
  for(const [i,w]of p.witnesses.entries()){
   const source=original.witnesses[i];assert.equal(w.role,source.role);assert.equal(w.requirementIndex,source.requirementIndex);
   const actual=model.requirements.map((t,j)=>(t.relation==='at-most'?cmp(source.targetPairs[j].upper,result.relaxedLimits[j])<=0:cmp(source.targetPairs[j].lower,result.relaxedLimits[j])>=0)?'met':'not-met');
   assert.deepEqual(w.selectedStatuses,actual);assert.equal(w.meetsBoth,actual.every(x=>x==='met'));
   assert.equal(w.designatedCounterexample,source.maximumViolation!==null&&cmp(source.maximumViolation,result.allowance)>0);
  }
  assert.equal(p.status!=='none',p.witnesses[0].meetsBoth);assert.equal(p.status!=='every',p.witnesses.some(w=>w.designatedCounterexample));
 }
 assert.deepEqual(result.counterexamples,result.patterns.flatMap(p=>p.witnesses.filter(w=>w.designatedCounterexample).map(w=>({patternIndex:p.patternIndex,role:w.role,requirementIndex:w.requirementIndex,maximumViolation:w.maximumViolation}))));
}
test('exact decimal and fraction parsing preserves tiny events without binary64 coercion and refuses excess representations',()=>{
 const cases=[['0','0'],['  +0.1000  ','1/10'],['.125','1/8'],['1.','1'],['1e-3','1/1000'],['12.5e+2','1250'],['2 / 6','1/3'],['+0/999','0'],['0.000e+12','0'],['001.2500','5/4']];
 for(const [text,want]of cases)eq(parseSkyAllowanceText(text),Q(want));
 eq(parseSkyAllowanceText('1e-400'),[1n,10n**400n]);assert.notEqual(cmp(parseSkyAllowanceText('0.1'),rational(.1)),0);
 const tiny=[1n,2n**1075n];eq(parseSkyAllowanceText('1 / '+tiny[1]),tiny);assert.equal(skyAllowanceAmountText(tiny),'2.470328e-324');
 assert.equal(skyAllowanceFractionText([2n,6n]),'1 / 3');assert.equal(skyAllowanceAmountText(Q(0)),'0');assert.equal(skyAllowanceAmountText(Q('-1/4')),'-0.25');
 eq(parseSkyAllowanceText('1e-1200'),[1n,10n**1200n]);assert.match(skyAllowanceAmountText([2n**4095n,1n]),/e1232$/);
 const bad=[null,undefined,1,.1,NaN,Infinity,1n,[],{},'',' ','-0','-0.0','-1','-1/3','1/-3','1/0','0/0','NaN','Infinity','0x10','1_000','1,000','1e','1e999999','1e-1234','1e1234','1e0000000','1//2','++1','1 / 2 extra','1'.repeat(4097),String(2n**4096n),'1 / '+(2n**4096n)];
 for(const x of bad)assert.throws(()=>parseSkyAllowanceText(x),String(x));
 assert.equal(SKY_ALLOWANCE_LIMITS.fractionBits,4096);assert.equal(SKY_ALLOWANCE_LIMITS.events,507);
});
test('176 independent oracle families preserve every exact event, simultaneous tie and original-empty withholding',()=>{
 let families=0,views=0;
 for(const item of fixture.cases){
  const raw=input(item),before=encode(raw),{coverage,model}=prepare(raw),coverageBefore=encode(coverage),expected=item.expected;
  assert.equal(encode(raw),before);assert(Object.isFrozen(model)&&Object.isFrozen(model.patterns)&&Object.isFrozen(model.events));
  if(expected.all.allProfileRelaxation===null){
   assert.deepEqual(model.events,[]);const r=projectSkyAllowance(model,Q(7));assert.equal(r.globalStatus,null);assert.equal(r.interval,null);assert.equal(r.intervalIndex,null);assert.deepEqual(r.patterns,[]);assert.deepEqual(r.counterexamples,[]);
  }else{
   const by=new Map(),event=v=>{const key=skyAllowanceFractionText(v);if(!by.has(key))by.set(key,{value:Q(v[0]+'/'+v[1]),existencePatternIndices:[],universalPatternIndices:[]});return by.get(key);};
   event(Z());
   const some=new Map(expected.some.patterns.map(p=>[p.pattern,Q(p.optimum)]));
   for(const p of expected.all.patterns){event(some.get(p.id)).existencePatternIndices.push(p.id);event(Q(p.allProfileRelaxation)).universalPatternIndices.push(p.id);}
   const events=[...by.values()].sort((a,b)=>cmp(a.value,b.value));assert.deepEqual(model.events,events,item.name);
   for(const delta of selections(events.map(e=>e.value))){
    const r=projectSkyAllowance(model,delta);eq(r.allowance,delta);inspectRoles(model,r);
    assert.deepEqual(r.patterns.map(p=>p.patternIndex),expected.all.patterns.map(p=>p.id));
    for(const p of r.patterns){const a=expected.all.patterns.find(x=>x.id===p.patternIndex),e=some.get(p.patternIndex);
     assert.equal(p.status,cmp(delta,e)<0?'none':cmp(delta,Q(a.allProfileRelaxation))<0?'some-but-not-every':'every');
    }
    const want=cmp(delta,Q(expected.some.minimumRelaxation))<0?'none':cmp(delta,Q(expected.all.allProfileRelaxation))<0?'some-but-not-every':'every';
    assert.equal(r.globalStatus,want);assert.equal(r.patternCounts.total,r.patterns.length);assert.equal(Object.values(r.patternCounts).slice(0,3).reduce((a,b)=>a+b,0),r.patterns.length);
    const index=events.findLastIndex(e=>cmp(e.value,delta)<=0);assert.equal(r.intervalIndex,index);eq(r.interval.lower,events[index].value);assert.equal(r.interval.lowerIncluded,true);assert.equal(r.interval.upperIncluded,false);
    if(index+1<events.length)eq(r.interval.upper,events[index+1].value);else assert.equal(r.interval.upper,null);
    views++;
   }
  }
  assert.equal(encode(coverage),coverageBefore);families++;
 }
 assert.equal(families,176);assert(views>0);console.log(JSON.stringify({oracleFamilies:families,allowanceViews:views}));
});
test('3645 scalar original intervals classify by direct inequality intersections and universal endpoints at every boundary and midpoint',()=>{
 let cases=0,views=0;
 for(let ai=0;ai<=4;ai++)for(let bi=ai;bi<=4;bi++)for(let li=-2;li<=6;li++)for(let ui=-2;ui<=6;ui++)for(let wi=0;wi<=2;wi++){
  const [a,b,l,u,w]=[ai,bi,li,ui,wi].map(x=>Q(x+'/4')),endpoint=sign=>({...row(['1','0']),constant:mul(w,Q(sign))});
  const raw={observed:[row(['1','0'])],bands:[{lower:a,upper:b}],requirements:[{relation:'at-most',limit:u,lower:endpoint(-1),upper:endpoint(1)},{relation:'at-least',limit:l,lower:endpoint(-1),upper:endpoint(1)}]};
  const {model}=prepare(raw);
  const e=[Z(),add(mul(sub(l,u),Q('1/2')),w),sub(add(a,w),u),add(sub(l,b),w)].reduce((x,y)=>cmp(x,y)>=0?x:y);
  const all=[Z(),sub(add(b,w),u),add(sub(l,a),w)].reduce((x,y)=>cmp(x,y)>=0?x:y);
  for(const delta of selections([Z(),e,all])){
   const lower=[a,sub(add(l,w),delta)].reduce((x,y)=>cmp(x,y)>=0?x:y),upper=[b,sub(add(u,delta),w)].reduce((x,y)=>cmp(x,y)<=0?x:y);
   const exists=cmp(lower,upper)<=0,every=cmp(add(b,w),add(u,delta))<=0&&cmp(sub(a,w),sub(l,delta))>=0;
   const result=projectSkyAllowance(model,delta);assert.equal(result.globalStatus,every?'every':exists?'some-but-not-every':'none');inspectRoles(model,result);views++;
  }
  cases++;
 }
 assert.equal(cases,3645);assert.equal(views,17150);console.log(JSON.stringify({directIntervalCases:cases,allowanceViews:views}));
});
function disjoint(tiny=false){
 const c=tiny?[1n,2n**1075n]:Q('1/4'),coefficient=mul(c,Q(2));
 const observed=[row(['1','0','0']),row(['0','0','1'])],bands=[{lower:Z(),upper:Z()},{lower:Q(1),upper:Q(1)}];
 const first={constant:c,coefficients:[[Z(),Z(),Z()],[coefficient,Z(),Z()],[Z(),Z(),Z()]]},zero=row(['0','0','0']);
 return {observed,bands,requirements:[{relation:'at-most',limit:Z(),lower:first,upper:first},{relation:'at-most',limit:Z(),lower:zero,upper:zero}]};
}
test('global some-but-not-every can contain only every and none patterns; equal bounds transition atomically including subnormal events',()=>{
 for(const tiny of [false,true]){
  const {model}=prepare(disjoint(tiny)),unit=tiny?[1n,2n**1075n]:Q('1/4');
  assert.equal(model.minimumChanges,1);assert.deepEqual(model.patterns.map(p=>p.splits),[[1],[2]]);
  assert.equal(model.events.length,3);eq(model.events[1].value,unit);eq(model.events[2].value,mul(unit,Q(3)));
  assert.deepEqual(model.events[1].existencePatternIndices,[2]);assert.deepEqual(model.events[1].universalPatternIndices,[2]);
  assert.deepEqual(model.events[2].existencePatternIndices,[1]);assert.deepEqual(model.events[2].universalPatternIndices,[1]);
  const middle=projectSkyAllowance(model,mul(unit,Q(2)));assert.equal(middle.globalStatus,'some-but-not-every');assert.deepEqual(middle.nonePatternIndices,[1]);assert.deepEqual(middle.everyPatternIndices,[2]);assert.deepEqual(middle.someButNotEveryPatternIndices,[]);
  assert.equal(projectSkyAllowance(model,mul(unit,Q('1/2'))).globalStatus,'none');
  assert.equal(projectSkyAllowance(model,model.events[1].value).globalStatus,'some-but-not-every');
  assert.equal(projectSkyAllowance(model,model.events[2].value).globalStatus,'every');assert.equal(projectSkyAllowance(model,mul(model.events[1].value,Q(1))).patterns[1].status,'every');
  inspectRoles(model,middle);
 }
});
test('the selected allowance recomputes both same-profile statuses and only strict designated maxima are counterexamples',()=>{
 const raw={observed:[{constant:Z(),coefficients:[[Q(1),Q(1),Z()],[Z(),Z(),Z()]]}],bands:[{lower:Q(1),upper:Q(1)}],requirements:[]};
 const endpoint=bin=>({constant:Z(),coefficients:[[bin===0?Q(1):Z(),bin===1?Q(1):Z(),Z()],[Z(),Z(),Z()]]});
 raw.requirements=[0,1].map(bin=>({relation:'at-least',limit:Q('3/4'),lower:endpoint(bin),upper:endpoint(bin)}));
 const {model}=prepare(raw),some=projectSkyAllowance(model,Q('1/4')),beforeContact=projectSkyAllowance(model,sub(Q('3/4'),[1n,2n**1075n])),contact=projectSkyAllowance(model,Q('3/4'));
 assert.equal(some.globalStatus,'some-but-not-every');assert.deepEqual(some.patterns[0].witnesses.map(w=>w.selectedStatuses),[['met','met'],['not-met','met'],['met','not-met']]);
 assert.equal(some.counterexamples.length,2);assert.equal(beforeContact.counterexamples.length,2);assert.equal(contact.globalStatus,'every');assert.deepEqual(contact.counterexamples,[]);
 assert(contact.patterns[0].witnesses.every(w=>w.selectedStatuses.every(x=>x==='met')));
 const large=projectSkyAllowance(model,[2n**4095n,1n]);assert.equal(large.globalStatus,'every');assert(skyAllowanceAmountText(large.relaxedLimits[0]).startsWith('-'));
 for(const out of [some,beforeContact,contact,large])inspectRoles(model,out);
});
test('preparation verifies parent proofs; frozen model and event identities cannot be forged or mutated through source or outputs',()=>{
 const raw=disjoint(),{coverage,model}=prepare(raw),baseline=encode(projectSkyAllowance(model,Q('1/2')));
 assert.throws(()=>projectSkyAllowance({},Q(0)));assert.throws(()=>projectSkyAllowance(structuredClone(model),Q(0)));
 for(const delta of [[-1n,1n],[1n,0n],[1n,-1n],[1n,2n**4096n],[2n**4096n,1n],[1,2],null])assert.throws(()=>projectSkyAllowance(model,delta));
 for(const change of [r=>r.someProfileRelaxation=Z(),r=>r.allProfileRelaxation=Z(),r=>r.cases.pop(),r=>r.cases[0].tests[0].maximumViolation=Z(),r=>r.minimum.cases[0].relaxation.value=Z(),r=>r.cases[0].tests[0].witness.violations[0]=Z(),r=>r.cases[0].linearModel.bounds[0]=Q(99)]){
  const altered=structuredClone(coverage);change(altered);assert.throws(()=>createSkyAllowanceModel(raw.observed,raw.bands,raw.requirements,altered));
 }
 assert.throws(()=>{model.events[1].value[0]=99n;});assert.throws(()=>{model.patterns[0].witnesses[0].targetPairs[0].lower[0]=99n;});
 const output=projectSkyAllowance(model,Q('1/2'));output.allowance[0]=99n;output.patterns[0].witnesses[0].selectedStatuses[0]='invented';output.counterexamples.pop();
 coverage.cases[0].tests[0].witness.violations[0]=Q(99);raw.requirements[0].limit=Q(99);
 assert.equal(encode(projectSkyAllowance(model,Q('1/2'))),baseline);
});
