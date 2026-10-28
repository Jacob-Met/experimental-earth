import {compareProposalSources,canonicalSiteSource} from './rain-proposal-comparison.js';
import {checkProjectFileBytes,parsePortableProject} from './project-portability.js';

const encoder=new TextEncoder();
const hashBytes=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
let started=false;

self.addEventListener('message',async event=>{
  if(started)return;
  started=true;
  try{
    const files=event.data?.files;
    if(!Array.isArray(files)||files.length<2||files.length>16)throw Error('Choose between 2 and 16 exported project files.');
    for(const file of files){
      if(!(file instanceof File))throw Error('Choose original project files with the file picker.');
      checkProjectFileBytes(file.size);
    }
    let completed=0;
    const readSource=async file=>{
      self.postMessage({type:'progress',completed,total:files.length,fileName:file.name});
      try{
        const bytes=await file.arrayBuffer();
        checkProjectFileBytes(bytes.byteLength);
        if(bytes.byteLength!==file.size)throw Error('Original project size changed during reading');
        const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
        const project=parsePortableProject(text);
        const sourceSHA256=await hashBytes(bytes);
        completed++;
        return {project,sourceSHA256,sourceBytes:bytes.byteLength};
      }catch(error){
        throw Error(file.name+': '+(error instanceof Error?error.message:String(error)));
      }
    };
    const report=await compareProposalSources(files,{readSource,hashIdentity:project=>hashBytes(encoder.encode(canonicalSiteSource(project)))});
    self.postMessage({type:'complete',report});
  }catch(error){
    self.postMessage({type:'error',message:error instanceof Error?error.message:String(error)});
  }
});

