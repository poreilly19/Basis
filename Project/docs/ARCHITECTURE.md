# Architecture — 0.7.25

`app/index.html` is the deployable single-file application. Its presentation,
legacy interchange adapters, workspace orchestration and optional host integration
remain in the HTML. Several marked regions now come from canonical source files:

| Source | Responsibility |
| --- | --- |
| `src/intake_reconciliation.js` | Per-document date/period arithmetic checks, strict financial-line normalization and Document Totals review. |
| `src/navigation_ui.js` | Desktop section/page/property tabs, responsive modal navigation, scoped property/context selection, summary and header-metric visibility. |
| `src/workflow_ui.js` | Lease drawer lifecycle, phone tenant cards, property-scoped tenant filters/bulk actions, in-place AI setup and import comparison from the Apply candidate. |
| `src/tenant_groups.js` | Legacy/multiple memberships and validated atomic batch classification changes. |
| `src/workspace_preferences.js` | Validated browser preferences and legacy theme migration, separate from model data. |
| `src/workspace_settings_ui.js` | Settings UI, theme/autosave hooks and column sizing. |
| `src/ai_provider.js` | Memory-only keys, fixed provider transports, cancellation and request/response budgets. |
| `src/financial_engine.js` | Property/portfolio calculations, model factories and financial helpers. See [ENGINE.md](ENGINE.md). |
| `src/native_codec.js` | Native ZIP/JSON integrity, migration and structural model validation. |
| `src/native_ui.js` | Native save/open adapters into the workspace. |
| `src/office_zip.js` | Bounded Office ZIP parsing and worksheet limits. |
| `src/workspace_validation.js` | Saved index/model envelope validation, key ownership and bounded decoding. |
| `src/xlsx_loader.js` | Lazy spreadsheet script loading, integrity, deadlines and validated references. |
| `src/pdf_integrity.js` | Bounded artifact fetch, exact size/SHA-256 verification and Blob module lifetime. |
| `src/pdf_loader.js` | Matched verified-pair selection, cache, fallback and abortable deadline waits. |
| `src/image_safety.js` | Bounded image header dimensions and pixel budgets. |
| `src/scenario_settings.js` | Pure versioned scenario valuation metadata and legacy fallback helpers. |
| `src/recovery_store.js` | Independent local recovery writers and session workspace state. |
| `src/calculation_worker.js` | Validated property/portfolio worker request and result protocol. |
| `src/calculation_client.js` | Request correlation, worker lifecycle, cancellation and timeouts. |
| `src/calculation_ui.js` | Background edit recalculation, invalidation and result/error presentation. |

Run `npm run build` after changing these modules. `scripts/sync-native.cjs`
updates their marked HTML regions and generates an inert embedded worker bundle
from the same engine, settings, codec and worker sources. It preserves the rest of
the HTML. Build checks detect missing/divergent regions and worker sources; editing
only a module does not update the distributable until the build runs.

## Models, calculation and presentation

`S` is the active property input model; `R` holds its current calculated result.
`PW` owns the library index, properties, portfolios/scenarios, caches and save
queue. Library actions now stage complete index/model changes before one commit;
cache ownership protects newer queued saves. See [LIBRARY_ACTIONS.md](LIBRARY_ACTIONS.md). Calculated outputs are derived data, not authoritative native inputs.

Edit recalculation and explicit sensitivity runs send independent input snapshots
to a Blob worker created from the embedded bundle. Requests carry IDs; the client
rejects invalid responses and ignores obsolete replies. UI epochs and snapshot
checks prevent old results from replacing a newer model. Cancellation,
supersession and timeouts terminate the worker because synchronous financial code
cannot service a cancellation message while computing. Worker failures are shown
with retry controls rather than silently executing that request on the UI thread.

Structured cloning preserves typed schedules, aliases and non-finite result
sentinels. The worker removes the non-cloneable debt payoff function; the client
restores it with the engine's equivalent pure payoff helper. Input validation and
serialized financial error details run at the worker boundary. See
[CALCULATION_WORKER.md](CALCULATION_WORKER.md) for the protocol and UI coverage.

This is not an all-path worker conversion. Startup/property activation retains
the synchronous `recalc` entry point; some portfolio views, reporting/export
helpers and metadata calculations also call the engine synchronously. The
canonical engine still includes small DOM helpers and initial active-state setup
for classic-script compatibility. Its numerical paths can run without a DOM.

## Saved state, scenario policy and recovery

