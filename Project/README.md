# Basis Studio — reviewed Codex handoff (v7.27 beta candidate)

The October 15–27, 2026 review adds data-integrity, security and financial fixes to
the supplied v7 baseline. Read [the restored reference ribbon and left Navigator](docs/RIBBON_0_7_25.md),
[earlier review findings](docs/CODE_REVIEW.md),
[changelog](CHANGELOG.md), [financial validation](docs/FINANCIAL_VALIDATION.md),
and [dependency inventory](docs/DEPENDENCIES.md). Version 7.10 simplifies navigation,
keeps property tabs within the selected portfolio, and adds [Workspace Settings
and document AI setup](docs/WORKSPACE_SETTINGS.md). Version 7.11 removes the changing
portfolio/property subtitle beneath the logo. Version 7.12 compacts the Workspace,
adds an Essentials rent roll, and fixes AI setup drafts, upload keyboard access
and save guidance; see [usability changes and next steps](docs/USABILITY_0_7_12.md)
and [validation](docs/VALIDATION_0_7_12.md). Version 7.13 adds [multiple tenant
groups](docs/TENANT_GROUPS.md), restores the ARGUS/XL4ADW navigation entry, fixes
standalone Source Log CSV downloads and aligns bulk NOI rows with their year
headings. See the [original-handoff comparison and accuracy priorities](docs/FEATURE_REVIEW_0_7_13.md)
and [7.13 validation](docs/VALIDATION_0_7_13.md). Version 7.14 adds the lease editor
drawer, document import progress with in-place AI setup and current/proposed/source
comparison, and group chips, filters and bulk add/remove. See the [workflow guide](docs/WORKFLOWS_0_7_14.md)
and [7.14 validation](docs/VALIDATION_0_7_14.md). Version 7.15 replaces the stacked
model tabs with a collapsible sidebar and one property/context bar, moves model
metrics behind Summary, and adds phone tenant cards with the full-screen lease
editor. See the [navigation guide](docs/NAVIGATION_0_7_15.md) and
[7.15 validation](docs/VALIDATION_0_7_15.md). Version 7.16 uses one system font
across the interface, forms and financial tables, with aligned numeric digits.
Only raw source/code previews use fixed-width text. See the
[typography update and validation](docs/TYPOGRAPHY_0_7_16.md). Version 7.17 formats
area as whole numbers with commas, per-SF rent with two decimal places, and rent
totals with dollar signs and commas. Decimal entry and full saved precision remain
available; see [number formats and validation](docs/NUMBER_FORMATS_0_7_17.md).

Earlier passes added [portfolio policy](docs/PORTFOLIO_MATH.md), [storage conflict
protection](docs/STORAGE.md), [worker calculations](docs/CALCULATION_WORKER.md),
[local draft recovery](docs/DRAFT_RECOVERY.md), [scenario settings](docs/SCENARIO_SETTINGS.md),
[atomic library actions](docs/LIBRARY_ACTIONS.md) and [document intake protections](docs/DOCUMENT_IMPORT.md).
Saved data has [safe initialization/recovery](docs/INITIALIZATION_RECOVERY.md),
[verified PDF/image reading](docs/PDF_LOADING.md) and [bounded spreadsheet loading](docs/RUNTIME_DEPENDENCY_TESTS.md).
Version 7.9 bounds inflation expansion, preserves unsaved edits during library
reload and improves workbook date styles. Earlier work [upgrades SheetJS](docs/SPREADSHEET_UPGRADE.md)
and adds [portable runners and CI](docs/CI.md). The original upload is unchanged.

This is the latest working Basis Studio HTML application from the October 2026 iterative development, packaged as an ordinary development project for **OpenAI Codex**. The code is **not cleared for public release**. Do not publish it or add a license declaration without completing the IP and dependency review.

Version 7.25 restores the reference’s **Portfolio / Inputs / Reports** modes,
**File / Home / View / Reports** ribbon and left portfolio/building Navigator.
Settings and Document Import remain beside the portfolio result tabs. See the
[button layout and action mapping](docs/RIBBON_0_7_25.md).

## Cloudflare beta preparation

