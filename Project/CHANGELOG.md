# Changelog

## 0.7.28 — 2026-10-27 neutral workbook terminology

- Replace product-specific workbook labels, internal navigation identifiers and documentation with neutral terminology while retaining input-template import/export and report-workbook features. Financial calculation behavior is unchanged; historical feature-inventory text is explicitly marked as edited for distribution.

## 2026-10-27 — GitHub Actions and Workers deployment setup

- Resolve runtime-cache paths in step contexts, where `runner.temp` is available, and pass `--cache` explicitly to runtime tests. Keep downloaded fixtures outside the checkout. This corrects the workflow setup rejection without changing application files or underwriting calculations.
- Bind the Windows local preview server exclusively. A second launch now checks the running app identity instead of binding the occupied port and hanging; a different release retains the occupied-port explanation. Add a competing-listener regression without changing application HTML or financial calculations.
- Wait for the initialized workspace in beta browser tests after initial navigation and reload, avoiding Chromium's Windows Promise-collection error. Keep exact saved-model, calculation-worker and native-backup assertions unchanged.
- Add static-assets-only Workers deployment configuration and document the selected free hostname, Worker-scoped Access and disabled previews. Reuse the verified release bundle and its security headers without changing application bytes.

## 0.7.27 — 2026-10-27 Cloudflare beta handoff and report reconciliation

- Correct workbook cash-flow detail: exclude reference-only expenses/capital from outflow lines while retaining their assumptions, and include non-operating ground rent. Add independent signed-credit, leasing/capital and debt subtotal fixtures; financial engine unchanged.
- Correct the related annual/monthly Cash Flow, As Of and CSV detail paths; preserve signed credits and numeric precision and include nonoperating ground rent, incentives, deposits and debt funding/payoff rows.
- Correct related Executive Summary, portfolio, resale and valuation credit signs; use the engine’s complete leasing total, including tenant incentives, in Returns Over Time and Yearly Valuation.
- Add File → About Basis with the release version, in-app privacy/limitations and an explicit allowlist of downloadable support information. Do not collect property data, keys, provider settings or browser storage.
- Add a bounded local/hosted release verifier, Pages canonical-route/custom-404 support, optional environment-only Access service credentials and an anonymous Access gate probe. Reject tampered files, unsafe inventory, mismatched security headers, unexpected redirects and unconfirmed access.
- Prepare separate production/preview/custom-domain Cloudflare Access setup using a harmless placeholder before uploading the application. No live deployment or invitations performed.
- Preserve modified files in existing build directories instead of overwriting them, add a static 404 to disable Pages default SPA fallback, and integrate deployment verification in CI. See [Cloudflare handoff](docs/CLOUDFLARE_BETA.md) and [validation](docs/VALIDATION_0_7_27.md).

## 0.7.26 — 2026-10-27 report workbook and beta preparation

- Add a real Excel report package with seven sheets: the five familiar reports, a guide and recorded assumptions. Preserve numeric precision, area/currency labels, tenant groups and detailed terms; distinguish report exports from native model backups and vendor import templates.
- Recalculate one captured property/scenario snapshot for both workbook and retained JSON report exports. Cancel stale or explicitly cancelled work, surface dependency/save failures, and preserve formula-looking text as text.
- Add an explicit Test AI Connection action with cancellation, bounded timeout and credential-safe errors. Send only a small fixed test payload; retain session-only credentials and the existing extraction/review/Apply flow.
- Add a minimal reproducible static beta build, release/member hashes, privacy/limitations pages, direct runtime inventory and matching response security headers. Register manual-save listeners so saving works with the stricter script policy.
- Add independent report fixtures, lifecycle regressions and served-build browser checks using actual pinned PDF/XLSX libraries. Configure future Chromium/Firefox/WebKit and Windows deployment smoke jobs. Preserve the financial engine, native codec/schema and restored ribbon layout.
- Document hosting, tester acceptance, feedback, backups and rollback. No public deployment, live API validation, license selection or broad financial certification is performed. See [beta handoff](docs/BETA_DEPLOYMENT_0_7_26.md) and [validation](docs/VALIDATION_0_7_26.md).

