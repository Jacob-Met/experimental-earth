import { prepareTimedSkyCourseEvidence,parseTimedSkyCourseEvidence } from './shade-heat-timed-course.js';
self.onmessage=event=>{
  try {
    const request=event.data;let result;
    if(request?.operation==='prepare')result=prepareTimedSkyCourseEvidence(request.originals,request.query);
    else if(request?.operation==='parse')result=parseTimedSkyCourseEvidence(request.text);
    else throw Error('Unsupported original-time reading operation');
    self.postMessage({ok:true,result});
  }catch(error){self.postMessage({ok:false,error:error.message});}
};
