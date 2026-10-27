# Changelog

## Unreleased — GitHub Actions and Workers deployment setup

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
- Keep Settings, AI Document Import, recovery, backup and portfolio metrics/chart accessible. The historical ARGUS Dump Package entry opens the current explicitly labeled JSON report export; historical workbook generation is not restored.
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
- Restore the ARGUS/XL4ADW navigation entry and disclose the adapter's unsupported tenant classifications on import/export. Make Source Log CSV work outside the optional host service. Restrict the bulk NOI row to its labeled analysis years.
- Compare the reattached original ZIP with this release: no registered model/report pages, builders or default…3679 tokens truncated…tain prior model chunks during interrupted saves, recover stored
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