## 0.7.25 — 2026-10-27 reference ribbon and left Navigator

- Restore Portfolio / Inputs / Reports modes and File / Home / View / Reports ribbon tabs. Match all 19 Home buttons and the View/Reports button labels, order, groups and icon placement to the supplied HTML.
- Restore the left portfolio/building Navigator, scenario header, property grid sorting/grouping/classifications and blue save-status footer. Keep buildings and open tabs within the selected portfolio/scenario.
- Wire ribbon controls to corrected library/scenario actions, the property wizard and native/legacy import/export workflows. Add keyboard-operated menus, focus retention and explicit async error handling; guard report opening against failed loads and context changes.
- Keep Settings, AI Document Import, recovery, backup and portfolio metrics/chart accessible. The historical Report Workbook entry opens the current explicitly labeled JSON report export; historical workbook generation is not restored.
- Add seven browser workflows for reference parity and restored control behavior, and adapt existing workflows to the visible ribbon. Financial engine, native codec, AI extraction, readers, storage and launchers are unchanged. See [layout details](docs/RIBBON_0_7_25.md) and [validation](docs/VALIDATION_0_7_25.md).

## 0.7.24 — 2026-10-27 supplied interface look and feel

- Match the newly supplied HTML's compact blue-and-gray theme, small BASIS header, square panels, thin section/page tabs, dense form/table spacing and charcoal dark mode. Preserve one font, title case, numeric formats and mobile touch controls.
- Show current property metrics in wide desktop headers using the same calculated results as Summary. Hide them while calculation is pending, in Workspace or outside the selected portfolio/scenario. Keep Summary and Model Checks on all screen sizes.
- Restore a collapsible Workspace portfolio navigator and a searchable, sortable property grid. Scope the property list to the selected portfolio/scenario, reuse current open/selection actions, and save In Roll-up changes through the existing atomic library action. Adapt the grid to labeled rows on phones.
- Keep Settings, document extraction/review/Apply, tenant groups, the lease editor, recovery, imports/exports and corrected calculation modules. Keep less-used library/scenario actions in their menus and the NOI chart in a disclosure.
- Add four browser workflows for metric freshness, scope boundaries, navigator behavior, inclusion save failures/reload and phone grid access. See [interface notes](docs/APPEARANCE_0_7_24.md) and [validation](docs/VALIDATION_0_7_24.md).

## 0.7.23 — 2026-10-27 original desktop layout restored

- Restore horizontal section/page tabs, scoped open-property tabs and full-width Model/Insights panels using the current corrected code. Retain Summary, mobile navigation, Settings, Document Import, the lease editor, tenant groups, title case, one font and numeric formatting.
- Keep property tabs within both the selected portfolio and scenario. Preserve active identity while loading and prevent a late load from reversing a newer context selection.
- Save before closing an active tab; retain it on failed save/read, changed context or intervening edits. Close the last tab into Workspace and preserve every saved model. Reopen it when returning to Model.
- Add keyboard navigation and selection for all tab rows, with focus preserved through redraws and contained horizontal overflow. Retain all Model and Insights routes.
- Add eight workspace lifecycle cases and six browser workflows; adapt navigation tests to the restored tab roles and keep the existing mobile, source-review, financial and data-integrity coverage. See [layout details](docs/LAYOUT_0_7_23.md) and [validation](docs/VALIDATION_0_7_23.md).

## 0.7.22 — 2026-10-27 document-period reconciliation

