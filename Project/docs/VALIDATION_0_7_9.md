# Validation snapshot — 0.7.9

Verified on 2026-10-20 17:01 UTC.

| Command | Result |
| --- | --- |
| `npm run build` / `npm run check` | Thirteen canonical application modules and four-module embedded worker match; JavaScript syntax checks pass. |
| `npm test` | 599 cases pass across 32 suites. |
| `npm run test:runner` | 13 Python stdlib cases pass. |
| `npm run test:browser` | 76 Chromium workflows pass in 66.102 seconds. |
| `npm run test:dependencies -- --cache CACHE_DIRECTORY` | 17 actual PDF/XLSX runtime workflows pass in 16.943 seconds. |

## Reproductions and fixes

A tiny independent legacy workbook with `InflationRates.Year_Index=4294967294`
entered an enormous zero-fill loop in the previous importer; a 20 ms Node VM
budget stopped the reproduction. The fix validates indices before array
allocation, rejects duplicates, limits each series to 100,000 values and caps the
workbook at 200,000 expanded values, including sparse gaps. Five Node methods
cover malformed/large indices, valid sparse and numeric-text inputs, supported
boundaries, duplicates and cross-property/series budgets. The added actual-runtime
workflow reads original table fixtures through SheetJS and checks valid rates plus
the first unsupported index, avoiding a deliberate browser lockup. No browser
out-of-memory experiment was attempted.

Reload library previously compared edit/save timestamps. The same-millisecond
fixture changed a model after saving and then reloaded it with zero confirmation
calls, despite a declining confirmation adapter. Edits now set a nonzero dirty
marker; successful commits clear it only for the exact current property/JSON
snapshot. Regression coverage includes equal/backwards/zero clocks, clean saves,
failed saves, edits while an older save commits, unrelated/metadata-only saves and
model-writing actions. Native Chromium checks the visible discard dialog.

An original OOXML fixture with serial 45000 and built-in date format 14 imported
as March 2023 with ordinary XML, but equivalent single-quoted/prefixed styles
silently left it numeric and selected a default analysis start. Reading validated
DOM style metadata fixes built-in/custom format quote, prefix and attribute-order
variants. Three Node methods and one added native-browser method check exact dates,
actual imported analysis years/months in both epochs and unconverted monetary
controls. Styles retain the existing date-format heuristic; this is not a full
OOXML schema implementation.

All browser suites use isolated storage and loopback HTTP, with other external
requests blocked. Real-runtime tests reuse and validate the eight-file local
cache; no new runtime library bytes were downloaded. No model or document was sent
to an external service. Existing PDF integrity/dedicated-worker and spreadsheet
formula/compatibility workflows remain part of the passing suites.

## Source identities

| File/reference | SHA-256 |
| --- | --- |
| Current `app/index.html` | `80090e53f4044ca28c3a9811d19a3464d31e67486dd57cdf106b24f338e6bd89` |
| Current `src/financial_engine.js` | `ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936` |
| Immutable reviewed 0.7.8 archive | `0f9230a49f338704da07489547af613dd814be3042766d671e122f4359946e33` |

The engine is byte-identical to 0.7.8. Existing independent financial cases and
pre-extraction fingerprints pass. Changes affect input validation, date-style
interpretation and reload/save lifecycle; underwriting formulas are unchanged.

The cumulative patch uses original source reconstructed by reversing the delivered
0.7.8 cumulative patch against its reviewed archive. Its HTML matches recorded
original SHA-256 `40c16952d92395ac15c8b0a40059fed35a9fc2c4a41e7d974c65b7fe3750b95c`.
This does not reconstruct the original ZIP container or claim a new read of the
unavailable original upload. Earlier reviewed packages remain unchanged. Packaging
checks both patches apply exactly, ZIP CRC/content, deterministic ZIP output and
an unchanged repeated build.

Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium
154.0.8037.57 on Linux. GitHub-hosted CI, Node 20, Windows, other browser engines
and live host APIs remain unverified. Broad malicious-file/financial corpora,
remaining XML/schema compatibility, early-1900 date policy, transitive licensing/
provenance, host-side atomic saves and synchronous calculation paths remain open.
See [next steps](CODE_REVIEW.md), [storage](STORAGE.md) and
[spreadsheet policy](SPREADSHEET_UPGRADE.md).
