# Beta validation — 0.7.27

This pass prepares Cloudflare Pages + Access, fixes report reconciliation and
adds tester support/privacy information. It does not publish a site or configure
an account. See [Cloudflare setup](CLOUDFLARE_BETA.md) and the
[manual acceptance record](BETA_ACCEPTANCE.md).

## Identities and behavior

Final app SHA-256: `69e7cdb157af0c91fb86a45fa56519408e42467924fb1c06798c37076315fc41`.
Financial engine remains `5b4878931d4e3221c47b2efb90c6063d791d2e93e6b014711a121bc43468d188`.
Native codec remains `1499e9b86cd4007b3792fd06fa17eb110a0eba05fdb8211cd7b9533479ea83c3`;
native schema is still v1. The original uploads and v7.26 release are retained.
There are 28 canonical application modules; the added beta information module's
version is checked against package.json.

Workbook outflow rows exclude reference-only operating/nonoperating/capital
records, which remain in Input Assumptions. Nonoperating ground rent appears as
its own detail. Independent fixtures reconcile credits, ground rent, tenant
incentives, leasing/capital and debt to the unchanged engine totals.

The subsequent focused report review also corrects the on-screen Cash Flow,
Cash Flow As Of and CSV paths: reference records, signed credits, monthly ground
rent and missing nonoperating/capital/deposit/debt detail. CSV numbers retain
precision instead of independently rounding every line. Presentation changes do
not change engine outputs or model inputs.

File → About Basis exposes the version, privacy and limitations offline, with
keyboard close/focus restoration. Its support download explicitly allows only
application/version/channel, browser user agent, secure-context flag, protocol
and theme. It contains no property/source/AI configuration/browser-storage data
and does not transmit itself anywhere.

## Recorded checks

| Check | Evidence |
| --- | --- |
| v7.26 baseline | 838 Node cases / 44 files passed |
| v7.27 Node regression | 871 cases / 46 files passed on final app bytes |
| Full Chromium suite before the final focused screen/CSV correction | All 202 cases passed in one uninterrupted run (674.536 seconds) |
| Final focused report/route checks | 10 accuracy/report browser cases passed on final bytes; 5 new cases, 207 distinct workflows with latest passing results |
| Final served beta with exact security headers | 6 cases each passed in Chromium, Firefox and WebKit (18 final-byte cases) |
| Local release verifier | 11-file final release passes exact inventory/hash/CSP checks; 21 verifier cases and 6 Access-probe cases pass |
| CI | YAML parsed; local verifier added to configured Linux/Windows beta jobs; hosted execution not performed |
| Packaging | Exact inventories, deterministic ZIPs, unchanged engine/codec, repeat builds and patch reproduction verified |

The full browser run's pre-correction app fingerprint is
`8b538786b81167d8f82fbc209f73d7f0fe845417d398f0a3d0f818590d622cc3`.
The final report correction is covered by targeted financial/report browser
checks and served-build smoke tests. These are distinct scopes; the whole browser
suite was not repeated after that localized correction. The final package records
both identities/results rather than labeling the earlier run as final-byte proof.

New deployment tests exercise inventory/hash/size/path/symlink checks, rejected
weaker headers, tampered hosted bytes, credentials and redirect safety, canonical
Pages routes and custom 404 behavior. Transport failures are redacted by error
type, including failures masquerading as verifier messages. The anonymous Access
probe requires the expected team's login redirect; arbitrary errors or outages
do not count as protection. All network fixtures are local or simulated.

The builder refuses to delete altered or additional user files in a previous
output directory, even when its release marker remains. A custom 404 disables
Cloudflare Pages' default single-page fallback, so missing paths do not return
the app. The generated `_headers` is verified locally; Pages consumes it instead
of exposing it as a public file. The remote verifier uses extensionless HTML
routes, rejects redirects and can read explicitly enabled Access service-token
credentials from environment variables only.

## Test conditions and limits

Local environment: Debian 13, Node 24.19.0, Python 3.12.14, Playwright 1.62.0,
system Chromium 154.0.8037.57 and Playwright Linux Firefox/WebKit. WebKit uses the
isolated local libraries described in the prior validation; no browser/library
is added to the release archive. Linux WebKit is not native Safari/iOS evidence.

A WebKit test harness initially attempted string-predicate polling after a
deliberately blocked inline script. WebKit applied CSP to the harness eval; the
check now observes the actual securitypolicyviolation event directly. The app's
CSP was not weakened. A targeted fixture's five-second wait and one verifier
loopback deadline also expired during concurrent load; unchanged expectations
passed subsequently. Final results are recorded above.

The seventeen optional PDF/SheetJS runtime cases last passed in v7.26; those
readers remain unchanged. This pass additionally exercises real PDF processing,
workbook generation, native backup, calculation workers, simulated AI requests
and beta support downloads under the served security policy in three engines.

The environment reports no configured Cloudflare credentials/identity, and the
owner's account, team hostname, allowed tester emails and support contact have
not yet been supplied. No protected live hostname, invited/excluded login,
session expiry, revocation or live API-account check has been performed. Native
Windows/Excel/Safari and GitHub-hosted CI remain unverified. The synthetic
acceptance kit is an independently computed simple case, not a substitute for
an analyst-approved representative underwriting/document benchmark.

**Ready status:** engineering package prepared for controlled deployment;
ready-for-invitations status remains blocked on live access/content checks and
the intended-platform/account/analyst acceptance record. No public license,
legal clearance or universal financial accuracy is asserted.

The final related sign audit also covers Executive Summary, portfolio cash flow,
resale operating expense, Returns Over Time and Yearly Valuation. A credit must
remain a positive contribution when a signed expense is displayed as an outflow;
absolute-value formatting is inappropriate for those flows. Returns Over Time
and Yearly Valuation now use the engine's leasing total, which includes tenant
incentives, rather than rebuilding an incomplete subtotal from selected inputs.

The cash-flow bridge includes nonoperating/deposit rows, and portfolio cash flow
includes percentage rent, termination fees and deposits so detail remains
consistent with aggregate totals. Five new browser cases use independently
defined amounts and signed/fractional credits for these report paths.

A parallel final Node run exceeded an existing 5-second VM deadline while the
three browser engines and focused reports were running. The final Node run was
repeated sequentially after the browser runs; limits and assertions were retained.
The percentage-rent browser fixture was corrected to the supported `amt`
breakpoint enum before its final passing run; no engine change was made.
