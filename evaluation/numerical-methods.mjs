#!/usr/bin/env node
// Real consumer for separate, read-only numerical method receiving.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {makeExample,validateProject} from '../core.js';
import {compareNumericalMethods} from './rain-integrator.js';
import {compareWetColumnReference} from './wet-column-reference.js';

const arg=process.argv[2];
if(!arg||process.argv.length!==3) {
  console.error('Usage: node evaluation/numerical-methods.mjs --example | --wet-columns | /path/to/exported-project.json');
  process.exit(2);
}
try {
 if(arg==='--wet-columns') {
  console.log(JSON.stringify(compareWetColumnReference(),null,2));
 } else {
  const bytes=arg==='--example' ? null : readFileSync(arg);
  const project=bytes ? JSON.parse(bytes.toString('utf8')) : makeExample();
  validateProject(project);
  const result=compareNumericalMethods(project,{
    surface: project.infiltrationStudy?.surface ?? 'turf',
    ratesMmHr: project.infiltrationStudy?.ratesMmHr ?? [3,9,22]});
  let sourceCommit=null,uncommitted=null;
  try {
    sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}).trim();
    uncommitted=Boolean(execFileSync('git',['status','--porcelain'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}).trim());
  }catch{}
  console.log(JSON.stringify({
    researchOnly:true,notFieldValidated:true,referenceIsNotTruth:true,
    input: {label:arg,sha256:bytes?createHash('sha256').update(bytes).digest('hex'):null,
      generatedExample:bytes===null},
    source:{commit:sourceCommit,uncommitted},
    result
  },null,2));
 }
} catch(e) {console.error('Benchmark refused:',e.message);process.exit(1);}
