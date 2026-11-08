#!/usr/bin/env node
/** Original-file receipt adapter; scientific admission belongs to the receiver. */
import {open, lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {receiveMechanismAcquisition} from './mechanism-acquisition-receive.js';

const USAGE = 'Usage: node receive-mechanism-acquisition.mjs original-proposal.json acquisition-menu.json received-readings.json output-original.json [acquisition-collections.json]';
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
  if (![4, 5].includes(args.length) || args.some(arg => !arg || arg.startsWith('--'))) throw Error(USAGE);
  if (!['linux', 'darwin'].includes(process.platform)) throw Error('Original-file admission currently supports Linux and macOS');
  const original = await readOriginal(args[0], 4 * 1024 * 1024, 'Original proposal');
  const menu = await readOriginal(args[1], 128 * 1024, 'Acquisition menu');
  const receipt = await readOriginal(args[2], 64 * 1024, 'Received readings');
  const collections = args.length === 5 ? await readOriginal(args[4], 128 * 1024, 'Acquisition collections') : null;
  const outputPath = resolve(args[3]);
  // Fail existing destinations before inference; exclusive creation below also
  // protects against an entry appearing after this check, including symlinks.
  try {
    await lstat(outputPath);
    throw Error('Output original already exists; it will not be replaced');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const originals = [[original, 4 * 1024 * 1024, 'Original proposal'], [menu, 128 * 1024, 'Acquisition menu'], [receipt, 64 * 1024, 'Received readings']];
  if (collections) originals.push([collections, 128 * 1024, 'Acquisition collections']);
  const verifyOriginals = async () => {
    for (const [input, limit, label] of originals) {
      const after = await readOriginal(input.path, limit, label);
      if (after.identity !== input.identity || !after.bytes.equals(input.bytes)) throw Error(`${label} changed before result publication`);
    }
  };
  // Exactly one authoritative receiver call. No cached inference or export rerun.
  const {receivedOriginalText, report} = receiveMechanismAcquisition(original.text, menu.text, JSON.parse(receipt.text), collections ? collections.text : null);
  if (typeof receivedOriginalText !== 'string') throw Error('Receiver did not return original text');
  const outputBytes = Buffer.from(receivedOriginalText, 'utf8');
  if (!outputBytes.length || outputBytes.length > 4 * 1024 * 1024 || new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(outputBytes) !== receivedOriginalText || receivedOriginalText.charCodeAt(0) === 0xfeff) throw Error('Received original requires exact UTF-8 without a BOM, at most 4MiB');
  const fileIdentity = input => ({sha256: input.sha256, bytes: input.bytes.length});
  const envelope = {
    schema: 'experimental-earth-mechanism-acquisition-receive-cli/1',
    inputs: {
      originalProposal: fileIdentity(original),
      acquisitionMenu: fileIdentity(menu),
      receivedReadings: fileIdentity(receipt),
      ...(collections ? {acquisitionCollections: fileIdentity(collections)} : {}),
    },
    outputOriginal: {sha256: digest(outputBytes), bytes: outputBytes.length},
    report,
  };
  // Complete both serializations before any output file or stdout is published.
  const stdout = JSON.stringify(envelope, null, 2) + '\n';
  await verifyOriginals();
  let handle;
  try {
    handle = await open(outputPath, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const created = await handle.stat({bigint: true});
    await handle.writeFile(outputBytes);
    await handle.sync();
    const written = await readOriginal(outputPath, 4 * 1024 * 1024, 'Output original');
    const current = await handle.stat({bigint: true});
    if (created.dev !== current.dev || created.ino !== current.ino || written.identity !== identity(current) || !written.bytes.equals(outputBytes) || written.sha256 !== envelope.outputOriginal.sha256) throw Error('Output original readback or identity mismatch');
    await verifyOriginals();
    if (identity(await lstat(outputPath, {bigint: true})) !== written.identity) throw Error('Output original changed before result publication');
    await handle.close();
    handle = null;
  } catch (error) {
    // Never unlink by pathname: another actor may have replaced our file.
    // A failed output is retained for inspection and must not be treated as PASS.
    if (handle) {
      await handle.close().catch(() => {});
      throw Error(`${error.message}; output was created and is retained (possibly partial); no result published`);
    }
    throw error;
  }
  process.stdout.write(stdout);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('RECEIVE REFUSAL: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
