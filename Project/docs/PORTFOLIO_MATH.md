# Portfolio calculation policy — 0.7.2

This policy is implemented by `calcPortfolio` and covered by 18 independently
specified tests in `tests/portfolio.test.cjs`. It changes the previous incorrect
rounding of start-month offsets and the joint-sale calculation. It does not
establish validation of every underlying property assumption.

## Timeline and cash flow

The earliest included property's start month is month zero. Every property's
operating cash flow is placed at its exact month offset, without rounding to
whole years. Reporting columns cover twelve months from the portfolio start;
the final column can be shorter and displays its actual date range and length.
Excluded properties do not affect the dates or values. An included property that
cannot calculate produces a visible error instead of being silently omitted.

Separate-sale mode stops each asset's operating cash at its own hold end and
places its existing net sale proceeds at that actual month. Each property retains
its terminal-income policy, exit cap, selling costs and deductions.

For example, two one-year assets each producing $800/month NOI, starting January
and July 2026, produce $14,400 in the first portfolio year and $4,800 in the final
six months. Their sales occur in December 2026 and June 2027.

## Discounting and IRR

The portfolio retains an annual member-anniversary payment convention. A full
property year's valuation cash flow is paid at that property's anniversary, not
moved to the end of a portfolio reporting column. A partial final property year
at a joint sale pays its accumulated valuation cash at the actual sale month.
This is distinct from the monthly operating arrays used for reporting.

A payment in portfolio month `m` (counting the first month as 1) is discounted by
`(1 + portfolioRate) ** (m / 12)`. The discount rate must exceed -100%. Each asset's
existing non-operating-expense valuation policy determines the cash valued.

If both example properties above sell for $120,000 at a 10% portfolio rate:

```text
PV = (9,600 + 120,000) / 1.10
   + (9,600 + 120,000) / 1.10 ** 1.5
```

Portfolio IRR uses those exact monthly payment dates and effective annualization.
Its initial investment is the computed portfolio PV. Standalone values are
discounted from each property's own analysis start using the exact fractional
year offset. They reconcile when rates, annual timing and other valuation
policies agree. The UI identifies mismatched assumptions, including monthly
standalone timing and day adjustments.

## Joint sale

With `portSingleExit` enabled, the latest original member sale date becomes a
common sale date. Shorter holds are extended on cloned models, retaining all
assets' operating cash through that date. Stored assumptions are not overwritten.
Extensions beyond the engine's 40-year property projection limit fail visibly.

`portResaleNoi` selects the twelve actual NOI months after sale (default `forward`)
or before sale (`trailing`). This portfolio policy is independent of an individual
property's `resaleNoi`. Every member's terminal NOI is capitalized at the portfolio
cap, then its own selling costs, adjustments and deductions determine net proceeds.
A joint exit requires a positive portfolio cap. Forward NOI is not approximated
by rounding to a nearby property year or by using the last reporting column.

For two flat $9,600/year NOI assets with one- and two-year original holds, joint
sale at year two now includes $19,200 NOI in both years and capitalizes $19,200
forward NOI. The previous calculation dropped the shorter-held asset from year
two. A growing single asset in the golden cases has $10,800 trailing NOI and
$12,120 forward NOI; at 8% these produce $135,000 and $151,500 gross terminal value.

## API and limits

The result includes `monthly`, `ann`, `periods`, actual `revM` sale payments,
`cashFlowPaymentsM`, `nM`, `startDate`, `endDate`, and per-property month offsets,
hold lengths and sale dates. `monthly.valuation` honors non-operating policy;
`monthly.cfbds` remains reported operating cash before debt service.

The workspace now passes discount, cap, joint-sale and terminal-NOI settings
through `pwRollup`. Settings retain the existing storage convention in the active
property snapshot. Moving those controls into explicit portfolio/scenario settings
with migration is a future model-design task.

IRR multiple-root limitations remain as documented in `FINANCIAL_VALIDATION.md`.
Complex leases, recovery structures and debt inside each property still need their
own broader fixture corpus; these portfolio tests do not certify those paths.
