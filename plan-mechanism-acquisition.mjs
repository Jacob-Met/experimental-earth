#!/usr/bin/env node
/** Original-file adapter only; scientific admission belongs to the planner. */
import {open, lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {planMechanismAcquisition} from './mechanism-acquisition.js';

const USAGE = 'Usage: node plan-mechanism-acquisition.mjs original-proposal.json acquisition-menu.json [acquisition-collections.json [conditional-sequences.json]]';
const identity = stat => ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'mode', 'uid', 'gid'].map(key => String(stat[key])).join(':');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function readOriginal(filename, limit, label) {
  const path = resolve(filename);
  const named = await lstat(path, {bigint: true});
  if (!named.isFile() || named.size < 1n || named.size > BigInt(limit)) {
    throw Error(`${label} must be a nonempty regular file of at most ${limit} bytes; symlinks and devices are not admitted`);
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let bytes, opened;
  try {
    opened = await handle.stat({bigint: true});
    if (!opened.isFile() || identity(named) !== identity(opened)) throw Error(`${label} changed before opening`);
    const buffer = Buffer.alloc(Number(opened.size) + 1);
    let count = 0;
    while (count < buffer.length) {
      const {bytesRead} = await handle.read(buffer, count, buffer.length - count, null);
      if (!bytesRead) break;
      count += bytesRead;
    }
    const after = await handle.stat({bigint: true});
    if (count !== Number(opened.size) || identity(opened) !== identity(after)) throw Error(`${label} changed during reading`);
    bytes = buffer.subarray(0, count);
  } finally {
    await handle.close();
  }
  if (identity(opened) !== identity(await lstat(path, {bigint: true}))) throw Error(`${label} changed during reading`);
  const text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  if (text.charCodeAt(0) === 0xfeff || !Buffer.from(text, 'utf8').equals(bytes)) throw Error(`${label} requires exact UTF-8 without a BOM`);
  return {path, text, bytes, identity: identity(opened), sha256: digest(bytes)};
}

export async function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write(USAGE + '\n');
    return 0;
  }
  if (![2, 3, 4].includes(args.length) || args.some(arg => !arg || arg.startsWith('--'))) throw Error(USAGE);
  if (!['linux', 'darwin'].includes(process.platform)) throw Error('Original-file admission currently supports Linux and macOS');
  const original = await readOriginal(args[0], 4 * 1024 * 1024, 'Original proposal');
  const menu = await readOriginal(args[1], 128 * 1024, 'Acquisition menu');
  const menuObject = JSON.parse(menu.text);
  const collections = args.length >= 3 ? await readOriginal(args[2], 128 * 1024, 'Acquisition collections') : null;
  const collectionMenuObject = collections ? JSON.parse(collections.text) : null;
  const sequences = args.length === 4 ? await readOriginal(args[3], 128 * 1024, 'Conditional sequences') : null;
  const sequenceMenuObject = sequences ? JSON.parse(sequences.text) : null;
  // Exactly one authoritative planner call; no exporter or cached result intake.
  let report;
  if (sequences) {
    const {planMechanismConditionalAcquisition} = await import('./mechanism-acquisition-conditional.js');
    report = planMechanismConditionalAcquisition(original.text, menuObject, collectionMenuObject, sequenceMenuObject);
  } else if (collections) {
    const {planMechanismAcquisitionCollections} = await import('./mechanism-acquisition-collections.js');
    report = planMechanismAcquisitionCollections(original.text, menuObject, collectionMenuObject);
  } else {
    report = planMechanismAcquisition(original.text, menuObject);
  }
  const originals = [[original, 4 * 1024 * 1024, 'Original proposal'], [menu, 128 * 1024, 'Acquisition menu']];
  if (collections) originals.push([collections, 128 * 1024, 'Acquisition collections']);
  if (sequences) originals.push([sequences, 128 * 1024, 'Conditional sequences']);
  for (const [input, limit, label] of originals) {
    const after = await readOriginal(input.path, limit, label);
    if (after.identity !== input.identity || !after.bytes.equals(input.bytes)) throw Error(`${label} changed before result publication`);
  }
  const output = {
    schema: 'experimental-earth-mechanism-acquisition-cli/1',
    inputs: {
      originalProposal: {sha256: original.sha256, bytes: original.bytes.length},
      acquisitionMenu: {sha256: menu.sha256, bytes: menu.bytes.length},
      ...(collections ? {acquisitionCollections: {sha256: collections.sha256, bytes: collections.bytes.length}} : {}),
      ...(sequences ? {conditionalSequences: {sha256: sequences.sha256, bytes: sequences.bytes.length}} : {}),
    },
    report,
  };
  // Construct the entire serialization before publishing any result bytes.
  const text = JSON.stringify(output, null, 2) + '\n';
  process.stdout.write(text);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('ACQUISITION PLANNING REFUSAL: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
