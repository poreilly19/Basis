# Code review — 0.7.10, 2026-10-21

For the October 27 pass, see [the 0.7.19 accuracy review](ACCURACY_0_7_19.md)
and [its validation evidence](VALIDATION_0_7_19.md). The preceding broad pass is
[the expanded 0.7.18 review](CODE_REVIEW_0_7_18.md). The findings below retain
their original review scope and date.

Reviewed `Basis_Studio_v7_Codex_Handoff.zip`; fixes are in this updated handoff.
The original upload and earlier reviewed packages remain unchanged. This pass
removes redundant navigation, improves contrast and Title Case labels, adds
Workspace Settings, and isolates property tabs to their selected portfolio.
It makes document intake visible and adds session-only OpenAI/Anthropic API setup
alongside the existing host integration. Reviewed extractions still require Apply.
Version 0.7.9 bounds inflation schedule expansion before allocation, fixes reload
confirmation for unsaved edits under clock collisions/skew, and preserves workbook
dates across equivalent style XML. The previous pass verified PDF reader/worker
bytes before execution and closed silent input-loss cases in custom XLSX readers. Earlier work upgraded the spreadsheet
dependency, completed date mappings and added portable validation/CI, reliable
loading, stable import destinations, correct Office epochs/XML and runtime checks. Saved-workspace validation,
writable recovery, paired PDF deadlines and image dimension checks remain. Earlier
passes added atomic library actions, coherent backups, safer document extraction,
the extracted engine, workers, crash drafts and scenario-scoped assumptions. Results cover
defined cases, not every underwriting configuration. No public deployment or
project license declaration was made; dependency notices/license texts are enclosed.

## Findings fixed

