# Runtime dependency and provenance inventory

Inventory started 2026-10-15; desktop packaging added 2026-11-05. This is an inventory from source inspection, not a
completed license, vulnerability, provenance or public-release clearance audit.

| Component | Where used | Delivery/version | Review still required |
| --- | --- | --- | --- |
| SheetJS `xlsx` | Legacy `.basis.xlsx` read/write through `pfReadFile` and `pfToXLSX` in `app/index.html` | Web: on-demand official CDN script; desktop: packaged verified artifact. Version `0.20.3`, SHA-384 SRI pinned by `src/xlsx_loader.js` | Official package/distribution Apache 2.0 licenses match; notices enclosed and real workbook compatibility checks pass. Selected version is beyond the upstream affected ranges for CVE-2023-30533 and CVE-2024-22363. Complete bundled-component/provenance review and broader malicious-file coverage; see [upgrade evidence](SPREADSHEET_UPGRADE.md). |
| PDF.js and its worker | Optional document-intake PDF text extraction and scan rendering, `src/pdf_integrity.js` / `src/pdf_loader.js` / `intPdfLib` / `intPdf` | Web: cdnjs bytes fetched on demand, attempted in order `4.10.38`, `4.4.168`; desktop: verified local `4.10.38` pair. Both artifacts require exact size and SHA-256 before Blob module use | Tagged Apache 2.0 license inspected; actual dedicated-worker/text/render smoke tests pass for both verified pairs. Broad parser/provenance review and current advisory assessment, including CVE-2024-4367, remain open. `isEvalSupported:false` is already passed by this app. |
| OpenAI Responses / Anthropic Messages | Optional standalone document extraction, `src/ai_provider.js` | Fixed HTTPS endpoints; user-selected model; editable defaults `gpt-4.1` / `claude-sonnet-4-5` | No provider SDK dependency. Web keys are session-only; desktop can optionally use Windows Credential Manager and a fixed-provider native HTTP bridge. Fake transport/browser tests do not establish live model/account accuracy. See [AI setup](WORKSPACE_SETTINGS.md) and [desktop behavior](DESKTOP.md). |
| Claude host `sample` API | Optional extraction of selected document text/images, `getSample` / `intExtract` | Supplied by `window.claude.use("sample")`; no version is pinned in this repository | Confirm supported host/API version, terms, data retention and recipient controls. The prompt includes analysis start, building area and up to 60 existing tenant names/suites/areas in addition to document content. |
| Claude host `db`, `user`, `downloads` APIs | Portfolio storage and file download adapters | Host supplied; plain-browser fallbacks also exist | Test unavailable/denied services, interrupted writes, download cancellation and migration between hosts. Record API compatibility and terms. |
| Browser platform APIs | ZIP compression/decompression, cryptography, Office XML parsing, files, IndexedDB/local storage, rendering and clipboard | Browser provided | Record minimum supported browsers; exercise `CompressionStream` / `DecompressionStream("deflate-raw")`, secure-context APIs, worker policy and storage quota failures on target devices. |
| Node.js | Local test runner and syntax/build checks | `package.json` requires Node 20+ | Web build/test commands need no npm dependencies. Desktop CLI dependencies are isolated in `desktop/package.json` and its lockfile. |
| Tauri, WebView2 and native Rust dependencies | Windows desktop window, native storage/dialogs, fixed-provider HTTP and optional Credential Manager keys | Tauri CLI pinned in `desktop/package-lock.json`; Rust dependencies resolved in `desktop/src-tauri/Cargo.lock`; Windows WebView2 is a system runtime | Installer build, native Windows lifecycle/device acceptance and current advisory review remain separate checks. Generated native notices copy upstream license texts and flag MPL-2.0 source-availability review; they are not a complete SBOM or legal clearance. |

The web release continues to load optional runtimes on demand. Desktop includes
verified runtime copies, accompanying component licenses and generated native
notices/inventory. Desktop npm and Cargo lockfiles describe its build dependencies;
the project does not claim a complete transitive dependency SBOM. A
[runtime manifest](../tests/fixtures/runtime_dependencies.json)
now records exact URLs, sizes and SHA-256 values for five current runtime files,
two license texts and one previous-writer compatibility reference. Both inspected licenses identify Apache 2.0; copies are enclosed with
[component notices](THIRD_PARTY_NOTICES.md). Transitive
components/notices and distribution requirements remain incomplete. SheetJS loading
sets SHA-384 SRI. Production PDF loading now fetches and verifies both reader and
worker against exact byte sizes and SHA-256 pins in `src/pdf_integrity.js`, then
imports the reader Blob and assigns the matching worker Blob. Neither artifact
can execute through this transport before both pass; there is no unverified
direct-URL fallback. These checks authenticate bytes against this repository's
pins, not their provenance or the absence of vulnerabilities. Desktop preparation
requires exact artifact hashes; release packaging requires the generated native
notice pair. Continue the broader provenance, notices and redistribution review. See
[runtime tests and limitations](RUNTIME_DEPENDENCY_TESTS.md).

