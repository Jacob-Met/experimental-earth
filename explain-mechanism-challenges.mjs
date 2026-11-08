#!/usr/bin/env node
/** Original-file adapter; scientific admission belongs to the consumer. */
import {open, lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {explainMechanismChallengeConflict} from './mechanism-challenge-conflict.js';

const USAGE = 'Usage: node explain-mechanism-challenges.mjs original-proposal.json';
const LIMIT = 4 * 1024 * 1024;
const identity = stat => ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'mode', 'uid', 'gid'].map(key => String(stat[key])).join(':');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function readOriginal(filename) {
  const path = resolve(filename);
  const named = await lstat(path, {bigint: true});
  if (!named.isFile() || named.size < 1n || named.size > BigInt(LIMIT)) {
    throw Error(`Original proposal must be a nonempty regular file of at most ${LIMIT} bytes; symlinks and devices are not admitted`);
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let bytes, opened;
  try {
    opened = await handle.stat({bigint: true});
    if (!opened.isFile() || identity(named) !== identity(opened)) throw Error('Original proposal changed before opening');
    const buffer = Buffer.alloc(Number(opened.size) + 1);
    let count = 0;
    while (count < buffer.length) {
      const {bytesRead} = await handle.read(buffer, count, buffer.length - count, null);
      if (!bytesRead) break;
      count += bytesRead;
    }
    const after = await handle.stat({bigint: true});
    if (count !== Number(opened.size) || identity(opened) !== identity(after)) throw Error('Original proposal changed during reading');
    bytes = buffer.subarray(0, count);
  } finally {
    await handle.close();
  }
  if (identity(opened) !== identity(await lstat(path, {bigint: true}))) throw Error('Original proposal changed during reading');
  const text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  if (text.charCodeAt(0) === 0xfeff || !Buffer.from(text, 'utf8').equals(bytes)) throw Error('Original proposal requires exact UTF-8 without a BOM');
  return {path, text, bytes, identity: identity(opened), sha256: digest(bytes)};
}

export async function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write(USAGE + '\n');
    return 0;
  }
  if (args.length !== 1 || !args[0] || args[0].startsWith('--')) throw Error(USAGE);
  if (!['linux', 'darwin'].includes(process.platform)) throw Error('Original-file admission currently supports Linux and macOS');
  const original = await readOriginal(args[0]);
  // One fresh authoritative consumer; no cached reports or exporter intake.
  const report = explainMechanismChallengeConflict(original.text);
  const after = await readOriginal(original.path);
  if (after.identity !== original.identity || !after.bytes.equals(original.bytes)) throw Error('Original proposal changed before result publication');
  const output = {
    schema: 'experimental-earth-mechanism-challenge-conflict-cli/1',
    inputs: {originalProposal: {sha256: original.sha256, bytes: original.bytes.length}},
    report,
  };
  // Complete admission, analysis and serialization before publishing result bytes.
  const text = JSON.stringify(output, null, 2) + '\n';
  process.stdout.write(text);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('CHALLENGE CONFLICT REFUSAL: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
