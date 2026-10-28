import {compareProposalCellSources} from './rain-proposal-local-depth.js';
import {validateProposalFiles,readProposalFile,hashProjectContext} from './proposal-file-intake.js';

let started=false;
self.addEventListener('message',async event=>{
  if(started)return;
  started=true;
  try{
    const {files,cellIndex,report}=event.data??{};
    validateProposalFiles(files);
    let completed=0;
    const readSource=async file=>{
      self.postMessage({type:'progress',completed,total:files.length,fileName:file.name});
      const source=await readProposalFile(file);completed++;return source;
    };
    const result=await compareProposalCellSources(files,{cellIndex,comparisonReport:report,readSource,hashIdentity:hashProjectContext});
    self.postMessage({type:'complete',result});
  }catch(error){
    self.postMessage({type:'error',message:error instanceof Error?error.message:String(error)});
  }
});
