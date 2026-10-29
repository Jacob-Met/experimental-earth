import {prepareSkyConditionalEvidence,parseSkyConditionalEvidence} from './shade-heat-sky-conditional-course.js';
self.onmessage=event=>{
 try{
  const request=event.data;let result;
  if(request?.operation==='prepare')result=prepareSkyConditionalEvidence(request.originals,request.query);
  else if(request?.operation==='parse')result=parseSkyConditionalEvidence(request.text);
  else throw Error('Unsupported conditional sky consequence operation');
  self.postMessage({ok:true,result});
 }catch(error){self.postMessage({ok:false,error:error.message});}
};