- Compare each rent roll using its own date; exclude vacant asking rent and uncommenced leases from current rent, and flag missing current steps, unresolved expired occupancy, unsupported units and escalation rules.
- Include explicit zero and signed totals. Compare reported-period expenses before annualizing model inputs, preserve accounting credits, and annualize supported partial-period per-SF expenses as well as dollar amounts.
- Withhold unsupported amounts, periods, percentages, bases and subtotal rows from expense/income proposals. Inherit a supported statement period when line months are omitted; never assume an unknown period is annual.
- Add Document Totals with match/mismatch/incomplete states, per-file dates/periods and source links. Handle repeated source rows, conflicting chunk totals and mixed periods/columns conservatively.
- Request explicit actual/budget/forecast periods, original-period amounts and total scope in extraction prompts. Show annualization periods for other income and preserve them in its source log.
- Add 37 independent reconciliation/input cases and eight browser workflows. Document public-alpha readiness and the limits of a general-layout copyright argument. No UI rollback, license choice or publication is performed. See [details](docs/AI_EXTRACTION_0_7_22.md) and [validation](docs/VALIDATION_0_7_22.md).

## 0.7.21 — 2026-10-27 document amendments

- Request explicit amendment execution dates, rent/recovery treatment and effective dates. Separate full rent replacements, replacements from a date and changes to listed steps; never use upload order or reporting as-of dates to establish amendment chronology.
- Combine supported amended rent with a documented base lease or supported current-model history. Preserve earlier absolute schedules and supported annual escalations before a replacement. Retain per-SF units and enforce complete-history, date, chronology and 1,000-step checks.
- Patch recovery fields without losing unchanged base years, stops, gross-up or cap treatment. Preserve explicit zero/false. Require complete replacement clauses for method changes, and block future recovery changes that the current per-lease model cannot date. Use the analysis start selected in the same import.
- Block Apply for unresolved amendments while retaining editable field review. Keep Current or a complete manual correction can resolve a blocker. No partial model write or new-property save occurs while blocked. Retain both base and amendment citations through review, mapping and native source-log metadata.
- Add 37 deterministic amendment cases and ten browser workflows with independent monthly/annual expectations, native round trips and direct Apply enforcement. Financial engine, native schema, file readers and launchers are unchanged. See [findings and limits](docs/AI_EXTRACTION_0_7_21.md) and [validation](docs/VALIDATION_0_7_21.md).

## 0.7.20 — 2026-10-27 AI extraction and source review

- Preserve partial rent abatement as its actual months, share and base/gross scope. Keep these fields together in review and reject unsupported timing, shares or scopes without altering the existing grant.
- Reject rent without supported units, malformed amounts, invalid step dates and incomplete/conflicting schedules. Withhold a bad schedule as a whole and leave that tenant unchecked by default. Preserve per-SF rent when reviewed area changes, including schedules and missing-area inputs.
- Require an explicit Apply To choice for ambiguous/fuzzy tenant matches. Keep unspecified suites from joining multiple leases, block duplicate selected targets, and reset field decisions when the target changes.
- Bind citations to local upload IDs, retain field-specific sources through merging/review/logging, distinguish found/unmatched/excluded/image citations, and open the correct upload when filenames repeat. A text match does not verify a financial interpretation.
- Stop inferring new expense recoverability from its category. Unknown new expense flags remain unchecked by default; explicitly including one adds a non-recoverable line with a note. Existing flags are preserved unless the source states a value.
- Separate provider extraction instructions from untrusted document messages and request exact field citations without inventing missing units or converting partial abatements. Fix the area correction editor disappearing before a value was entered.
- Add synthetic source documents, independent monthly cash-flow expectations, 31 extraction cases, two provider-request cases and nine browser workflows. The financial engine and native schema are unchanged. See [extraction findings and limits](docs/AI_EXTRACTION_0_7_20.md) and [validation](docs/VALIDATION_0_7_20.md).

## 0.7.19 — 2026-10-27 financial and document accuracy

