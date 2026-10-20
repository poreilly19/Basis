#!/usr/bin/env python3
"""Restore files uploaded to Box as lossless Base64 text or numbered parts.

Download and extract the complete Box folder, then run this script with Python
3.10 or newer. UPLOAD_MANIFEST.json must be beside this script. Existing files
are never overwritten; identical restored files are skipped. Encoded copies stay
in place so the upload can be verified or restored again.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile


def safe_path(base: Path, value: object) -> Path:
    if not isinstance(value, str) or not value or "\\" in value or "\0" in value:
        raise ValueError("Manifest paths must be nonempty relative paths without backslashes.")
    components = value.split("/")
    if any(part in ("", ".", "..") or ":" in part for part in components):
        raise ValueError(f"Unsafe manifest path: {value!r}")
    candidate = base.joinpath(*components)
    if not candidate.resolve().is_relative_to(base):
        raise ValueError(f"Manifest path leaves the downloaded folder: {value!r}")
    current = base
    for part in components:
        current = current / part
        if current.is_symlink():
            raise ValueError(f"Manifest paths cannot contain symbolic links: {value!r}")
    return candidate


def validate_entry(base: Path, entry: object) -> tuple[Path, Path, dict]:
    if not isinstance(entry, dict):
        raise ValueError("Every manifest file entry must be an object.")
    target = safe_path(base, entry.get("path"))
    source = safe_path(base, entry.get("stored_path"))
    if entry.get("encoding") not in ("base64", "utf-8"):
        raise ValueError(f"Unsupported encoding for {entry.get('path')!r}.")
    size = entry.get("size")
    if isinstance(size, bool) or not isinstance(size, int) or size < 0:
        raise ValueError(f"Invalid original size for {entry.get('path')!r}.")
    for field, width in (("sha256", 64), ("sha1", 40)):
        if not isinstance(entry.get(field), str) or not re.fullmatch("[0-9a-f]{" + str(width) + "}", entry[field]):
            raise ValueError(f"Invalid {field} for {entry.get('path')!r}.")
    if entry["encoding"] == "base64" and source == target:
        raise ValueError("A Base64 source cannot also be its restored destination.")
    if "parts" in entry:
        parts = entry["parts"]
        if entry["encoding"] != "base64" or not isinstance(parts, list) or not parts:
            raise ValueError("Numbered parts require a nonempty Base64 parts list.")
        paths = []
        for part in parts:
            if not isinstance(part, dict):
                raise ValueError("Every numbered part must be an object.")
            part_path = safe_path(base, part.get("path"))
            part_size, part_hash = part.get("size"), part.get("sha1")
            if isinstance(part_size, bool) or not isinstance(part_size, int) or part_size < 0:
                raise ValueError(f"Invalid numbered-part size for {part.get('path')!r}.")
            if not isinstance(part_hash, str) or not re.fullmatch("[0-9a-f]{40}", part_hash):
                raise ValueError(f"Invalid numbered-part SHA-1 for {part.get('path')!r}.")
            if part_path == target:
                raise ValueError("A numbered part cannot also be its restored destination.")
            paths.append(part_path)
        if len(paths) != len(set(paths)):
            raise ValueError("A file's numbered-part paths must be distinct.")
        if entry["stored_path"] != parts[0]["path"]:
            raise ValueError("The stored path must identify the first numbered part.")
    return target, source, entry


def encoded_bytes(base: Path, source: Path, entry: dict) -> bytes:
    if "parts" not in entry:
        return source.read_bytes()
    payloads = []
    for part in entry["parts"]:
        payload = safe_path(base, part["path"]).read_bytes()
        if len(payload) != part["size"] or hashlib.sha1(payload).hexdigest() != part["sha1"]:
            raise ValueError(f"Numbered-part size or checksum mismatch for {part['path']!r}; no files were restored.")
        payloads.append(payload)
    return b"".join(payloads)


def matches(path: Path, data: bytes) -> bool:
    return path.is_file() and path.stat().st_size == len(data) and path.read_bytes() == data


def publish_new(path: Path, data: bytes) -> bool:
    """Publish a complete file atomically, without replacing any existing path."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix=".basis-restore-", dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            # Hard-link creation is exclusive: an existing destination is never
            # replaced, including one created after the preflight check.
            os.link(temporary, path)
        except FileExistsError:
            if not path.is_symlink() and matches(path, data):
                return False
            raise FileExistsError(f"Refusing to overwrite existing file: {path}") from None
        return True
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def restore_archives(directory: Path) -> tuple[int, int]:
    base = directory.resolve()
    manifest_path = safe_path(base, "UPLOAD_MANIFEST.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 1 or not isinstance(manifest.get("files"), list):
        raise ValueError("UPLOAD_MANIFEST.json is not a supported version-1 manifest.")
    entries = [validate_entry(base, entry) for entry in manifest["files"]]
    targets = [target for target, _, _ in entries]
    if len(targets) != len(set(targets)):
        raise ValueError("The manifest contains duplicate original file paths.")

    # Verify every encoded payload and existing destination before creating any
    # output, so a damaged payload cannot partially restore this batch.
    plans = []
    skipped = 0
    for target, source, entry in entries:
        if entry["encoding"] != "base64":
            continue
        payload = encoded_bytes(base, source, entry)
        try:
            data = base64.b64decode(b"".join(payload.split()), validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError(f"Invalid Base64 content in {entry['stored_path']!r}.") from error
        if len(data) != entry["size"] or hashlib.sha256(data).hexdigest() != entry["sha256"] or hashlib.sha1(data).hexdigest() != entry["sha1"]:
            raise ValueError(f"Size or checksum mismatch for {entry['path']!r}; no files were restored.")
        if target.exists():
            if matches(target, data):
                skipped += 1
                continue
            raise FileExistsError(f"Refusing to overwrite existing file: {entry['path']}")
        plans.append((target, data))

    restored = 0
    for target, data in plans:
        # Recheck path ownership after creating earlier output directories.
        safe_path(base, target.relative_to(base).as_posix())
        if publish_new(target, data):
            restored += 1
        else:
            skipped += 1
    return restored, skipped


def main() -> int:
    try:
        restored, skipped = restore_archives(Path(__file__).resolve().parent)
    except (OSError, ValueError, TypeError) as error:
        print(f"Restore stopped: {error}", file=sys.stderr)
        return 1
    print(f"Restored {restored} encoded file(s); skipped {skipped} identical file(s). Encoded copies and parts were kept.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
