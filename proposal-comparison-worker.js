import {compareProposalSources} from './rain-proposal-comparison.js';
import {validateProposalFiles,readProposalFile,hashProjectContext} from './proposal-file-intake.js';

let started=false;
self.addEventListener('message',async event=>{
  if(started)return;
  started=true;
  try{
    const files=event.data?.files;
    validateProposalFiles(files);
    let completed=0;
    const readSource=async file=>{
      self.postMessage({type:'progress',completed,total:files.length,fileName:file.name});
      const source=await readProposalFile(file);completed++;return source;
    };
    const report=await compareProposalSources(files,{readSource,hashIdentity:hashProjectContext});
    self.postMessage({type:'complete',report});
  }catch(error){
    self.postMessage({type:'error',message:error instanceof Error?error.message:String(error)});
  }
});
