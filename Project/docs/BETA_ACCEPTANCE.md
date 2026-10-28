# First-cohort acceptance record

Current results: [October 28 owner-preview acceptance](DEPLOYMENT_2026_10_28.md).
Owner-reported Google login and workspace access passed; live save/reload,
backup/export and the other checks below still need their own results.

Use the synthetic files in `samples/beta/` for a repeatable live-origin check.
They contain no real tenant or property information. They exercise a simple flat
lease, annual rent roll and operating statement, not complex underwriting or an
independent analyst sign-off. Do not upload real documents until the operator has
confirmed Access, provider terms and the invitation's privacy notice.

## Live access and deployment

Follow [Cloudflare setup](CLOUDFLARE_BETA.md). Record release version/app hash,
production/preview/custom hostname, date, browser/OS, invited/excluded identity
category, and pass/fail. Never record login cookies, Access tokens or API keys.

- Anonymous request: expected Access login redirect on every tested path/hostname.
- Invited identity: login succeeds; excluded identity: application remains unavailable.
- Authenticated release check: `verify-beta.cjs` confirms trusted local bytes and headers.
- Expired/revoked session: next load requires authorization; existing local data is
  recoverable. Access logout is not a browser-data eraser.
- Repeated login/logout in the same profile must not be represented as separate
  users' model libraries. Use separate browser profiles for shared-device testing.

## App, Windows and backup

On the actual Windows machine, extract the full project ZIP, double-click
`Start Basis.cmd`, and keep its window open. Check local preview and the protected
hosted origin separately; they have separate browser storage. Record Windows,
Python and browser versions. The native CMD CI job is configured but still needs
an actual execution record.

Create two portfolios, each with a clearly named synthetic property. Open, edit,
save and reload each. Confirm Navigator/tabs never show another portfolio's
properties. Add a downside scenario and confirm edits affect only that scenario.
Download a portfolio `.basiscre` backup, import into a fresh browser profile,
and compare properties, scenarios, inclusions, tenant groups and inputs. Test
manual save with autosave off. Back up before site upgrades or origin changes.

## Live AI extraction and review

In Portfolio → Settings, use an account-owned API key, then Test AI Connection.
Do not send the key to a reviewer or add it to feedback. Record provider/model
names locally, success/error category and date, without credentials.

Use a new synthetic property and analysis start April 2026. Import lease.txt,
rent-roll.csv and operating-statement.csv from samples/beta. Extract explicitly,
review every proposed value and source, and only then Apply. Expected tenant:
Example Tenant, suite **001**, area 1,000 SF, commencement 2026-04-01, expiration
2035-12-31, annual rent $12,125 or equivalent **$12.125/SF/year**. Preserve the
underlying decimal even if displayed per-SF rent rounds to $12.13.

Check that matching documents produce one tenant, not duplicate leases. The
rent-roll totals are checks, not tenant records. NOI is a subtotal, not an expense.
The statement period is April 2026–March 2027 and already covers 12 months: do
not multiply it by 12 again. A disclosed unsupported/uncertain field requires
review or manual entry; do not turn it into an assumed success. Before Apply,
confirm inputs are unchanged; after Apply, confirm exactly the accepted changes.

## Independent arithmetic and export

Set a two-year analysis, zero inflation/growth, vacancy and credit loss, no debt,
no reimbursements and no other income/costs. Annual operating costs are $2,400.
Use `samples/beta/expected.json` as the independent arithmetic reference:
annual rent $12,125; annual NOI $9,725; monthly operating cost $200. Compare both
analysis years and monthly rows within 0.000001 before display rounding. This
fixture does not assert PV, resale or IRR; those need independently approved
valuation assumptions and expected results.

Export the report workbook and Cash Flow CSV. Open the workbook in the intended
Excel/LibreOffice version; verify numeric cells, dates/periods, no missing sheets,
complete tenant groups, and the same rent/expense/NOI totals. Reference-only costs
must not appear as cash outflows. Expense credits must increase cash flow. Use
File → About Basis → Download Support Info to attach basic version/browser details
if reporting a problem; review the file and redact any additional attachments.

## Decision record

For each row record date, tester, release/app hash, platform, expected and actual
result, pass/fail and issue reference. Do not mark a skipped or inaccessible check
as passed. Keep the record in the private support channel named by the operator.
A live-account connection check does not establish extraction accuracy on real
leases. An experienced analyst must still approve representative complex leases,
amendments, recoveries, financing and exit assumptions before broader use.