Version 7.27 adds the [Cloudflare Pages + Access setup](docs/CLOUDFLARE_BETA.md),
release/access verification commands, and **File → About Basis** with version,
privacy, limitations and a small support-info download. It also fixes reference-only
expense and ground-rent details in report workbooks. See the
[current beta validation](docs/VALIDATION_0_7_27.md).

Build with `npm run build:beta`, then `npm run verify:beta`. Upload only
`dist/basis-beta` after production and preview Access checks pass. The account
and allowlist still need configuration; the package itself provides no login.

## Preview the app

Version 7.26 adds **Portfolio → Reports ribbon → ARGUS Dump Package → Download Report Workbook (.xlsx)**
and **Portfolio → Settings → Test AI Connection**. It also includes a minimal
static hosting build. Read the [beta deployment handoff](docs/BETA_DEPLOYMENT_0_7_26.md)
and [current validation](docs/VALIDATION_0_7_26.md). No site has been published;
the deployment bundle does not provide login or cloud synchronization.

On Windows, extract the entire ZIP and double-click **Start Basis.cmd** inside
`Basis_Studio_Codex`. It checks for Python 3.10+, starts the app at
**http://127.0.0.1:8765/** and opens your browser. Keep the server window open.
The launcher finds `app/index.html` relative to itself, so it works independently
of your terminal's current folder. If Python is missing or another program occupies
the port, the window explains the next step. Native Windows execution remains to
be verified; the portable server behavior is tested on Linux and a Windows test
is included in CI.

On macOS/Linux, run `python3 scripts/start-basis.py` from the extracted project.
Node is needed for development checks, not for previewing the app.

**Existing models:** use the same browser and exact address as before. `localhost`
and `127.0.0.1`, different ports, private windows and different browsers each have
separate storage. Before switching addresses, download an Editable Model Backup
from your old workspace and import it at the new address. Moving the application
files alone does not move browser-saved models.

Version 7.18 completes the [seven usability improvements](docs/USABILITY_0_7_18.md)
and a [broader code review](docs/CODE_REVIEW_0_7_18.md). It also corrects document
import precision and missing-area rent units, flags holds beyond the engine's
40-year projection, and adds direct Model Checks links.

Version 7.19 adds independent financial cases and corrects low-occupancy expense
gross-up, returns for loans funded through future draws, present-value report
reconciliation, and imported lease expiry/free-rent timing. See the
[accuracy review](docs/ACCURACY_0_7_19.md) and [validation evidence](docs/VALIDATION_0_7_19.md).

Version 7.20 preserves partial-abatement timing and rent units, requires a choice
for ambiguous tenant matches, and ties each reviewed tenant field to its source.
See [AI extraction improvements](docs/AI_EXTRACTION_0_7_20.md) and
[validation evidence](docs/VALIDATION_0_7_20.md).

Version 7.21 combines supported rent and recovery amendments with their base
terms, preserves earlier cash flows, and blocks uncertain timing or scope until
reviewed. See [amendment handling](docs/AI_EXTRACTION_0_7_21.md) and
[validation evidence](docs/VALIDATION_0_7_21.md).

Version 7.22 checks each document against its own reporting date and period,
includes zero totals, and validates annualized expense/income proposals. See
[statement reconciliation](docs/AI_EXTRACTION_0_7_22.md),
[validation](docs/VALIDATION_0_7_22.md), and the preceding
[open-source release and original-interface assessment](docs/RELEASE_READINESS_0_7_22.md).

Version 7.23 restores the original desktop section tabs, page tabs, open-property
strip and full-width editing area on top of the corrected application. Property
tabs stay within the selected portfolio and scenario. Later settings, formatting,
mobile controls, lease editing and AI extraction improvements are retained. See
[layout notes](docs/LAYOUT_0_7_23.md) and [validation](docs/VALIDATION_0_7_23.md).

Version 7.24 matches the compact blue-and-gray interface in the newly supplied
HTML: a small BASIS header, desktop metrics, squared panels, thin tab bars, denser
tables and a Workspace navigator with a property grid. All changes build on the
corrected application. See [appearance and workflow notes](docs/APPEARANCE_0_7_24.md)
and [validation](docs/VALIDATION_0_7_24.md).

