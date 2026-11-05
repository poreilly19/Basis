"""Prepare the fixed, tested 0.7.30 release assets without network access.

Inputs are the pinned Git checkout, its generated web bundle, and the downloaded
native CI artifact. No credentials, uploads, archive extraction, or execution of
downloaded native files are used by this utility.
"""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import tempfile
import tomllib
import zipfile


COMMIT = '351120ae97fd6e769f015eb14c5e341e0d363ad7'
VERSION = '0.7.30'
APP_SHA = 'b33bd65d5d3fa9311f1db7817754190905e4798cb4a028aa62cd9ec4d20deb77'
INSTALLER_SHA = 'c453bfcfeb0a8de5cb89a0c0a45ce7c1b58b10d0539ac46809340befb3002fb0'
INSTALLER = 'Basis-Studio-0.7.30-Windows-x64-Setup.exe'
NATIVE_INSTALLER = 'Basis Studio_0.7.30_x64-setup.exe'
PREFIX = 'Basis_Studio_v7_30'
SOURCES = {
    ('cssparser', '0.37.0'), ('cssparser-macros', '0.7.1'),
    ('dtoa-short', '0.3.5'), ('option-ext', '0.2.0'), ('selectors', '0.38.0'),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode('utf-8')


def safe_name(name):
    require(isinstance(name, str) and name and '\\' not in name and ':' not in name
            and not any(ord(char) < 32 for char in name), 'Unsafe archive path')
    path = PurePosixPath(name)
    require(not path.is_absolute() and all(piece not in ('', '.', '..')
                                         for piece in name.rstrip('/').split('/')),
            'Unsafe archive path: ' + name)
    return name


def read_file(root, name, limit=16 * 1024 * 1024):
    safe_name(name)
    root = root.resolve()
    filename = root.joinpath(*PurePosixPath(name).parts)
    require(filename.resolve().is_relative_to(root), 'Input escapes its declared root')
    require(not filename.is_symlink() and filename.is_file(), 'Missing regular input: ' + name)
    require(filename.stat().st_size <= limit, 'Input exceeds its size limit: ' + name)
    data = filename.read_bytes()
    require(len(data) <= limit, 'Input grew beyond its size limit: ' + name)
    return data


def git(source, *arguments):
    return subprocess.run(['git', '-C', str(source), *arguments], check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout


def git_file(source, name):
    safe_name(name)
    return git(source, 'show', COMMIT + ':' + name)


def check_record(data, record, label):
    require(isinstance(record, dict) and type(record.get('bytes')) is int
            and record['bytes'] == len(data) and record.get('sha256') == digest(data),
            'Size/hash mismatch: ' + label)


def zip_bytes(entries):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED,
                         compresslevel=9) as archive:
        for name, data in sorted(entries.items()):
            safe_name(name)
            info = zipfile.ZipInfo(name, (2026, 11, 5, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED,
                             compresslevel=9)
    return output.getvalue()


def check_zip(data, prefix=None):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members = archive.infolist()
        require(len(members) <= 10000 and len({item.filename for item in members}) == len(members),
                'Duplicate or excessive ZIP members')
        require(sum(item.file_size for item in members) <= 128 * 1024 * 1024,
                'ZIP expanded size exceeds the release limit')
        for item in members:
            safe_name(item.filename)
            require(not stat.S_ISLNK(item.external_attr >> 16), 'ZIP links are not permitted')
            require(prefix is None or item.filename.startswith(prefix), 'Unexpected source archive prefix')
        require(archive.testzip() is None, 'ZIP CRC verification failed')
        return len(members)


def expected_web(source, app):
    copies = {
        'docs/BETA_404.html': '404.html', 'docs/BETA_PRIVACY.html': 'privacy.html',
        'docs/BETA_LIMITATIONS.html': 'limitations.html', 'LICENSE': 'LICENSE.txt',
        'docs/THIRD_PARTY_NOTICES.md': 'THIRD_PARTY_NOTICES.txt',
        'docs/third_party/SHEETJS_LICENSE_0_20_3.txt': 'third_party/SHEETJS_LICENSE_0_20_3.txt',
        'docs/third_party/PDFJS_LICENSE_4_10_38.txt': 'third_party/PDFJS_LICENSE_4_10_38.txt',
    }
    files = {'index.html': app}
    for origin, target in copies.items():
        files[target] = git_file(source, 'Project/' + origin)
    hashes = []
    for match in re.finditer(r'<script\b([^>]*)>([\s\S]*?)</script\s*>', app.decode('utf-8'), re.I):
        require(not re.search(r'\bsrc\s*=', match[1], re.I), 'Unexpected external application script')
        if re.search(r'type=["\']application/x-basis-worker["\']', match[1], re.I):
            continue
        hashes.append("'sha256-" + base64.b64encode(hashlib.sha256(match[2].encode('utf-8')).digest()).decode() + "'")
    require(len(hashes) == 3, 'Unexpected executable script inventory')
    headers = {
        'Content-Security-Policy': '; '.join([
            "default-src 'none'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'none'",
            'script-src ' + ' '.join(hashes) + " blob: https://cdn.sheetjs.com 'wasm-unsafe-eval'",
            "style-src 'self' 'unsafe-inline'", "img-src 'self' blob: data:", "font-src 'self'", "worker-src 'self' blob:",
            "connect-src 'self' https://cdnjs.cloudflare.com https://api.openai.com https://api.anthropic.com", "manifest-src 'self'",
        ]),
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()', 'Cache-Control': 'no-store',
    }
    files['headers.json'] = json_bytes(headers)
    files['_headers'] = ('/*\n' + '\n'.join('  ' + name + ': ' + value for name, value in headers.items()) + '\n').encode()
    runtime = json.loads(git_file(source, 'Project/tests/fixtures/runtime_dependencies.json'))
    files['runtime-inventory.json'] = json_bytes({
        'scope': 'Direct optional runtime artifacts; not a complete transitive SBOM',
        'artifacts': [item for item in runtime['artifacts'] if item.get('purpose') != 'compatibility-reference-only'],
    })
    return files


def prepare(source, native, output):
    source, native, output = source.resolve(), native.resolve(), output.absolute()
    require(git(source, 'rev-parse', 'HEAD').decode().strip() == COMMIT, 'Source HEAD is not the pinned release commit')
    require(not git(source, 'diff', '--name-only', COMMIT, '--', 'Project'), 'Tracked Project source has uncommitted changes')
    package = json.loads(git_file(source, 'Project/package.json'))
    require(package['version'] == VERSION and package['license'] == 'MIT', 'Unexpected source version/license')
    app = git_file(source, 'Project/app/index.html')
    require(digest(app) == APP_SHA, 'The shared application does not match its tested hash')
    license_bytes = git_file(source, 'Project/LICENSE')
    require(license_bytes == git_file(source, 'LICENSE'), 'Root and portable MIT licenses differ')
    require(not output.is_symlink() and (not output.exists() or (output.is_dir() and not any(output.iterdir()))),
            'Output must be absent or an empty regular directory; existing assets are never replaced')

    native_root = 'desktop/src-tauri/'
    installer = read_file(native, native_root + 'target/release/bundle/nsis/' + NATIVE_INSTALLER)
    require(digest(installer) == INSTALLER_SHA, 'The installer does not match the tested Windows artifact')
    original_sum = read_file(native, native_root + 'target/release/bundle/nsis/' + NATIVE_INSTALLER + '.sha256', 4096).decode('utf-8-sig').strip().split(None, 1)
    require(len(original_sum) == 2 and original_sum[0].lower() == INSTALLER_SHA
            and original_sum[1].lstrip('*') == NATIVE_INSTALLER, 'Native installer checksum sidecar is invalid')
    desktop_raw = read_file(native, 'dist/basis-desktop/desktop-release.json', 1024 * 1024)
    desktop = json.loads(desktop_raw)
    require(desktop.get('generator') == 'basis-desktop-static-v1' and desktop.get('version') == VERSION
            and desktop.get('appSha256') == APP_SHA and desktop.get('nativeNoticesIncluded') is True,
            'Native embedded application/inventory does not match the release')
    check_record(app, desktop['files']['index.html'], 'native application')

    generated = native_root + 'generated/'
    notices = read_file(native, generated + 'NATIVE_THIRD_PARTY_NOTICES.txt')
    inventory_raw = read_file(native, generated + 'native-license-inventory.json')
    inventory = json.loads(inventory_raw)
    require(inventory.get('schemaVersion') == 1 and inventory.get('packageCount') == 303
            and isinstance(inventory.get('packages'), list) and len(inventory['packages']) == 303
            and inventory.get('noticeSha256') == digest(notices), 'Native package/notice inventory is invalid')
    require(len({(item['name'], item['version'], item.get('source')) for item in inventory['packages']}) == 303,
            'Native package inventory has duplicate identities')
    supplement = {
        'LICENSE.txt': license_bytes, 'NATIVE_THIRD_PARTY_NOTICES.txt': notices,
        'native-license-inventory.json': inventory_raw,
        'THIRD_PARTY_NOTICES.txt': git_file(source, 'Project/docs/THIRD_PARTY_NOTICES.md'),
        'third_party/MPL_2_0.txt': git_file(source, 'Project/docs/third_party/MPL_2_0.txt'),
        'third_party/PDFJS_LICENSE_4_10_38.txt': git_file(source, 'Project/docs/third_party/PDFJS_LICENSE_4_10_38.txt'),
        'third_party/SHEETJS_LICENSE_0_20_3.txt': git_file(source, 'Project/docs/third_party/SHEETJS_LICENSE_0_20_3.txt'),
        'README.txt': (f'Basis Studio {VERSION} third-party notices and source supplements.\n'
                       'The native inventory is a Cargo package superset, including build/platform dependencies; not a complete SBOM.\n'
                       'The five unmodified MPL source archives match Cargo.lock checksums.\n'
                       'The Basis application is MIT-licensed; dependencies retain their individual licenses.\n').encode(),
    }
    for name, data in [('NATIVE_THIRD_PARTY_NOTICES.txt', notices), ('native-license-inventory.json', inventory_raw)]:
        check_record(data, desktop['files'][name], name)
    archives = inventory.get('sourceArchives')
    require(isinstance(archives, list) and len(archives) == 5, 'Expected five native source archives')
    lock = tomllib.loads(git_file(source, 'Project/desktop/src-tauri/Cargo.lock').decode())
    checksums = {(item['name'], item['version']): item.get('checksum') for item in lock['package']}
    expected_sources = {'native-sources/' + name + '-' + version + '.crate': (name, version) for name, version in SOURCES}
    require({item.get('path') for item in archives} == set(expected_sources), 'Unexpected native source archive set')
    for record in archives:
        name = record['path']
        data = read_file(native, generated + name)
        check_record(data, record, name)
        require(digest(data) == checksums[expected_sources[name]], 'Source archive differs from trusted Cargo.lock: ' + name)
        check_record(data, desktop['files'][name], 'embedded ' + name)
        supplement[name] = data
    reviewed = [item for item in inventory['packages'] if item.get('requiresSourceAvailabilityReview')]
    require({(item['name'], item['version']) for item in reviewed} == SOURCES, 'Unexpected source-availability package set')
    for item in reviewed:
        record = item.get('sourceArchive')
        require(record in archives, 'A native package lacks its exact source supplement')

    web_root = source / 'Project/dist/basis-beta'
    web = expected_web(source, app)
    release_raw = read_file(web_root, 'release.json', 1024 * 1024)
    release = json.loads(release_raw)
    require(release.get('generator') == 'basis-beta-static-v1' and release.get('version') == VERSION
            and release.get('appSha256') == APP_SHA and set(release.get('files', {})) == set(web),
            'Web release inventory is invalid')
    for name, expected in web.items():
        require(read_file(web_root, name) == expected, 'Web bytes differ from trusted source: ' + name)
        check_record(expected, release['files'][name], 'web ' + name)
    require({item.relative_to(web_root).as_posix() for item in web_root.rglob('*') if item.is_file()} == set(web) | {'release.json'},
            'Web output contains undeclared files')
    web['release.json'] = release_raw
    require(len(web) == 12 and len(supplement) == 13, 'Unexpected distribution file counts')

    source_zip = git(source, 'archive', '--format=zip', '--prefix=' + PREFIX + '/', COMMIT + ':Project')
    source_members = check_zip(source_zip, PREFIX + '/')
    files = {
        INSTALLER: installer, INSTALLER + '.sha256': (INSTALLER_SHA + '  ' + INSTALLER + '\n').encode(),
        PREFIX + '_Source.zip': source_zip, PREFIX + '_Web_Deployment.zip': zip_bytes(web),
        PREFIX + '_Third_Party_Notices_and_Sources.zip': zip_bytes(supplement), PREFIX + '_App.html': app,
        PREFIX + '_Desktop_Release_Notes.md': git_file(source, 'Project/docs/DESKTOP_RELEASE_0_7_30.md'),
    }
    for name in [PREFIX + '_Web_Deployment.zip', PREFIX + '_Third_Party_Notices_and_Sources.zip']:
        check_zip(files[name])
    verification = {
        'version': VERSION, 'channel': 'desktop-beta.1', 'sourceCommit': COMMIT,
        'nativeRuntimeCommit': 'a6dfcf8e45299c8832f7b2c92da3035cc680f76f',
        'sharedWebValidationCommit': 'fb3a87e41b1071f91bf7c059f43f15ec1ddefbaa', 'appSha256': APP_SHA,
        'nativeRuntimeInputsUnchangedSinceTestedBuild': True,
        'nativeWorkflow': 'https://github.com/poreilly19/Basis/actions/runs/42063543855',
        'webWorkflow': 'https://github.com/poreilly19/Basis/actions/runs/42064899671',
        'tests': {'windowsRust': 11, 'installedDesktop': 8, 'browser': 219, 'actualLibrary': 18,
                  'offlineDesktopBundle': 5, 'hostedWebJobs': 9},
        'desktopNativePackages': 303, 'includedMplSources': 5, 'nativeSchemaVersion': 1,
        'license': 'MIT; dependencies retain their licenses',
        'nativeArtifactManifestSha256': digest(desktop_raw), 'nativeNoticesSha256': digest(notices),
        'archiveMembers': {'source': source_members, 'web': len(web), 'thirdParty': len(supplement)},
        'packages': {name: {'bytes': len(data), 'sha256': digest(data)} for name, data in files.items()},
    }
    files[PREFIX + '_Package_Verification.json'] = json_bytes(verification)
    files[PREFIX + '_SHA256.txt'] = ''.join(digest(data) + '  ' + name + '\n' for name, data in files.items()).encode()
    require(len(files) == 9, 'Expected exactly nine release assets')
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.basis-release-', dir=output.parent))
    try:
        for name, data in files.items():
            safe_name(name)
            with (staging / name).open('xb') as stream:
                stream.write(data)
        if output.exists():
            require(not output.is_symlink() and output.is_dir() and not any(output.iterdir()), 'Output changed during preparation')
            output.rmdir()
        staging.rename(output)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return {'sourceCommit': COMMIT, 'appSha256': APP_SHA, 'output': str(output), 'assetCount': len(files),
            'assets': {name: {'bytes': len(data), 'sha256': digest(data)} for name, data in files.items()}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--native', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(prepare(args.source, args.native, args.output), indent=2))


if __name__ == '__main__':
    main()
