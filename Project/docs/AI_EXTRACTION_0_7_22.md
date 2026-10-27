# AI extraction: rent-roll and statement reconciliation — 0.7.22

This pass improves document checks and financial-input normalization in the
local chat-workspace application. It does not change Box files, publish the
project, select a license or revert the interface. See
[open-source readiness and the original interface](RELEASE_READINESS_0_7_22.md).

## Reproduced issues and corrections

| Finding in 0.7.21 | Behavior in 0.7.22 |
| --- | --- |
| Every rent roll used the latest as-of date across all uploads. A January 2026 roll with $12,000 current annual rent was compared at $13,200 after a June 2028 P&L was added. | Each file uses its own strict calendar date. Missing, invalid or multiple dates cannot borrow the model date or another file's date. |
| The first future step could stand in for missing current rent. Vacant asking rents and future signed rent could enter the current-rent total. | Current-rent comparisons exclude vacant and uncommenced leases. Missing current rent, unknown units, unsupported escalation rules or unresolved expired occupancy produce **Not Fully Checked**. |
| Zero totals were skipped by truthiness tests, including zero NOI. | Zero and signed totals participate in area, rent, expense and revenue-less-expense checks. A stated zero NOI against $6,000 revenue and $4,000 expenses is a visible $2,000 mismatch. |
| Expense rows could be annualized before comparing with a six-month statement total. | The document check compares the original period amounts. Annualization belongs to the separately proposed model inputs. |
| A $4/SF expense covering six months became a $4/SF/year model input. | Supported six-month per-SF amounts become $8/SF/year. A 1,000 SF independent fixture produces $8,000 annual operating expenses. |
| Zero, negative, missing or malformed period inputs could be defaulted or used in arithmetic. Numeric prefixes could accept amounts followed by junk. | Expense/income proposals require a supported amount and 1–12 whole months, or an explicit annual unit. Supported statement metadata can supply missing line months. Invalid proposals are withheld with an explanation. |
| The first repeated total could win even when different chunks supplied different figures. Exact repeated rows could be added twice. | Conflicting totals, mixed reporting periods/columns, and part-only totals prevent a completed comparison. Exact repeated rows are collapsed only when their full relevant content and page/quote evidence agree. |

Parenthesized accounting credits already worked in 0.7.21. New regression cases
preserve that behavior while tightening amount validation; this is not claimed
as a newly corrected sign bug. The shared financial engine is unchanged.

## Review experience

**Document Totals** shows the upload, its as-of date or reporting period, each
check, the calculated/extracted amount, stated total and result. It opens when
there is a mismatch or incomplete comparison and stays compact when all checked
measures match. Each cited total opens its own upload, including duplicate file
names. Values are rendered as text.

The statuses are **Totals Match**, **Mismatch**, and **Not Fully Checked**.
Matching means arithmetic agreement within $1 or 1 SF for that extracted measure.
It does not establish that the provider read the right column, every source row
was found, or the source itself is correct. A file with no extracted stated
totals explicitly discloses the missing completeness check. Checks are advisory;
valid proposed values still require the existing deliberate Apply workflow.
Withheld malformed financial lines cannot be included through a checkbox; enter
corrected supported amounts manually in Operating Expenses or Other Income.

Review identifies annualized other income as well as expenses; source logs retain
the annualization period. The independently specified six-month fixture has
$3,000 taxes + $1,500 insurance − $500 credit = $4,000 reported expenses. Its
annual model inputs are $6,000 + $3,000 − $1,000 = $8,000. Reported $600 parking
income becomes $1,200/year. All are preserved through native export/import.

## Extraction contract

The prompt now requests `reporting.start`, `reporting.end`, `reporting.months`
and `reporting.column`, plus the scope and source of stated totals. Reporting
metadata belongs to the extraction review, not a native-model schema migration.
Full calendar-month date bounds can establish a month count; inconsistent bounds
and counts are rejected. Partial dates and ambiguous periods are not guessed.

Operating statements request their actual T-12 or stated actual period; budgets
request their budget column. A model analysis year does not instruct the provider
to switch a statement from actuals to budget. All numbers and totals should retain
their original period; the application handles supported annualization. Subtotal,
total and NOI rows are excluded from detail proposals when recognized.

## Limits and next steps

- The source-period check cannot prove that a provider attached correct period,
  scope or column metadata. Representative de-identified documents with reviewed
  expected fields remain the next accuracy milestone. No live AI call was made.
- Straight-line annualization is transparent, not a seasonal forecast. Inputs
  covering fractional months, more than 12 months or inconsistent periods need
  manual treatment.
- Percentage-fee reconciliation needs a documented dollar amount and revenue
  denominator; total revenue is not silently assumed to be the fee's EGR base.
  Per-SF document checks require area in the same upload, not the current model.
- Repeated tenant identities with different source evidence need review. Mixed
  periods/columns within one file are flagged, not automatically partitioned into
  separate financial statements.
- Expense matching across files still uses existing name matching and document
  priorities. A future period/column selection screen and explicit expense-line
  target review would improve this workflow. Similar line labels can represent
  different accounts; arithmetic matching alone does not validate model mapping.
- UI restoration should port the desired original layout into the corrected app.
  The original HTML is a historical reference with known defects, not a release
  substitute. No copyright pass/fail conclusion is claimed.

See [validation](VALIDATION_0_7_22.md) for executed checks and packaging evidence.
