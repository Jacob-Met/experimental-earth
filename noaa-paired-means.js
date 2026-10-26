/** Narrow original-file bridge; NOAA parser, thermal intake and point CSV paths are unchanged. */
import {receiveHourlyBytes} from './noaa-hourly.js';
import {PAIRED_MEAN_SCHEMA,inferPairedMeanHistory} from './paired-mean-history.js';
export const NOAA_PAIRED_MEAN_SCHEMA='experimental-earth-noaa-paired-mean/1';
const README='https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/README.txt';
const keys=(x,a)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===[...a].sort().join(',');
const text=(x,max=1000)=>typeof x==='string'&&!!x.trim()&&x.length<=max;
export function validateNoaaPairedMeanRecipe(x){return validateNoaaMeanSource(x,{partitioned:true});}
export function validateNoaaMeanSource(x,{partitioned=true}={}){
 if(!keys(x,['schema','source','selection','channels','association','comparisonOperator','bands',...(partitioned?['boundary','boundaryBasis']:['modelBasis'])])||x.schema!==(partitioned?NOAA_PAIRED_MEAN_SCHEMA:'experimental-earth-noaa-unpartitioned-means/1'))throw Error('Retain an original NOAA paired-mean recipe');
 if(!keys(x.source,['sourceUrl','sha256','rawText'])||!text(x.source.sourceUrl)||typeof x.source.rawText!=='string'||!x.source.rawText.length||x.source.rawText.length>4000000||/[^\x00-\x7f]/.test(x.source.rawText)||!/^[0-9a-f]{64}$/.test(x.source.sha256??''))throw Error('Retain bounded original ASCII bytes, URL and SHA-256');
 if(!keys(x.selection,['firstLine','count','correctionType'])||!Number.isInteger(x.selection.firstLine)||x.selection.firstLine<1||!Number.isInteger(x.selection.count)||x.selection.count<3||x.selection.count>64||!['C','R'].includes(x.selection.correctionType))throw Error('Select 3–64 original rows and an explicit corrected/raw surface policy');
 if(!keys(x.channels,['treated','comparison'])||!['SUR_TEMP','T_HR_AVG'].includes(x.channels.treated)||!['SUR_TEMP','T_HR_AVG'].includes(x.channels.comparison)||x.channels.treated===x.channels.comparison)throw Error('Choose the two distinct original surface and air mean channels');
 if((partitioned?(!text(x.boundary)||!text(x.boundaryBasis)):!text(x.modelBasis))||!text(x.association))throw Error('Declare the phase split and descriptive channel association');
 if(!keys(x.comparisonOperator,['kind','basis'])||x.comparisonOperator.kind!=='uniform-time-mean'||!text(x.comparisonOperator.basis))throw Error('Explicitly declare a uniform-time MODEL comparison; NOAA sample weights remain unknown');
 if(!keys(x.bands,['treated','comparison']))throw Error('Declare separate comparison bands');
 for(const b of Object.values(x.bands))if(!keys(b,['halfWidth','source'])||!Number.isFinite(b.halfWidth)||b.halfWidth<0||b.halfWidth>100||!text(b.source))throw Error('Declare each 0–100 C comparison half-width and basis; do not infer sensor error from printed precision');
 return x;
}
export async function receiveNoaaPairedMeans(recipe,options={}){const received=await receiveNoaaMeanSource(recipe);return{...received,report:inferPairedMeanHistory(received.input,options)};}
export async function receiveNoaaMeanSource(recipe,{partitioned=true}={}){
 validateNoaaMeanSource(recipe,{partitioned});recipe=structuredClone(recipe);
 const intake=await receiveHourlyBytes(new TextEncoder().encode(recipe.source.rawText),{sourceUrl:recipe.source.sourceUrl,expectedSha256:recipe.source.sha256});
 const {firstLine,count,correctionType}=recipe.selection;if(firstLine+count-1>intake.rows.length)throw Error('Selected original rows extend beyond the supplied file');
 const selected=intake.rows.slice(firstLine-1,firstLine-1+count),station=selected[0].raw.WBANNO,phase=Date.parse(recipe.boundary);
 const places=Object.fromEntries(['treated','comparison'].map(name=>[name,`NOAA ${station} · ${recipe.channels[name]==='SUR_TEMP'?'infrared surface':'air'}`]));
 const input={schema:partitioned?PAIRED_MEAN_SCHEMA:'experimental-earth-unpartitioned-means/1',quantity:'Temperature',unit:'C',treatedPlace:places.treated,comparisonPlace:places.comparison,association:recipe.association,...(partitioned?{boundary:recipe.boundary,boundaryBasis:recipe.boundaryBasis}:{modelBasis:recipe.modelBasis}),comparisonOperator:structuredClone(recipe.comparisonOperator),pairs:[]};
 for(const [i,row]of selected.entries()){
  if(row.raw.WBANNO!==station||row.raw.LONGITUDE!==selected[0].raw.LONGITUDE||row.raw.LATITUDE!==selected[0].raw.LATITUDE)throw Error('Selected original station or location changes');
  if(i&&selected[i-1].intervalEndUtc!==row.intervalStartUtc)throw Error('Selected original intervals have a gap, duplicate or reordering');
  if(row.raw.SUR_TEMP_TYPE!==correctionType||row.numbers.SUR_TEMP_FLAG!==0)throw Error('Selected surface correction policy or source QC is unsuitable');
  if(row.numbers.SUR_TEMP.missing||row.numbers.T_HR_AVG.missing)throw Error('A selected original channel mean is missing');
  const start=Date.parse(row.intervalStartUtc),end=Date.parse(row.intervalEndUtc);
  if(partitioned&&!(end<=phase||start>=phase))throw Error('An original hourly mean crosses the declared phase boundary; no row is split or dropped');
  const pair=partitioned?{role:end<=phase?'pre':'post'}:{};
  for(const name of ['treated','comparison']){
   const column=recipe.channels[name],band=recipe.bands[name];
   pair[name]={from:row.intervalStartUtc.replace('.000Z','Z'),to:row.intervalEndUtc.replace('.000Z','Z'),value:row.numbers[column].value,halfWidth:band.halfWidth,bandSource:band.source,unit:'C',place:places[name],
    source:`NOAA WBAN ${station}; supplied-file line ${firstLine+i}; ${column}=${row.raw[column]}; SHA256 ${intake.sha256}; ${intake.sourceUrl}`,
    sourceAggregation:{kind:'reported-interval-mean',weighting:'unknown',basis:`Original preceding-hour average; exact per-row temporal weights are not supplied. NOAA documentation: ${README}`}};
  }
  input.pairs.push(pair);
 }
 return{recipe,source:{sourceUrl:intake.sourceUrl,sha256:intake.sha256,originalRows:intake.rows.length,selectedLines:selected.map(r=>r.line)},input};
}
