import {prepareSkyConsequenceEvidence,parseSkyConsequenceEvidence} from './shade-heat-sky-consequence-course.js';
self.onmessage=event=>{
  try{
    const request=event.data;let result;
    if(request?.operation==='prepare')result=prepareSkyConsequenceEvidence(request.originals,request.query);
    else if(request?.operation==='parse')result=parseSkyConsequenceEvidence(request.text);
    else throw Error('Unsupported original sky-consequence operation');
    self.postMessage({ok:true,result});
  }catch(error){self.postMessage({ok:false,error:error.message});}
};
