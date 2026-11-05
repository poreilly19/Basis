# Basis Desktop and Web

Basis Desktop is a Windows application built with Tauri 2. It packages the same
Basis interface, document review flow, native model format and calculation engine
used by the web application. The web application remains supported and continues
to use the existing Cloudflare deployment. A desktop build does not replace or
redirect the website.

This is a desktop beta. A successful installer build establishes that the
application can be packaged; it does not replace hands-on Windows acceptance,
live AI-provider checks or analyst review of underwriting results.

## Choose how to run Basis

| | Web application | Windows desktop application |
| --- | --- | --- |
| Launch | Open the hosted URL in a supported browser. | Open the installed Basis application; no Python server is needed. |
| Saved models | Belong to the browser profile and exact site address. | Belong to the local Windows user and the installed app's data directory. |
| Offline use | The current web deployment is not an offline installation. | Core modeling and packaged PDF/Excel reading work without a network connection. |
| Sharing and transfer | Export an editable `.basiscre` model or portfolio. | Use the same `.basiscre` model or portfolio files. |
| AI extraction | Requires a supported provider account, key and network access. | Requires the same; desktop packaging does not include an AI subscription. |
| Access | The hosted beta is protected by its Cloudflare Access policy. | Local copies are controlled by Windows account/device access. |

Installing the desktop application does not sign it in to the hosted beta,
provide cloud synchronization or make browser-saved models appear automatically.
Do not treat desktop application files or model backups as encrypted documents.

## Move models between web and desktop

1. In the old workspace, choose the portfolio you want to transfer.
2. Use **File → Export Portfolio… → Editable Model Backup (.basiscre)** and keep
   that file in a separate folder. A portfolio backup retains its properties,
   scenarios and inclusion settings. Export each portfolio separately.
3. In the other edition, choose **File → Import…** and select the `.basiscre` file.
4. Open a property, check its inputs and Model Checks, then compare expected
   cash-flow and valuation results before continuing work.

Import validates the existing native archive format before publication and creates
new records. It does not silently replace existing properties. Repeated imports
can therefore create additional copies. Native schema v1 remains unchanged.

Exported report workbooks and CSV reports contain calculated outputs; use an
**Editable Model Backup** to move the complete editable model. See
[the native format](FILE_FORMAT.md).

## Saving and backups

Desktop workspace saves use a native local store rather than the website's
browser database. The model library and index commit together, and a failed save
must remain visible instead of reporting success. Workspace preferences and local
draft recovery continue to use the desktop WebView's own storage.

Desktop saves retain rolling workspace snapshots. These snapshots are recovery
copies in the same Windows user profile; they are not an independent off-device
backup. Keep periodic `.basiscre` portfolio exports somewhere separate, especially
before upgrades, uninstalling, switching computers or restoring a snapshot.

The native store is `workspace.json` in Tauri's per-user application data
directory, normally `%APPDATA%\com.basisstudio.desktop` on Windows. In
**Portfolio → Settings**, **Desktop Storage & Backups** shows the actual location.
Use **Back Up Workspace Now** to save and snapshot the current workspace or
**Open Backup Folder** to view its files in Explorer. The `backups` subdirectory
retains up to ten timestamped workspace snapshots. Automatic backups retain the
previous saved snapshot at most once every 15 minutes; creating a backup manually
captures the current saved workspace. This is rolling recovery, not a record of
every edit. A snapshot contains all portfolios stored in this desktop workspace.

For manual recovery, close Basis, copy the existing `workspace.json` somewhere
safe, copy the chosen workspace snapshot to `workspace.json`, then reopen Basis.
Do not edit the JSON to bypass validation. Restoring a snapshot restores its whole
library, so export newer accessible portfolios first. If you cannot verify the
backup or preserve the current files, keep both and seek help before replacing
the active store.

API keys are separate from model and workspace backups. An optional remembered
key is stored through Windows Credential Manager, not in a property, portfolio,
workspace JSON file or exported support information. A key held for the current
session does not become persistent without the user's explicit choice.
Use **Remember Key on This Device**, **Use Saved Key** and **Forget Saved Key**
in AI settings to manage the selected provider's native credential. The normal
**Use AI Setup** action remains session-only.

