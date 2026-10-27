# Financial and document accuracy review — 0.7.19

Reviewed October 27, 2026 in the local chat project. This pass follows the broader
0.7.18 review with independently specified financial examples and document-mapping
checks. The v7.18 release ZIP is retained unchanged; no Box or published files were
modified.

## Confirmed findings and corrections

| Area | Before | Corrected behavior |
| --- | --- | --- |
| Expense gross-up | The denominator was floored at 10% occupancy, understating the selected gross-up during early lease-up. | Use actual positive occupancy. For a 1,000-SF building, a 50-SF tenant and $10,000 full-occupancy costs (20% fixed), a 95% gross-up produces a $9,600 recovery pool and $480 tenant share. The old share was $290. Actual operating expense remains $2,400. |
| Future-funded debt | A zero initial loan amount caused levered equity, IRR and multiple to remain blank even when capital-cost draws and repayments existed. | A $1,000 July draw at 6%, with no initial advance, now produces the independently reconciled levered result: $120,000 initial equity, $1,000 payoff, approximately 7.57600845% nominal annualized IRR and 1.1509166667× net equity multiple in the stated two-year fixture. |
| Financing horizon | An advance in the forward year could activate levered metrics for a hold ending before that advance. | Only initial debt or actual advances/draws within the selected hold activate levered results. The forward-year schedule is retained, and shorter-hold sensitivities use their own horizon. |
| Levered reports | Several reports required a nonzero loan at acquisition, hiding returns for loans funded later. | IRR Matrix, Returns Over Time and Valuation & Return Summary use the existence of modeled equity, including deferred and draw-only loans. |
| Present Value report | With valuation-day adjustment enabled, detailed rows omitted the adjustment although totals included it. | Period rows apply the same factor as totals, across annual, nominal-monthly and effective-monthly discount modes and annual/quarterly/monthly report periods. |
| Valuation date input | A date outside the first analysis month could be mistaken for a full change of valuation month. The established engine adjusts only the day within the first month. | An error-level Model Check identifies the unsupported date and links to the field. Neither the date nor the valuation convention is silently changed. |
| Imported lease expiry | A saved term-length mode could override a newly imported explicit expiry, changing the modeled rent term. | Accepting an explicit expiry selects date mode. Keep Current preserves both the previous end value and its entry mode; inactive term-year/month inputs remain available. |
| Imported free rent | A later free-rent start was only noted while the grant was applied at commencement or a stale offset. A market override could ignore the imported duration; explicit zero months did not clear an earlier grant. | Supported start dates become the correct lease-month offset, with entered-month basis. Explicit zero is honored. Review keeps/corrects amount, start and basis together. Corrected commencement dates drive the proposed free-rent offset and annual fixed-dollar rent-step dates before Apply. |

The free-rent mapper accepts whole months starting on a lease-month anniversary,
including the existing month-end-clamping convention. Fractional durations,
off-anniversary dates, invalid dates or starts before commencement are **not
applied**; a review note explains that the timing needs manual review. Existing
free-rent terms remain intact in these cases. Additional existing free windows,
partial-abatement shares and gross/base-only settings are not inferred from a
source schema that does not describe them. Additional windows are specifically
flagged for review.

## Independent cases that also pass

The new financial suite specifies expected economics before calling the actual
engine. It covers both occupancy-frequency choices for gross-up; cumulative and
non-cumulative 5% recovery caps after an expense decline; administration fees before
and after a recovery ceiling; annual versus monthly stop netting; a circular 3%
recoverable management fee solved algebraically; deferred origination, maturity
and exit fees; floating-rate floors/caps; future-draw shares and commitment limits;
weighted market rollover with downtime, free rent, TI and LC; midmonth option
handoffs; a one-day leap-year lease; and the within-start-month valuation convention.

For the draw-only fixture, the expected monthly cash flows are an initial
-$120,000, six $800 receipts, eighteen $795 receipts, and an additional $119,000
sale receipt in the final month. July's $1,000 capital expenditure is offset by the
$1,000 draw; $5 monthly interest begins that month. The independent IRR oracle uses
bisection on this conventional one-investment/nonnegative-receipts stream. It is
not a general claim about unique IRRs for cash flows with multiple sign changes.

The nineteen calculation cases plus one diagnostic case are in
`tests/advanced_financial.test.cjs`. Nine additional cases in
`tests/intake_accuracy.test.cjs` check source mapping and coherent review decisions.
Five browser workflows verify worker output, native round trips, report visibility,
PV row reconciliation and document review/apply. Their extraction responses are
fixed synthetic fixtures; they do not measure a live AI provider's accuracy.

## Preservation and scope

- The native schema remains v1; no model fields or report destinations were removed.
  Historical source inputs are not rewritten on import except when the user applies
  the reviewed document proposals.
- Existing 18 complete engine-output fingerprints remain unchanged, as do their
  recorded input fingerprints. Those particular fixtures do not exercise the
  newly corrected edge cases; passing them is preservation evidence, not evidence
  that the old behavior was correct in every case.
- Underwriting changes are limited to gross-up at low occupancy and recognizing
  actual financing within the selected hold for levered results. Report and import
  corrections intentionally affect the identified scenarios. Unsupported valuation
  dates receive a finding instead of a newly invented discounting convention.
- The seven usability changes from 0.7.18, multiple tenant groups, source review,
  formatting, settings, portfolio/scenario boundaries and file formats are retained.

See [the validation snapshot](VALIDATION_0_7_19.md) for final commands, counts,
hashes and package checks. Earlier failing reproductions are kept separately from
passing final evidence.

## Next priorities

1. Reconcile representative full property models against independently prepared
   underwriting schedules, especially recovery caps spanning amendments, partial
   years, area changes and mixed actual/budget periods. These examples improve
   coverage without certifying every combination.
2. Test live extraction on representative leases, amendments, rent rolls and P&Ls,
   with expected fields and source citations established by a reviewer. Provider
   availability, extraction accuracy and costs are still unverified here.
3. Add a date-based free-rent schedule editor and a source-linked rent-step grid
   for grants/amendments that cannot be represented by whole lease months. Review
   additional existing grants and abatement scope explicitly.
4. Execute the included native Windows launcher check and a double-click walkthrough
   on Windows; test other browser engines and assistive technologies. This Linux
   environment cannot establish those results.
5. Retain the hosting, dependency/provenance and legal-review priorities from the
   [broader review](CODE_REVIEW_0_7_18.md). This is not financial certification or
   legal clearance.
