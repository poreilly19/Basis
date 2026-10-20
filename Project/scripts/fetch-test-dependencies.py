"""Fetch the exact public artifacts used only by optional integration tests.

Usage: python3 scripts/fetch-test-dependencies.py /path/to/test-cache
Runtime library bytes are never copied into the distributable application.
"""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import urllib.request


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 scripts/fetch-test-dependencies.py CACHE_DIRECTORY')
    destination = Path(sys.argv[1]).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((Path(__file__).resolve().parents[1] /
                           'tests/fixtures/runtime_dependencies.json').read_text())
    for artifact in manifest['artifacts']:
        name, size, expected = (artifact[key] for key in ('file', 'size', 'sha256'))
        if Path(name).name != name or name in ('', '.', '..'):
            raise RuntimeError('Invalid artifact filename')
        target = destination / name
        if target.exists():
            if target.stat().st_size != size or hashlib.sha256(target.read_bytes()).hexdigest() != expected:
                raise RuntimeError(f'Existing cache file does not match the manifest: {target}')
            print(f'Verified cached {name}')
            continue
        request = urllib.request.Request(artifact['url'], headers={'User-Agent': 'Basis-local-integration-tests/0.7.7'})
        with urllib.request.urlopen(request, timeout=20) as response:
            data = response.read(size + 1)
        if len(data) != size or hashlib.sha256(data).hexdigest() != expected:
            raise RuntimeError(f'Public artifact does not match the recorded size/SHA-256: {name}')
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(prefix='.basis-test-', dir=destination, delete=False) as output:
                temporary = Path(output.name)
                output.write(data)
            temporary.replace(target)
            temporary = None
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
        print(f'Fetched and verified {name}')


if __name__ == '__main__':
    main()