- Correct expense gross-up below 10% occupancy without changing fixed expenses, zero-occupancy reimbursements or disabled gross-up. Preserve the existing monthly/annual occupancy policy.
- Calculate levered returns for loans with no initial advance but actual future draws. Ignore financing that begins after the selected hold when deciding whether levered results exist. Apply the same rule in price/hold sensitivities.
- Show deferred/draw-only financing in the IRR Matrix, Returns Over Time and Valuation & Return Summary. Reconcile Present Value report rows to their totals under the valuation-day adjustment in every discount/period mode.
- Flag valuation dates outside the first analysis month, with a Model Checks link to the input; retain the established within-month valuation convention and the entered date.
- Make an imported explicit expiry take precedence over a retained term-length mode. Map supported later free rent to its actual lease month, honor explicit zero months, and select entered months instead of a stale market override. Use reviewed commencement dates for dependent rent steps/free-rent timing.
- Review expiry/date mode and free-rent amount/start/basis together. Unsupported fractional or off-anniversary free-rent timing is left unapplied with a review note, rather than silently moved or rounded. Existing additional free windows are retained and flagged for review.
- Add 20 financial/diagnostic cases, nine import-mapping cases and five browser workflows. Existing pre-extraction output fingerprints are retained unchanged. See [findings and limits](docs/ACCURACY_0_7_19.md) and [validation](docs/VALIDATION_0_7_19.md).

## 0.7.18 — 2026-10-26 guided workflows and expanded review

- Complete the seven approved usability improvements: guided property setup, Lease Basics and previous/next tenant navigation, contextual document imports, actionable Model Checks, compact rent-roll columns and report shortcuts, clear save/export controls, and a relative-path Windows launcher.
- Correct the analysis-months display. Limit new holds to the engine's supported 1–40 years; retain longer imported holds unchanged and flag the 40-year projection limit with a link to the input.
- Keep annual rent in annual-dollar units when area is missing. Preserve fractional source area, expense rates, rent schedules and annual-to-per-SF conversion precision during document import. Flag fixed per-SF escalations that still need area. Display formatting remains separate from stored values.
- Review tenant proposals field by field, retain current values, correct inputs and view uploaded source text/scans. Keep dependent rent amount/unit/schedule decisions together. Preserve invalid drafts through redraws, block their application, and reject changed review decisions during asynchronous confirmation. Return contextual imports to highlighted tenant/expense rows.
- Keep drawer sections open when committing a field and clicking a disclosure or changing tenants. Retain advanced lease fields, multiple tenant groups, scenario/portfolio actions, all report destinations, old file formats and native schema v1.
- Label saves by their actual backend and show saved time. Export editable backups, Excel/JSON models or results, and current CSV reports. Recover safely from malformed report-shortcut preferences and export an explicit no-findings row for an empty Model Checks report.
- Add optional structured validation targets without changing financial calculation code. Index validation's lease lookups and cache summary checks across repeated renders.
- Add 19 code regression cases, 14 browser workflows and six launcher checks (the native Windows case runs only on Windows). See [review findings](docs/CODE_REVIEW_0_7_18.md), [workflow guide](docs/USABILITY_0_7_18.md) and [validation](docs/VALIDATION_0_7_18.md).

## 0.7.17 — 2026-10-23 area and rent number formats

- Show area as comma-separated whole numbers, per-SF rents as dollars with two decimals, and annual/monthly totals as dollars with commas and cents when present. Apply the formats to the rent roll, lease drawer, phone cards, area inputs, market rent categories/profiles, ground leases, absorption and miscellaneous rents.
- Reveal and select the full saved value on focus, accept pasted US numbers/currency, and preserve decimal precision in calculations, autosave and native files. Reject invalid or partially numeric entries without changing the saved value; keep numeric keyboard hints and aligned digits. Unit changes immediately refresh the format and retain the entered magnitude.
- Preserve linked market categories when viewing a rate without editing it. Retain market-percentage inputs and percentage schedule steps. Give currency totals more room in the tables.
- Fix new Base rent-schedule rows assuming $/SF/year for every lease. Copy the lease's annual, monthly or per-SF unit and amount, or its market percentage, into the new row. Verify the resulting monthly amounts against independent flat-rent examples; the financial engine and native schema are unchanged.
- Add six formatting/parser cases and nine browser workflows for precision, pasted/invalid values, keyboard editing, unit changes, linked rates, schedule units, phone layouts and save/reopen/native round trips. See `docs/NUMBER_FORMATS_0_7_17.md` for completed validation.