Advisory reference identifiers above are leads for a current upstream audit, not
confirmation that an exploit was reproduced against this application:

- <https://nvd.nist.gov/vuln/detail/CVE-2023-30533>
- <https://nvd.nist.gov/vuln/detail/CVE-2024-22363>
- <https://nvd.nist.gov/vuln/detail/CVE-2024-4367>

## Provenance and interoperability boundaries

`docs/DEV_HISTORY.md` records historical use of commercial third-party behavior,
documentation, examples and screenshots. Source comments refer to training
slides in `calcPositions`, scrub metrics and report organization; earlier
comments and UI strings also described third-party report layouts and workflows.
The distributed wording is now neutral, and the historical feature inventory
marks its edited text. Preserve original source evidence for review. Renaming
labels alone does not verify provenance or establish legal clearance.
Inventory the origin and rights for each reference, workbook template, report
layout and sample data set; replace distinctive expression with independently
specified workflows where necessary. The owner later selected MIT for Basis's
original code; that choice does not relicense dependencies or complete this review.

Legacy `.basis.json` and `.basis.xlsx` are full-model interchange paths. CSV/TSV
in document intake are read as source text for optional AI extraction, while report
CSV exports contain outputs. Report CSV is not a structured model round-trip
format. Establish golden workbook/JSON fixtures with edited rows, references,
dates, units, booleans, unknown fields and malformed inputs before replacing the
spreadsheet dependency or revising legacy schemas. Office/document intake now shares the bounded `src/office_zip.js` helper through
`intUnzip` and `x4Unzip`. ZIP-based legacy workbooks receive archive preflight too;
row/column/cell budgets limit sparse expansion. These checks do not replace the
upstream spreadsheet/PDF dependency audit or prove real binary-workbook parity.

Document intake now checks file sizes before reading: 32 MiB per non-Office
document, the existing 64 MiB Office archive allowance, and 128 MiB across at most
50 intake documents. PDF extraction permits at most 300 pages and releases its
PDF.js document after use or failure. File-size and page limits alone do not
bound decoded content; additional checks and their limits are described below.

The 0.7.5 loader removes the classic 3.x fallback, coalesces requests, validates a
matched 4.x reader/worker pair and applies module deadlines. Opening, page/text,
rendering, encoding and cleanup waits now have scoped aborts/deadlines. Image
headers receive a 40-megapixel/16,384-edge check before pass-through or decoding.
Decoded PDF text is bounded separately from file size. See
[PDF and image reading](PDF_LOADING.md) for limits and evidence.

The 0.7.8 PDF transport adds bounded production fetches and digest verification
without changing the approved library versions. It requires native Web Crypto
in a secure context (HTTPS or localhost), CORS-readable fetch responses and Blob
module/worker support. A deployed CSP must allow cdnjs in `connect-src` and Blob
URLs in the applicable `script-src` and `worker-src`; blocked capabilities fail
loading recoverably rather than bypassing verification. Successful URLs remain
valid for the transport lifetime, up to two reader/worker versions. Explicit
transport owners must stop all PDF jobs before disposal revokes those URLs.
The transport never imports the worker into the main window; PDF.js may itself
use the verified worker Blob for a local fallback if dedicated startup fails.

The 0.7.6 pass fetched existing declared runtime artifacts and tagged licenses into
a separate cache. Seven optional Chromium workflows used those verified bytes with
all other external requests blocked, including actual PDF workers and XLSX parsing.
The 0.7.7 pass upgrades SheetJS to 0.20.3; no runtime code is bundled. Seventeen
real-runtime checks now include old-writer compatibility, formula/date policy and
bounded inflation-index expansion.
The current PDF smoke checks use the production verification transport; synthetic
browser fixtures also reject same-size reader/worker tampering before execution.
Broader malformed-file corpora, animated-image
cumulative allocations and cross-browser codecs remain open work. License/source
observations and small smoke tests do not constitute a completed dependency audit.

## Financial follow-up

`tests/financial.test.cjs` now independently defines rent, free-rent, step,
proration, recovery, DCF, debt, IRR and aligned-portfolio cases. It extracts and
executes the deployable engine through Node's VM; it is not a browser workflow
test or a certification of all underwriting behavior.

Next fixtures should cover month-aligned portfolio starts, different property
hold periods, forward/trailing terminal NOI, market rollovers, fractional lease
terms, recovery stops/gross-up/caps, floating-rate debt and future funding, loan
maturities/exit fees, valuation dates and multiple-sign-change IRR streams. The portfolio month alignment, separate/joint exits and terminal NOI now have
18 additional golden cases and an explicit policy in `PORTFOLIO_MATH.md`. Year-only
calendar/fiscal recovery stops have five dedicated golden cases. IRR bracket expansion returns one bracketed root; it does not prove
uniqueness for a cash-flow sequence with several sign changes.
