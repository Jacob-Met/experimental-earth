import assert from'node:assert/strict';
import{advance}from'../outlet-event-graph.mjs';import{writeFileSync}from'node:fs';
// Independent one-cell analytic solution: H'=R-I-k(H+10) while wet.
// Rain-free course, exact first dry hit, then zero uptake/outflow.
const rows=[];for(const H of[.01,.1,1,10])for(const h of[1/60,1/12,1]){const I=9,k=.38,A=I+10*k,z=k*H/A,hit=H/A*(z===0?1:Math.log1p(z)/z),wet=Math.min(h,hit),water=h>=hit?0:H*Math.exp(-k*h)-A*(-Math.expm1(-k*h))/k,uptake=I*wet,exit=H-water-uptake;const budget={used:0,limit:3000000},r=advance([H],[0],[],[[0,1]],h,0,k,0,[I],budget);rows.push({H,h,oracle:{water,uptake,exit,hit},actual:{water:r.water[0],uptake:r.absorbed,exit:r.exit},error:Math.max(Math.abs(water-r.water[0]),Math.abs(uptake-r.absorbed),Math.abs(exit-r.exit)),work:budget.used});}for(const row of rows)assert.ok(row.error<1e-10,JSON.stringify(row));console.log(rows.map(({oracle,actual,...r})=>r))
