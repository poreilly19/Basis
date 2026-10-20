# Changelog

## 0.7.9 — 2026-10-20 continued review

- Validate inflation year indices before sparse array expansion: require bounded nonnegative integers, reject duplicates and apply a workbook-wide expanded-value budget including gaps. Preserve supported rates and zero-fill behavior.
- Protect unsaved edits during Reload library independently of wall-clock ordering. A successful commit clears the dirty marker only for the exact current property/JSON snapshot; failed, older and unrelated commits keep newer edits dirty.
- Parse template number formats and cell styles from validated DOM metadata. Equivalent XML quotes, prefixes and attribute order preserve dates and actual imported analysis starts in both workbook epochs; monetary controls remain numeric.
- Add regression coverage for allocation boundaries, sparse schedules, clock collisions/rollback, save races and date-style compatibility, including actual Chromium and SheetJS paths. Financial engine source is unchanged.
- Validate 599 Node cases, 13 runner cases, 76 ordinary Chromium workflows and 17 real-runtime workflows.

## 0.7.8 — 2026-10-20 continued review

- Fetch both approved PDF reader/worker artifacts under byte/chunk limits and verify their exact length and SHA-256 before creating executable Blob URLs. Import only the reader into the window; pass the verified worker URL to PDF.js. Keep approved fallback, cancellation, deadlines and retries without a direct-URL bypass.
- Retain successful Blob pairs for the transport lifetime so active PDFs survive loader invalidation; revoke failed/cancelled URLs and support explicit owner disposal. Document secure-context/CSP requirements and the upstream local-worker fallback limit.
- Reject unusable formula caches, Excel errors and invalid shared-string indices in both custom XLSX readers with sheet/cell errors. Preserve cached zero, false and empty text, including equivalent XML syntax. Parse template cells/shared strings through the validated DOM so comments, CDATA and namespace prefixes cannot bypass checks.
- Add production-pin/manifest comparisons, same-size reader/worker tamper checks before execution, abort/resource regressions and native browser workbook fixtures. Financial engine source is unchanged.
- Validate 585 Node cases, 13 Python runner cases, 74 ordinary Chromium workflows and 16 real-runtime workflows. No runtime library code is bundled; hosted CI and broader release review remain pending.

## 0.7.7 — 2026-10-20 continued review

- Upgrade SheetJS from 0.18.5 to the official 0.20.3 artifact with a new SHA-384 integrity pin, strict version checks, source/license metadata and dependency notices. Keep the previous writer only as an isolated compatibility fixture.
- Reject imported formula/array-formula cells without usable cached results and input cells with Excel errors before table conversion. Preserve cached zero, false and empty text; leave ignored results/informational sheets outside this policy.
- Complete workbook date mappings for loan starts, valuation/cutoff dates and additional tenant/area/rent fields. Preserve both workbook epochs and retain unchanged financial engine code.
- Add portable Python invocation and runtime discovery that fail missing/altered caches, empty/all-skipped suites and test failures. Add a pinned CI workflow for Node/Windows/Ubuntu and Chromium; hosted CI execution remains pending.
- Validate 543 Node cases, 13 Python runner cases, 69 ordinary Chromium workflows and 16 real-runtime workflows, including old-writer/new-reader compatibility.

## 0.7.6 — 2026-10-19 continued review

- Load the spreadsheet library on demand with shared requests, a deadline, API/version checks, retry and pinned script integrity. Capture export inputs/filename before waiting and retain the validated library reference through conversion.
- Preserve the selected portfolio/scenario across legacy and native property reads; reject removed destinations and oversized JSON before reading/parsing. Stage member additions and preserve switches/edits made during their reads. Propagate preview Open failures to the shared action error handler.
- Clear the PDF worker module's imported main-thread handler so normal parsing starts a dedicated Worker. Verify both approved versions with actual runtime bytes and an original PDF fixture.
- Preserve 1904 workbook date epochs across legacy/custom imports and XL4ADW exports. Reject malformed Office XML, avoid repeated nested Word-table text and honor equivalent PowerPoint namespace prefixes.
- Add separate hash-pinned runtime integration tests, reproducible public artifact fetching and a targeted dependency/license record. Runtime libraries are not bundled or upgraded; broader advisory, provenance and cross-browser work remains open. Financial engine source is unchanged.

- Validate 519 Node cases, 69 ordinary Chromium workflows and seven real-runtime workflows.

## 0.7.5 — 2026-10-19 continued review

- Validate saved index IDs, memberships, storage-key ownership, headers/chunks and decoded models before activation or writes. Reject cross-property aliases, malformed encodings and oversized expansion while retaining compatible legacy defaults. Keep in-memory model reads synchronous through complete snapshot collection.
- Create a writable isolated recovery workspace after startup failure, retaining the original backend for validated Reload retries. Open another healthy saved property when possible, preserve unreadable source data and keep deliberately empty libraries empty.
- Load matched PDF reader/worker 4.x modules under deadlines with shared in-flight requests and retry after failure. Remove the classic 3.x fallback. Abort/timeout PDF opening, text, render and encoding work; release pages, loading tasks, documents and canvases, including late completions.
- Preflight PNG/JPEG/WebP/GIF header dimensions before pass-through or decoding, enforce pixel/edge budgets and check decoded PDF text output separately from input file size.
- Add canonical PDF, image and saved-workspace modules plus focused unit/browser regressions. The financial engine remains byte-identical to 0.7.4; external library integrity/live parsing and cross-device host atomicity remain open work.
- Expand validation to 476 Node cases and 58 Chromium workflows; preserve all previous regression cases.

