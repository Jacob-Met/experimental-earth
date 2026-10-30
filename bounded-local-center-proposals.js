import{boundedCenterProposals}from'./bounded-center-proposals.js';
export function boundedLocalCenterProposals(profile,earlyResidual,lateResidual,low,high,iterations,partitions=8,maximumBrackets=2){
 if(typeof profile!=='function'||typeof earlyResidual!=='function'||typeof lateResidual!=='function'||![low,high].every(Number.isFinite)||low>=high||!Number.isInteger(iterations)||iterations<1||iterations>44||partitions!==8||maximumBrackets!==2)throw Error('Bounded eight-slice two-bracket proposal policy required');
 const grid=Array.from({length:partitions+1},(_,i)=>({T:i===partitions?high:low+(high-low)*i/partitions,row:null}));for(const x of grid)x.row=profile(x.T);
 const brackets=[];for(let i=0;i<partitions;i++){const a=grid[i],b=grid[i+1],fa=lateResidual(a.row),fb=lateResidual(b.row);if(fa===0||fb===0||Math.sign(fa)!==Math.sign(fb))brackets.push({index:i,low:a.T,high:b.T,priority:Math.max(Math.abs(earlyResidual(a.row)),Math.abs(earlyResidual(b.row)))+Math.max(Math.abs(fa),Math.abs(fb))});}
 const ranked=brackets.slice().sort((a,b)=>a.priority-b.priority||a.index-b.index);for(const b of ranked.slice(0,maximumBrackets))b.status=boundedCenterProposals(profile,lateResidual,b.low,b.high,iterations);
 return{grid,brackets:ranked,selected:ranked.slice(0,maximumBrackets).map(x=>x.index)};
}
