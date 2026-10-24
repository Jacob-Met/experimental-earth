const fmt = n => Number(n).toLocaleString('en-US', {maximumSignificantDigits: 4});
const ns = 'http://www.w3.org/2000/svg';
const errorAt = (c, kind, index) => [...c.calibration[kind].errors, ...c.challenge[kind].errors].find(e => e.index === index);

/** One observation pair in its native units; the table retains all evidence. */
export function drawJointEvidencePlane(host, report, project, volumeIndex, depthIndex) {
  host.replaceChildren();
  const points = report.candidates.map((c, i) => ({c, i, v:errorAt(c,'volume',volumeIndex), d:errorAt(c,'depth',depthIndex)}));
  if (!points.length || points.some(p => !p.v || !p.d)) return;
  const {v,d} = points[0];
  const extent = (values, center, tolerance) => {
    const lo=Math.min(...values,center-tolerance), hi=Math.max(...values,center+tolerance);
    const pad=Math.max(hi-lo,Math.abs(hi)*.1,1)*.12;
    return [lo-pad,hi+pad];
  };
  const [xmin,xmax]=extent(points.map(p=>p.v.predicted),v.observed,v.tolerance);
  const [ymin,ymax]=extent(points.map(p=>p.d.predicted),d.observed,d.tolerance);
  const x=n=>68+(n-xmin)/(xmax-xmin)*500, y=n=>290-(n-ymin)/(ymax-ymin)*245;
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 620 350');svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Numbered joint hypotheses in volume and depth. Dashed lines show observed bands; complete native-unit evidence follows in the table.');
  const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;svg.append(n);return n;};
  add('rect',{x:68,y:45,width:500,height:245,fill:'#f6faf8',stroke:'#91a9a0'});
  if(v.tolerance>0)add('rect',{x:x(v.observed-v.tolerance),y:45,width:x(v.observed+v.tolerance)-x(v.observed-v.tolerance),height:245,fill:'#a8d1ba',opacity:.35});
  if(d.tolerance>0)add('rect',{x:68,y:y(d.observed+d.tolerance),width:500,height:y(d.observed-d.tolerance)-y(d.observed+d.tolerance),fill:'#a8d1ba',opacity:.35});
  for(let i=0;i<=4;i++){
    const xv=xmin+(xmax-xmin)*i/4,yv=ymin+(ymax-ymin)*i/4;
    add('line',{x1:x(xv),x2:x(xv),y1:45,y2:290,stroke:'#d3e2da'});
    add('line',{x1:68,x2:568,y1:y(yv),y2:y(yv),stroke:'#d3e2da'});
    add('text',{x:x(xv),y:309,'text-anchor':'middle',fill:'#294d44','font-size':12},fmt(xv));
    add('text',{x:59,y:y(yv)+4,'text-anchor':'end',fill:'#294d44','font-size':12},fmt(yv));
  }
  for(const b of new Set([v.observed-v.tolerance,v.observed+v.tolerance]))add('line',{x1:x(b),x2:x(b),y1:45,y2:290,stroke:'#217252','stroke-width':2,'stroke-dasharray':'5 4'});
  for(const b of new Set([d.observed-d.tolerance,d.observed+d.tolerance]))add('line',{x1:68,x2:568,y1:y(b),y2:y(b),stroke:'#217252','stroke-width':2,'stroke-dasharray':'5 4'});
  for(const p of points){
    const fill=p.c.calibration.compatible!==true?'#637d77':p.c.challenge.compatible===false?'#a55226':'#165f50';
    const circle=add('circle',{cx:x(p.v.predicted),cy:y(p.d.predicted),r:6,fill,stroke:'#fff','stroke-width':2});
    const title=document.createElementNS(ns,'title');title.textContent=`${p.c.label}: ${fmt(p.v.predicted)} L, ${fmt(p.d.predicted)} mm`;circle.append(title);
    add('text',{x:x(p.v.predicted)+10,y:y(p.d.predicted)-9,fill:'#173c34','font-size':13,'font-weight':700},String(p.i+1));
  }
  add('text',{x:318,y:337,'text-anchor':'middle',fill:'#294d44','font-size':13},'Modeled collected volume · L');
  add('text',{x:68,y:26,fill:'#294d44','font-size':13},'Modeled ponding depth · mm');
  host.append(svg);
  const volume=project.outletEvidence.readings[volumeIndex],depth=project.observations[depthIndex];
  const caption=document.createElement('p');caption.className='mini-note';
  caption.textContent=`Collection ${volume.startMinute}–${volume.endMinute} min (${volume.use}); depth at cell ${depth.cellIndex+1}, ${depth.minute} min (${depth.use}). Dashed lines bound supplied ± tolerances; zero tolerance is one line. Numbered points match the table. This view shows two readings; the full comparison uses every assigned reading.`;
  host.append(caption);
}
