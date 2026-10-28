#!/usr/bin/env python3
"""Build the private Experimental Earth runtime from a verified Git tree export.

No network, git checkout changes, application rewrites, or third-party packages.
The source commit/tree association was verified through the authorized gateway.
"""
import argparse
import ast
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import zipfile



def fail(message):
    raise ValueError(message)


def checked_bytes(root, name, entries):
    entry = entries.get(name)
    if not entry or entry.get('type') != 'blob' or entry.get('mode') != '100644':
        fail(f'Not an advertised regular source file: {name}')
    path = root
    for part in PurePosixPath(name).parts:
        path = path / part
        if path.is_symlink():
            fail(f'Symlink refused: {name}')
    if not path.is_file():
        fail(f'Missing advertised source file: {name}')
    data = path.read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if blob != entry['sha'] or len(data) != entry['size']:
        fail(f'Modified advertised source file: {name}')
    return data


def nested_assets(source):
    for node in ast.parse(source).body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'NESTED_BROWSER_ASSETS' for t in node.targets):
            value = node.value
            if not (isinstance(value, ast.Call) and isinstance(value.func, ast.Name)
                    and value.func.id == 'frozenset' and len(value.args) == 1 and not value.keywords):
                fail('Unsupported launcher asset declaration')
            result = ast.literal_eval(value.args[0])
            if not isinstance(result, set) or not all(isinstance(x, str) for x in result):
                fail('Invalid launcher asset declaration')
            return result
    fail('Launcher asset declaration missing')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--tree', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--version', required=True)
    parser.add_argument('--source-commit', required=True)
    parser.add_argument('--source-tree', required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,79}', args.version):
        fail('Version must be a simple archive-safe label')
    if not all(re.fullmatch(r'[0-9a-f]{40}', value) for value in (args.source_commit, args.source_tree)):
        fail('Source commit and tree must be verified full Git SHA-1 identities')
    tree = json.loads(args.tree.read_text())
    if tree.get('sha') != args.source_tree or tree.get('truncated') is not False:
        fail('Expected complete pinned source tree')
    entries = {}
    for entry in tree['tree']:
        name = entry['path']
        if (name.startswith('/') or '\\' in name or
                any(p in ('', '.', '..') for p in name.split('/')) or name in entries):
            fail(f'Invalid or repeated tree path: {name}')
        entries[name] = entry
    root = args.source.resolve()
    launcher = checked_bytes(root, 'serve.py', entries)
    nested = nested_assets(launcher.decode('utf-8'))
    names = {'serve.py', 'README.md', 'docs/PRODUCT_SEED.md',
             'examples/noaa-tucson-hourly/README.md',
             'examples/noaa-tucson-hourly/source-receipt.json'} | nested
    # Only first-level Markdown guides linked by the maintained user README;
    # never recursively scoop historical receiving evidence into a release.
    readme = checked_bytes(root, 'README.md', entries).decode('utf-8')
    names.update(re.findall(r'\]\((docs/[A-Za-z0-9_-]+\.md)(?:#[^)]*)?\)', readme))
    for name, entry in entries.items():
        if entry.get('type') != 'blob':
            continue
        if '/' not in name and Path(name).suffix.lower() in ('.html', '.css', '.js'):
            names.add(name)
        if name.startswith('vendor/') and (name.endswith('.md') or Path(name).name in ('LICENSE', 'NOTICE', 'COPYING')):
            names.add(name)
    payload = {name: checked_bytes(root, name, entries) for name in sorted(names)}
    if 'index.html' not in payload:
        fail('Runtime entry point missing')
    # All JS imports in the maintained source must be qualified separately in
    # browser receiving; this archive copies every top-level browser module and
    # the exact nested allowlist without pretending regex is a JS parser.
    manifest = {
        'format': 1, 'version': args.version, 'source_commit': args.source_commit,
        'source_tree': args.source_tree, 'visibility': 'private',
        'runtime': 'Python 3.9+ and a modern browser',
        'nested_browser_assets': sorted(nested),
        'qualification': 'Packaging integrity only; browser and downloaded-release receiving are separate.',
        'files': [{ 'path': name, 'bytes': len(data),
                    'git_blob_sha1': entries[name]['sha'],
                    'sha256': hashlib.sha256(data).hexdigest() }
                  for name, data in sorted(payload.items())],
    }
    template = Path(__file__).with_name('DISTRIBUTION_README.md').read_text()
    payload['START_HERE.md'] = template.replace('{{VERSION}}', args.version).replace('{{SOURCE_SHA}}', args.source_commit).encode()
    manifest['generated_files'] = [{'path': 'START_HERE.md', 'bytes': len(payload['START_HERE.md']),
                                    'sha256': hashlib.sha256(payload['START_HERE.md']).hexdigest()}]
    payload['RELEASE_MANIFEST.json'] = (json.dumps(manifest, indent=2, sort_keys=True) + '\n').encode()
    stem = 'experimental-earth-' + args.version
    args.output.mkdir(parents=True, exist_ok=True)
    destination = args.output / (stem + '.zip')
    # Exclusive creation prevents accidental replacement of an existing release.
    with destination.open('xb') as output:
        with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED) as archive:
            for name, data in sorted(payload.items()):
                info = zipfile.ZipInfo(stem + '/' + name, date_time=(1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                archive.writestr(info, data)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    checksum = destination.with_suffix('.zip.sha256')
    with checksum.open('x') as output:
        output.write(digest + '  ' + destination.name + '\n')
    print(json.dumps({'archive': str(destination), 'sha256': digest,
                      'source_commit': args.source_commit, 'source_files': len(names)}, indent=2))


if __name__ == '__main__':
    main()
