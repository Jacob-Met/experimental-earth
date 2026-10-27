// Independent receiving oracle: partition raw linear depth functions, then
// classify departure intervals. Never consumes modeled exposure intervals.
export function rawDepth(result, cell, time) {
  const rows=result.snapshots;
  for(let j=1;j<rows.length;j++) {
    const a=rows[j-1],b=rows[j];
    if(time>=a.minute && time<=b.minute) {
      return a.depthsMm[cell]+(b.depthsMm[cell]-a.depthsMm[cell])*
        ((time-a.minute)/(b.minute-a.minute));
    }
  }
  throw new Error('Oracle arrival outside retained snapshots');
}

export function oracle(result,route,steps,threshold,from,until) {
  const offsets=route.map((_,k)=>steps.slice(0,k).reduce((sum,n)=>sum+n,0));
  const cuts=new Set([from,until]);
  const add=x=>{if(x>from && x<until) cuts.add(x);};
  route.forEach((cell,k)=>{
    const rows=result.snapshots;
    rows.forEach(row=>add(row.minute-offsets[k]));
    for(let j=1;j<rows.length;j++) {
      const a=rows[j-1],b=rows[j];
      const da=a.depthsMm[cell],db=b.depthsMm[cell];
      if((da<threshold && db>threshold)||(da>threshold && db<threshold)) {
        add(a.minute+(threshold-da)/(db-da)*(b.minute-a.minute)-offsets[k]);
      }
    }
  });
  const points=[...cuts].sort((a,b)=>a-b),windows=[];
  for(let j=1;j<points.length;j++) {
    const startMinute=points[j-1],endMinute=points[j];
    const middle=(startMinute+endMinute)/2;
    if(route.every((cell,k)=>rawDepth(result,cell,middle+offsets[k])<=threshold)) {
      const previous=windows.at(-1);
      if(previous && previous.endMinute===startMinute) previous.endMinute=endMinute;
      else windows.push({startMinute,endMinute});
    }
  }
  return windows;
}

