# Validation snapshot — 0.7.10

Verified locally on 2026-10-21. This pass updates the files in the chat workspace.

| Command | Result |
| --- | --- |
| `npm run build` / `npm run check` | Sixteen canonical application modules and the four-module embedded worker match; three inline scripts pass syntax checks. |
| `npm test` | 633 cases pass across 34 suites. |
| `npm run test:runner` | 13 Python stdlib cases pass. |
| `npm run test:browser` | 85 Chromium workflows pass in 256.863 seconds. |
| Focused recovery and navigation browser suites | Nine recovery and four navigation workflows pass, including menu state/focus during redraw. |
| Desktop and mobile previews | Workspace and Settings screenshots inspected; Settings has no page overflow at 390 pixels. |

## Behavior checked

- The numbered shortcut row is absent. Document Import is reachable through
  Workspace and Model → Data Workspace; Configure AI opens Settings. Keyboard
  command search remains available. Visible navigation text meets a 4.5:1 contrast
  ratio in the tested light/dark states.
- Top property tabs show only the selected portfolio, while retaining remembered
  tabs for other portfolios. Model, Insights and document import guard against an
  active property from another portfolio/scenario.
- Appearance and column settings survive reload, system appearance follows device
  changes, and dynamically rendered tables use the column preference. Autosave off
  leaves an explicit Save Changes action and writable recovery drafts; reenabling
  autosave saves dirty input after the idle delay. Explicit property/library saves
  retain their existing behavior.
- Nineteen preference cases exercise defaults, migration, invalid input, storage
  failures and whitelist-only serialization. Fifteen AI adapter cases exercise
  both provider request formats, images, size limits, parsed results, generic
  errors, abort/deadline handling and obsolete capabilities after setup changes.
- Browser tests configure a synthetic API key without sending a request, confirm
  it is absent from browser storage, model/workspace state and archives, then run
  explicit extraction, review and Apply against a fake response. Reload clears
  the key. Provider/model switching and delayed host availability are covered.
- A final browser run exposed Library Actions closing during background redraws
  and losing the recovery opener's keyboard focus. Retaining the menu element and
  restoring its focused control fixes both; the focused suites pass.

The existing extraction lifecycle still owns the property/scenario/document
snapshot and requires reviewed Apply. AI configuration changes cancel running
requests and invalidate previous reviews. Credentials remain in the provider
closure for the current tab; the password input is cleared after configuration.
Direct API requests use fixed HTTPS endpoints, reject redirects and omit cookies.

## Source identities

| File/reference | SHA-256 |
| --- | --- |
| `app/index.html` | `8f0a54da6846b9c2b9eb7374dabdeff58311b3c00fc64cf9259c24b115169f18` |
| `src/financial_engine.js` | `ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936` |
| `src/workspace_preferences.js` | `a99bb78f72f6f901ae9168ce2f73eb560e0ccbb0c73b84059a39a57a6ef22445` |
| `src/workspace_settings_ui.js` | `a19f9bcbf90231f024a80e67527a6faa1d423f340eb680efdf801f4b0d3f776f` |
| `src/ai_provider.js` | `ec9665f9b0ba3dfe438c288a873a9e51b873772360f87fb5c032df3b849017bd` |
| Immutable reviewed 0.7.9 archive | `d22989c52b31e52827bb01c7dd557f5373673749d72364acd429fa057e078db0` |

All fourteen existing files under `src/` are byte-identical to 0.7.9. Three new
modules implement preferences, Settings and AI transport. The existing financial
fixtures pass; underwriting formulas are unchanged.

## Scope and limits

Browser suites use isolated storage and loopback HTTP, with external HTTPS
blocked or intercepted by local fake services. No real document, API key or paid
request was sent to an external provider. Live API model access, CORS, billing and
extraction accuracy remain unverified; test representative leases, rent rolls
and P&Ls with a chosen account before relying on proposed inputs.

The seventeen optional actual PDF.js/SheetJS runtime checks last passed in 0.7.9;
this pass retains their unchanged runtime modules and does not repeat that suite.
See the [previous snapshot](VALIDATION_0_7_9.md) and [runtime evidence](RUNTIME_DEPENDENCY_TESTS.md).

Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium
154.0.8037.57 on Linux. Windows instructions are documented, but native Windows,
Node 20, other browser engines and GitHub-hosted CI were not executed here.
Remaining financial corpus, host concurrency, dependency/provenance and release
work is tracked in [the code review and next steps](CODE_REVIEW.md).

Packaging uses the locally available, hash-verified 0.7.9 archive as its baseline.
The supplied patch is incremental from 0.7.9, not a cumulative patch from the
original uploaded ZIP. Final packaging checks require an unchanged repeated
build, exact patch reconstruction, unique ZIP entries with valid CRC/content,
deterministic ZIP bytes and an unchanged baseline archive.