Native import verifies manifest/checksums, ZIP structure and model schema before
workspace adoption. Portfolio adoption remaps IDs, stages all models and commits
the index once. Malformed imports fail before saving the current property.
Saved workspace adoption separately validates the index, owned model keys,
headers/chunks and decoded model. Startup failure opens independent memory recovery
without overwriting the original source; see [initialization recovery](INITIALIZATION_RECOVERY.md).

Scenario discount, cap, joint-sale and terminal-NOI policy live in versioned
`sc.settings`. Library rollups read that scenario policy independently of `S`.
Initialization explicitly migrates missing metadata from the first saved property
in each scenario's index order; pure reads do not mutate data. Settings edits use
the revision-checked save queue and become live only after a successful commit.
Native portfolio archives and additive legacy portfolio JSON retain the metadata.
See [SCENARIO_SETTINGS.md](SCENARIO_SETTINGS.md).

Saved library commits and unsaved recovery drafts serve different purposes.
IndexedDB checks the loaded index revision and atomically publishes model headers,
chunks, index metadata and deletions. Host storage retains immutable generated
model keys and remote index snapshots, but lacks a documented atomic server-side
compare-and-swap operation. Simultaneous remote index publications can still race.
See [STORAGE.md](STORAGE.md).

Workspace selection is session-local. Unsaved edits use origin-local recovery
keys with a fresh writer per document, including duplicated tabs. Startup opens
the saved library and offers recovery candidates explicitly. Restoring creates a
new property, leaving the saved/original active models intact. These local drafts
do not replace or enumerate host account snapshots and do not sync across devices.
See [DRAFT_RECOVERY.md](DRAFT_RECOVERY.md). Native/legacy backups freeze the loaded
view and verify saved revisions when collecting uncached models; see [STORAGE.md](STORAGE.md).
Document extraction and application use separate target/selection ownership and
staged model validation; see [DOCUMENT_IMPORT.md](DOCUMENT_IMPORT.md).

## Verification and next decomposition

Independent financial/portfolio/recovery fixtures and pre-extraction engine
fingerprints run against the canonical engine. Worker protocol/client tests cover
structured results, cancellation and stale/error paths. Workspace suites inject
storage failures and conflicting revisions. Browser tests serve the real HTML
with external CDNs blocked and exercise selected worker, scenario and recovery
flows. See [FINANCIAL_VALIDATION.md](FINANCIAL_VALIDATION.md) and
[PORTFOLIO_MATH.md](PORTFOLIO_MATH.md) for numerical evidence and remaining limits.

Next separate the schema, remaining workspace/legacy adapters and presentation
from the HTML, and move remaining expensive synchronous paths behind explicit
worker requests. Preserve golden comparisons and input/output compatibility as
those boundaries change. Host-side atomic revision checks and remote snapshot
recovery/pruning still require a documented backend contract.


## Guided workflows (0.7.18)

`src/guided_ui.js` owns setup, contextual navigation, save/export presentation,
selection actions and local report shortcuts. `src/model_checks.js` renders
structured validation targets and routes back to input controls. `src/intake_review.js`
applies reviewed tenant decisions to a copied model and supplies correction/source
views. The existing intake mapper in `app/index.html` supplies the same prepared
model to preview and Apply. Review state is session-only and outside model files;
accepted values and their source log are stored normally.

There are 26 canonical application modules plus the four-source inert worker
bundle. The financial engine is unchanged outside `validateModel`; its optional
third callback supplies UI targets without altering legacy finding objects.
The remaining embedded UI/import code is still a maintenance boundary to extract
behind the existing regression fixtures. The standard-library launcher serves
only the `app` folder on IPv4 loopback, with a content fingerprint for safe reuse
of an already-running instance of the same release.

`src/intake_quality.js` owns extraction evidence binding, strict rent normalization,
conservative tenant grouping and reviewed Apply To targets. Both preview and Apply
use its target checks. Provider responses remain proposals; no model changes occur
until Apply validates the candidate. Field citations retain the local upload ID
and an explicit text-match status, without treating that status as semantic proof.

`src/intake_amendments.js` combines explicit rent/recovery changes with supported
base terms on the candidate model. It returns review blockers for unsupported
scope, chronology or timing. Preview renders the blockers; Apply enforces them
before any live model replacement or new-property save. The same module retains
combined source evidence and bounds generated schedules. It does not change the
financial engine or establish contractual priority.

The 0.7.25 portfolio presentation restores the supplied reference ribbon and
Navigator in `app/index.html`. It reuses the corrected atomic workspace actions
and `pwExplorer` grid; it does not import historical persistence or engine code.
Ribbon action errors are surfaced, pop-up menus clean up their handlers and
report opening checks its load/context before entering Reports. Settings and
Document Import remain secondary pages. See `RIBBON_0_7_25.md` for the action map.