Do not delete application data to troubleshoot a startup problem until you have
copied it and exported any accessible models. A corrupt workspace file is an error
to recover from, not a reason to silently start over. Removing Windows application
data, deleting the Windows user profile or selecting an uninstall option that
removes user data can remove local models. Do not rely on uninstall behavior as a
backup strategy.

## Offline documents and AI

The desktop package includes the pinned SheetJS and PDF.js artifacts and their
license notices. It verifies these packaged runtimes and uses local assets;
reading a PDF or Excel document does not require downloading a runtime from a CDN.
This does not imply that every PDF font, workbook feature or external document
link is supported.

AI extraction still sends selected document content to the configured OpenAI or
Anthropic API. It requires internet access, a suitable provider account and a
user-supplied API key. Provider charges are separate from Basis. Review proposed
fields and source citations before applying them. Local document reading and AI
extraction are different operations; packaging a document reader does not create
an offline AI model.

The native AI request bridge is limited to the supported provider endpoints. It
does not turn the desktop application into a general-purpose local file or HTTP
server. The web version continues to use its existing browser provider path.

The native dependency notice generator reads locked Cargo metadata, copies bounded
upstream license/notice texts, and records package versions, sources and hashes.
The installer includes `NATIVE_THIRD_PARTY_NOTICES.txt` and
`native-license-inventory.json`. This is a package superset that can include build
and other-platform dependencies, not a complete SBOM or legal clearance. MPL-2.0
declarations are flagged for separate source-availability review.
The corresponding exact upstream `.crate` source archives accompany the native
notices under `native-sources`; their hashes are checked against `Cargo.lock`.
The inventory also records public source download URLs and the narrow evidence
for any license text supplied from an upstream repository rather than its crate.

## Installation, updates and distribution

Use Windows installers produced from this repository's desktop workflow. GitHub
Releases can distribute the installer without a purchased domain or app store.
The project remains MIT-licensed; its dependencies retain their own licenses.

Initial beta installers may be unsigned. Windows may show an unknown-publisher or
SmartScreen warning; a successful build is not a publisher signature. Only install
an artifact from the intended repository/release and compare its published hash
when one is provided. Production code signing can have a separate cost.

The initial desktop edition does not automatically download and install updates.
Export a portfolio backup before installing a newer release. Keep the old
installer and backup until you have opened and checked the new version. A browser
page reload updates the web application independently; it does not update an
installed desktop application.

## Build from source

Development prerequisites are Node.js 20 or newer, Rust's stable MSVC toolchain,
Microsoft C++ Build Tools with the Windows SDK, and Microsoft Edge WebView2.
Installer build prerequisites differ from those needed by an end user running
the packaged application. From `Project`:

```sh
npm ci --prefix desktop
npm run desktop:prepare
npm run desktop:dev
```

Use `npm run desktop:build` for the Windows NSIS installer. Desktop tooling is
isolated in `desktop/package.json`; the existing web build remains
`npm run build:beta && npm run verify:beta` and does not require Rust or the Tauri
CLI. The desktop preparation step uses the same canonical application source and
copies verified runtime artifacts into `dist/basis-desktop`.

The repository-root [desktop workflow](../../.github/workflows/desktop.yml)
builds the Windows installer as a workflow artifact. Building an artifact and
publishing a GitHub Release are separate operations. Use the validation evidence
and acceptance checklist before treating an installer as a tested release.

## Verification and acceptance

Desktop and web share the financial implementation and the existing regression
cases. Desktop acceptance also needs real Windows checks of native save dialogs,
workspace save/reopen, rolling backup recovery, optional Credential Manager keys,
shutdown during saving, PDF/Excel imports without network access and installer
upgrade behavior. Keep this status separate from web CI and Cloudflare Access
checks. See the [beta acceptance checklist](BETA_ACCEPTANCE.md).
