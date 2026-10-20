# Basis Studio — reviewed Codex handoff (v7.9 pre-release)

The October 15–20, 2026 review adds data-integrity, security and financial fixes to
the supplied v7 baseline. Read [the review and next steps](docs/CODE_REVIEW.md),
[changelog](CHANGELOG.md), [financial validation](docs/FINANCIAL_VALIDATION.md),
and [dependency inventory](docs/DEPENDENCIES.md). See also [portfolio policy](docs/PORTFOLIO_MATH.md) and [storage conflicts/recovery](docs/STORAGE.md). See [worker calculations](docs/CALCULATION_WORKER.md), [local draft recovery](docs/DRAFT_RECOVERY.md) and [scenario settings](docs/SCENARIO_SETTINGS.md) for calculation and storage changes. Recent passes add [atomic library actions](docs/LIBRARY_ACTIONS.md), coherent portfolio backups and [document intake protections](docs/DOCUMENT_IMPORT.md). Saved data has [safe initialization/recovery](docs/INITIALIZATION_RECOVERY.md) and [bounded PDF/image reading](docs/PDF_LOADING.md). Recent work fixes import destinations and Office dates/XML, with [real runtime checks and bounded spreadsheet loading](docs/RUNTIME_DEPENDENCY_TESTS.md). The latest pass bounds inflation schedule expansion, preserves unsaved edits during library reload and improves custom workbook date-style compatibility. The prior pass verifies [PDF runtime bytes before execution](docs/PDF_LOADING.md) and rejects unusable cells in the custom workbook readers. Earlier work [upgrades SheetJS](docs/SPREADSHEET_UPGRADE.md), expands date/compatibility coverage, and adds [portable runners and CI](docs/CI.md). The original upload is unchanged.

This is the latest working Basis Studio HTML application from the October 2026 iterative development, packaged as an ordinary development project for **OpenAI Codex**. The code is **not cleared for public release**. Do not publish it or add a license declaration without completing the IP and dependency review.

## Getting started (Windows or macOS)

1. Extract this ZIP to a local project folder, e.g. `Documents\\basis-studio`.
2. Open that folder in the ChatGPT desktop app's **Codex** view, or in VS Code with the Codex extension, or run `codex` from a terminal in the folder.
3. Install Node.js 20+ and Python 3.10+, then run `npm test` and `npm run test:runner` (no npm packages required).
4. To view the app, serve the `app` folder locally: `cd app` followed by `py -m http.server 8765` on Windows, or `python3 -m http.server 8765` on macOS/Linux. Open `http://localhost:8765`. A full browser is needed; iOS HTML preview may block scripts.
5. Copy the text in `CODEX_START_HERE.md` into your first Codex task, or simply ask Codex to read `AGENTS.md` and `CODEX_START_HERE.md`.

## Current deliverables

- `app/index.html`: complete standalone app, including its embedded calculation worker.
- `src/financial_engine.js`: canonical calculation engine with exact pre-extraction output fixtures; see [engine contracts](docs/ENGINE.md).
- `src/calculation_worker.js`, `calculation_client.js`, `calculation_ui.js`: bounded worker protocol, cancellation/deadlines and edit recalculation integration.
- `src/scenario_settings.js`, `recovery_store.js`: validated scenario metadata and independent local recovery writers.
- `src/native_codec.js`, `native_ui.js`, `office_zip.js`: archive validation, file integration and bounded Office ZIP parsing.
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

`npm test` runs 599 cases across the archive, workspace, concurrency, independent financial,
engine parity, portfolio, draft recovery, scenario, worker, legacy, Office,
spreadsheet export and sensitivity suites. New suites cover atomic library actions,
consistent portfolio backup snapshots, document read budgets/preview ownership and
extraction/apply lifecycle races, saved workspace validation/recovery, paired PDF
loading, PDF lifecycle cleanup and image dimensions. Latest cases add spreadsheet
loading, captured import destinations, dates, strict Office XML, formula-cache
checks and portable Python invocation. Latest additions verify PDF bytes before
execution and custom XML workbook cells, including native browser parsing. This
pass adds inflation expansion, reload/save ownership and equivalent date-style
checks. Thirteen additional stdlib runner tests
exercise cache/discovery/exit failures. Exact final counts and source hashes are in the
[0.7.9 validation snapshot](docs/VALIDATION_0_7_9.md).
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
to launch a browser. Office checks use independent binary ZIP/XML fixtures and native XML parsing; image conversion uses actual browser codecs. Seventeen optional [real runtime checks](docs/RUNTIME_DEPENDENCY_TESTS.md) additionally exercise hash-pinned PDF.js and SheetJS bytes from a separate cache. The main suite uses synthetic external modules. Live AI/host workflows and Safari/Firefox/Edge remain unverified.

CSV/clipboard exports now prefix formula-like text with an apostrophe for
spreadsheet safety; numbers remain numeric. Report CSV is not a model round-trip
format. Format samples are examples of serialization, not complete underwriting
golden cases.

## Architectural cautions

- The engine and supporting modules are canonical sources, while most UI remains in the HTML. Preserve output fixtures while extracting further modules. Normal edits and sensitivities use cancellable workers; startup, switching, metadata, some exports and portfolio panes still calculate synchronously.
- Browser/host APIs, external Excel/AI dependencies, and persistent portfolio storage need end-to-end testing before release.
- The initial `.basis` file extension was rejected because it is used for Basis Universal texture files. `.basiscre` is a **proposed** extension, not a registered or legally cleared identifier.
- The project history includes earlier reference to a competitor's documentation/screens. **Do not describe past work as a formal clean-room implementation.** Future work should adhere to original specifications and document provenance.
