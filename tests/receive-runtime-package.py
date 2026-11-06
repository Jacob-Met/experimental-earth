"""Run against an already extracted distribution; no checkout HTTP substitute.

Usage: python3 receive-package.py '/tmp/received build/Experimental Earth'
Copies the supplied tree to a new path containing spaces, starts its serve.py
from an unrelated cwd, and checks actual HTTP bytes and restart behavior.
This is package transport/launch evidence, NOT browser journey evidence.
"""
import argparse
import ast
import hashlib
import http.client
import json
from pathlib import Path
import queue
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading


def request(port, path):
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
    try:
        connection.request('GET', path)
        response = connection.getresponse()
        return response.status, response.read()
    finally:
        connection.close()


def start(root, cwd, log, port):
    process = subprocess.Popen(
        [sys.executable, '-u', str(root / 'serve.py'), '--port', str(port)],
        cwd=cwd, stdout=subprocess.PIPE, stderr=log, text=True)
    lines = queue.Queue()
    threading.Thread(target=lambda: lines.put(process.stdout.readline()), daemon=True).start()
    try:
        line = lines.get(timeout=10)
        match = re.fullmatch(r'Serving Experimental Earth at http://127\.0\.0\.1:(\d+)/\n', line)
        if not match:
            raise AssertionError('unexpected server readiness: ' + repr(line))
        return process, int(match[1])
    except BaseException:
        stop(process)
        raise


def stop(process):
    if process.poll() is None:
        process.send_signal(signal.SIGINT)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
            raise AssertionError('server required forced cleanup')
    if process.stdout:
        process.stdout.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('extracted_root', type=Path)
    parser.add_argument('--port', type=int, default=0,
                        help='0 for isolated transport test; 8765 explicitly tests documented port')
    args = parser.parse_args()
    source = args.extracted_root.resolve(strict=True)
    assert (source / 'serve.py').is_file() and (source / 'index.html').is_file()
    assert not (source / '.git').exists(), 'receive an extracted distribution, not a checkout'
    with tempfile.TemporaryDirectory(prefix='earth received ') as temporary:
        base = Path(temporary)
        root = base / 'Application with spaces'
        shutil.copytree(source, root)
        cwd = base / 'Unrelated working directory'
        cwd.mkdir()
        # Read the maintained allowlist without importing or replacing the server.
        syntax = ast.parse((root / 'serve.py').read_text())
        names = next(ast.literal_eval(node.value.args[0]) for node in syntax.body
                     if isinstance(node, ast.Assign)
                     and any(isinstance(t, ast.Name) and t.id == 'NESTED_BROWSER_ASSETS'
                             for t in node.targets))
        paths = sorted({p.name for p in root.iterdir()
                        if p.is_file() and p.suffix in ('.html', '.js', '.css')} | set(names))
        checked = []
        with (base / 'server.log').open('w+') as log:
            process, port = start(root, cwd, log, args.port)
            try:
                status, body = request(port, '/')
                assert status == 200 and body == (root / 'index.html').read_bytes()
                for name in paths:
                    status, body = request(port, '/' + name)
                    assert status == 200, (name, status)
                    assert body == (root / name).read_bytes(), name
                    checked.append(name)
                for name in ['serve.py', '.git/config', 'package.json']:
                    assert request(port, '/' + name)[0] == 404, name
            finally:
                stop(process)
            assert process.returncode == 0, process.returncode
            # Same port is intentional: confirms shutdown released the listener.
            process, restarted_port = start(root, cwd, log, port)
            try:
                assert restarted_port == port and request(port, '/')[0] == 200
            finally:
                stop(process)
            assert process.returncode == 0, process.returncode
        print(json.dumps({'status': 'passed', 'scope': 'HTTP package launch only',
                          'python': sys.version, 'port': port,
                          'cwd_independent': True, 'path_spaces': True,
                          'same_port_relaunch': True, 'checked_assets': checked,
                          'serve_sha256': hashlib.sha256((root / 'serve.py').read_bytes()).hexdigest(),
                          'browser_journey': 'not executed by this check'}, indent=2))


if __name__ == '__main__':
    main()