## 0.7.4 — 2026-10-19 continued review

- Stage new/copy/scenario, rename, move and delete operations before publishing the live library. Commit parent records, complete property models and removals together. Reject a changed deletion selection and capture creation targets before asynchronous work.
- Keep failed actions from leaving phantom records, partially copied scenarios or orphaned properties. Preserve newer edits and pending inclusion/cache updates around overlapping saves.
- Freeze portfolio backup metadata, current inputs and loaded models. Verify saved index revisions around uncached reads to reject mixed-generation native and legacy backups, while retaining backups from fully loaded views after failed saves.
- Bind document extraction to its property/scenario/input and page selection. Claim jobs before awaits, abort retry waits, ignore late responses and validate staged inputs before applying. Replace commits the finished model as a new property and preserves edits made during its save.
- Bound document and pasted-text intake, reserve aggregate capacity across batches, limit PDF pages and release PDF/image resources. Keep file preview results attached to their latest selected filename.
- Expand coverage to 335 Node cases and 48 Chromium workflows, and document remaining host, dependency and resource-budget limits. Financial engine source and formulas are unchanged from 0.7.3.

## 0.7.3 — 2026-10-16 continued review

- Extract the canonical financial engine behind 18 exact pre-extraction result fingerprints and payoff-boundary checks. Preserve sample cash flow, debt and return results exactly across all three valuation modes.
- Run edit recalculations and on-demand sensitivity calculations in embedded workers. Cancel superseded work, enforce deadlines, restore typed arrays/aliases/payoff behavior and reject late results. Keep uncommitted input text during result refresh and restart when a legacy pane normalizes inputs mid-calculation.
- Give each document an independent recovery writer and each tab its own workspace selection. Preserve drafts on quota failure, migrate legacy snapshots without applying them automatically, and restore selected drafts as new properties through a keyboard-accessible recovery dialog.
- Persist portfolio valuation assumptions on scenario records. Migrate from the first saved member deterministically without rewriting properties, save metadata through revision-checked commits, and preserve settings/additive metadata in native and legacy portfolio backups.
- Synchronize eight canonical application modules and the embedded worker through the build, with 274 Node cases and 36 offline Chromium workflows. Synchronous startup, metadata/export and portfolio calculations remain documented follow-up work.

## 0.7.2 — continued review

- Align portfolio cash flow and sales by exact calendar month, label partial reporting periods, and preserve member-anniversary annual discount timing. Joint exits retain all assets, use explicit forward/trailing NOI and honor member selling costs. Workspace valuation settings now reach the calculation.
- Parse year-only expense-recovery base years correctly, including fiscal labels and option retention; preserve those years through native and legacy workbook interchange.
- Publish IndexedDB models, chunks, index and deletions in one revision-checked transaction. Reject stale tabs, preserve local edits for export, and provide Reload library with discard confirmation. Host editing keeps optimistic checks and immutable recovery snapshots; simultaneous remote writes still need server-side atomicity.
- Validate model records, IDs, dates and work-driving terms before calculation/import. Reject excessive absorption generation, malformed legacy models, duplicate property IDs and cyclic memberships.
- Add a canonical bounded Office ZIP reader, caller size checks, CRC/header/range verification and sparse worksheet row/column/cell budgets. Preflight ZIP-based legacy workbooks before the spreadsheet library.
- Add 80 Node regressions (163 total) and expand Chromium coverage to 18 workflows, including real two-tab conflicts, editable invalid portfolio settings, all visible routes and hostile XML references.

## 0.7.1 — 2026-10-15 review

- Reject native archives with incomplete manifest checksums, overlapping entries,
  mismatched headers, malformed descriptors, unsupported flags or ZIP64 fields.
  Bound streaming DEFLATE output and validate portfolio records before export.
  Retain draft v0 and supplied sample compatibility.
- Stage portfolio imports before publishing the library index. Surface write
  failures, retain prior model chunks during interrupted saves, recover stored
  models when snapshots are missing, and preserve unreadable indexes for recovery.
- Prevent stale opens, switching after failed saves, phantom failed copies and
  incomplete legacy exports. Allow native backup when autosave storage is full.
  Support native archives named `.zip`.
- Render model-controlled strings as text/DOM nodes; reject prototype keys and
  unsafe paths in legacy readers. Neutralize spreadsheet-formula text in CSV and
  clipboard exports. Reclaim download URLs and report asynchronous UI failures.
- Correct workspace NOI yield's extra percentage conversion and apply selected
  report IDs during command-search navigation.
- Fix zero-interest amortization and stop debt service after payoff. Share a
  bounded IRR solver across model/sensitivity/portfolio views, with checks for
  undefined, high-return, deep-loss and zero-padded flows. See financial validation
  for intentional differences and ordinary-case parity.
- Add native-module synchronization, 74 additional Node tests (83 total), 11 HTTP
  Chromium tests, dependency inventory and a prioritized review.

## 0.7.0 — supplied handoff

Standalone v7 application, extracted native archive modules, nine codec tests,
inline source/syntax checks, draft format specification and sample archives.