## Development setup

1. Extract this ZIP to a local project folder, e.g. `Documents\\basis-studio`.
2. Open that folder in the ChatGPT desktop app's **Codex** view, or in VS Code with the Codex extension, or run `codex` from a terminal in the folder.
3. Install Node.js 20+ and Python 3.10+, then run `npm test` and `npm run test:runner` (no npm packages required).
4. Preview using **Start Basis.cmd** or `python3 scripts/start-basis.py`, as described above. A full browser is needed; an attachment preview may block scripts.
5. Copy the text in `CODEX_START_HERE.md` into your first Codex task, or simply ask Codex to read `AGENTS.md` and `CODEX_START_HERE.md`.

## Workspace and AI setup

Open **Portfolio → Settings** for theme, autosave, table columns and your own
OpenAI/Anthropic API key. Keys last only for this tab and are never saved in
property files. Use **Portfolio → Document Import** to upload leases, rent rolls
or operating statements, extract proposed inputs, review them, then Apply.
**Configure AI** also opens directly in Document Import, keeping your upload in place.
See [settings and document AI](docs/WORKSPACE_SETTINGS.md) for setup and limits.

Choose a portfolio in Portfolio mode's **Navigator**, then a scenario above the grid.
Click a property name in the navigator or grid to open its model. The grid has
selection controls for bulk actions and an **In Roll-up** checkbox backed by the
existing atomic library save. Search and sort apply to the selected portfolio
and scenario. On phones the ribbon and grid scroll horizontally within the screen.

The Rent Roll starts with
**Essentials**; choose **All Columns** or a field group from **View** when needed.
**Edit** opens a side drawer with grouped lease terms and a rent schedule. View choices last until the tab
reloads and do not change model data.

Use the first horizontal tab row for Inputs or Reports sections and the second
for pages; on phones, use **Sections**. Open-property tabs and **All Properties**
show only the selected portfolio and scenario. Click the portfolio/scenario name
to change that selection. Closing a tab preserves the saved property; closing
the last tab returns to Portfolio. Wide desktop headers show the active property's
calculated metrics. **Summary** also exposes the results and Model Checks, including
on smaller screens. Pending or out-of-context results are hidden. See the
[current interface guide](docs/RIBBON_0_7_25.md).
Phones use **Tenant Cards** by default; choose **Editable Table** under View for
inline editing and row deletion, or **Edit Lease** for the full-screen editor.

Area displays as **12,345 SF**, per-SF rent as **$24.50**, and annual rent as
**$125,000** or **$125,000.50** when cents are entered. Focus a formatted field to
select its full saved value for editing; click again to place the caret. Commas
and dollar signs are accepted when pasting. Display rounding never changes the
stored amount. Invalid text is marked and leaves the previous saved amount intact.

Use **Model → Lease Book → Tenant Groups → Tenant Assignments** to assign several
groups to a tenant. The picker is also in Rent Roll **Edit** and **Tenant
Classifications**. Groups are classifications and do not change property cash flow.
Select tenant rows in **Tenant Assignments** to add or remove a group in one reviewed
batch. Search and group filters apply to this property's tenants; changing a filter
clears the row selection. The rent roll also supports these filters.

## Current deliverables

