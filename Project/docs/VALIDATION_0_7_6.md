# Validation snapshot — 0.7.6

Verified on 2026-10-19 20:52 UTC.

| Command | Result |
| --- | --- |
| `npm run build` | Twelve canonical application modules and four-module embedded worker synchronized. |
| `npm test` | 519 cases pass across 28 suites, plus exact module/bundle and JavaScript syntax checks. |
| `npm run test:browser` | 69 ordinary Chromium workflows pass in 63.305 seconds; external dependencies blocked or replaced with synthetic modules. |
| `BASIS_DEPENDENCY_DIR=... npm run test:dependencies` | Seven real-runtime Chromium workflows pass in 13.755 seconds against a freshly fetched, hash-verified cache. All test network URLs fulfilled locally. |
| `python3 scripts/fetch-test-dependencies.py CACHE_DIRECTORY` | Five existing runtime artifacts and two license texts downloaded and verified against the manifest. |

The Node run preserves 476 previous cases and adds 15 spreadsheet-loader,
15 import-lifecycle, eight Office XML, three Office date and two legacy date
cases. Browser checks preserve 58 workflows and add four import, two date and
five Office XML workflows. The existing sparse-workbook browser mock now supplies
the API required by the strict loader, preserving the assertion that dangerous
ranges fail before table allocation.

## Concrete failures and evidence

- A first spreadsheet operation could fail before the startup script finished.
  The lazy loader now shares a bounded request, validates the API/version, applies
  SRI and permits retry. Real Chromium rejects altered script bytes, then loads
  the original artifact on retry. Export snapshots and explicit library references
  survive edits, changed options and later global assignments.
- Oversized portfolio JSON bypassed pre-read checks; slow native/legacy reads
  could target a later portfolio/scenario. Independent failure injection and real
  file chooser/read tests verify the original destination, removed-target refusal,
  unchanged current edits and rejection before reading oversized JSON. Member-file
  additions stage against unchanged input/context. Preview Open failures are visible
  and do not create an uncaught rejection.
- Actual PDF worker-module import installed a main-thread handler and disabled
  normal dedicated-worker startup. Both real approved versions failed the new worker
  assertion before the adapter fix and pass it afterward. Original PDF text, JPEG
  raster pixels/dimensions, task/worker disposal and visible corrupt-PDF errors pass.
- Independent ZIP/XML fixtures reproduce the 1904 epoch error: serial 45000 must
  mean 2027-03-16, rather than 2023-03-15. Custom/legacy readers and XL4ADW writes
  preserve the epoch. Actual SheetJS edits retain the correct date, rent/rate
  numbers and a four-digit recovery base year.
- Malformed Office parts previously produced partial/empty reads; nested Word
  tables duplicated paragraphs; an equivalent PowerPoint namespace prefix lost
  slides. Node fixture DOM checks and native Chromium DOMParser workflows now
  verify errors, each nested paragraph once and namespace-aware relationships.

## Source identities

| File/reference | SHA-256 |
| --- | --- |
| Current `app/index.html` | `7f60a08552f782304bbe8c71f38da158fe61118060692ebf00cb4dcb8127be04` |
| Current `src/financial_engine.js` | `ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936` |
| Immutable reviewed 0.7.5 archive | `8ebcc9bc02ccd03cd8bb09fbe5ed7b202b69e5ea5aa9f228cc56b3a92faacca5` |

The financial engine is byte-identical to 0.7.5. Existing independent financial
fixtures and pre-extraction fingerprints pass. Imported date interpretation is
corrected; no underwriting formula changes are intended. Historical numerical
comparisons and limits remain in [financial validation](FINANCIAL_VALIDATION.md).

The original source used for the cumulative patch is reconstructed by reversing
the delivered 0.7.5 patch against its reviewed archive. Its HTML matches the
recorded original SHA-256
`40c16952d92395ac15c8b0a40059fed35a9fc2c4a41e7d974c65b7fe3750b95c`.
This does not reproduce the original ZIP container or claim a fresh read of the
original upload. Earlier packages remain unchanged.

Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium
154.0.8037.57 on Linux. Tests use isolated storage and loopback servers. Public
dependency downloads contain no models or documents. Local test URLs serve actual
verified dependency bytes; production PDF dynamic imports still lack runtime
digest checks. Runtime code is not included in this handoff ZIP.

The inspected SheetJS/PDF.js license texts identify Apache 2.0; bundled component
notices and a current vulnerability/provenance audit remain incomplete. SheetJS
0.18.5 is not upgraded, and SRI does not remedy old parser vulnerabilities. The
runtime tests use small original fixtures, preserving existing blank/empty-list
normalization in XLSX; they do not prove broad desktop Office compatibility.
Live AI/host APIs, Node 20, other browser engines, direct-file navigation, complex
PDF features and malicious-file corpora remain unverified. See
[runtime evidence](RUNTIME_DEPENDENCY_TESTS.md), [dependency inventory](DEPENDENCIES.md)
and [the review and next steps](CODE_REVIEW.md).
