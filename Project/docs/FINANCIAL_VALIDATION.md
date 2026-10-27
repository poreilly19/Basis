# Financial validation evidence

Review date: 2026-10-15. Runtime: Node.js 24.19.0. These are targeted regression
and independently defined golden-case results, not financial certification.

## Baseline identification and method

The comparison read `Basis_Studio_Codex/app/index.html` directly from the supplied
`Basis_Studio_v7_Codex_Handoff.zip`, without modifying the archive. SHA-256 hashes:

| Artifact | SHA-256 |
| --- | --- |
| Original ZIP | `5ccabb5cf57fb58506d095e06e586e18dc1acd1aaf3d3d388abbd04b271d09db` |
| Original `app/index.html` | `40c16952d92395ac15c8b0a40059fed35a9fc2c4a41e7d974c65b7fe3750b95c` |
| Original extracted financial-engine source | `012f08470badf7a2e66397e10e7cfac49ac7685fedbfcb0281c623ad67181b70` |
| Reviewed 0.7.1 extracted financial-engine source | `895e9ff2dd2ac13fdcf6c4b4c6630dc417342cbdc48523f1d28a815b164fe654` |
| Shared sample input serialized with `JSON.stringify` | `094e6c2b9f69815eb1dc3ac204facd9e0769fde06479f47b36d710092d781c9c` |

The financial engine is the exact HTML source between the first `const $=` and
the `/* =========================== PROPERTY FILE` marker. Both versions were
evaluated in isolated Node VM contexts. The original `sampleState()` generated
one shared input, which was JSON-cloned separately into each engine before every
run. Random IDs were made reproducible by substituting `Math.random` with xorshift32
seed `123456789`: xor shifts left 13, unsigned right 17, left 5, then return the
unsigned result divided by `4294967296`. The engine's initial `blankState()` call
ran before `sampleState()` as in the application. The shared property is the
built-in 2026, ten-year industrial example, with three occupied tenants and a
vacant suite. Each PV convention was then selected without changing other inputs.

Comparison tolerances were $0.000001 absolute for money, `1e-12` absolute for
rates/ratios and exact array lengths. Reported differences below are unrounded
observations before applying those tolerances. The source hashes identify this
review snapshot; future source changes require a new comparison.

## Original/current sample parity

For **each** of `nominal`, `effective` and `annual` PV modes:

- All 1,342 numeric entries in the returned `ann` structure matched exactly.
- All 3,696 numeric entries in the returned `monthly` structure matched exactly.
- All 539 entries across monthly debt service, interest, principal, balances and
  annual debt service matched exactly.
- Purchase price, PV, PV components, net sale proceeds, initial loan, equity,
  payoff, loan fees, equity multiple, average DSCR and debt yield matched exactly.
- The largest IRR difference was `2.6645352591003757e-15`, below the `1e-12`
  tolerance. This is floating-point evaluation noise from the shared IRR solver.

| PV mode | Original PV | Current PV | Original unlevered IRR | Current unlevered IRR | Largest IRR absolute difference |
| --- | ---: | ---: | ---: | ---: | ---: |
| Nominal monthly | 23,839,740.23561246 | 23,839,740.23561246 | 0.08542365077648251 | 0.08542365077648251 | 2.6645352591003757e-15 |
| Effective monthly | 24,306,577.327110786 | 24,306,577.327110786 | 0.08884884869700271 | 0.08884884869700271 | 0 |
| Annual | 24,000,847.146337956 | 24,000,847.146337956 | 0.08675228110120481 | 0.08675228110120481 | 2.6645352591003757e-15 |

Sample loan amount was `13,185,237.21768538`; the ten-year payoff was
`10,959,588.794989545`, unchanged in all three modes. The sample's 30-year
amortization does not encounter the early-payoff or zero-interest defects below.

## Intentional numerical changes

| Independently specified case | Original behavior | Corrected behavior |
| --- | --- | --- |
| $60,000 loan, zero interest, ten-year amortization | Payment $0; year-one balance $60,000 | Payment $500/month; year-one balance $54,000 |
| $60,000 loan, 6% interest, one-year amortization; inspect the 36-month engine schedule | Month 13 still charged $5,163.9857824249475; cumulative principal $183,935.65877820007 despite $60,000 borrowing | Month 13 debt service $0; cumulative principal $59,999.999999999985, equal to $60,000 within rounding tolerance |
| Periodic cash flows `[-100,1000]` | IRR `null` because the fixed search bracket excluded the root | IRR `9`, or 900% per period |
| Periodic cash flows `[-100,1]` | IRR `null` because the fixed lower bound excluded the root | IRR `-0.99`, or -99% per period |
| All-zero cash flows `[0,0]` | Annual IRR approximately -90%; monthly periodic IRR approximately -7.5% | IRR `null`: there is neither an investment nor a return |
| `[-100,1]` followed by 479 zero periods | Annual IRR incorrectly `5`; monthly IRR `null` | IRR `-0.99`; empty periods do not change the root |

