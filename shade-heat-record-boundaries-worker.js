import {prepareRecordBoundaryEvidence,parseRecordBoundaryEvidence} from './shade-heat-record-boundaries.js';
self.onmessage=event=>{
  try{
    const request=event.data;let result;
    if(request?.operation==='prepare')result=prepareRecordBoundaryEvidence(request.originals,request.query);
    else if(request?.operation==='parse')result=parseRecordBoundaryEvidence(request.text);
    else throw Error('Unsupported complete-record boundary operation');
    self.postMessage({ok:true,result});
  }catch(error){self.postMessage({ok:false,error:error.message});}
};
