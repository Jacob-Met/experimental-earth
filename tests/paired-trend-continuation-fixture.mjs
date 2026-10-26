import {TREND_REGION_SCHEMA} from '../paired-trend-region.js';
export function continuationFixture(consistent=false){
 const series={schema:'experimental-earth-paired-series/1',quantity:'temperature',unit:'C',treatedPlace:'t',comparisonPlace:'c',association:'Authored shared quantity',parallelChange:'Authored linear continuation',intervention:'2026-01-02T12:00:00Z',pairs:[]};
 for(const [i,lo,hi]of [[0,0,0],[1,-1,1],[2,2,2],[3,consistent?3:-3,consistent?3:-3]]){const time=`2026-01-0${i+1}T00:00:00Z`;series.pairs.push({time,role:i<2?'pre':'post',treated:{lower:lo,upper:hi,unit:'C',place:'t',time,source:'Authored control'},comparison:{lower:0,upper:0,unit:'C',place:'c',time,source:'Authored control'}});}
 return {schema:TREND_REGION_SCHEMA,series,basis:'Authored continuation control'};
}