## 0.7.16 — 2026-10-23 consistent typography

- Use one system UI font for navigation, buttons, text fields, dates, tenant rows, summary metrics and financial reports. Remove the separate Inter override and typewriter-style interface text; reserve monospace for raw source/code previews.
- Keep numeric columns right-aligned with tabular digits. Use the same font in light and dark themes and on phones, without downloading fonts or adding dependencies.
- Pass the 651-case baseline, source/worker/syntax checks and ten existing desktop/mobile usability and contrast workflows. Inspect ten desktop/phone views: one UI font stack, no page-width overflow and no uncaught browser errors. Financial engine and application logic are unchanged; embedded script differences are limited to font-style values.

## 0.7.15 — 2026-10-22 compact navigation and phone tenant cards

- Move property metrics behind Summary, with the active property/context, pending/error states and a dash for value per SF when rentable area is zero. Close the summary on context changes and retain one primary navigation bar on phones.
- Replace the two modeling tab rows with one collapsible Model/Insights sidebar. Keep all destinations, command search and shortcuts; use the same section tree in a keyboard-accessible modal on smaller screens.
- Replace open-property tabs, the duplicate picker and arrow buttons with one property selector and a portfolio/scenario context dialog inside the work area. Restrict choices to both the selected portfolio and scenario, retain save/calculation controls, and show the actual active property while another property loads.
- Show tenant cards on phones with rent units, lease dates, groups and Edit Lease. Retain the editable table and full-screen drawer, and restore focus to the visible card. Block duplicate/delete shortcuts from acting on a hidden table selection after resizing.
- Keep navigation/view state outside native model data. Preserve the removed logo subtitle, native schema v1 and the byte-identical financial engine. Add nine browser workflows, including all sidebar destinations, small-screen layout, context boundaries, delayed property loads and hidden-table shortcut protection.
- Validate all 651 code cases and 13 runner cases. The full browser run passes 119 of 120; the remaining scenario-copy case times out during page-load setup and passes unchanged on a targeted rerun. Record the exact results and limits in `docs/VALIDATION_0_7_15.md`.

## 0.7.14 — 2026-10-22 lease editing, intake review and group actions

- Open lease details in a side drawer beside the rent roll, with grouped sections, basic rent/recovery controls and the existing rent schedule. Preserve scroll position, uncommitted typing during calculation, focus on close and property boundaries. Opening the drawer does not initialize optional model arrays. Use a full-width drawer and stacked form fields on phones.
- Show Upload → Review → Apply progress and configure document AI in place. Keep documents and pasted text while configuring; retain memory-only API keys and explicit Extract. Compare current/proposed inputs and source quotes using the actual Apply mapping; include copy-mode removals and follow-up notes, and block empty selections.
- Fix selected imported going-in cap rates being ignored by Apply. Validate the mapping with an independent $12,000 NOI / 8% = $150,000 purchase-price case; financial engine source is unchanged.
- Display named group chips, filter the rent roll and assignments by group or tenant/suite, and add/remove a group for selected tenants. Validate every batch before mutation, preserve other memberships, reject stale selections and make each batch a separate undo step. Keep filter/selection state scoped to the active property and outside saved files.
- Add a canonical workflow UI module, focused browser coverage and atomic bulk-group cases. Native schema and workbook formats remain unchanged. See [workflow guide](docs/WORKFLOWS_0_7_14.md) and [validation](docs/VALIDATION_0_7_14.md).
- Validate 651 code cases, 13 runner cases and all 111 browser workflows; pass all ten new workflows again after the final imported-group filter fix. Inspect desktop, phone and dark-mode previews. Live AI accuracy and other browser engines remain unverified.

## 0.7.13 — 2026-10-21 multiple tenant groups and feature comparison

