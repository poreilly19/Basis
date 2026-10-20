"""Read hash-pinned optional runtime fixtures; never fetch missing dependencies."""
import hashlib
import json
import os
from pathlib import Path
import re


def load_runtime_dependencies():
    """Return manifest URL -> verified bytes from BASIS_DEPENDENCY_DIR.

    An explicitly requested smoke run fails for missing or altered files. The
    callers decide whether to skip an optional run when the variable is unset.
    Validation happens before launching Chromium or fulfilling any requests.
    """
    location = os.environ.get('BASIS_DEPENDENCY_DIR')
    if not location:
        raise RuntimeError('Set BASIS_DEPENDENCY_DIR to the audited runtime artifact directory')
    directory = Path(location).resolve()
    if not directory.is_dir():
        raise RuntimeError(f'BASIS_DEPENDENCY_DIR is not a directory: {directory}')
    manifest_path = Path(__file__).parent / 'fixtures/runtime_dependencies.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest.get('schemaVersion') != 1 or not isinstance(manifest.get('artifacts'), list) or not manifest['artifacts']:
        raise RuntimeError(f'Invalid runtime dependency manifest: {manifest_path}')
    verified, names = {}, set()
    for artifact in manifest['artifacts']:
        name, url, size, digest = (artifact.get(key) for key in ('file', 'url', 'size', 'sha256'))
        if (not isinstance(name, str) or Path(name).name != name or name in ('', '.', '..')
                or name in names or not isinstance(url, str) or not url.startswith('https://')
                or url in verified or type(size) is not int or size < 1
                or not isinstance(digest, str) or not re.fullmatch('[0-9a-f]{64}', digest)):
            raise RuntimeError(f'Invalid runtime dependency artifact: {artifact!r}')
        source = (directory / name).resolve()
        if source.parent != directory or not source.is_file():
            raise RuntimeError(f'Missing runtime dependency artifact: {directory / name}')
        actual_size = source.stat().st_size
        if actual_size != size:
            raise RuntimeError(f'Runtime dependency size mismatch for {name}: expected {size}, got {actual_size}')
        data = source.read_bytes()
        actual_digest = hashlib.sha256(data).hexdigest()
        if len(data) != size or actual_digest != digest:
            raise RuntimeError(f'Runtime dependency SHA-256 mismatch for {name}: expected {digest}, got {actual_digest}')
        names.add(name)
        verified[url] = data
    return verified
