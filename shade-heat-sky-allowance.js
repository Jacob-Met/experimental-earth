import {verifyMinimumSkyCoverage} from './shade-heat-sky-coverage.js';
import {cmp} from './vendor/chronos/exact-halfplanes.mjs';

export const SKY_ALLOWANCE_LIMITS=Object.freeze({textCharacters:4096,fractionBits:4096,computedFractionBits:8193,decimalPower:1233,patterns:253,events:507});
const ZERO=Object.freeze([0n,1n]),models=new WeakSet();
const dense=(v,n)=>Array.isArray(v)&&v.length===n&&Array.from({length:n},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
const abs=n=>n<0n?-n:n;
const bits=n=>abs(n).toString(2).length;
function gcd(a,b){a=abs(a);while(b){const c=a%b;a=b;b=c;}return a;}
function fraction(v,maxBits=SKY_ALLOWANCE_LIMITS.fractionBits){
 if(!dense(v,2)||typeof v[0]!=='bigint'||typeof v[1]!=='bigint'||v[1]<=0n||bits(v[0])>maxBits||bits(v[1])>maxBits)throw Error('An exact allowance fraction exceeds its bounded representation');
 const d=gcd(v[0],v[1]);return [v[0]/d,v[1]/d];
}
// Only the two derived inspection limits can grow beyond the solver's 4096-bit
// inputs. Cross-products of bounded inputs need at most 8193 bits; no solver
// arithmetic, proof limit or accepted input capacity is changed.
function adjustedLimit(limit,value,direction){return fraction([limit[0]*value[1]+direction*value[0]*limit[1],limit[1]*value[1]],SKY_ALLOWANCE_LIMITS.computedFractionBits);}
function allowance(v){const q=fraction(v);if(q[0]<0n)throw Error('A common allowance must be nonnegative');return q;}
function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
const copyPair=p=>({lower:fraction(p.lower),upper:fraction(p.upper)});
const classify=(value,existence,coverage)=>cmp(value,existence)<0?'none':cmp(value,coverage)<0?'some-but-not-every':'every';
const meets=(requirement,pair,limit)=>requirement.relation==='at-most'?cmp(pair.upper,limit)<=0:cmp(pair.lower,limit)>=0;

/** Decimal and scientific text mean exact base ten. Fraction text retains an
 * exact rational event even when no finite decimal can represent it.
 */
export function parseSkyAllowanceText(text){
 if(typeof text!=='string'||text.length>SKY_ALLOWANCE_LIMITS.textCharacters)throw Error('Enter a bounded exact decimal, scientific value or fraction');
 const source=text.trim().replace(/^\+/,'');
 const ratio=/^(\d+)[ \t]*\/[ \t]*(\d+)$/.exec(source);
 if(ratio)return allowance([BigInt(ratio[1]),BigInt(ratio[2])]);
 const decimal=/^(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(source);
 if(!decimal)throw Error('Use a nonnegative exact decimal, scientific value or numerator / denominator');
 const exponentText=decimal[4]??'0';
 if(exponentText.length>6)throw Error('The decimal exponent exceeds its allowance');
 const exponent=Number(exponentText);
 if(!Number.isInteger(exponent)||Math.abs(exponent)>SKY_ALLOWANCE_LIMITS.decimalPower)throw Error('The decimal exponent exceeds its allowance');
 const decimals=decimal[2]??decimal[3]??'',whole=decimal[1]??'0';
 let digits=(whole+decimals).replace(/^0+/,'')||'0',power=exponent-decimals.length;
 if(digits==='0')return [0n,1n];
 while(digits.endsWith('0')){digits=digits.slice(0,-1);power++;}
 if(Math.abs(power)>SKY_ALLOWANCE_LIMITS.decimalPower)throw Error('The exact decimal scale exceeds its allowance');
 const numerator=BigInt(digits),scale=10n**BigInt(Math.abs(power));
 return allowance(power>=0?[numerator*scale,1n]:[numerator,scale]);
}

export function skyAllowanceFractionText(value){const q=fraction(value,SKY_ALLOWANCE_LIMITS.computedFractionBits);return q[0]+' / '+q[1];}
export function skyAllowanceAmountText(value){
 const [signed,denominator]=fraction(value,SKY_ALLOWANCE_LIMITS.computedFractionBits);if(signed===0n)return '0';
 const numerator=abs(signed),sign=signed<0n?'-':'';
 let exponent=numerator.toString().length-denominator.toString().length;
 if(exponent>=0?numerator<denominator*10n**BigInt(exponent):numerator*10n**BigInt(-exponent)<denominator)exponent--;
 const shift=6-exponent,scaled=shift>=0?numerator*10n**BigInt(shift)/denominator:numerator/(denominator*10n**BigInt(-shift));
 const digits=scaled.toString().padStart(7,'0');
 if(exponent>=-2&&exponent<=3)return sign+String(Number(scaled)*10**(exponent-6));
 return sign+digits[0]+'.'+digits.slice(1)+'e'+String(exponent);
}

/** Verify the complete original coverage proof once, then copy and freeze the
 * bounded projection data. No caller-supplied "verified" flag is accepted.
 */
export function createSkyAllowanceModel(observed,bands,requirements,coverage){
 if(!coverage||!Array.isArray(coverage.cases)||coverage.cases.length>SKY_ALLOWANCE_LIMITS.patterns)throw Error('Retain the bounded complete original minimum family');
 verifyMinimumSkyCoverage(observed,bands,requirements,coverage);
 const model={status:coverage.status,minimumChanges:coverage.minimum.analysis.minimumChanges,
  requirements:requirements.map(r=>({relation:r.relation,limit:fraction(r.limit)})),
  someProfileRelaxation:coverage.someProfileRelaxation===null?null:fraction(coverage.someProfileRelaxation),
  allProfileRelaxation:coverage.allProfileRelaxation===null?null:fraction(coverage.allProfileRelaxation),patterns:[],events:[]};
 function witness(profile,role,requirementIndex,maximumViolation=null){
  return {role,requirementIndex,maximumViolation:maximumViolation===null?null:fraction(maximumViolation),
   requiredRelaxation:fraction(profile.requiredRelaxation),targetPairs:profile.targetPairs.map(copyPair),
   violations:profile.violations.map(v=>fraction(v)),originalStatuses:[...profile.requirementStatuses]};
 }
 for(const [i,item]of coverage.cases.entries()){
  const some=coverage.minimum.cases[i];
  model.patterns.push({patternIndex:item.patternIndex,splits:[...item.splits],someProfileRelaxation:fraction(some.relaxation.value),allProfileRelaxation:fraction(item.allProfileRelaxation),
   witnesses:[witness(some.relaxation.witness,'some-profile',null),...item.tests.map(t=>witness(t.witness,'requirement-maximum',t.requirementIndex,t.maximumViolation))]});
 }
 if(model.patterns.length){
  const by=new Map(),event=value=>{const v=fraction(value),key=v[0]+'/'+v[1];if(!by.has(key))by.set(key,{value:v,existencePatternIndices:[],universalPatternIndices:[]});return by.get(key);};
  event(ZERO);
  for(const p of model.patterns){event(p.someProfileRelaxation).existencePatternIndices.push(p.patternIndex);event(p.allProfileRelaxation).universalPatternIndices.push(p.patternIndex);}
  model.events=[...by.values()].sort((a,b)=>cmp(a.value,b.value));
  if(model.events.length>SKY_ALLOWANCE_LIMITS.events)throw Error('The complete exact event list exceeds its allowance');
 }
 freeze(model);models.add(model);return model;
}

/** A deterministic view of a prepared model: no inference, optimization,
 * numerical replay, worker dispatch or mutation is performed here.
 */
export function projectSkyAllowance(model,value){
 if(!models.has(model))throw Error('Prepare and verify the original coverage model before selecting an allowance');
 const selected=allowance(value),relaxedLimits=model.requirements.map(r=>adjustedLimit(r.limit,selected,r.relation==='at-most'?1n:-1n));
 const patterns=model.patterns.map(p=>{
  const status=classify(selected,p.someProfileRelaxation,p.allProfileRelaxation);
  const witnesses=p.witnesses.map(w=>{
   const selectedStatuses=model.requirements.map((r,i)=>meets(r,w.targetPairs[i],relaxedLimits[i])?'met':'not-met');
   if(selectedStatuses.some((s,i)=>(s==='met')!==(cmp(w.violations[i],selected)<=0)))throw Error('A selected allowance lost its original signed residual identity');
   const meetsBoth=selectedStatuses.every(s=>s==='met');
   if(meetsBoth!==(cmp(w.requiredRelaxation,selected)<=0))throw Error('A selected profile lost its required common allowance');
   return {role:w.role,requirementIndex:w.requirementIndex,requiredRelaxation:[...w.requiredRelaxation],
    maximumViolation:w.maximumViolation===null?null:[...w.maximumViolation],originalStatuses:[...w.originalStatuses],selectedStatuses,meetsBoth,
    designatedCounterexample:w.maximumViolation!==null&&cmp(w.maximumViolation,selected)>0};
  });
  if((status!=='none')!==witnesses[0].meetsBoth||(status!=='every')!==witnesses.some(w=>w.designatedCounterexample))throw Error('The retained witness roles contradict a certified allowance classification');
  return {patternIndex:p.patternIndex,status,someProfileRelaxation:[...p.someProfileRelaxation],allProfileRelaxation:[...p.allProfileRelaxation],witnesses};
 });
 const nonePatternIndices=patterns.filter(p=>p.status==='none').map(p=>p.patternIndex),
  someButNotEveryPatternIndices=patterns.filter(p=>p.status==='some-but-not-every').map(p=>p.patternIndex),
  everyPatternIndices=patterns.filter(p=>p.status==='every').map(p=>p.patternIndex),
  existencePatternIndices=patterns.filter(p=>p.status!=='none').map(p=>p.patternIndex);
 const globalStatus=patterns.length?classify(selected,model.someProfileRelaxation,model.allProfileRelaxation):null;
 if(patterns.length&&globalStatus!==(everyPatternIndices.length===patterns.length?'every':existencePatternIndices.length?'some-but-not-every':'none'))throw Error('Global allowance coverage lost its complete pattern union');
 let intervalIndex=null;
 for(const [i,event]of model.events.entries()){if(cmp(event.value,selected)>0)break;intervalIndex=i;}
 const event=intervalIndex===null?null:model.events[intervalIndex],next=intervalIndex===null?null:model.events[intervalIndex+1];
 return {allowance:selected,status:patterns.length?'classified-original-family':'original-incompatible',globalStatus,patterns,
  patternCounts:{none:nonePatternIndices.length,someButNotEvery:someButNotEveryPatternIndices.length,every:everyPatternIndices.length,total:patterns.length},
  nonePatternIndices,someButNotEveryPatternIndices,everyPatternIndices,existencePatternIndices,
  counterexamples:patterns.flatMap(p=>p.witnesses.filter(w=>w.designatedCounterexample).map(w=>({patternIndex:p.patternIndex,role:w.role,requirementIndex:w.requirementIndex,maximumViolation:[...w.maximumViolation]}))),
  relaxedLimits,intervalIndex,interval:event?{lower:[...event.value],upper:next?[...next.value]:null,lowerIncluded:true,upperIncluded:false}:null};
}