Monthly results in this table are periodic rates returned by `irrMonthlyF`.
Reported annualized model returns still use the existing nominal or effective
annualization convention. The annual, monthly, sensitivity and portfolio paths
now call the shared periodic solver, which prevents contradictory report results.
Principal repayments are capped at the outstanding loan balance. No intentional
changes were made to rent, expenses, recoveries, discount timing or terminal NOI.

## Golden cases and solver edge review

`node tests/financial.test.cjs` passes **21 tests** against the deployable engine.
Inputs independently define rent-unit equivalence, annual steps, commencement free
rent, daily proration, occupied-area expenses, NNN recoveries, all three DCF modes,
zero discount, debt fees, interest-only and amortizing loans, payoff limits,
periodic IRR, sensitivity parity and an aligned annual portfolio.

A separate read-only solver stress run passed **166 checks**. These used known
single-return cases over 1, 12, 120 and 480 periods, rates -50%, -10%, -1%, 0.5%,
10% and 50% per period, and cash-flow scales `1e-100`, `1` and `1e100`, plus
zero-padding and invalid/no-sign-change inputs. The largest absolute rate error
was `2.7755575615628914e-16`. The single-return input was an initial `-100 * scale`
and final `100 * scale * (1 + rate) ** periods`, with intervening zeros.

That review caught another underflow edge in the revised solver: 479 leading
zero periods before `[-100,1]` could produce a false endpoint root (monthly `7`,
annual `5`). Leading zero periods are now trimmed, alongside trailing zeros.
Both sides' padding is covered by the committed golden test; the separate stress
run also checked padding lengths 0, 1, 479 and 10,000. Trimming these periods
removes a positive common discount factor and preserves every finite root.

## Limits and next financial work

- This sample comparison covers one shared model in three valuation modes. It
  does not establish parity for every historical model or replace a v6/v7 corpus.
- The IRR solver searches a bounded, expanding bracket and returns one root when
  bracketed. It does not enumerate roots or prove uniqueness. For example,
  `[-100,230,-132]` has 10% and 20% roots but returns `null`; the tangent-root case
  `[-100,200,-100]` also returns `null`. Both behaviors are unchanged from the
  supplied baseline. Reports should eventually distinguish ambiguous/no-bracket
  cash flows from a conventional unique IRR and offer NPV analysis.
- Portfolio calendar alignment and joint exits were corrected in 0.7.2 with an
  independently specified policy and 18 additional cases in `PORTFOLIO_MATH.md`.
- Expand fixtures for market rollovers, lease options, recoveries with stops and
  gross-up, floating-rate/future-funded debt, balloon/exit fees and day-based
  valuation. The current tests do not certify those paths.
- Node VM checks do not exercise browser UI, XLSX/JSON interoperability, storage,
  downloads or cross-browser behavior. Those require separate workflow tests.

## Continued 0.7.2 validation

The same original/shared sample comparison was rerun after these changes. Its
cash-flow, annual, debt and PV groups still match exactly in nominal, effective
and annual modes; maximum IRR difference remains `2.6645352591003757e-15`.
At the 0.7.2 snapshot, the extracted HTML engine body SHA-256 was
`8b45c5a94ee790f6ec892f696a585d8cc691768b3b0b3fc7bc2717b02b96464b`.
The earlier source hash above records the 0.7.1 review snapshot.

`tests/portfolio.test.cjs` adds 18 cases for month offsets, partial reporting years,
separate and common exits, forward/trailing NOI, sale costs, non-operating policy,
input immutability, invalid members and horizon/rate bounds. Before replacement,
13 of the initial 16 cases failed; all 18 final cases pass. The accepted timing
convention and intentional valuation changes are documented in `PORTFOLIO_MATH.md`.

`tests/recovery.test.cjs` adds five independent expense-stop cases. Four initially
failed because the date parser ignored year-only overrides and used the tenant's
lease start instead. With expenses of $2,400 in 2026 growing 10% annually, a tenant
starting in 2027 with a 2026 base year now reimburses $240 in 2027 and $504 in 2028.
Month/day overrides retain existing behavior; a fiscal year-only value denotes
its explicit fiscal label. Options retaining an original stop retain that override.
General lease-date parsing still requires a month. The existing first-year expense
proxy for a pre-analysis base year is preserved rather than inventing historical
expense inputs.

