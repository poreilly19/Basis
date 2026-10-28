# Code review and fixes — 0.7.29

Reviewed October 28, 2026, starting from `f9eae35` (application 0.7.28).
The baseline regression suite passed, including 207 Chromium workflows and
17 real-library integration cases. The issues below were found with additional
edge cases and independent expected values, not by treating that green baseline
as proof that every model was correct.

Integration verification of the fixes is in progress. Final results are recorded
below before publication.

## Saved models and workspace consistency

| Finding | Impact | Correction |
| --- | --- | --- |
| A delayed background read could replace a newer cached model | Reopening and saving could overwrite edits already saved durably | Recheck the write queue/cache and guard revision, index, cache generation and backend ownership before accepting a read |
| Copy used old library metrics with updated copied inputs | Workspace area, NOI and value disagreed with the copied model | Calculate metrics from the exact snapshot being copied |
| Recalculate Values persisted metrics without the corresponding unsaved model | Reload could combine old inputs and newer financial summaries | Commit the captured edited model and its metrics atomically; preserve edits and original storage on failure |

Regressions cover late reads, backend replacement, manual save, durable reopen,
failed commits and input/context changes while waiting for model reads.

## Financial calculations

| Finding | Impact | Correction |
| --- | --- | --- |
| Budget-only lower-line overrides were skipped | TI, commissions, capital and non-operating budgets did not reach cash flow | Apply enabled budget values independently of whether actuals exist |
| A sparse revenue series waived vacancy/loss across its entire date window | Forecast months without supplied values could overstate NOI | Change vacancy/loss only in months with actually applied revenue overrides; preserve zero values and reference-only behavior |
| Position fee-simple valuation deducted capital twice | Understated ownership-position value | Deduct the combined leasing/capital total once |
| Position cash flow used a truthiness fallback | A valid zero cash flow became full NOI | Preserve zero and negative cash flows |
| Non-operating ground rent was added back to NOI | Overstated pre-ground-rent NOI and position values | Add back only operating ground rent already deducted from NOI |
| Explicit 0% position terminal growth became 2% | Overstated position reversion | Distinguish an entered zero from an absent assumption |
| Reset/CPI scheduling could perform unbounded work | Invalid imported timing could freeze the UI | Iterate only supported analysis years and expose invalid timing as a Model Checks error |
| Enabling a future reset flattened earlier contractual rents | Incorrect ground-rent forecast before the first event | Preserve the underlying rent schedule until an actual reset/catch-up occurs |
| Explicit fractional-percent debt rates were interpreted as decimal fractions | A 0.5% index could become 50% | Honor explicit percent units; save new UI entries with explicit percent markers |

Representative independent cases:

- $12,000 rent less $2,400 operating costs gives $9,600 annual NOI.
  In a one-year position comparison with 8% cap, default 2% forward growth and
  $1,000 capital, corrected fee-simple value is $131,000; the old value was $130,000.
- With $4,800 capital, corrected value is $127,200; the truthiness fallback
  previously produced $132,000.
- Moving $1,200 ground rent between operating and non-operating classification
  does not change the pre-ground-rent position economics.
- A $60,000 interest-only loan at 0.5%, 0.25% and 1% has annual interest of
  $300, $150 and $600 respectively.
- Sparse January actual revenue must not remove vacancy or credit loss from
  February/March forecast revenue merely because the actuals end date is March.

Valid unmarked legacy floating curves retain their historical interpretation.
Ambiguous fractional entries receive a review warning; editing the field records
explicit percent units. Malformed or nonfinite tokens are rejected visibly.
Position resets retain the established level-rent policy after the first event;
this pass does not add new ground-lease contract structures.

## Document extraction and Apply

| Finding | Correction |
| --- | --- |
| Capital dates used calendar-year offsets under a fiscal analysis | Use the final selected analysis start and preserve an explicitly supplied payment month |
| Equal-name/amount capital projects with different dates were deduplicated | Include their date/year in identity; retain distinct dated projects |
| A partial profile overwrote unstated TI, commissions or free rent | Preserve the existing counterpart values and inflation references; retain explicit zero |
| An annual per-area market rent retained the previous monthly/total rate unit | Set the documented annual per-area unit when applying that field |
| Plain recovery proposals reused pooled or differently denominated structures | Reuse only financially equivalent supported structures |
| Unsupported recovery types became standard net recoveries | Withhold the proposal until the user keeps or selects a supported recovery treatment |
| Permissive numeric parsing accepted malformed magnitudes | Parse supported complete numbers, grouping, signs and exponents; warn on unsupported values rather than manufacturing an amount |
| Missing loan/option fields received financial defaults | Require supported, documented terms or explicit review; preserve stated zero values and withhold incomplete financing |
| Negative loan terms passed completeness checks | Require nonnegative amortization and nonnegative whole-month IO/maturity terms |
| Repeated expense captions in one source collapsed independent rows | Withhold ambiguous source groups; preserve genuine cross-document corroboration |
| An expense could silently match the first of multiple existing targets | Require an unambiguous target instead of updating an arbitrary row |

Held proposals are visibly unchecked with actionable explanations. A forced Apply
does not bypass unresolved ambiguity. Supported Keep/Edit review decisions can
resolve a field without discarding unrelated documented inputs. Floating loan
extraction without an actual index curve is held for manual debt entry; an index
name and spread alone do not establish a future rate forecast.

## File interoperability, exports and timeouts

- Valid workbook XML using single quotes, namespace prefixes, paired elements or
  normalized relative worksheet paths could be rejected. Read relationships and
  worksheets through the already validated XML structure.
- Template export could retain old rows and add duplicate row references, or
  leave a prefixed worksheet unchanged. Rewrite the parsed sheet data while
  retaining headers, styles, validations, comments and unrelated metadata.
- Spreadsheet numeric text was rounded to 12 significant digits before structured
  import. Preserve the underlying JavaScript number's round-trip representation.
- The report numeric reader mishandled exponent signs. Keep scientific notation
  distinct from an accounting or leading negative sign.
- Formatted numeric model inputs such as `1,000` and `$12.75` could calculate but
  fail report export. Normalize supported numeric text without concealing
  malformed or nonfinite values.
- A stalled file read could keep a batch permanently in Reading despite the
  deadline. Bound each read, stage results privately, reject late mutations and
  advance to the next file. PDF resources must still be released on cancellation.
- Actuals/Budget help incorrectly claimed that budgets never affect cash flow.
  Explain the selected data configuration, supplied values and end dates.

## Validation and practical limits

New financial vectors are in `position_financial.test.cjs`,
`budget_override_financial.test.cjs` and `debt_curve.test.cjs`. Storage, reader,
report, intake and native-browser tests include reproductions of their respective
failures. XML rewriting is also exercised with the real browser DOM serializer,
not solely a test DOM implementation.

These corrections intentionally change affected calculations and newly imported
assumptions. Recheck saved models using actual/budget overrides, floating debt or
ownership-position comparisons. Previously imported inputs cannot be repaired
reliably without their source documents; review affected capital timing, market
profiles and recovery assumptions against the originals.

The review found no reproducible DOM script injection or API-key disclosure in
the inspected rendering and provider paths. That is a bounded finding, not a
complete security certification. Real-account provider accuracy, native desktop
spreadsheet behavior, uninvited-identity/session checks and representative
analyst acceptance remain part of the beta checklist.