| Priority | Finding and effect | Result |
| --- | --- | --- |
| High | Tenant, expense and loan names reached HTML/SVG markup in reports/editors. | Model-controlled content uses text nodes/DOM construction; Chromium checks hostile strings across affected views. |
| High | Legacy dotted paths could traverse prototypes; JSON was merged before reserved-key validation. | Validate before copying, reject unsafe segments, and use own-property traversal/null-prototype maps. |
| High | Native checksums could omit content; ZIP metadata/ranges were insufficiently checked; DEFLATE buffered expansion before validation. | Require complete v1 coverage, matching headers, descriptors, non-overlapping ranges and bounded streaming expansion. Checksums detect corruption; they do not authenticate a file's creator. |
| High | Save errors were swallowed, imports could expose partial portfolios, and interrupted chunk writes damaged previous data. | Return operation failures, stage portfolio imports, and publish generation-specific model chunks through a final header write. |
| High | Missing snapshots could replace stored data; failed saves or stale opens could lose the active recovery snapshot. | Reload stored data, abort failed switches, ignore stale requests and preserve unreadable indexes for recovery. |
| High | Zero-rate loans paid no principal; fully amortized loans could continue charging principal. | Independent debt fixtures now verify amortization and stopping payments after payoff. |
| Medium | Fixed IRR brackets rejected valid returns and produced rates for zero flows; reports used different solvers. | Share a bounded solver with sign/finite checks and stable evaluation. Multiple-sign-change flows can still have several roots. |
| Medium | Model-controlled CSV/clipboard text could become spreadsheet formulas. | Prefix formula-like text and escape separators; retain numeric values. |
| Medium | Workspace NOI yield was 100 times too high; command search ignored selected report destinations. | Correct percentage conversion and apply report IDs when navigating. |
| Medium | Generic ZIP uploads were misrouted; legacy exports silently skipped missing models; full storage could prevent native backup. | Route native ZIP correctly, fail incomplete exports visibly, and export live models after autosave failure. |
| High | Month offsets were rounded to years; joint sales dropped shorter-held assets and used incomplete/trailing income. | Align operating and sale cash by actual month; retain all assets to joint sale and use explicit forward/trailing terminal NOI with member selling costs. |
| High | Workspace valuation settings were discarded; stale browser tabs could overwrite newer models/indexes. | Pass settings through; revision-check and atomically commit browser models/index in one transaction. Conflicts retain exportable edits and offer Reload library. |
| High | Large lease terms, payment spreads, absorption counts or sparse Office XML references could freeze calculation/import. | Apply structural/work limits before calculation, bounded Office ZIP expansion and worksheet allocation budgets. |
| Medium | Year-only recovery base years from importers were ignored, or treated as Excel date serials. | Parse explicit calendar/fiscal year labels and preserve them through native and legacy interchange. |
| High | Tabs overwrote one shared crash snapshot; startup could apply that snapshot to an existing property. | Give each document its own recovery writer, preserve legacy keys, open saved library data at startup, and explicitly restore drafts as new properties. Quota failures preserve existing copies and expose the current in-memory copy. |
| High | Portfolio valuation assumptions followed whichever property was open. | Store validated settings on each scenario, migrate deterministically from saved members, commit atomically and retain settings/additive metadata in native and legacy backups. |
| Medium | Normal edits and sensitivity grids could block the UI; stale calculations could publish old output. | Run these paths in cancellable workers with deadlines, snapshots and generation guards. Retry legacy pane normalization and preserve focused input text during output refresh. Remaining synchronous paths are documented. |
| Medium | Financial implementation existed only inside a large HTML file. | Extract the canonical engine with 18 exact pre-extraction result fingerprints, frozen input checks and payoff hydration tests; synchronize source and worker bundle during build. |
| High | Concurrent property creation could publish an index entry before its model; batch copies/deletes could commit only part of an action. | Stage complete action drafts and publish all affected models and metadata in one revision-checked transaction. Reject changed confirmation membership and preserve state on failure. |
| High | Uncached portfolio collection could mix model/index generations while another page saved. | Freeze loaded input/metadata snapshots and bracket uncached reads with actual saved revision checks; refuse inconsistent backups visibly. |
| High | Extraction replies and Apply could reach a different property or overwrite edits made during asynchronous work. | Bind jobs/reviews to property, portfolio, scenario, model and selected pages; guard all awaits, stage/validate inputs and save final Replace copies atomically. |
| Medium | Non-Office files, pasted text and PDF page counts lacked read budgets; older preview reads could replace a newer selection. | Enforce file/count/aggregate/page bounds, release PDF/image resources and correlate preview publication with the latest read generation. |
| High | Stored library metadata, model headers/chunks and model bodies could be adopted without complete validation, including cross-property chunk aliases. | Validate before activation, caching, commit and startup; enforce owned model keys, bounded chunk/JSON expansion and valid model structure. Preserve a coherent in-memory chunk snapshot across asynchronous reads. |
| High | Startup failure could leave an unwritable recovery workspace or inherit a revision from the unreadable source; an empty saved library could gain demo data. | Create an independent writable memory workspace, retain the original source for validated reload, and distinguish a valid empty library from an absent index. |
| Medium | PDF reader/worker imports could hang or mix incompatible versions; document removal did not stop pending reads/renders. | Validate matched 4.x module pairs, bound imports/open/page/render/cleanup work, abort on Remove/Clear, reject stale results and clean up late resources. Remove the obsolete classic fallback. |
| Medium | Small compressed images or PDF text could exceed practical decoded budgets. | Inspect actual image headers before decoding or passing through; enforce 40-megapixel/16,384-edge limits, bounded canvases and per-page/cumulative UTF-8 PDF text limits. |
| High | The imported PDF worker handler forced actual PDF.js parsing onto the main thread. | The production transport no longer imports the worker into the window; clear stale handlers before opening. Real artifacts start dedicated Workers for both approved versions under the tested configuration. |
| High | CDN PDF modules executed without authenticating their bytes. | Fetch both artifacts under exact size/chunk limits and verify SHA-256 before creating executable Blob URLs. Abort failed/timed-out pairs; permit only approved verified fallback pairs. |
| Medium | First Excel use could fail while the startup script was still loading, and later globals could change readers/writers. | Load on demand with shared deadlines, validation, retry and SHA-384 SRI; retain the chosen library and captured export state. |
| High | Oversized portfolio JSON bypassed pre-read limits; slow property/member reads could publish into a later selection. | Bound JSON before reading/parsing, capture native/legacy destinations, reject removed targets and stage member publication against unchanged context. |
| High | Valid 1904-calendar workbooks shifted dates by 1,462 days; exports retained the epoch while writing serials for another epoch. | Carry the workbook epoch through legacy/custom readers and the XL4ADW writer; independent fixtures verify exact dates and round trips. |
| Medium | Malformed Office XML could yield empty/partial data; nested Word tables repeated text and equivalent PowerPoint prefixes lost slides. | Check native parser errors and required parts, extract each nested paragraph once and resolve relationships by namespace. |
| High | The old spreadsheet release fell within two upstream advisory ranges. | Use official SheetJS 0.20.3 with a new integrity pin and strict API/version validation; retain the old artifact only for isolated trusted compatibility tests. |
| High | Formula cells without results and Excel errors could become blank/zero financial inputs. | Reject unusable caches and input errors with a sheet/cell error in both SheetJS and custom XML readers; retain valid cached values without recalculation. |
| High | Invalid shared-string references in custom workbook readers silently became blank inputs. | Parse actual DOM cells/shared strings, require a nonnegative safe-integer index inside the table and report the sheet/cell on failure. Comments/CDATA cannot manufacture caches; namespace-prefixed formulas are checked. |
| Medium | Some known date columns, including loan starts, did not interpret Excel serials. | Complete date mappings and verify modern dates in both workbook epochs before model validation. |
| Medium | Shell-specific discovery could produce a false successful run with zero runtime tests. | Discover inside Python; fail empty/all-skipped suites and bad caches, preserve argv/status through a portable launcher, and add pinned CI configuration. |
| High | A tiny legacy workbook could expand an unchecked inflation year index into billions of zero-filled array entries. | Validate integer indices and duplicates before allocation; bound each series and the workbook-wide expanded values, including sparse gaps. |
| High | Reload library compared edit/save timestamps; edits sharing a save timestamp or following a clock rollback could be discarded without confirmation. | Use a dirty marker cleared only when a successful commit stores the exact current model snapshot; older/unrelated/failed commits retain it. |
| High | Equivalent style XML with single quotes or namespace prefixes left date serials numeric, changing the imported analysis start to a default. | Read format/style metadata from validated DOM nodes and verify dates plus resulting model starts in both workbook epochs. |
| Medium | Property tabs and the active editor could show a property from another selected portfolio. | Filter tabs by portfolio; guard model/report/document views until a matching property is opened, while remembering each portfolio's tabs. |
| Medium | The extraction workflow was absent from visible navigation and assumed a host AI service. | Expose Document Import and Settings; add bounded OpenAI/Anthropic adapters with session-only keys, explicit extraction, review and Apply. |
| Medium | Changing AI providers could leave the wrong model ID selected or expose stale extraction results. | Restore the configured model when returning to a provider, cancel active requests and invalidate reviewed results on setup changes; refresh late host availability in Settings. |
| Medium | Workspace redraws closed Library Actions and lost keyboard focus during recovery. | Retain the menu element and focused control across redraws; check refresh, keyboard navigation and focus after restoring a draft. |

