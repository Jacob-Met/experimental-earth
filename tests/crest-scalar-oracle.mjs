// Independent piecewise analytic donor with absorbing downstream sinks.
export function exactDonor({water,stored=0,capacity=null,drainage=0,uptake=0,rain=0,mobility=1,crests,hours}){
 let time=0,absorbed=0,drained=0,out=0,events=0;const initial=water+stored;
 while(time<hours){if(++events>64)throw Error('oracle event bound');const q=Math.min(uptake,capacity!==null&&stored===capacity?drainage*capacity:Infinity,water===0?rain:Infinity),derivative=rain-q-mobility*crests.reduce((s,c)=>s+Math.max(0,water-c),0),active=crests.filter(c=>water>c||(water===c&&derivative>0)),lambda=mobility*active.length,F=rain-q+mobility*active.reduce((a,b)=>a+b,0),equilibrium=lambda?F/lambda:0;let dt=hours-time,hit=null;
 for(const level of[0,...crests]){if(level===water)continue;let t;if(lambda){const ratio=(level-equilibrium)/(water-equilibrium);if(!(ratio>0&&ratio<1))continue;t=-Math.log(ratio)/lambda;}else{if(F===0)continue;t=(level-water)/F;}if(t>0&&t<dt){dt=t;hit={water:level};}}
 if(capacity!==null&&stored<capacity&&q>drainage*capacity){const gap=capacity-stored,excess=q-drainage*capacity,z=drainage*gap/excess,t=(gap/excess)*(z===0?1:Math.log1p(z)/z);if(t>0&&t<dt){dt=t;hit={store:capacity};}}
 const next=lambda?equilibrium+(water-equilibrium)*Math.exp(-lambda*dt):water+F*dt,used=q*dt;out+=water+rain*dt-used-next;absorbed+=used;if(capacity!==null){const z=drainage*dt,phi=z===0?1:-Math.expm1(-z)/z,nextS=stored*Math.exp(-z)+used*phi;drained+=stored+used-nextS;stored=hit?.store??nextS;}water=hit?.water??next;time+=dt;if(water<0&&water>-1e-12)throw Error('oracle negative roundoff');}
 return{water,stored,absorbed,drained,out,events,balance:initial+rain*hours-water-stored-out-drained-(capacity===null?absorbed:0)};
}
