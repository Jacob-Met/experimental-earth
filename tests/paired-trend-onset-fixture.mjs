import {shiftFixture} from './paired-trend-shift-fixture.mjs';
import {TREND_RESPONSE_SCHEMA} from '../paired-trend-response.js';
import {TREND_ONSET_SCHEMA} from '../paired-trend-onset.js';
export function onsetFixture(){
 const x=shiftFixture(3);x.inquiry.series.pairs[1].treated.lower=x.inquiry.series.pairs[1].treated.upper=0;
 x.inquiry.series.pairs[2].treated.lower=x.inquiry.series.pairs[2].treated.upper=1;
 return {schema:TREND_ONSET_SCHEMA,model:'continuous-change-in-original-gap',response:{schema:TREND_RESPONSE_SCHEMA,model:'separate-linear-periods',inquiry:x.inquiry}};
}
export function onsetOracleInputs(){
 let seed=1368;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed;},cases=[];
 for(let i=0;i<40;i++){
  const x=onsetFixture(),a=(random()%9-4)/2,b=(random()%9-4)/2,e=(random()%9-4)/2,onset=1+(random()%5)/4,c=a+(b-e)*onset;
  for(const [j,p]of x.response.inquiry.series.pairs.entries()){
   const center=i%3===0?(random()%21-10)/2:j<2?a+b*j:c+e*j,width=(random()%4)/8,comparison=10+j;
   p.comparison.lower=p.comparison.upper=comparison;p.treated.lower=comparison+center-width;p.treated.upper=comparison+center+width;
  }
  cases.push(x);
 }
 return cases;
}
