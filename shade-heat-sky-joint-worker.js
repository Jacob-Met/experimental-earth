import {prepareSkyJointEvidence,parseSkyJointEvidence} from './shade-heat-sky-joint-course.js';
self.onmessage=event=>{
 try{
  const request=event.data;let result;
  if(request?.operation==='prepare')result=prepareSkyJointEvidence(request.originals,request.query);
  else if(request?.operation==='parse')result=parseSkyJointEvidence(request.text);
  else throw Error('Unsupported original joint sky operation');
  self.postMessage({ok:true,result});
 }catch(error){self.postMessage({ok:false,error:error.message});}
};
