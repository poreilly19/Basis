# Validation snapshot — 0.7.8

Verified on 2026-10-20 12:10 UTC.

| Command | Result |
| --- | --- |
| `npm run build` / `npm run check` | Thirteen canonical application modules and four-module embedded worker match; JavaScript syntax checks pass. |
| `npm test` | 585 cases pass across 32 suites. |
| `npm run test:runner` | 13 Python stdlib cases pass. |
| `npm run test:browser` | 74 Chromium workflows pass in 77.394 seconds. |
| `npm run test:dependencies -- --cache CACHE_DIRECTORY` | 16 actual PDF/XLSX runtime workflows pass in 27.729 seconds. |

## PDF execution and import evidence

Production PDF loading now verifies the exact size and SHA-256 of both approved
reader/worker artifacts before creating executable Blob URLs. The reader alone is
imported into the main window; PDF.js receives the verified worker Blob URL.
Tests compare all four production pins against the runtime-cache manifest.

Twenty-five transport cases cover byte tampering, exact-size and chunk limits,
stream/HTTP/digest failures, unavailable capabilities, aborts during fetch/read/
digest/import, late cleanup, cache races and explicit disposal. Six added loader
cases verify default transport selection, candidate abort before fallback,
unverified-pair rejection, invalidation and injection validation.

Synthetic Chromium tests replace reader and worker bytes at the same length and
prove neither module executes, no Blob code is created and no execution sentinel
request is sent. They also cover approved verified fallback, fetch timeout/retry
and Blob lifetime. Real PDF.js checks use the default production transport with
actual pinned bytes: both approved versions start dedicated Workers, produce
exact text and raster output, clean up and read a second document without refetch.
PDF.js's own local fallback remains possible if worker startup fails; synchronous
fallback work cannot be preempted by these deadlines. See [PDF loading](PDF_LOADING.md).

The template reader now uses validated DOM cells and shared strings, preventing
comments, CDATA or equivalent namespace prefixes from hiding formulas or
manufacturing cached values. Original small OOXML/ZIP fixtures reproduce
uncached formulas, Excel errors and
invalid shared-string references becoming blank/zero custom-reader inputs. The
fix reports the sheet/cell before model conversion. Valid cached zero, false and
empty strings remain accepted; stored formulas are never recalculated. Native
Chromium DOM checks complement Node's lightweight XML facade. Document intake
consumes every worksheet; direct XL4ADW template parsing applies the new guards
to sheets identified by their COL input row. See [document imports](DOCUMENT_IMPORT.md).

All browser suites use isolated local storage and loopback HTTP with other external
requests blocked. Runtime tests serve verified local artifacts; this pass reuses
and verifies the eight-file cache without downloading new library bytes. No model
or document was sent to an external service. No runtime library code is bundled.

## Source identities

| File/reference | SHA-256 |
| --- | --- |
| Current `app/index.html` | `77945156b0d24b1df0af786308a745ec025d1125dadc37e89bf3f57b440faa6b` |
| Current `src/financial_engine.js` | `ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936` |
| Immutable reviewed 0.7.7 archive | `dfe97a6434455c106bb312bfabc94b0f0c9368d5581eaefc09926b476983ab0c` |

The engine is byte-identical to 0.7.7. Existing independent financial cases and
pre-extraction fingerprints pass; this release changes runtime loading and input
validation, with no underwriting formula changes.

The cumulative patch uses original source reconstructed by reversing the delivered
0.7.7 cumulative patch against its reviewed archive. Its HTML matches recorded
original SHA-256 `40c16952d92395ac15c8b0a40059fed35a9fc2c4a41e7d974c65b7fe3750b95c`.
This does not reconstruct the original ZIP container or claim a new read of the
unavailable original upload. Earlier reviewed packages remain unchanged. Packaging
checks both patches apply exactly, ZIP CRC/content, deterministic ZIP output and
an unchanged repeated build.

Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium
154.0.8037.57 on Linux. The pinned CI workflow remains configured but has not run
on GitHub. Node 20, Windows, other browser engines, live host APIs and direct-file
navigation remain unverified. HTTPS/localhost and the deployed fetch/Blob/worker
policy need validation on target devices.

Broader malicious-file/financial corpora, early-1900 spreadsheet date compatibility,
transitive license/provenance review, host-side atomic saves and remaining synchronous
calculation paths remain open. See [next steps](CODE_REVIEW.md) and
[runtime dependency evidence](RUNTIME_DEPENDENCY_TESTS.md).
