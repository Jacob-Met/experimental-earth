#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {compare} from './core.js';
import {parsePortableProject, MAX_PROJECT_FILE_BYTES} from './project-portability.js';
import {serializeWaterHistoryCsv} from './water-history-csv.js';

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = s => ['dev','ino','size','mtimeNs','ctimeNs','mode','uid','gid'].map(k => String(s[k])).join(':');
const usage = 'Usage: node export-water-history.mjs ORIGINAL_PROJECT.json NEW_OUTPUT_DIRECTORY';

function readOriginal(filename, limit) {
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd,{bigint:true});
    if (!before.isFile() || before.size < 1n || before.size > BigInt(limit)) throw Error('Input must be a nonempty bounded regular file.');
    const bytes = Buffer.alloc(Number(before.size) + 1);
    let count = 0;
    while (count < bytes.length) {
      const n = fs.readSync(fd,bytes,count,bytes.length-count,null);
      if (!n) break;
      count += n;
    }
    const after = fs.fstatSync(fd,{bigint:true}), named = fs.lstatSync(filename,{bigint:true});
    if (count !== Number(before.size) || identity(before) !== identity(after) || identity(after) !== identity(named)) throw Error('Input changed while being read.');
    return {bytes:bytes.subarray(0,count), identity:identity(after)};
  } finally { fs.closeSync(fd); }
}
function writeNew(filename, bytes) {
  const fd = fs.openSync(filename,fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,0o600);
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const n = fs.writeSync(fd,bytes,offset,bytes.length-offset,null);
      if (!n) throw Error('Output write made no progress.');
      offset += n;
    }
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  if (!readOriginal(filename,bytes.length).bytes.equals(bytes)) throw Error('Output readback differs.');
}

export async function main(args) {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return 0; }
  if (process.platform !== 'linux') throw Error('This original-file command currently requires Linux.');
  if (args.length !== 2 || args.some(x => !x || x.startsWith('--'))) throw Error(usage);
  const inputPath = path.resolve(args[0]), output = path.resolve(args[1]);
  try { fs.lstatSync(output); throw Error('Output exists; choose a new directory.'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const original = readOriginal(inputPath,MAX_PROJECT_FILE_BYTES);
  const text = new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(original.bytes);
  if (text.charCodeAt(0) === 0xfeff || !Buffer.from(text,'utf8').equals(original.bytes)) throw Error('Original project requires exact UTF-8 without a BOM.');
  const project = parsePortableProject(text);
  const comparison = compare(project);
  const csv = Buffer.from(await serializeWaterHistoryCsv(comparison,text),'utf8');
  if (csv.length > MAX_CSV_BYTES) throw Error('Complete CSV exceeds the 2 MiB output bound.');
  const snapshots = comparison.existing.snapshots;
  const files = [['project.original.json',original.bytes],['water-history.csv',csv]];
  const receipt = {
    format:'experimental-earth-water-history-native/v1',
    method:'Unchanged parsePortableProject, compare and serializeWaterHistoryCsv.',
    model:'base-rain',
    input:{bytes:original.bytes.length,sha256:sha(original.bytes)},
    files:files.map(([name,bytes]) => ({path:name,bytes:bytes.length,sha256:sha(bytes)})),
    snapshots:snapshots.length,firstMinute:snapshots[0].minute,lastMinute:snapshots.at(-1).minute,
    scope:'Complete paired whole-site stored-water history from one base-rain comparison of the exact original project. Optional investigation declarations are preserved, but their analyses are not executed.',
    limitations:'Conceptual model results, not observations or a calibrated flood-risk prediction. No browser qualification.',
    reopen:'Run this command on project.original.json with a new output directory; saved CSV and receipt values are never inputs.'
  };
  files.push(['receipt.json',Buffer.from(JSON.stringify(receipt,null,2)+'\n')]);
  const again = readOriginal(inputPath,MAX_PROJECT_FILE_BYTES);
  if (again.identity !== original.identity || !again.bytes.equals(original.bytes)) throw Error('Original changed before output creation.');
  let created = false;
  try {
    fs.mkdirSync(output,{mode:0o700}); created = true;
    for (const [name,bytes] of files) writeNew(path.join(output,name),bytes);
    console.log(JSON.stringify({output,snapshots:receipt.snapshots,files:files.map(([name,bytes]) => ({path:name,bytes:bytes.length,sha256:sha(bytes)}))}));
    return 0;
  } catch (e) {
    if (created) e.message += ' A partial fresh directory may remain; retain it for inspection.';
    throw e;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (e) { console.error('WATER HISTORY REFUSAL: '+e.message); process.exitCode = 1; }
}
