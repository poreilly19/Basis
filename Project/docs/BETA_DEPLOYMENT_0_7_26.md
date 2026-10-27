# Basis 0.7.26 beta deployment candidate

This release adds a real report workbook and prepares a portable static beta
bundle while preserving the preferred ribbon and Navigator. The work is local:
no site, repository, access service, or live API account has been configured.
Prepare an invite-only first cohort unless the owner selects a different scope.
The generated application has no login; the host must enforce tester access.

## Added workflows

Open a property, then choose **Portfolio → Reports ribbon → ARGUS Dump Package → Download Report
Workbook (.xlsx)**. The workbook contains README, Property Summary, Tenant Rent
Roll, Tenant Summary, Cash Flow, All Terms Report, and Input Assumptions. The
tables are independently arranged Basis reports; the historical five names do
not imply a compatible vendor dump layout. The separate ARGUS / XL4ADW template
workflow is unchanged.

The export recalculates one captured property/scenario snapshot. Changes while
the calculation or library load is pending cancel that export. Numeric amounts
retain precision; SF displays as whole numbers, USD per-area rents as $0.00,
and USD annual amounts as comma-separated whole dollars. Different currency and
area labels are retained without conversion. Non-USD values use neutral numeric
formatting. Formula-looking tenant names remain text. Unavailable IRRs are blank.
Cash-flow periods start in the model's analysis month, expense lines are negative,
and tenant groups and detailed terms are retained. Property overrides may make
tenant totals differ from property cash flow; the guide states this limitation.

The separate JSON export preserves its existing minimal report schema and now
uses a newly calculated snapshot too. Report files are not editable backups;
continue using **.basiscre** for complete property/portfolio restoration.

In **Portfolio → Settings**, select OpenAI or Anthropic, enter your own model and
API key, choose **Use AI Setup**, then **Test AI Connection**. The test sends a
small fixed message, no model or document content, and may incur a usage charge.
It does not certify document extraction accuracy. Keys remain in tab memory.
Cancel, authentication failures, timeouts and changed settings are handled
without displaying credentials or raw provider error bodies. No live credentials
were used in this release validation.

## Build and verify

Use Node 20+ and Python 3.10+; local evidence is for Node 24/Python 3.12 on Linux.

```sh
npm test
npm run test:launcher
npm run test:runner
npm run test:browser
node scripts/run-python.cjs scripts/fetch-test-dependencies.py ../basis-runtime-cache
npm run test:dependencies -- --cache ../basis-runtime-cache
npm run build:beta
npm run test:beta -- --cache ../basis-runtime-cache --browser chromium
npm run test:beta -- --cache ../basis-runtime-cache --browser firefox
npm run test:beta -- --cache ../basis-runtime-cache --browser webkit
```

Browser checks require development-only Playwright 1.62.0 and the selected
browsers/system dependencies (`python -m playwright install --with-deps chromium
firefox webkit`). Runtime checks use separately cached, exact-size/SHA-256-pinned
public SheetJS and PDF.js bytes. Provider responses are simulated. Nothing in the
test cache belongs in the deployment bundle. See [validation](VALIDATION_0_7_26.md)
for actual results and platform limits, and [CI](CI.md) for configured future jobs.

