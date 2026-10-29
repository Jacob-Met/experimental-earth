import {node,number} from './shade-heat-epoch-view.js';
import {courseWitnessDifferences} from './shade-heat-course-inputs.js';

const svgNode=(tag,attributes={},text='')=>{
  const element=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value] of Object.entries(attributes))element.setAttribute(key,String(value));
  element.textContent=text;return element;
};
const timeText=utc=>utc.slice(11,16);
export function drawRecordBoundaryPlots(host,report,selectedTime,selectedBoundary,selectedWitness){
  host.replaceChildren();
  const boundary=report.boundaries[selectedBoundary],witness=boundary.report.witnesses.find(w=>w.id===selectedWitness);
  const trace=witness?courseWitnessDifferences(witness):null;
  for(const [field,title] of [['surfaceC','Ground surface'],['subsurfaceC','Lower heat store']]){
    const figure=node('figure');figure.className='many-plot';figure.dataset.store=field;figure.append(node('h3',title));
    const rows=report.pointwiseCourse,prior=report.firstThree.pointwiseCourse;
    const admitted=[...rows,...prior].filter(row=>row.ranges);
    if(!admitted.length){figure.append(node('p','Neither evidence family admits an offered boundary. No consequence range is reported.'));host.append(figure);continue;}
    const low=Math.min(0,...admitted.map(row=>row.ranges[field].lower.differenceC.lower));
    const high=Math.max(0,...admitted.map(row=>row.ranges[field].upper.differenceC.upper));
    const pad=Math.max((high-low)*.1,.05),minimum=low-pad,maximum=high+pad;
    const x=minute=>66+344*minute/rows.at(-1).minute,y=value=>224-190*(value-minimum)/(maximum-minimum);
    const svg=svgNode('svg',{viewBox:'0 0 430 280',role:'img','aria-label':title+', pointwise unions over offered boundaries at original times. Exact values and every attaining boundary are available below.'});
    svg.append(svgNode('title',{},title+' · proposal minus existing, °C'),svgNode('desc',{},
      'Pale blue ranges use the first three original readings; green ranges use the entire record across every compatible offered boundary. Orange markers, when present, use one fixed profile and its selected original change boundary. No connecting trajectory or interpolated time is asserted.'));
    const tick=value=>Math.abs(value)<.001&&value!==0?value.toExponential(1):String(Number(value.toFixed(2)));
    for(let i=0;i<=4;i++){
      const value=minimum+(maximum-minimum)*i/4;
      svg.append(svgNode('line',{x1:66,x2:410,y1:y(value),y2:y(value),stroke:'#e2e9e3'}),
        svgNode('text',{x:57,y:y(value)+5,'text-anchor':'end',fill:'#506c69','font-size':15},tick(value)));
    }
    svg.append(svgNode('text',{x:13,y:20,fill:'#506c69','font-size':15},'Δ °C'),
      svgNode('line',{x1:66,x2:410,y1:y(0),y2:y(0),stroke:'#708f86','stroke-width':1.3}),
      svgNode('line',{x1:x(rows[selectedTime].minute),x2:x(rows[selectedTime].minute),y1:29,y2:229,stroke:'#c2d6d0','stroke-width':7,opacity:.6}));
    if(trace)svg.append(svgNode('line',{x1:x(rows[boundary.splitAfterInterval].minute),x2:x(rows[boundary.splitAfterInterval].minute),y1:29,y2:229,stroke:'#8b6b93','stroke-dasharray':'5 5','stroke-width':1.4}));
    for(const row of rows){
      const px=x(row.minute),reference=prior[row.index].ranges?.[field];
      if(reference){
        const group=svgNode('g',{'data-prior-index':row.index,'data-prior-lower':reference.lower.differenceC.lower,'data-prior-upper':reference.upper.differenceC.upper});
        group.append(svgNode('line',{x1:px,x2:px,y1:y(reference.lower.differenceC.lower),y2:y(reference.upper.differenceC.upper),stroke:'#9aafc5','stroke-width':8,opacity:.55}));svg.append(group);
      }
      const range=row.ranges?.[field];
      if(range){
        const lower=range.lower.differenceC.lower,upper=range.upper.differenceC.upper;
        const group=svgNode('g',{'data-index':row.index,'data-lower':lower,'data-upper':upper});
        group.append(svgNode('title',{},row.utc+': '+number(lower)+' to '+number(upper)+' °C'),
          svgNode('line',{x1:px,x2:px,y1:y(lower),y2:y(upper),stroke:'#377b68','stroke-width':3}),
          svgNode('line',{x1:px-5,x2:px+5,y1:y(lower),y2:y(lower),stroke:'#377b68','stroke-width':2}),
          svgNode('line',{x1:px-5,x2:px+5,y1:y(upper),y2:y(upper),stroke:'#377b68','stroke-width':2}));svg.append(group);
      }
      if(trace)for(const side of ['lower','upper']){
        const value=trace[row.index].differenceC[field][side][side];
        svg.append(svgNode('circle',{cx:px,cy:y(value),r:side==='lower'?2.4:1.5,fill:side==='lower'?'#ad5c18':'#fff5e8',stroke:'#ad5c18','stroke-width':1.1,
          'data-profile':witness.id,'data-boundary':boundary.splitAfterInterval,'data-index':row.index,'data-bound':side,'data-value':value}));
      }
    }
    const labels=[rows[0],rows[Math.floor(rows.length/2)],rows.at(-1)];
    for(const row of labels)svg.append(svgNode('text',{x:x(row.minute),y:251,fill:'#506c69','font-size':15,'text-anchor':row.index===0?'start':row.index===rows.length-1?'end':'middle'},timeText(row.utc)));
    figure.append(svg,node('figcaption','Original UTC · '+rows[0].utc.slice(0,10)+(rows.at(-1).utc.slice(0,10)===rows[0].utc.slice(0,10)?'':' to '+rows.at(-1).utc.slice(0,10))+'. Narrow ranges can be smaller than a marker; inspect exact values and origins below.'));host.append(figure);
  }
}
