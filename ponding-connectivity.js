/** Same-time depth-only connectivity. These grid paths are not physical routes. */
export const CONNECTIVITY_WORK_LIMIT = 2_000_000;

export function validateConnectivityQuestion(question, width, height) {
  const count = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width > 24 || height > 24) throw new Error('Unsupported site grid.');
  const {startIndex, endIndex, allowedIndices} = question ?? {};
  const valid = i => Number.isInteger(i) && i >= 0 && i < count;
  if (!valid(startIndex) || !valid(endIndex) || startIndex === endIndex) throw new Error('Choose two different endpoints in this site.');
  if (!Array.isArray(allowedIndices) || allowedIndices.length < 2 || allowedIndices.length > count || Array.from(allowedIndices).some(i => !valid(i)) || new Set(allowedIndices).size !== allowedIndices.length) throw new Error('Declare a distinct allowed-cell footprint within this site.');
  if (!allowedIndices.includes(startIndex) || !allowedIndices.includes(endIndex)) throw new Error('Both endpoints must belong to the offered footprint.');
  return {startIndex, endIndex, allowedIndices: [...allowedIndices].sort((a,b)=>a-b)};
}

export function parseConnectivityCells(text, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width > 24 || height > 24) throw new Error('Unsupported site grid.');
  if (typeof text !== 'string' || !text.trim() || text.length > 3000) throw new Error('Declare the allowed cells, or enter ALL for the entire grid.');
  if (text.trim().toUpperCase() === 'ALL') return Array.from({length:width*height},(_,i)=>i);
  const result = text.trim().toUpperCase().split(/[\s,;]+/).map(label => {
    const match = /^([A-X])([1-9]|1[0-9]|2[0-4])$/.exec(label);
    const x = match ? match[1].charCodeAt(0)-65 : -1, y = match ? Number(match[2])-1 : -1;
    if(x<0 || x>=width || y<0 || y>=height) throw new Error('A declared cell is outside this grid.');
    return y*width+x;
  });
  if(new Set(result).size !== result.length) throw new Error('Declare each footprint cell once.');
  return result;
}

function neighbors(i,width,count) {
  // Ascending cell order makes shortest witness ties stable.
  return [i-width, i%width ? i-1 : -1, i%width<width-1 ? i+1 : -1, i+width].filter(j=>j>=0 && j<count);
}

function thresholdReachability(depths,width,question,thresholdMm) {
  const allowed=new Set(question.allowedIndices),queue=[],prev=new Map(),boundary=new Set();
  if(depths[question.startIndex]>thresholdMm)boundary.add(question.startIndex);
  else {queue.push(question.startIndex);prev.set(question.startIndex,-1);}
  for(const i of queue)for(const j of neighbors(i,width,depths.length))if(allowed.has(j)){
    if(depths[j]>thresholdMm)boundary.add(j);
    else if(!prev.has(j)){prev.set(j,i);queue.push(j);}
  }
  return {reachable:queue,boundary:[...boundary].sort((a,b)=>a-b),prev};
}
function validateDepths(depths,width,height) {
  if(!Array.isArray(depths)||depths.length!==width*height||Array.from(depths).some(d=>!Number.isFinite(d)||d<0))throw new Error('Finite nonnegative depth for every site cell is required.');
}
/** Complete source component and its excluded cell boundary at one threshold. */
export function pondingConnectionBoundary(depths,width,height,question,thresholdMm) {
  const q=validateConnectivityQuestion(question,width,height);validateDepths(depths,width,height);
  if(!Number.isFinite(thresholdMm)||thresholdMm<0)throw new Error('A finite nonnegative threshold is required.');
  const {reachable,boundary}=thresholdReachability(depths,width,q,thresholdMm);
  return {reachable,boundary};
}

function search(depths,width,question) {
  const n=depths.length, allowed=new Set(question.allowedIndices);
  const distance=Array(n).fill(Infinity), visited=new Set();
  distance[question.startIndex]=depths[question.startIndex];
  // A binary heap bounds the complete course to O(snapshots * cells log cells).
  const heap=[];
  function push(cost,index){let k=heap.length;heap.push([cost,index]);while(k){const p=(k-1)>>1;if(heap[p][0]<cost || heap[p][0]===cost&&heap[p][1]<=index)break;heap[k]=heap[p];k=p;}heap[k]=[cost,index];}
  function pop(){const root=heap[0],last=heap.pop();if(heap.length){let k=0;while(2*k+1<heap.length){let c=2*k+1;if(c+1<heap.length&&(heap[c+1][0]<heap[c][0]||heap[c+1][0]===heap[c][0]&&heap[c+1][1]<heap[c][1]))c++;if(last[0]<heap[c][0]||last[0]===heap[c][0]&&last[1]<=heap[c][1])break;heap[k]=heap[c];k=c;}heap[k]=last;}return root;}
  push(distance[question.startIndex],question.startIndex);
  while(heap.length){const [cost,i]=pop();if(visited.has(i))continue;visited.add(i);if(i===question.endIndex)break;
    for(const j of neighbors(i,width,n))if(allowed.has(j)&&!visited.has(j)){const candidate=Math.max(cost,depths[j]);if(candidate<distance[j]){distance[j]=candidate;push(candidate,j);}}
  }
  const bottleneckMm=distance[question.endIndex];
  if(!Number.isFinite(bottleneckMm))return {connected:false,bottleneckMm:null,path:[]};
  // Minimax predecessors alone need not give a shortest minimax path. A second
  // BFS at the optimal threshold establishes that separate tie objective.
  const {prev}=thresholdReachability(depths,width,question,bottleneckMm);
  const path=[];for(let i=question.endIndex;i!==-1;i=prev.get(i))path.push(i);path.reverse();
  return {connected:true,bottleneckMm,path};
}

export function minimumPondingConnection(depths,width,height,question) {
  const q=validateConnectivityQuestion(question,width,height);
  validateDepths(depths,width,height);
  return search(depths,width,q);
}

export function comparePondingConnections(results,width,height,question) {
  const q=validateConnectivityQuestion(question,width,height), n=width*height;
  const existing=results?.existing?.snapshots,proposal=results?.proposal?.snapshots;
  if(!Array.isArray(existing)||existing.length<2||!Array.isArray(proposal)||proposal.length!==existing.length)throw new Error('Aligned original solver snapshots are required.');
  if(2*existing.length*n*Math.ceil(Math.log2(n+1))>CONNECTIVITY_WORK_LIMIT)throw new Error('The complete connection course exceeds its work limit; reduce the site or number of original solver steps.');
  for(const list of [existing,proposal])Array.from(list).forEach((s,i)=>{if(!Number.isFinite(s?.minute)||s.minute<0||(i&&s.minute<=list[i-1].minute)||s.minute!==existing[i].minute||!Array.isArray(s.depthsMm)||s.depthsMm.length!==n||Array.from(s.depthsMm).some(d=>!Number.isFinite(d)||d<0))throw new Error('Invalid or unaligned original solver snapshots.');});
  return {question:q,rows:existing.map((s,i)=>({minute:s.minute,existing:search(s.depthsMm,width,q),proposal:search(proposal[i].depthsMm,width,q)}))};
}