- Assign multiple tenant groups using a searchable checkbox dialog from Tenant Groups, Rent Roll classifications or Edit. Retain the compact Essentials view, keyboard focus, cancellation and stale-edit checks.
- Preserve old scalar memberships and new arrays in native property/portfolio and Basis XLSX/JSON model files. Reject malformed arrays; distinguish blank workbook cells from explicit empty assignments. Keep dangling IDs visible and preserve other memberships when deleting a group.
- Copy memberships independently into scenarios and contract renewals; show group names in Tenant Summary and basic report tenant tables. Count each tenant once per assigned group without changing financial calculations.
- Restore the Workbook Import / Export navigation entry and disclose the adapter's unsupported tenant classifications on import/export. Make Source Log CSV work outside the optional host service. Restrict the bulk NOI row to its labeled analysis years.
- Compare the reattached original ZIP with this release: no registered model/report pages, builders or default top-level model fields removed. Document inherited incomplete exports and remaining accuracy work in `docs/FEATURE_REVIEW_0_7_13.md`.
- Add thirteen code cases and nine browser workflows; see `docs/VALIDATION_0_7_13.md` for completed checks and limits. The canonical financial engine is unchanged from 0.7.12.

## 0.7.12 — 2026-10-21 usability improvements

- Compact Workspace into clickable property rows, smaller summary metrics and a visible save message. Keep the property list ahead of unit ratios and the income chart; distinguish pending saves, failed writes and library conflicts.
- Default Rent Roll to Essentials with eight core data fields and Edit/Delete actions. Replace its view-button row with one selector for Essentials, All Columns and existing groups. Retain in-tab choices, full data and keyboard editing; exclude hidden columns from uniform table sizing.
- Preserve unfinished AI setup and focus through preference changes and background redraws. Update provider guidance immediately and describe local configuration without claiming a successful connection.
- Add a keyboard-accessible Choose Files action, associate shared form labels/help with controls, and make keyboard help reflect autosave preferences. Replace extraction review's blanket pass statement with “No validation issues found” and a source-comparison reminder.
- Add seven usability browser workflows and extend the extraction review regression. Document the remaining AI review, advanced-field, navigation and phone-layout priorities. Financial engine and model format remain unchanged.
- Validate 633 code cases, 13 runner cases and all 92 Chromium workflows; inspect desktop and phone-sized previews. Live AI services and other browser engines remain unverified.

## 0.7.11 — 2026-10-21 logo subtitle cleanup

- Remove the changing portfolio/scenario/property text beneath the Basis Property Intelligence logo, along with its unused styles and update code.
- Pass 633 code cases and the four existing navigation browser workflows; refresh desktop/mobile previews.

## 0.7.10 — 2026-10-21 workspace UI and document AI

- Remove the duplicate numbered shortcut row; retain keyboard search, use Title Case navigation and improve theme contrast. Group occasional library controls under Library Actions.
- Add Workspace Settings for System/Light/Dark appearance, autosave while editing and automatic or uniform table column sizing. Migrate legacy theme preferences; preserve recovery drafts and show Save Changes when idle autosave is off.
- Scope top property tabs to the active portfolio while remembering other portfolios’ tabs. Guard Model, Insights and document intake against an off-portfolio/scenario active model.
- Restore Document Import in navigation and add OpenAI Responses and Anthropic Messages adapters alongside the existing host integration. Keep user keys only in memory; preserve explicit Extract, review and atomic Apply. Bound requests/responses, cancellation and provider changes.
- Add preference/adapter unit cases and Chromium settings, key-lifetime, extraction/review, contrast and portfolio-boundary workflows. Fix provider/model switching and delayed host-status refresh found during review. Preserve Library Actions open state and keyboard focus during background redraws and recovery. Financial engine source remains byte-identical.
- Validate 633 Node cases, 13 runner cases and 85 ordinary Chromium workflows. Provider tests use fake responses; live API accounts and extraction accuracy remain to be checked with representative documents.

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
