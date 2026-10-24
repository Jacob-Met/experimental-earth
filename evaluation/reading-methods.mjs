#!/usr/bin/env node
import {statSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateProject} from '../core.js';
import {compareReadingMethods} from './reading-methods.js';
const MAX_BYTES=4*1024*1024;
if(process.argv.length!==3){
  console.error('Usage: node evaluation/reading-methods.mjs /path/to/source-project.json');
  process.exit(2);
}
try{
  const path=process.argv[2];
  if(statSync(path).size>MAX_BYTES)throw Error('Source project exceeds 4MiB');
  const bytes=readFileSync(path);
  const project=validateProject(JSON.parse(bytes.toString('utf8')));
  if(!project.infiltrationStudy)throw Error('A retained infiltrationStudy is required');
  const result=compareReadingMethods(project);
  const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{
    cwd:new URL('..',import.meta.url),encoding:'utf8'}).trim();
  console.log(JSON.stringify({
    schema:'experimental-earth-reading-methods-receipt/1',
    input:{label:path,sha256:createHash('sha256').update(bytes).digest('hex')},
    source:{gitCommit:sourceCommit},
    interpretation:'Author-declared models only; not field-validated; neither numerical method selected as physical truth',
    result
  },null,2));
}catch(e){console.error('Reading-method challenge refused:',e.message);process.exit(1);}