## Continued 0.7.3 extraction and worker verification

On 2026-10-16 the current canonical engine was compared again with the immutable
reviewed 0.7.1 and 0.7.2 archives. The original uploaded handoff archive was no
longer present in this execution environment, so this check does not claim a new
read of that original. The original-to-0.7.1 comparison above remains historical
evidence; the fresh checks establish unchanged outputs from those reviewed
snapshots to the canonical implementation.

| Freshly read reference | SHA-256 |
| --- | --- |
| `Basis_Studio_v7_1_Reviewed.zip` | `bc819aa1dae45385e6430f2548b48583a3df27519a4280d77838402da410063a` |
| Its `app/index.html` | `9bbe8aca313a5111c1c243fbb679ee8bdf2ed7b74db64945fa4037a3f4b76aa8` |
| `Basis_Studio_v7_2_Reviewed.zip` | `62b6e35763b2a41149662478ccecc4f5d4b10f59aa36292d90f7a329eb7f26fe` |
| Its `app/index.html` | `79dfcb307f8a46eb8c45af504052b7c78c4f11c28eb8a79fe07a7f1654d212c2` |
| Current complete `src/financial_engine.js` | `ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936` |

The current hash covers the **complete canonical file**, including boundary
comments, its independent strict-mode directive and the payoff helper refactor.
The earlier hashes cover the original HTML extraction boundaries; they identify
different source representations and are retained with their original meanings.

The shared 0.7.1 `sampleState()` input was generated with the same seeded method
described above. Its JSON SHA-256 still matches the historical shared input:
`094e6c2b9f69815eb1dc3ac204facd9e0769fde06479f47b36d710092d781c9c`.
All 1,342 annual entries, 3,696 monthly entries, 539 debt entries, array lengths
and scalar valuation/return metrics match **exactly** between each reviewed
archive and the current canonical engine in all three valuation modes. There
is no additional rounding tolerance or IRR difference in these fresh comparisons.
The historical original-to-reviewed IRR difference remains unchanged.

| Mode | Current PV, unchanged from both reviewed archives | Current unlevered IRR | Current levered IRR |
| --- | ---: | ---: | ---: |
| Nominal monthly | 23,839,740.23561246 | 0.08542365077648251 | 0.11062820197682699 |
| Effective monthly | 24,306,577.327110786 | 0.08884884869700271 | 0.11641356463747621 |
| Annual | 24,000,847.146337956 | 0.08675228110120481 | 0.11062820197682699 |

The extraction has 22 passing checks in `tests/engine_parity.test.cjs`, covering
18 frozen-input scenarios with exact pre-extraction full-result fingerprints.
`tests/worker_protocol.test.cjs` also passes seven checks for direct/worker output
parity, typed arrays and aliases, validation, recoverable errors and packing.
`tests/calculation_client.test.cjs` passes 26 checks for cancellation, deadlines,
superseded/late replies, cloning failures and hydration. These protocol/client
checks are separate from application UI integration and browser workflows; a
passing isolated protocol test does not establish that all pane updates or
navigation races are correct. See `ENGINE.md` for the transport contract.


## 0.7.4 integrity and intake fixes

The canonical engine is byte-identical to 0.7.3, with SHA-256
`ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936`.
The independent financial, portfolio and recovery fixtures and exact extraction
fingerprints remain in the full test run. Library transactions, export snapshot
ownership and document lifecycle changes do not revise calculation formulas.
Document Apply now validates a complete staged input model before publication;
invalid structural fields leave the prior model intact. The new document-only
capital-year allocation guard rejects offsets beyond 100 years. This is an input
work bound, not a change to the valuation of a valid model.


## 0.7.5 saved-data and document guards

The financial engine remains byte-identical to 0.7.4, retaining SHA-256
`ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936`.
The existing independent financial/portfolio/recovery fixtures and exact engine
fingerprints remain in the full regression run. New saved-data validation and
document resource/lifecycle limits do not revise underwriting formulas.

## 0.7.6 Office dates and runtime integration

The engine remains byte-identical to 0.7.5 with the same SHA-256 above. Workbook
imports and XL4ADW exports now honor Excel's 1904 date system, correcting a
1,462-day interpretation error. Independent serial/date fixtures and actual
SheetJS edit/read checks verify the input dates. This changes previously incorrect
imported assumptions, not the cash-flow formulas applied to a given model.

## 0.7.7 formula results and workbook dates

