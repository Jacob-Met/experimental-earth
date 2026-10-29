import {prepareSkyChangeEvidence,parseSkyChangeEvidence} from './shade-heat-sky-change-course.js';
self.onmessage=event=>{
  try{
    const request=event.data;let result;
    if(request?.operation==='prepare')result=prepareSkyChangeEvidence(request.originals,request.query);
    else if(request?.operation==='parse')result=parseSkyChangeEvidence(request.text);
    else throw Error('Unsupported original sky-change operation');
    self.postMessage({ok:true,result});
  }catch(error){self.postMessage({ok:false,error:error.message});}
};
