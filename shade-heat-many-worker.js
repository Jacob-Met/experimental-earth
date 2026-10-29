import {prepareManySkyCourseEvidence,parseManySkyCourseEvidence} from './shade-heat-many-course.js';
self.onmessage=event=>{
  try{
    const request=event.data;let result;
    if(request?.operation==='prepare')result=prepareManySkyCourseEvidence(request.originals,request.query);
    else if(request?.operation==='parse')result=parseManySkyCourseEvidence(request.text);
    else throw Error('Unsupported original-record sky operation');
    self.postMessage({ok:true,result});
  }catch(error){self.postMessage({ok:false,error:error.message});}
};
