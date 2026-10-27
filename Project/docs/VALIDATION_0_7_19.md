# Validation snapshot — 0.7.19

Reviewed locally on October 27, 2026. Financial formulas/input mappings were changed
only after independently specified cases reproduced the discrepancies. The
ordinary baseline passed before edits. All work uses the local chat project.

## Commands and results

| Check | Result |
| --- | --- |
| Baseline `npm test` | All 676 cases across 37 test files passed, plus build/source checks. |
| Final `npm test` | All 705 cases across 39 test files passed, plus source/worker/syntax checks. |
| Final `npm run test:browser` | All 148 Chromium workflows passed in 413.553 seconds against the final app hash below. |
| Actual-library `npm run test:dependencies` | All 17 PDF.js/SheetJS workflows passed in 77.357 seconds using the manifest-verified local cache. |
| Focused financial reproduction | Before the fixes, four of the first eighteen cases failed: both low-occupancy gross-up variants and both draw-only return paths. They passed after correction; horizon and diagnostic coverage brings the final new financial suite to twenty cases. |
| Focused report reproduction | Both browser cases failed before the report fixes: hidden levered results and PV row/total mismatch. They passed after correction. |
| Focused document mapping | All nine new mapping cases and all nineteen existing guided-model cases passed after the mapper/review corrections. |
| Build/source boundary | Twenty-three main application modules, four worker modules and three parsed inline scripts are checked by the build verification. |

The new suites contain 20 financial/diagnostic cases, nine document-mapping cases
and five browser workflows. Existing independent financial fixtures, the 18 frozen
full-result fingerprints, worker hydration and source/embedded parity checks remain
in the full Node command. Fingerprints were not regenerated.

The focused browser check initially compared a floating-point $999.9999999999999
value with exactly $1,000. Its monetary assertions now use a $0.0000001 tolerance;
date, mode and decision assertions remain exact. The complete browser run is
separate from those earlier reproductions. No retry or increased timeout is used
to turn a failed assertion into passing evidence.

The browser suite covers existing saves, scenarios, recovery, imports, malformed
archives, HTML/formula handling, tenant groups, number formats, navigation, settings
and AI-key isolation as well as the new accuracy workflows. Actual PDF.js/SheetJS
checks use the verified local artifact cache. No live AI service or customer
document was used.

## Environment and remaining limits

Linux x86_64, Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium
154.0.8037.57. Ordinary browser tests block external HTTPS and use isolated browser
storage. The existing runtime cache is provided through `BASIS_DEPENDENCY_DIR`.
No dependencies were added or upgraded.

The launcher and runner are unchanged from 0.7.18 and were not separately retested
for this release. Their last recorded portable results remain five launcher cases
and thirteen runtime-runner cases passing; native Windows CMD execution was skipped
on Linux. Live extraction, other browsers, physical devices, accessibility testing,
full independent underwriting reconciliation and external advisory/legal review
remain outside these results. The model's valuation-day switch is a within-first-
month convention, not an arbitrary-date valuation engine.

## Integrity

| Artifact | SHA-256 |
| --- | --- |
| Final `app/index.html` | `ae37a10e47a3adadb24526495d47cd9ea6ef3a34fc3446a8612c3759b2930257` |
| Final `src/financial_engine.js` | `5b4878931d4e3221c47b2efb90c6063d791d2e93e6b014711a121bc43468d188` |
| Preserved v7.18 ZIP | `c1fee79c6c0752658972840aa60fabfd1e22dd63179618d1b871e12a29730fbb` |

Unlike the previous UI release, this release intentionally changes calculation
behavior for the documented gross-up and financing cases. Native schema v1 is
unchanged. Package verification checks the prior archive, unchanged repeat-build
bytes, deterministic ZIP/CRC/content, Windows-launcher CRLF and a patch reproducing
the exact final project from v7.18. Artifact checksums accompany the ZIP.

See [the accuracy review](ACCURACY_0_7_19.md) for numerical examples and next steps.
