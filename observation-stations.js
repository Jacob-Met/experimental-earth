// Explicit user-declared station placements; never inferred from station names.
const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
export function mappedCell(label,width,height) {
 const match=typeof label==='string'&&/^([A-Z])([1-9]\d*)$/.exec(label);
 if(!match)throw Error('Station cells must use uppercase grid labels such as B2');
 const x=match[1].charCodeAt(0)-65,y=Number(match[2])-1;
 if(x>=width||y>=height)throw Error('Station mapping cell lies outside the current grid');
 return y*width+x;
}
export function stationMap(input,project) {
 if(!input||!text(input.source,600)||!Array.isArray(input.entries)||!input.entries.length||input.entries.length>100)throw Error('Supply a mapping source and 1–100 station entries');
 const result=new Map();
 for(const entry of input.entries){
  if(!entry||!text(entry.station,160)||entry.station!==entry.station.trim()||result.has(entry.station))throw Error('Station IDs must be distinct, nonempty, trimmed strings of at most 160 characters');
  mappedCell(entry.cell,project.width,project.height);
  result.set(entry.station,{station:entry.station,cell:entry.cell,source:input.source,gridWidth:project.width,gridHeight:project.height});
 }
 return result;
}
export function validateStationOrigin(reading,project) {
 const origin=reading.tableSource?.stationMapping;
 if(origin===undefined){if(reading.tableSource?.stationValue!==undefined)throw Error('Original station token requires its retained mapping');return;}
 if(typeof reading.tableSource.stationValue!=='string'||reading.tableSource.stationValue.length>128000||reading.tableSource.stationValue.trim()!==origin.station)throw Error('Original station token does not match its retained mapping');
 if(!origin||!text(origin.station,160)||origin.station!==origin.station.trim()||!text(origin.source,600)||!Number.isInteger(origin.gridWidth)||!Number.isInteger(origin.gridHeight)||origin.gridWidth<1||origin.gridWidth>24||origin.gridHeight<1||origin.gridHeight>24)throw Error('Invalid retained station mapping');
 if(project&&(origin.gridWidth!==project.width||origin.gridHeight!==project.height))throw Error('Station mapping belongs to different grid dimensions');
 if(mappedCell(origin.cell,origin.gridWidth,origin.gridHeight)!==reading.cellIndex)throw Error('Observation cell does not match its retained station mapping');
}
