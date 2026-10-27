# Validation snapshot — 0.7.18

Reviewed locally on October 25–26, 2026. This release completes the seven approved
usability changes and the expanded code review. Only the local chat project was
edited; Box files and earlier release archives were not changed.

## Checks

| Check | Result |
| --- | --- |
| Baseline `npm test` | 657 cases across 36 test files passed before the changes, plus build/source checks. |
| Final `npm test` | All 676 cases across 37 test files passed against the final app hash below, plus source/worker/syntax checks. |
| Final `npm run test:browser` | All 143 Chromium workflows passed in 280.385 seconds; the command exited with status 0. |
| `npm run test:dependencies` | All 17 actual-library PDF.js and SheetJS workflows passed in 32.063 seconds using the previously cached, manifest-verified artifacts. |
| `npm run test:runner` | All 13 runtime-runner cases passed in 0.146 seconds. |
| `npm run test:launcher` | Five portable cases passed; the sixth, native Windows CMD case was skipped on Linux. The run completed in 2.065 seconds. |
| Final focused layout checks | Both document source/input separation and Essentials full-date visibility passed in 5.686 seconds. |
| Build checks | Twenty-three main application modules match their canonical sources; the calculation worker matches its four source modules; all three inline scripts parse. |

The release browser command is a complete run after the last production change.
The sandboxed final Node attempt was blocked at the launcher's child-process
test (`spawnSync EPERM`); it was rerun with authorized subprocess access.
Earlier failing intermediate runs are not counted as passing evidence. Those
runs exposed the lease-drawer pointer timing bug and updated selectors for the
intentional setup, labeling and export changes. The invalid-import case now
verifies both a disabled Apply control and rejection through the direct apply
function, followed by a successful valid selection and source-log preservation.

## Coverage

- Guided setup validates inputs and respects portfolio/scenario boundaries;
  cancellation creates no property. Basics/Advanced preserves existing settings.
- Previous/Next lease navigation commits valid edits, rejects invalid amounts,
  and retains sections. A field commit cannot swallow a disclosure click.
- Document review and Apply use the same prepared model and selected field
  decisions. Tests cover kept/corrected area, annual rent normalization, invalid
  corrections across redraws, source references, context returns and decisions
  changing during asynchronous confirmation.
- Structured Model Checks target the intended record even with duplicate tenant
  names, return to updated findings and explain unsupported long holds. Clean
  reports still export a qualified no-findings row.
- Essentials retains editable identity/date/rent fields at the tested laptop
  width. Selection actions, report pins, corrupt preference recovery, save-backend
  labels, canceled/failed downloads and native round trips remain covered.
- Existing tests retain failed/atomic saves, stale tabs, scenario copies,
  crash recovery, archive integrity and bounds, hostile text/formula handling,
  pending/canceled calculations, multiple tenant groups, number precision,
  settings, mobile navigation and session-only API-key isolation.
- The portable launcher checks folder independence (including spaces), IPv4
  loopback serving, identical-version reuse, occupied-port/version refusal,
  missing files, invalid ports and browser-opening fallback. Native CMD execution
  is included in the Windows CI matrix but was not run in this environment.

## Visual evidence and environment

Nine screenshots in the companion `Basis_Studio_v7_18_Previews` folder cover
property basics, rent roll, desktop/phone lease editing, Model Checks, property
setup, document fields/source and export. At 1280 × 720 and 390 × 844, these
captures have no page-width overflow or uncaught browser errors. The source panel
reflows desktop review inputs beside it; Essentials dates display the full year.
These observations concern the tested fixtures and sizes, not every possible
model, zoom setting or assistive technology.

Environment: Linux x86_64, Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and
Chromium 154.0.8037.57. Ordinary browser tests block external HTTPS and use isolated
storage. Actual-library checks use `BASIS_DEPENDENCY_DIR` pointing at a verified
local cache. No AI provider was contacted and no live user documents or API keys
were used.

## Integrity

| File | SHA-256 |
| --- | --- |
| Final `app/index.html` | `53130ced926aee7a89cb4f969b658099dfa020e6c4a27ad3120ec4d6ee48186c` |
| Final `src/financial_engine.js` | `b55f2e83ad77409cffe3068a8fce7355aef2f10fe521150ac401146d679cc493` |
| Retained v7.17 ZIP | `353b1af0b8729da7dbfb6de7bb04b466790e39fa6614a85817f91d2595b2c91a` |

All engine source outside `validateModel` is byte-identical to v7.17. Financial
formulas and native schema v1 are unchanged; the import unit/precision fixes
intentionally change affected inputs. Packaging verifies the previous ZIP,
repeat-build identity, deterministic ZIP bytes/CRC, archive contents and an
incremental patch that reproduces the complete final project from v7.17. The
companion SHA-256 and package-verification files identify the release artifacts.

## Limits

Passing these tests is evidence for the cases exercised, not certification of all
financial calculations or source data. Live AI extraction accuracy, native
Windows execution, other browser engines, physical devices, screen readers and
representative-user task timing remain to be checked. No fresh external
vulnerability-advisory audit or legal clearance was performed. See the
[review priorities](CODE_REVIEW_0_7_18.md#remaining-priorities) for the remaining
financial, hosting, source-review and release work.
