# Validation snapshot — 0.7.7

Verified on 2026-10-20 11:49 UTC.

| Command | Result |
| --- | --- |
| `npm run build` / `npm run check` | Twelve canonical application modules and four-module embedded worker synchronized; JavaScript syntax checks pass. |
| `npm test` | 543 cases pass across 30 suites. |
| `npm run test:runner` | 13 Python stdlib cases pass. |
| `npm run test:browser` | 69 Chromium workflows pass in 63.085 seconds. |
| `npm run test:dependencies -- --cache CACHE_DIRECTORY` | 16 actual PDF/XLSX runtime workflows pass in 16.794 seconds. |
| `scripts/fetch-test-dependencies.py CACHE_DIRECTORY` | All eight manifest artifacts fetched and size/SHA-256 verified in the resumed environment. |

The Node run preserves 519 cases and adds eight formula guards, 15 portable Python
launcher checks and one broader date-mapping case. The runtime run preserves seven
workflows and adds nine workbook compatibility methods. The additional 13 stdlib
runner cases check discovery, cache verification, empty/all-skipped results and
failure/exit handling. The launcher includes a real child-process check proving
literal arguments and exit status 7 survive forwarding.

## Dependency and import evidence

Official SheetJS 0.20.3 metadata/license/advisory information was inspected on
2026-10-19. The official artifact, new SHA-384 SRI, strict accepted version and
source links are recorded in [the upgrade report](SPREADSHEET_UPGRADE.md).
Package/distribution license texts matched; [dependency notices](THIRD_PARTY_NOTICES.md)
and copies are enclosed. No runtime JavaScript is bundled in this handoff.

Real XLSX fixtures verify both workbook epochs, styled tenant/loan dates,
Unicode/leading-zero identifiers and references, child order, literal formula-like
strings, cached zero/false/empty-text values, multiple/excluded members and unknown
additive data. A separately pinned 0.18.5 writer creates original trusted input in
an isolated iframe; the new reader imports it without replacing its active library.
The old version is never an app fallback.

Actual runtime failure injection reproduced missing formula results and Excel
errors becoming blank rents. The fix preserves formula/stub metadata and rejects
unusable input cells before conversion with a sheet/cell error. Valid stored
results remain unchanged; unused results/informational sheets do not block import.
Tests also reproduced missing loan-date mapping in both epochs before the fix.

PDF checks retain real dedicated workers for both approved versions, exact text
and rendered pixels from an original PDF, cleanup and visible malformed-PDF errors.
All browser tests use isolated local storage and loopback HTTP. Runtime URLs are
fulfilled from verified local files; other external requests are blocked. Public
artifact fetching sends no user documents or models. AI tests use a local fake
service; no extraction requests were sent externally.

## Source identities

| File/reference | SHA-256 |
| --- | --- |
| Current `app/index.html` | `d04b27ecac2051f684d3f260908417c4edeeefd8d39223fba6e78f6974b73c32` |
| Current `src/financial_engine.js` | `ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936` |
| Immutable reviewed 0.7.6 archive | `621436999447bf6b06f85691cf2c0b2533ee2503e766085d8ae561e983a704ee` |

The engine is byte-identical to 0.7.6. Existing independent financial fixtures and
pre-extraction fingerprints pass. Formula input policy and date interpretation
change at the import boundary; no underwriting formula changes are intended.

The cumulative patch uses original source reconstructed by reversing the delivered
0.7.6 patch against its reviewed archive. Its HTML matches the recorded original
identity `40c16952d92395ac15c8b0a40059fed35a9fc2c4a41e7d974c65b7fe3750b95c`.
This does not reconstruct the original ZIP container or claim a new read of the
original upload. Earlier reviewed packages remain unchanged.

Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium
154.0.8037.57 on Linux. The resumed environment reset temporary logs/cache;
the full runs above and artifact verification were completed again afterward.

The pinned [CI workflow](../.github/workflows/ci.yml) was syntax-checked locally,
with read-only permissions and credential persistence disabled. It has not run on
GitHub. Node 20, Windows, other browser engines, live host APIs and direct-file
navigation remain unverified. See [CI scope](CI.md).

Cached spreadsheet results can be stale; historic dates before March 1900 and
Excel's fictional leap day remain a compatibility limitation. Broad malformed-file
corpora, PDF production digest checks, transitive license/provenance review,
host-side atomic saves and remaining synchronous calculation paths are still open.
See [the review and next steps](CODE_REVIEW.md) and
[runtime evidence](RUNTIME_DEPENDENCY_TESTS.md).
