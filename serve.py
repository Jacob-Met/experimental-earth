"""Serve the local Experimental Earth workbench, not the source checkout.

Only top-level browser HTML/CSS/JS is intentionally published. This is not an
API, documentation server, or a way to serve saved investigations.
"""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import shutil
import stat
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.mjs': 'text/javascript', '.json': 'application/json',
    '.txt': 'text/plain', '.md': 'text/markdown',
}
# These named modules and nested files serve the maintained browser experience.
# Keep this exported set name for the existing package builder.
# Other research, original projects, tests, documentation and vendor internals
# remain outside the served surface.
NESTED_BROWSER_ASSETS = frozenset({
    'event-graph.mjs',
    'fill-event-graph.mjs',
    'crest-event-graph.mjs',
    'vendor/chronos/exact-halfplanes.mjs',
    'vendor/worldlaw-linear-fit.mjs',
    'vendor/suncalc/index.js',
    'research/usda-er2-rate-comparison.json',
    'examples/noaa-tucson-hourly/tucson-hourly-excerpt.txt',
    'docs/SOIL_BAND_FEASIBILITY.md',
    'docs/SOIL_PARAMETER_REFINEMENT.md',
})


def open_browser_asset(name):
    """Open a pinned regular-file candidate without traversing symlink parents."""
    parts = name.split('/')
    flags = (os.O_RDONLY | getattr(os, 'O_NONBLOCK', 0)
             | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_CLOEXEC', 0))
    if os.open in os.supports_dir_fd and hasattr(os, 'O_NOFOLLOW'):
        directory_flags = (os.O_RDONLY | getattr(os, 'O_DIRECTORY', 0)
                           | os.O_NOFOLLOW | getattr(os, 'O_CLOEXEC', 0))
        base_fd = os.open(ROOT, directory_flags)
        current_fd = base_fd
        try:
            for segment in parts[:-1]:
                following_fd = os.open(segment, directory_flags, dir_fd=current_fd)
                if current_fd != base_fd:
                    os.close(current_fd)
                current_fd = following_fd
            return os.open(parts[-1], flags, dir_fd=current_fd)
        finally:
            if current_fd != base_fd:
                os.close(current_fd)
            os.close(base_fd)
    # Platforms without descriptor-relative no-follow opening still reject
    # symlinks in the observed path, but concurrent replacement is unqualified.
    current = ROOT
    for segment in parts:
        current = current / segment
        if current.is_symlink():
            raise OSError('symbolic link in browser asset')
    return os.open(current, flags)



class WorkbenchHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._serve(send_body=True)

    def do_HEAD(self):
        self._serve(send_body=False)

    def do_POST(self):
        self._method_not_allowed()

    def do_OPTIONS(self):
        self._method_not_allowed()

    def do_PUT(self):
        self._method_not_allowed()

    def do_DELETE(self):
        self._method_not_allowed()

    def _method_not_allowed(self):
        self.send_response(405)
        self.send_header('Allow', 'GET, HEAD')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def _local_origin(self, origin):
        try:
            parts = urlsplit(origin)
            return (parts.scheme == 'http' and parts.hostname in ('localhost', '127.0.0.1')
                    and parts.port == self.server.server_port and not parts.username
                    and not parts.password and parts.path in ('', '/')
                    and not parts.query and not parts.fragment)
        except ValueError:
            return False

    def _admitted_caller(self):
        # A localhost bind by itself does not protect against DNS rebinding.
        hosts = self.headers.get_all('Host', [])
        if len(hosts) != 1 or hosts[0].lower() not in (
            f'127.0.0.1:{self.server.server_port}',
            f'localhost:{self.server.server_port}',
        ):
            return False
        origins = self.headers.get_all('Origin', [])
        return len(origins) <= 1 and (not origins or self._local_origin(origins[0]))

    def _serve(self, send_body):
        if not self._admitted_caller():
            self.send_error(403)
            return
        parsed = urlsplit(self.path)
        if parsed.scheme or parsed.netloc:
            self.send_error(404)
            return
        try:
            name = unquote(parsed.path, errors='strict').removeprefix('/')
        except UnicodeDecodeError:
            self.send_error(404)
            return
        if name == '':
            name = 'index.html'
        # No directory browsing or arbitrary documents. Named modules and nested
        # assets are explicit rather than granting suffixes or directories.
        if (name.startswith('.') or '\\' in name or '\x00' in name or
                (('/' in name or Path(name).suffix.lower() not in ('.html', '.js', '.css'))
                 and name not in NESTED_BROWSER_ASSETS)):
            self.send_error(404)
            return
        try:
            fd = open_browser_asset(name)
            information = os.fstat(fd)
            if not stat.S_ISREG(information.st_mode):
                os.close(fd)
                raise OSError('not an ordinary browser asset')
        except (OSError, ValueError):
            self.send_error(404)
            return
        with os.fdopen(fd, 'rb') as source:
            self.send_response(200)
            self.send_header('Content-Type', f'{MIME[Path(name).suffix.lower()]}; charset=utf-8')
            self.send_header('Content-Length', str(information.st_size))
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            if send_body:
                try:
                    shutil.copyfileobj(source, self.wfile)
                except (BrokenPipeError, ConnectionResetError):
                    pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765, help='local port (default: 8765; 0 selects an unused port)')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('port must be between 0 and 65535')
    with ThreadingHTTPServer(('127.0.0.1', args.port), WorkbenchHandler) as server:
        print(f'Serving Experimental Earth at http://127.0.0.1:{server.server_port}/', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
