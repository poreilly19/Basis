# Validation snapshot — 0.7.26

Date: October 27, 2026. Scope: report workbook restoration and beta preparation
on the corrected 0.7.25 ribbon application. See the
[beta handoff](BETA_DEPLOYMENT_0_7_26.md) for usage and launch acceptance steps.

## Source identities

| Component | SHA-256 |
| --- | --- |
| Standalone app/index.html | `a1ae157956e37ae3c08d2ba30637781a23466abd0a269416631259869ecb7e31` |
| Financial engine, unchanged | `5b4878931d4e3221c47b2efb90c6063d791d2e93e6b014711a121bc43468d188` |
| Native codec, unchanged | `1499e9b86cd4007b3792fd06fa17eb110a0eba05fdb8211cd7b9533479ea83c3` |
| Previous v7.25 ZIP, retained unchanged | `1e5b49e59db76390f4f97ca77563deb69d74b678cca9cf8d6d2dc4ce84ab8334` |

There are 27 canonical app modules. The new report exporter is canonical; the
existing provider and Settings modules add connection testing. The manual-save
button uses a registered listener instead of an inline attribute. The financial
engine, native schema v1, native codec, calculation workers, extraction rules,
document readers, samples and Windows/local launchers remain unchanged.

## Executed checks

| Check | Result |
| --- | --- |
| Initial baseline `npm test` | 820 cases across 42 files passed |
| Final `npm test` | 838 cases across 44 files passed; build consistency and three executable inline scripts parse |
| Full ordinary Chromium browser suite | All 199 distinct cases passed: 189 before the environment restart, then the remaining 10 |
| Real runtime integrations | All 17 passed using eight separately cached, pinned public artifacts |
| Served beta / Chromium | All 5 passed |
| Served beta / Firefox | All 5 passed |
| Served beta / WebKit | All 5 passed |
| Python runtime runner | All 13 passed |
| Local launcher | 5 passed; 1 native CMD case skipped on Linux |
| CI configuration | YAML parses; existing Node/Linux/Windows jobs plus four beta browser/OS matrix entries; GitHub execution pending |
| Desktop and phone previews | Three images inspected; no horizontal page overflow, uncaught errors or unexpected CSP violations |
| Repeated build, deterministic packaging, patch reproduction | Passed; exact source and deployment inventories verified |

The full browser run was interrupted by an execution-environment restart after
189 passing cases. Test discovery identified the remaining ten, which passed in
a follow-up run against the same app hash. Coverage is complete across these two
runs; there was no single uninterrupted full green run. The packaged coverage
record identifies every case and its latest result.

The 18 added Node cases cover independent workbook amounts/units/signs/periods,
tenant groups and detailed terms, nonfinite values, oversize text, AI connection
payload/authentication/cancellation, and deterministic deployment generation with
matching CSP hashes. A report test confirms currency/area labels without numeric
conversion. Seven added ordinary browser cases exercise export failure/retry,
changed context, cancellation/declined downloads, fresh XLSX/JSON snapshots,
explicit AI testing and credential-safe failures.

Each served-build run starts from fresh browser storage and returns the exact
`headers.json` policy. The five checks cover security headers and blocked
unauthorized inline scripts; manual save/reload, calculation worker and native
backup; real XLSX download; real PDF text/worker/render/cleanup; and a simulated
OpenAI connection through the permitted endpoint. The workbook is inspected with
Python ZIP/XML independently of SheetJS, and then reopened with the pinned
SheetJS library. The independent two-year April-start fixture has 1,000 area
units, rent 12.125 per unit/year, annual rent 12,125, operating cost 2,400 and NOI
9,725. Numeric types, precision, periods, formats, multiple tenant groups and
formula-looking names are checked. No formula or external-link parts are emitted.

The earlier report unit fixture uses annual rent 12,000 and NOI 9,600. Floating
point differences are compared within explicit tolerances; the exporter does not
round saved numbers or change underwriting calculations.

## Environment and test corrections

Local runs use Debian 13 Linux, Node 24.19.0, Python 3.12.14 and Playwright 1.62.0.
Chromium uses the installed 154.0.8037.57 binary; Firefox and WebKit use Playwright's downloaded Linux
builds. WebKit's missing Debian libraries were downloaded to a separate scratch
directory and linked into its local test bundle. Its host dependency check reads
the system linker cache and cannot see these isolated libraries, so that check
was bypassed after verifying library loading; the browser and all five tests
then ran. This is Linux WebKit evidence, not native Safari/iOS certification.
None of these test browsers or system libraries is packaged with the application.

Initial new-test failures were corrected: a status selector matched two elements,
a CSP assertion omitted whitespace trimming, a manual-save test named a nonexistent
helper, an existing source-slice test assumed the old no-argument report function,
and WebKit's routing exposed local Blob URLs that the fixture initially blocked.
The corrected harness allows only this origin's Blob URLs and still rejects
unverified external requests. These fixture corrections did not relax the app's
security policy or remove product checks. Final results are those above.

The new shared report export path also fixes stale JSON results, and the workbook
uses neutral number formats for non-USD models. Real provider calls are not made:
synthetic API replies validate wiring and errors, not account access, provider
CORS policies, model quality or billing behavior.

## Limits and next evidence

- No hosted deployment, access configuration or GitHub Actions run occurred.
  Run the acceptance checklist on the selected stable HTTPS origin.
- Native Windows/Edge, macOS Safari, iOS and native Excel/LibreOffice remain
  unverified. Cross-engine smoke coverage is narrower than the full Chromium
  suite and does not establish every workflow on those engines.
- Use a user-owned API key locally for a live connection/extraction check.
  Analyst-reviewed representative leases, rent rolls and P&Ls and a broader
  independent financial benchmark are still needed.
- The report workbook is a Basis report, not a guaranteed ARGUS dump-layout
  equivalent or native model backup. The legacy JSON report remains minimal.
- Some calculation and workbook-serialization paths remain synchronous; large
  portfolios need performance testing at the intended beta size.
- Runtime pins/notices and the static security policy do not replace a full
  transitive dependency audit, penetration test or provenance review. No project
  license has been selected and no legal/financial certification is asserted.