## Verification performed

- Original baseline: nine supplied codec tests and source/syntax checks passed in the initial review.
- `npm test` passes 633 cases. Final browser results, commands and hashes are recorded in [the 0.7.10 validation snapshot](VALIDATION_0_7_10.md). Sixteen canonical application modules and the worker bundle match source exactly; all scripts parse.
- Chromium workflows exercise real downloads/uploads, scenario/exclusion backups, corrupt input, edits across switch/reload, injected failed commits, stale tabs, recovery dialogs, invalid settings, model/workbook attack inputs, mobile navigation, command search and all visible routes. Worker tests cover exact results, cancellation, latest-snapshot publication, input preservation, retry and the embedded worker with external requests blocked. New workflows exercise atomic actions and document extraction with a local fake service; no external extraction requests were made.
- Earlier Node cases cover corrupt saved indexes/models, storage-key ownership, bounded chunk expansion, independent writable recovery, PDF module failure/retry, cancellation and cleanup, UTF-8 text budgets and image-header limits. Chromium adds recovery/source reload workflows, intercepted paired PDF module loading, pending open/render cancellation and actual PNG/JPEG/WebP canvas conversion.
- The 0.7.6 pass added 43 Node cases: 15 spreadsheet-loader, 15 import-lifecycle, eight XML, three Office date and two legacy date cases. Eleven additional ordinary browser workflows cover imports and native Office date/XML behavior.
- The ordinary browser harness blocks external HTTPS and uses synthetic external modules. Seventeen optional Chromium checks last passed in 0.7.9 against actual hash-verified PDF.js/SheetJS artifacts: dedicated workers, text/raster/cleanup, corrupt PDF, XLSX round trips/edits, 1904 dates, captured exports and browser SRI rejection/retry. Those runtime sources remain unchanged; this UI pass does not repeat the optional runtime suite. See [runtime dependency evidence](RUNTIME_DEPENDENCY_TESTS.md). Live AI/host APIs, broader file corpora and other browsers remain unverified.
- Earlier sample comparisons against immutable 0.7.1 and 0.7.2 packages match annual/monthly/debt arrays, valuation components and both IRRs exactly in all three discount modes. Historical original-upload comparisons remain documented separately in [financial validation](FINANCIAL_VALIDATION.md). The original ZIP was unavailable in the current execution environment; this pass does not claim a new read of it.
- The 0.7.7 pass added 24 Node cases, 13 stdlib runner cases and nine real-workbook workflows. The 0.7.8 pass added 42 Node cases for PDF verification/loading and custom workbook cells, plus five ordinary browser methods for tampering and native XML input validation. Version 0.7.9 added 14 Node cases, two ordinary browser methods and one real-runtime method for inflation expansion, reload dirty-marker and date-style regressions. Version 0.7.10 adds 34 Node cases and nine browser methods for preferences, adapter formats/errors/cancellation, key lifetime, reviewed Apply, themes, navigation and portfolio boundaries. The pinned workflow has not run on GitHub. See [CI scope](CI.md) and [spreadsheet input policy](SPREADSHEET_UPGRADE.md).
- The financial engine is byte-identical to 0.7.9. This pass changes preferences, navigation and AI transport; underwriting formulas are unchanged.
- Environment: Node `24.19.0`, Python `3.12.14`, Playwright `1.62.0`, Chromium `154.0.8037.57` on Linux. Node 20 and other browser engines were not exercised.

