import {prepareThreeEpochSkyEvidence,parseThreeEpochSkyEvidence} from './shade-heat-three-epoch-course.js';
self.onmessage=event=>{
  try{
    const request=event.data;let result;
    if(request?.operation==='prepare')result=prepareThreeEpochSkyEvidence(request.originals,request.query);
    else if(request?.operation==='parse')result=parseThreeEpochSkyEvidence(request.text);
    else throw Error('Unsupported original three-epoch operation');
    self.postMessage({ok:true,result});
  }catch(error){self.postMessage({ok:false,error:error.message});}
};
