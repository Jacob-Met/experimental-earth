import {TREND_SHIFT_SCHEMA} from '../paired-trend-shift.js';
import {TREND_REGION_SCHEMA} from '../paired-trend-region.js';
export function shiftFixture(last=4){
 const series={schema:'experimental-earth-paired-series/1',quantity:'temperature',unit:'C',treatedPlace:'t',comparisonPlace:'c',association:'Authored shared quantity',parallelChange:'Authored linear continuation',intervention:'2026-01-02T12:00:00Z',pairs:[]};
 for(const [i,lo,hi]of [[0,0,0],[1,-1,1],[2,3,3],[3,last,last]]){const time=`2026-01-0${i+1}T00:00:00Z`;series.pairs.push({time,role:i<2?'pre':'post',treated:{lower:lo,upper:hi,unit:'C',place:'t',time,source:'Authored control'},comparison:{lower:0,upper:0,unit:'C',place:'c',time,source:'Authored control'}});}
 return {schema:TREND_SHIFT_SCHEMA,model:'constant-later-gap-shift',inquiry:{schema:TREND_REGION_SCHEMA,series,basis:'Authored continuation control'}};
}

export function shiftOracleInputs(){
 let seed=951;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed;};const cases=[];
 for(let i=0;i<60;i++){
  const x=shiftFixture(),s=x.inquiry.series;s.intervention='2026-01-07T00:00:00Z';const source=s.pairs[0];s.pairs=[];
  const a=rand()%7-3,b=(rand()%9-4)/2,d=rand()%9-4;
  for(const [index,day]of [0,2,5,9,13].entries()){
   const p=structuredClone(source),time=new Date(Date.parse('2026-01-01T00:00:00Z')+day*86400000).toISOString().replace('.000Z','Z');p.time=p.treated.time=p.comparison.time=time;p.role=index<3?'pre':'post';p.comparison.lower=p.comparison.upper=10;
   const center=i%2===0?a+b*day+(index<3?0:d):(rand()%21-10)/2,width=(rand()%5)/4;
   p.treated.lower=center-width+10;p.treated.upper=center+width+10;s.pairs.push(p);
  }
  cases.push(x);
 }
 return cases;
}