- `app/index.html`: complete standalone app, including its embedded calculation worker.
- `src/financial_engine.js`: canonical calculation engine with exact pre-extraction output fixtures; see [engine contracts](docs/ENGINE.md).
- `src/calculation_worker.js`, `calculation_client.js`, `calculation_ui.js`: bounded worker protocol, cancellation/deadlines and edit recalculation integration.
- `src/scenario_settings.js`, `recovery_store.js`: validated scenario metadata and independent local recovery writers.
- `src/tenant_groups.js`: backward-compatible multiple memberships, group lookup, deletion and atomic bulk changes.
- `src/workflow_ui.js`: lease drawer, group filtering/bulk assignment and document setup/comparison UI.
- `src/native_codec.js`, `native_ui.js`, `office_zip.js`: archive validation, file integration and bounded Office ZIP parsing.
- `src/workspace_preferences.js`, `workspace_settings_ui.js`, `ai_provider.js`: browser preferences, Settings and memory-only-key document extraction adapters.
- `src/workspace_validation.js`: saved library/model validation and storage-key ownership.
- `src/pdf_integrity.js`, `pdf_loader.js`, `image_safety.js`, `xlsx_loader.js`: verified PDF reader/worker bytes with deadlines, image-header preflight and lazy spreadsheet loading with script integrity.
- `scripts/sync-native.cjs`: run `npm run build` after editing canonical modules. It updates marked application regions and the inert worker bundle; other HTML remains hand-maintained.
- `tests/check-build.cjs`: checks exact module/bundle synchronization, dependency order and JavaScript syntax.
- `tests/*.test.cjs`: archive, persistence, financial, extraction, worker, recovery, scenario and legacy regressions, without npm dependencies.
- `tests/*browser_test.py`: real Chromium workflows with external HTTPS blocked, including the embedded worker without external scripts.
- `samples/`: native property and portfolio examples.
- `docs/FILE_FORMAT.md`: version 1 format specification.
- `docs/RELEASE_CHECKLIST.md`: compliance, tests and deployment blockers.
- `.github/workflows/ci.yml`: configured Node/Windows/Ubuntu and Chromium jobs; see [CI status](docs/CI.md).
- `docs/THIRD_PARTY_NOTICES.md`: runtime component attribution and enclosed license texts.
- `AGENTS.md`: project instructions for Codex.

## What is and isn't tested

The current checks cover native archives, persistence, scenario boundaries,
independent financial expectations, engine parity, recovery, workers, exports,
Office/PDF/image readers, provider request formats, preferences, tenant groups,
numeric entry and document extraction/review/Apply. The layout update adds tab
save/close lifecycle cases, late-load context guards, keyboard behavior and
coverage of every desktop Model and Insights destination. The latest test totals,
commands, app hash and limits are in the [0.7.26 validation snapshot](docs/VALIDATION_0_7_26.md).

Financial fixtures and original-vs-updated sample comparisons are documented in
`docs/FINANCIAL_VALIDATION.md`. These do not certify every underwriting feature.

For browser tests, install the development-only Python Playwright package and
Chromium, then run:

```sh
python3 -m pip install playwright==1.62.0
python3 -m playwright install chromium
npm run test:browser
```

The browser harness isolates browser storage and blocks external HTTPS requests. It uses
an installed `chromium` executable if available; `CHROMIUM_PATH` selects another
binary, otherwise it uses Playwright's installed Chromium. Windows users can run
`py -m unittest discover -s tests -p "*browser_test.py" -v`. Browser tests require loopback sockets and permission
to launch a browser. Office checks use independent binary ZIP/XML fixtures and native XML parsing; image conversion uses actual browser codecs. Seventeen optional [real runtime checks](docs/RUNTIME_DEPENDENCY_TESTS.md) additionally exercise hash-pinned PDF.js and SheetJS bytes from a separate cache. The main suite uses synthetic external modules. The seventeen actual-runtime checks pass again in v7.26. The deployment smoke suite additionally serves the exact beta security headers and exercises the new report workbook with real libraries. See the current validation snapshot for browser-engine evidence. Live AI/host requests, native Windows/Edge and Safari remain unverified.

CSV/clipboard exports now prefix formula-like text with an apostrophe for
spreadsheet safety; numbers remain numeric. Report CSV is not a model round-trip
format. Format samples are examples of serialization, not complete underwriting
golden cases.

## Architectural cautions

- The engine and supporting modules are canonical sources, while most UI remains in the HTML. Preserve output fixtures while extracting further modules. Normal edits and sensitivities use cancellable workers; startup, switching, metadata, some exports and portfolio panes still calculate synchronously.
- Browser/host APIs, external Excel/AI dependencies, and persistent portfolio storage need end-to-end testing before release.
- The initial `.basis` file extension was rejected because it is used for Basis Universal texture files. `.basiscre` is a **proposed** extension, not a registered or legally cleared identifier.
- The project history includes earlier reference to a competitor's documentation/screens. **Do not describe past work as a formal clean-room implementation.** Future work should adhere to original specifications and document provenance.
