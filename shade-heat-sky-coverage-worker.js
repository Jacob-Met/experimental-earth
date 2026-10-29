import {prepareSkyCoverageEvidence,parseSkyCoverageEvidence} from './shade-heat-sky-coverage-course.js';
self.onmessage=event=>{
 try{
  const request=event.data;let result;
  if(request?.operation==='prepare')result=prepareSkyCoverageEvidence(request.originals,request.query);
  else if(request?.operation==='parse')result=parseSkyCoverageEvidence(request.text);
  else throw Error('Unsupported original common-relaxation sky operation');
  self.postMessage({ok:true,result});
 }catch(error){self.postMessage({ok:false,error:error.message});}
};
