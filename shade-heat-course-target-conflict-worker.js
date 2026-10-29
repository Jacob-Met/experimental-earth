import {prepareSkyTargetConflictEvidence,parseSkyTargetConflictEvidence} from './shade-heat-course-target-conflicts.js';
self.onmessage=event=>{
  try{
    const request=event.data;let result;
    if(request?.operation==='prepare')result=prepareSkyTargetConflictEvidence(request.originals,request.query);
    else if(request?.operation==='parse')result=parseSkyTargetConflictEvidence(request.text);
    else throw Error('Unsupported original target conflict operation');
    self.postMessage({ok:true,result});
  }catch(error){self.postMessage({ok:false,error:error.message});}
};