`npm run build:beta` produces **dist/basis-beta/** with ten deployable files:
the exact standalone HTML, privacy/limitations pages, notices/license texts,
runtime inventory, security headers, and release metadata. `release.json` records
the version, app hash and member hashes. The runtime inventory covers direct
optional dependencies; it is not a complete transitive vulnerability/license audit.
Rebuilding identical sources produces identical release bytes. The builder
refuses to replace an output directory without its own release marker.

## Hosting handoff

1. Select a host, stable HTTPS beta domain, tester access method, support owner,
   and private feedback/security contact. Configure access before uploading any
   proprietary source or tester models. An unlisted URL is not access control.
2. Deploy only the **contents of dist/basis-beta/** as the site's document root.
   Do not publish the project ZIP, tests, samples, scratch files or API keys.
   A host that supports the `_headers` convention can read it directly. For
   other hosts, translate `headers.json` into their response-header configuration.
3. Serve matching HTML and headers together. The Content Security Policy pins
   executable inline scripts by hash, permits the existing verified runtime
   sources/workers and supported API endpoints, and blocks other scripts,
   framing, objects, forms and base-URL changes. The build keeps registered
   button listeners working without `unsafe-inline` scripts. Styles still need
   `unsafe-inline`. This policy reduces exposure; it is not a complete audit.
4. Disable HTML rewriting/minification/script injection unless the resulting
   bytes are rebuilt and retested with new hashes. Do not add tracking or error
   upload scripts silently. Configure host access logs/retention and disclose
   them in the invitation/privacy page. The app adds no analytics or automatic
   model uploads.
5. Verify the deployed response headers and `release.json`, HTTPS, access
   enforcement on every file, and the acceptance checklist below. A basic
   Python file server ignores `_headers`; use the deployment smoke suite to
   test the provided policy locally.
6. Include links to `/privacy.html` and `/limitations.html`, the exact release
   version, supported test environments, backup instructions and private feedback
   contact in each invitation. The host and contact remain owner decisions.

There is no shared database, team editing or cloud synchronization in this
candidate. Browser models belong to the browser profile and origin. A domain,
protocol or port change does not carry them over. Ask testers to download a
portfolio `.basiscre` backup before upgrades and import it at a new origin.

## Acceptance before invitations

| Check | Expected evidence | Owner/status |
| --- | --- | --- |
| Hosted release and access | Correct app/hash/headers; signed-out visitors cannot fetch files | Deployment owner; pending host selection |
| Intended Windows/browser combinations | Start Basis.cmd, native downloads, browser reload and hosted smoke pass | Tester/owner; native Windows run pending |
| Core model workflow | Import a backup, edit, save/reload, switch portfolios/scenarios, restore the backup; no cross-portfolio tabs or data loss | Automated local coverage; repeat on deployed origin |
| Report workbook | Open in the intended Excel/LibreOffice version; compare Year 1 rent, expenses, NOI and periods to the approved model; inspect display formats | OOXML/runtime checks automated; native spreadsheet review pending |
| Live AI setup | User-owned key passes connection test; one synthetic lease is extracted, sources reviewed, Apply checked and backup restored | Live provider/CORS/account check pending; no key needed in chat |
| Underwriting benchmark | Analyst signs off on representative lease, rent-roll and P&L inputs plus monthly cash flow, recoveries, debt, exit and IRR tolerances | Independent analyst and representative documents needed |
| Feedback and recovery | Named private contact, reproducible issue template, backup/rollback rehearsal | Deployment owner; contact pending |

For the underwriting benchmark, record each source fact, approved value/unit,
analysis period, expected monthly/annual output and acceptable tolerance.
Include mid-month starts, free rent, stepped rent, amendments, recoveries with
stops/caps/gross-up, rollover probabilities, partial-period expenses, funding
draws and multiple scenarios. Require no unresolved material discrepancies.
Passing the automated fixtures does not establish universal financial accuracy.

## Triage and rollback

Use a private report with: release version/app hash, browser/OS, steps, expected
versus actual behavior, and a synthetic or redacted reproduction. Keep API keys,
tenant personal data and confidential documents out of public issues. Agree on
the support contact before invitations; this package does not invent one.

Pause the beta for confirmed data loss, secret exposure, cross-scenario corruption,
or materially incorrect calculations. Preserve a local backup and reproduction.
Rollback by publishing the last verified static bundle with its matching headers
at the same origin. Do not clear browser storage. This release does not change
native schema v1 or the financial engine. Still rehearse backup restoration with
both releases before rollback and investigate any future schema migration first.

Public open-source publication is a separate decision: select the project license
and confirm distribution rights, asset/sample provenance and required notices.
No license or legal clearance is asserted by this beta package.