The financial engine remains byte-identical to 0.7.6 with SHA-256
`ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936`.
Workbook imports now refuse unavailable formula results and Excel errors instead
of silently turning them into blank/zero assumptions. Cached values, including
zero/false/empty text, remain unchanged and are not recalculated. Expanded date
column mappings allow modern serials in both workbook epochs. Existing financial
golden cases and exact engine fingerprints pass; no formula changes are intended.

## 0.7.8 custom workbook input validation

The engine retains the SHA-256 above and is byte-identical to 0.7.7. Custom XLSX
readers now reject uncached formulas, Excel error cells and invalid shared-string
indices instead of silently converting them to blank/zero assumptions. Independent
small workbook fixtures verify both rejection and preserved cached values. PDF
runtime loading also changes, without changing financial calculations.


## 0.7.9 import and reload guards

The engine remains byte-identical to 0.7.8 with SHA-256
`ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936`.
Inflation indices are validated before sparse expansion; accepted schedules retain
the same rate values and zero-filled gaps. Template style parsing preserves dates
across equivalent XML syntax instead of falling back to default analysis dates.
Reload confirmation now follows edit ownership and successful exact-snapshot
publication rather than clock ordering. These are input/lifecycle corrections;
no underwriting formula changes are intended.

## 0.7.18 document inputs and analysis horizon

All financial-engine source outside `validateModel` is byte-identical to the
immutable v7.17 release. Validation adds structured input destinations, an
explicit finding for holds beyond the supported 40 years, and indexed lookups.
The full engine now has SHA-256
`b55f2e83ad77409cffe3068a8fce7355aef2f10fe521150ac401146d679cc493`.
The independent financial fixtures and exact engine-result fingerprints remain
in the regression suite.

Document mapping intentionally changes affected model inputs:

- A $12,000 annual lease with no area retains annual-dollar units. Adding 1,000 SF
  later still produces $12,000 annual rent; the old mapper treated the amount as
  $12,000/SF/year by dividing by an assumed one SF.
- Source SF, expense amounts/rates, annual schedules and converted rents retain
  their numeric precision. For $12,345.67 over 1,000.25 SF, the saved per-SF rent is
  the full JavaScript division result, not a four-decimal approximation. Display
  formatting continues to round SF and currency independently.
- Accepted, retained or corrected area is used consistently by both proposal
  review and Apply. Invalid review drafts cannot reach the saved model.
- A retained 60-year input is not rewritten or represented as a 60-year forecast.
  The page explicitly shows 480 modeled months and Model Checks identifies the
  40-year engine limit. New property setup accepts 1–40 years.

These cases are covered by `tests/guided_model.test.cjs` and the corresponding
browser workflows. See [the review](CODE_REVIEW_0_7_18.md) and
[validation snapshot](VALIDATION_0_7_18.md) for exact evidence and limitations.

## 0.7.19 independent edge-case reconciliation

The engine intentionally changes low-occupancy expense gross-up and recognition
of financing within the selected hold. A 50-SF tenant in a 1,000-SF building with
$10,000 full-occupancy expenses (20% fixed) and 95% gross-up now reimburses $480,
not $290. The fixed $2,000 cost is unchanged; variable expenses gross up from
$400 actual to $7,600 for recovery, making a $9,600 pool multiplied by 5% share.

A $1,000 July draw at 6% on a zero-initial-advance facility now produces levered
returns. With $120,000 acquisition/sale, $9,600 annual NOI, a two-year hold and
the matching $1,000 July capital cost, the equity receives six $800 payments,
eighteen $795 payments and $119,000 net terminal proceeds. The independent
monthly-IRR calculation gives approximately 7.57600845% nominal annualized;
the net-distribution multiple is 1.1509166667. Advances/draws beyond a selected
hold do not activate levered results for that hold.

Twenty new financial/diagnostic cases also cover caps, stop netting, circular
management fees, floating rates, maturity/exit fees, commitments, rollover costs,
midmonth options, leap-day rent and the existing within-first-month valuation
adjustment. Nine import cases cover explicit expiry and free-rent timing, including
reviewed commencement dates. See [the accuracy review](ACCURACY_0_7_19.md) for
the assumptions and remaining limitations.

The 18 recorded full-result fingerprints still match exactly and were not
regenerated. They do not include the new failing edge cases and therefore do not
establish universal correctness. The new engine SHA-256 is
`5b4878931d4e3221c47b2efb90c6063d791d2e93e6b014711a121bc43468d188`.
Final command evidence is in [the validation snapshot](VALIDATION_0_7_19.md).
