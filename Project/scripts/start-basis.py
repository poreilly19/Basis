"""Start the local app from any working directory using only Python's standard library."""
import argparse
import functools
import hashlib
import http.server
import json
from pathlib import Path
import socket
import sys
import urllib.error
import urllib.request
import webbrowser

APP = Path(__file__).resolve().parents[1] / 'app'
HOST = '127.0.0.1'
DEFAULT_PORT = 8765
HEALTH = '/.basis-launcher'


def app_identity(directory):
    path = Path(directory) / 'index.html'
    if not path.is_file():
        raise RuntimeError('The app/index.html file is missing. Extract the complete Basis ZIP, then run Start Basis from the extracted folder.')
    return hashlib.sha256(path.read_bytes()).hexdigest()


class BasisHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory, identity, **kwargs):
        self.identity = identity
        super().__init__(*args, directory=str(directory), **kwargs)

    def do_GET(self):
        if self.path == HEALTH:
            body = json.dumps({'app': 'Basis Studio', 'sha256': self.identity}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *_args):
        pass


class BasisHTTPServer(http.server.ThreadingHTTPServer):
    # Multiple listeners would make the stable browser-storage origin ambiguous.
    allow_reuse_port = False

    def server_bind(self):
        if sys.platform == 'win32':
            # Windows SO_REUSEADDR allows an occupied port to be rebound. Take
            # exclusive ownership so a second launch reaches the identity check.
            self.allow_reuse_address = False
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def existing_app(port, identity):
    # Never use a configured HTTP proxy for loopback probing.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(f'http://{HOST}:{port}{HEALTH}', timeout=2) as response:
            data = response.read(4097)
        return len(data) <= 4096 and json.loads(data) == {'app': 'Basis Studio', 'sha256': identity}
    except (OSError, ValueError, urllib.error.URLError):
        return False


def open_browser(url, enabled):
    if enabled:
        try:
            if webbrowser.open(url):
                return
        except webbrowser.Error:
            pass
        print('Open the address above in your browser.', flush=True)


def launch(directory=APP, port=DEFAULT_PORT, browser=True):
    identity = app_identity(directory)
    handler = functools.partial(BasisHandler, directory=directory, identity=identity)
    try:
        server = BasisHTTPServer((HOST, port), handler)
    except OSError as error:
        if existing_app(port, identity):
            url = f'http://{HOST}:{port}/'
            print(f'Basis is already running at {url}', flush=True)
            open_browser(url, browser)
            return 0
        raise RuntimeError(f'Port {port} is in use. Close the previous Basis server window or the program using that port, then start again. '
                           'The address has not changed, so your browser-saved models stay at the same address.') from error
    server.daemon_threads = True
    url = f'http://{HOST}:{server.server_port}/'
    print(f'Basis Studio: {url}', flush=True)
    print('Keep this window open while using Basis. Press Ctrl+C here to stop.', flush=True)
    print('Use this same browser and address to access your saved models. Download an Editable Model Backup to keep a separate copy.', flush=True)
    open_browser(url, browser)
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print('\nBasis stopped. Your saved models remain in your browser.', flush=True)
    finally:
        server.server_close()
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-browser', action='store_true', help='Print the address without opening a browser')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help='Advanced: a different port has separate browser storage')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('Port must be between 0 and 65535')
    if args.port != DEFAULT_PORT:
        print('A different port uses a different browser workspace. Import a backup if needed.', flush=True)
    try:
        return launch(port=args.port, browser=not args.no_browser)
    except (RuntimeError, OSError) as error:
        print(f'Could not open Basis: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