## Recommended next steps, in order

For this UI update, first try the Windows localhost workflow with a representative
lease, rent roll and P&L. Compare every proposed input with the source, including
dates, annual/monthly rent, reimbursements and expenses, before Apply. Exercise a
live OpenAI or Anthropic account to confirm model access, browser CORS and billing;
the automated tests use fake responses and establish workflow behavior, not
extraction accuracy. Try light/dark mode, autosave off/on and switching between
two portfolios with real working models. Then continue the broader backlog:

1. **Complete dependency and real-file validation.** SheetJS 0.20.3 is selected after reviewing upstream metadata, licenses and the two published advisory ranges; this is not a complete security audit. Review pinned PDF versions and bundled-component notices, and broaden malformed-file, encrypted-PDF, font/form and desktop Office fixtures. Cached formulas can be stale; early-1900 serials still need a calendar compatibility decision. See [spreadsheet upgrade evidence](SPREADSHEET_UPGRADE.md).
2. **Finish host-side concurrency and recovery.** IndexedDB uses atomic revision checks, but the host document API lacks a documented compare-and-swap. Add server-side transactions, authenticated snapshot restoration and retention; see [storage](STORAGE.md).
3. **Move remaining expensive calculations off the UI thread.** Startup, switching, metadata, exports and portfolio panes retain synchronous paths. Add measured model complexity budgets/reference constraints. Native ZIP still permits 256 entries, including at most 253 property entries; see [worker scope](CALCULATION_WORKER.md).
4. **Broaden financial and device validation.** Add independent fixtures for complex rollovers, recovery gross-up/caps, floating/future-funded debt and valuation-day combinations. Exercise Safari/iOS, Firefox, Edge, keyboard, screen readers and worker/CSP restrictions. Existing output fingerprints preserve behavior but do not independently prove every formula.
5. **Exercise CI and continue decomposition.** Run the new workflow on GitHub, especially Node 20 and Windows, and keep runtime cache pins reviewed. Extract remaining UI/schema boundaries behind fixtures. Define multi-scenario merging/versioning and larger archives before expanding collaboration.
6. **Complete release review.** Review historical visual/report expression, asset provenance, optional AI disclosure/retention, extension naming and license choice. PDF deadlines cannot preempt synchronous fallback parsing or cancel native imports; image limits do not bound every animation frame. Nothing was publicly deployed or published. These tests are targeted evidence, not financial certification or public-release clearance.
