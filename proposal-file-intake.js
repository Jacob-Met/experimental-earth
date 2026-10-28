import {canonicalSiteSource} from './rain-proposal-comparison.js';
import {checkProjectFileBytes,parsePortableProject} from './project-portability.js';

const encoder=new TextEncoder();
const hashBytes=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');

/** Shared original-byte intake for the two read-only saved-proposal workers. */
export function validateProposalFiles(files){
  if(!Array.isArray(files)||files.length<2||files.length>16)throw Error('Choose between 2 and 16 exported project files.');
  for(const file of files){
    if(!(file instanceof File))throw Error('Choose original project files with the file picker.');
    checkProjectFileBytes(file.size);
  }
}

export async function readProposalFile(file){
  try{
    const bytes=await file.arrayBuffer();
    checkProjectFileBytes(bytes.byteLength);
    if(bytes.byteLength!==file.size)throw Error('Original project size changed during reading');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    const project=parsePortableProject(text);
    const sourceSHA256=await hashBytes(bytes);
    return {project,sourceSHA256,sourceBytes:bytes.byteLength};
  }catch(error){
    throw Error(file.name+': '+(error instanceof Error?error.message:String(error)));
  }
}

export const hashProjectContext=project=>hashBytes(encoder.encode(canonicalSiteSource(project)));
