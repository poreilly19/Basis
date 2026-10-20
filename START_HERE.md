# Basis Studio reviewed files — v7.9

Project/ contains every file from the reviewed v7.9 handoff. Start with Project/README.md and Project/docs/CODE_REVIEW.md. Releases/ contains every reviewed ZIP, patch and checksum file produced in this conversation, including earlier versions.

This Box session exposes text uploads only and caps each upload request at 1 MB. Binary ZIP/native sample files and oversized source/patch files are stored as lossless Base64 text, sometimes split into numbered parts. Files ending in `.base64.txt` or `.base64.partNNN.txt` are encoded copies, not directly openable originals. Other files retain their original bytes and names.

To restore all original files, download this whole Box folder, extract it and run `python3 RESTORE_ARCHIVES.py` (Windows: `py RESTORE_ARCHIVES.py`). The script verifies every encoded payload and reconstructed file against UPLOAD_MANIFEST.json, preserves existing different files and keeps the encoded copies. Original filenames are restored next to those copies. No runtime dependencies or credentials are included.

The latest release is Releases/Basis_Studio_v7_9_Reviewed.zip after restoration. Its SHA-256 is d22989c52b31e52827bb01c7dd557f5373673749d72364acd429fa057e078db0. Validation passed 599 Node cases, 13 runner cases, 76 ordinary browser workflows and 17 real-runtime workflows. The financial engine is unchanged from v7.8.

The full import/release limitations and next steps are documented in the project. This upload changes no Box sharing settings.
