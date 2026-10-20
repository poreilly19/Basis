# Runtime dependency checks — 0.7.9

The test cache contains five current runtime artifacts, two upstream license
texts and one previous-writer compatibility reference listed in [the pinned test manifest](../tests/fixtures/runtime_dependencies.json).
The manifest records exact URLs, sizes and SHA-256 values observed on 2026-10-19.
Library code is kept in a separate test cache and is not bundled into this ZIP.

Both inspected license texts identify Apache License 2.0: the official SheetJS
0.20.3 package and PDF.js tag `v4.10.38`. Copies are enclosed in
[third-party notices](THIRD_PARTY_NOTICES.md). This is a targeted source/license observation, not a
complete review of bundled transitive components, notices, provenance, current
advisories or public redistribution requirements. It does not select a license
for Basis. Existing advisory leads remain in [the inventory](DEPENDENCIES.md).

## Spreadsheet loading

The app now requests SheetJS only when an Excel import/export needs it. Concurrent
operations share a ten-second load; failure and timeout allow retry. A complete
existing library must provide version 0.20.3 and all import/export methods. The
new script request sets `crossOrigin="anonymous"` and this observed SHA-384 SRI:

```
sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT
```

Each operation retains the validated library reference, so a later classic script
assignment cannot change its reader/writer halfway through. Export inputs,
options and filename are captured before loading. Removing a timed-out script
is best effort; already downloaded JavaScript may still execute. An existing
host-provided global is validated by API/version, not authenticated by this SRI.

SRI detects changed bytes. The 0.7.7 pass upgrades to the official 0.20.3 artifact
after reviewing upstream release/advisory/license information and compatibility
checks. See [the upgrade and formula policy](SPREADSHEET_UPGRADE.md). The old
0.18.5 writer exists only as a separately pinned test reference in an isolated
iframe with original input; it is never an app fallback.

## Verified PDF loading and real workers

The 0.7.6 checks pinned separately cached PDF bytes for repeatable tests; that did
not verify production requests. In 0.7.8, [the production integrity transport](../src/pdf_integrity.js)
fetches the existing 4.10.38 reader and worker, with 4.4.168 as the only fallback
pair. Each artifact must match its exact pinned byte length and SHA-256 digest.
Readable streams have byte/chunk bounds; redirects, opaque responses, short or
excess data and digest mismatches fail. Both artifacts must verify before either
becomes executable Blob code. The production metadata repeats the four PDF pins
in [the test manifest](../tests/fixtures/runtime_dependencies.json); an automated comparison prevents pin drift. Test-cache
verification remains a separate preflight from each browser's production check.

The transport imports only the reader Blob into the main window and passes the
matching verified worker Blob URL to PDF.js. It never imports the worker module
there. Concurrent documents share loading; a ten-second deadline applies per
candidate pair, and cancellation aborts pending fetch/stream work. Late digest or
import completions cannot publish after an attempt stops. If verification or
loading fails, the loader can try the other approved verified pair and later
retry; it never falls back to an unverified direct CDN import.

Successful Blob URLs live with their transport, up to two versions/four URLs, so
individual document cleanup or loader invalidation cannot break another PDF.
Failed attempts revoke uncommitted URLs. Owners must stop their PDF jobs before
explicit transport disposal, which aborts pending verification and revokes the
retained URLs. The default app transport remains page-owned.

Native Web Crypto SHA-256 requires a secure context: HTTPS or localhost. A deployed
CSP must permit cdnjs fetches through `connect-src`, reader Blob imports through
`script-src` and Blob workers through `worker-src`; CORS and readable streaming
responses are required too. Missing APIs or blocked policy fail loading rather
than bypassing integrity. This describes deployment requirements, not a complete
review of a production CSP.

Synthetic Chromium fixtures alter reader and worker bytes without changing their
lengths. Tests assert a digest error, no reader or worker execution, no executable
Blob URLs and no tamper-sentinel request. Additional cases check matched verified
fallback, stalled-fetch retry and URL lifetime until explicit disposal. Existing
real-runtime tests now use the production transport and assert a dedicated worker
from the verified Blob for both approved pairs, reuse by a second document,
exact text from an original PDF, rendered JPEG pixels/dimensions, cleanup and a
visible malformed-PDF error.

The app clears any stale host `globalThis.pdfjsWorker` handler before opening.
PDF.js may still choose its own local fallback when dedicated Worker startup
fails, importing the verified worker Blob into the main window; dedicated-only
parsing is not enforced. Deadlines cannot interrupt synchronous parsing in that
mode, and a runtime worker error does not transparently retry the document with
another version. These checks add production byte verification without upgrading
PDF.js, bundling its code or completing a dependency/parser audit.

## Reproducing the optional tests

Install the development-only Playwright/Chromium tools as described in README.
Then run the portable commands:

```sh
node scripts/run-python.cjs scripts/fetch-test-dependencies.py ../basis-runtime-cache
npm run test:dependencies -- --cache ../basis-runtime-cache
```

Use a writable cache directory outside the project. `BASIS_DEPENDENCY_DIR` remains
supported, but `--cache` needs no shell-specific environment syntax. The [portable
runner and CI](CI.md) fail zero/all-skipped runs explicitly. The fetch command
uses public HTTPS, verifies sizes/hashes, and refuses mismatched existing cache
files. It sends no models or documents. The tests themselves make no external
requests: Chromium receives actual artifact bytes from intercepted URLs, and
other remote requests are blocked. Missing or altered artifacts fail validation
before the browser starts. Ordinary `npm test` and `npm run test:browser` need no
runtime artifact cache and continue to block external dependencies.

Seventeen optional workflows cover both PDF pairs and actual XLSX round trips,
edited rent/rates, both date epochs and loan dates, captured export state/library,
formula-cache/error policy, bounded inflation-index expansion, identifiers/references, members/additive data, previous
writer compatibility, and browser rejection of altered script bytes followed by retry. XLSX comparisons
retain all populated model inputs, numeric zero, booleans and membership; existing
blank-to-null and empty-list normalization is preserved. These are small original
fixtures, not a broad malicious-file corpus or validation in desktop Excel.

Independent OOXML fixtures also check custom workbook readers/writers, 1904 epoch
preservation, malformed XML, nested Word tables and namespace-equivalent PowerPoint
relationships. Live AI extraction, remote host storage, other browser engines,
encrypted PDFs, complex fonts/forms and broad Office interoperability remain work
for a release corpus.
