# Basis Studio 0.7.30 desktop beta

Basis now has a Windows desktop edition alongside the maintained web application.
Both use the same interface, financial engine and schema-v1 `.basiscre` files.
The underwriting engine is unchanged from the corrected 0.7.29 application.

- [Windows installer and source downloads](https://github.com/poreilly19/Basis/releases/tag/v0.7.30-desktop-beta.1)
- [Hosted web application](https://basis.pjoreilly19.workers.dev/)
- [Installation, model transfer, backups and developer builds](DESKTOP.md)

## Desktop behavior

The Windows edition adds atomic local library saves, ten rolling backups,
native Save As dialogs, bundled PDF/Excel libraries and optional Windows
Credential Manager storage. AI requests use a fixed-provider native transport;
keys remain separate from models, backups and support exports.

Closing commits the focused editor, validates its text and saves the current
property. Invalid text remains available for correction. Controls are locked
during the final save; a save failure restores interaction and retains the
window. Periodic Autosave and save-on-close are explained separately in Settings.

Web and desktop libraries remain separate. Transfer each portfolio using an
editable `.basiscre` backup. Desktop does not add cloud synchronization or use the
website's Cloudflare Access login. Neither version requires a paid hosting plan.

## Tested Windows installer

The installer was built, silently installed into a directory containing spaces,
and exercised as an actual installed application in
[native CI run 42063543855](https://github.com/poreilly19/Basis/actions/runs/42063543855).
Its runtime source is commit `a6dfcf8e45299c8832f7b2c92da3035cc680f76f`.
Subsequent browser-tooling and documentation changes do not alter those runtime
inputs.

All **11 Windows Rust tests** and **8 installed-application checks** passed:

1. Secure local origin and the native storage backend.
2. Saved model edits surviving a complete process restart.
3. Native archive round trip and an independent $1,200 annual expense case,
   with the actual background worker producing the expected -$1,200 NOI.
4. Bundled Excel read/write and decimal precision.
5. Bundled PDF text extraction and a real dedicated PDF worker.
6. Manual backup creation and inventory.
7. Windows Credential Manager store/status/delete with a fake test key.
8. Real unblurred City keystrokes, window close, process exit and independent
   verification of the saved model and index.

The installer is **unsigned**. Windows may show an unknown-publisher or
SmartScreen warning. The installer may download WebView2 if it is missing.
No live AI-provider request or paid API call was made by these tests.

```
Installer: Basis-Studio-0.7.30-Windows-x64-Setup.exe
SHA-256: c453bfcfeb0a8de5cb89a0c0a45ce7c1b58b10d0539ac46809340befb3002fb0

Shared application SHA-256:
b33bd65d5d3fa9311f1db7817754190905e4798cb4a028aa62cd9ec4d20deb77
```

## Shared application verification

The complete Node regression command passed. Playwright 1.64.1 / Chromium 156
passed **219 browser cases** and **18 real-library integrations** with the same
application bytes before and after. Five additional desktop-bundle cases passed
with external networking blocked, including real PDF rendering/cleanup, Excel
round trips and failed-integrity/retry behavior.

The Chromium, Firefox and WebKit six-case deployment suites passed locally with
the updated harness. Firefox also passed ten repeated save/reload/worker/archive
cases. The previous Playwright Firefox 153 build had a reproducible native
segmentation fault on reload; the upgrade retains all assertions and introduces
no automatic retries. This does not establish the precise upstream crash cause.
See [CI evidence](CI.md) for the tooling change.

All nine hosted web jobs passed in
[run 42064899671](https://github.com/poreilly19/Basis/actions/runs/42064899671)
for `fb3a87e41b1071f91bf7c059f43f15ec1ddefbaa`, including Node 20/24 on
Windows/Ubuntu, the full Chromium suite and the Chromium, Firefox, WebKit and
Windows Chromium deployment checks. No job retry or assertion relaxation was
used for that updated-harness run.

## Distribution and remaining acceptance

The application remains MIT-licensed. Desktop packaging includes a bounded
inventory and notice texts for 303 Cargo packages, plus five checksum-verified
MPL source archives. Dependencies retain their own licenses. The release also
provides downloadable notice/source supplements; the inventory is not a complete
transitive SBOM or legal clearance.

Hands-on acceptance on the owner's Windows computer, native save dialogs,
backup recovery/upgrade rehearsal and representative live AI extraction remain
separate checks. Existing models affected by 0.7.29 financial corrections still
need analyst review. Automated checks do not certify every underwriting case.
