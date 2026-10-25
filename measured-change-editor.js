/** Structured original-input authoring. Parent owns source custody and comparison. */
export function mountMeasuredChangeEditor(host,{changed}) {
  const fields=new Map(),rows=new Map();
  const label=(name,text,type='text')=>{
    const box=document.createElement('label');box.className='input-label';box.textContent=text;
    const multiline=name==='association'||name==='parallelChange'||name.endsWith('-source');
    const control=document.createElement(multiline?'textarea':'input');if(multiline){control.rows=3;control.style.width='100%';control.style.boxSizing='border-box';}else control.type=type;control.dataset.field=name;
    if(type==='number'){control.step='any';}else control.maxLength=1000;
    box.append(control);control.addEventListener('input',changed);return {box,control};
  };
  for(const [name,title]of [['quantity','Measured quantity'],['unit','Common original unit'],['treatedPlace','Treated place'],['comparisonPlace','Comparison place'],['before','Before time (UTC, YYYY-MM-DDTHH:MM:SSZ)'],['after','After time (UTC, YYYY-MM-DDTHH:MM:SSZ)'],['association','Why are the places, times and measured quantities comparable?'],['parallelChange','What supports assuming the same untreated change?']]){
    const {box,control}=label(name,title);fields.set(name,control);host.append(box);
  }
  for(const [key,title]of [['treatedBefore','Treated place · before'],['treatedAfter','Treated place · after'],['comparisonBefore','Comparison place · before'],['comparisonAfter','Comparison place · after']]){
    const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;group.append(legend);const controls={};
    for(const [name,title,type]of [['lower','Original lower bound','number'],['upper','Original upper bound','number'],['source','Original source and measurement method','text']]){const {box,control}=label(`${key}-${name}`,title,type);controls[name]=control;group.append(box);}rows.set(key,controls);host.append(group);
  }
  return {
    read(){
      const x={schema:'experimental-earth-measured-change/1'};for(const [key,control]of fields)x[key]=control.value;
      for(const [key,controls]of rows){if(controls.lower.value.trim()===''||controls.upper.value.trim()==='')throw Error(`Enter both original bounds for ${key}`);x[key]={lower:Number(controls.lower.value),upper:Number(controls.upper.value),source:controls.source.value,unit:x.unit,place:x[key.startsWith('treated')?'treatedPlace':'comparisonPlace'],time:x[key.endsWith('Before')?'before':'after']};}
      return x;
    },
    write(x){for(const [key,control]of fields)control.value=x[key]??'';for(const [key,controls]of rows)for(const [name,control]of Object.entries(controls))control.value=x[key]?.[name]??'';},
  };
}
