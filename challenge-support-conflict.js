/** Exact minimum conflict over bounded original candidate identities. */
export function findMinimumChallengeConflict(candidateCount,supports){
  if(!Number.isInteger(candidateCount)||candidateCount<0||candidateCount>512||!Array.isArray(supports)||supports.length>12)throw Error('Require 0–512 candidate IDs and at most12 challenge supports.');
  const N=candidateCount,C=supports.length,S=2**C-1;
  const searchWork=N*(S+5*C+2)+8*S+C*C+C;
  if(!Number.isSafeInteger(searchWork)||searchWork>1000000)throw Error('Complete challenge subset search exceeds its work budget.');
  for(const ids of Array.from(supports)){
    if(!Array.isArray(ids))throw Error('Each challenge support must be an ascending candidate-ID array.');
    let previous=-1;
    for(const id of ids){if(!Number.isInteger(id)||id<0||id>=N||id<=previous)throw Error('Challenge support IDs must be distinct, ascending and in the original family.');previous=id;}
  }
  if(!N)return {jointSurvivorIds:[],witness:null};
  if(!C)return {jointSurvivorIds:Array.from({length:N},(_,i)=>i),witness:null};
  const records=supports.map(ids=>{const vector=new Uint8Array(N);for(const id of ids)vector[id]=1;return vector;});
  const vectors=new Array(S+1),cardinality=new Uint8Array(S+1);
  vectors[0]=new Uint8Array(N).fill(1);
  let best=0;
  for(let mask=1;mask<=S;mask++){
    const bit=mask&-mask,previous=mask^bit,ordinal=31-Math.clz32(bit);
    const vector=new Uint8Array(N),prior=vectors[previous],record=records[ordinal];let survivors=0;
    for(let i=0;i<N;i++){vector[i]=prior[i]&record[i];survivors+=vector[i];}
    vectors[mask]=vector;cardinality[mask]=cardinality[previous]+1;
    if(!survivors){
      const difference=(mask^best)&-(mask^best);
      if(!best||cardinality[mask]<cardinality[best]||(cardinality[mask]===cardinality[best]&&(mask&difference)!==0))best=mask;
    }
  }
  const ids=vector=>{const out=[];for(let i=0;i<N;i++)if(vector[i])out.push(i);return out;};
  const jointSurvivorIds=ids(vectors[S]);
  if(!best)return {jointSurvivorIds,witness:null};
  const recordOrdinals=[];for(let i=0;i<C;i++)if(best&(1<<i))recordOrdinals.push(i);
  const omissions=recordOrdinals.map(omittedOrdinal=>{
    const survivorCandidateIds=ids(vectors[best^(1<<omittedOrdinal)]);
    if(!survivorCandidateIds.length)throw Error('Minimum challenge witness failed its omission check.');
    return {omittedOrdinal,survivorCandidateIds};
  });
  return {jointSurvivorIds,witness:{cardinality:cardinality[best],recordOrdinals,omissions}};
}
