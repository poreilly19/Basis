# Amendment handling — 0.7.21

This release improves how extracted amendments become reviewed model inputs. It
keeps earlier rent and unchanged recovery terms when the supplied facts support
combining them. It does not determine legal priority or measure live AI accuracy.
See [validation](VALIDATION_0_7_21.md).

## Fixed issues

| Issue | New behavior |
| --- | --- |
| An amendment with future rent could replace the entire base lease schedule, applying new rent to earlier months. | Combine supported base rent and amendment steps. Preserve rent before the effective date; never fill missing historical rent with an invented zero. |
| Replacing all future rent and changing only listed steps were treated alike. | Explicit `replace_from` removes old steps on/after the effective date; `listed_steps` retains unmentioned explicit steps; `complete` must establish the entire schedule from commencement. |
| Confidence and input order could choose an older amendment. | Different rent/recovery amendments require distinct stated execution dates to establish order. Reporting `asOf` and upload order do not substitute. Identical repeated chunks are deduplicated using canonical data, including execution date. |
| A partial recovery amendment replaced the whole recovery object or was ignored if it lacked a type. | A supported `patch` inherits unmodified base-year/stop/fee/gross-up/cap fields from the base clause or a simple existing structure. Explicit zero and false can remove a fee or change cumulative treatment. |
| A future recovery change could be applied to every analysis month. | Block it when its effective date follows the final selected analysis start. The current model has one recovery structure per in-place lease and cannot represent that dated change safely. |
| A blocked proposal could leave no schedule editor for manual resolution. | Always expose rent-schedule correction for amended rent, including when the current tenant has no schedule. Opening Correct alone does not bypass a blocker. |

## Supported examples

A synthetic base lease begins January 2026 at $12,000/year, steps to $13,200 in
January 2027 and $14,400 in January 2028. An amendment replaces rent from July 2027
with $18,000/year, then $19,200 from January 2029. The result is:

| Period | Rent |
| --- | ---: |
| 2026 | $12,000 |
| January–June 2027 | $1,100/month |
| July–December 2027 | $1,500/month |
| 2027 total | $15,600 |
| 2028 | $18,000 |
| 2029 | $19,200 |

If the amendment instead explicitly changes only its listed steps, the original
January 2028 step remains. This distinction is driven by supplied scope, not an
assumption that every amendment replaces all later provisions.

For recoveries, a base-year clause with a 2024 base year, 95% gross-up and a 10%
admin fee can receive a patch removing only the fee. The base year and gross-up
remain. A future-effective patch is blocked rather than applied retroactively.

## Review workflow

1. Upload the base lease and relevant amendments together when available. Extract
   only the selected documents/pages. API keys remain session-only as before.
2. Confirm **Apply To**. Review source evidence and the effective-date/treatment
   notes in **Review Tenant Fields**. Combined rent and recovery fields retain
   both base and amendment citations. Current-model history is identified as
   model data, not as an uploaded source.
3. Unclear scope or amendment chronology leaves that tenant unchecked initially.
   If selected, its unresolved rent/recovery changes block **Apply selected**.
4. Resolve a blocker by **Keep Current Value**, or by a complete correction.
   Rent corrections must explicitly include **Rent Schedule** (use `[]` to use
   the corrected base rent). Recovery corrections must choose an existing
   supported structure. Selecting Correct without supplying the required value
   does not resolve the blocker. You can also leave the tenant unchecked and
   apply other reviewed inputs.
5. Review **Selected Changes** and Apply. Direct/programmatic Apply enforces the
   same blockers before publishing the candidate or saving a new property.

In copy mode the new property cannot borrow the original property's lease rent
history after its tenant rows have been removed. Supply a base lease or a complete
schedule. The original property remains unchanged.

## Evidence and chronology

The schema now requests `amendmentDate` (stated execution date), `rentChange`
(treatment/effective date), and `recoveryChange` (patch/replace/effective date).
These remain AI proposals, supported by quoted document evidence for review.
No date is synthesized from an upload timestamp, file order or `asOf` field.

Different rent/recovery changes without distinct execution dates are blocked;
same-day conflicts need manual review. Dates rank scalar fields such as expiry
only when every equally ranked statement is a dated amendment. Mixed statement
types or undated sources retain the existing confidence fallback and visible
conflicts; dates do not establish their legal priority. This avoids a cyclic
pairwise date/confidence comparator.

Merged fields expose all relevant sources. Native source-log entries retain a
`sources` list for combined evidence as optional metadata; the existing log table
and CSV show the primary source. Text-found labels still mean only that a quote
occurs in the local page text. They do not establish semantic accuracy or whether
one clause supersedes another.

## Limits and next work

- **Live extraction benchmark.** Synthetic responses test normalization, review
  and calculation integration. Build a de-identified real-document corpus with
  independently reviewed fields, scope, effective dates and citations, then compare
  provider/model versions before claiming an extraction accuracy rate.
- **Dated recoveries.** Add an engine-backed recovery schedule with independent
  golden cases before allowing a change after analysis commencement. For now,
  keep current recoveries or model the change separately.
- **Advanced rent rules.** Relative/additive/review schedules, CPI, changing area,
  unclear escalation anchors and ongoing escalations in listed-step changes require
  manual review. Amendments with continuing escalation rules need explicit dated
  steps; the importer does not guess how those rules interact. Generated history
  is bounded by the engine's 80-year schedule convention and 1,000 combined steps.
- **Complex recovery clauses.** Existing custom pools, occupied-area denominators,
  lines and unknown rule fields are not flattened into simple structures. Method
  changes require a complete supported replacement. Unsupported exclusions,
  controllable-expense definitions and other clause detail still need underwriting
  review against the source.
- **Legal priority and incomplete documents.** Execution dates and supplied scope
  help organize proposals but do not prove enforceability, identify omitted
  amendments or resolve conditions precedent.
- **Schedule review interface.** Add a date/amount/unit grid so reviewers can
  inspect and correct combined schedules without editing JSON. Keep explicit
  source and effective-date information beside each step.
- **P&L reconciliation.** Per-document reporting dates, actual/budget selection,
  partial periods and subtotal/NOI reconciliation remain the next extraction focus.

The financial engine and native schema remain unchanged. Numerical differences
come from corrected input mapping, and are covered by independently specified
cash-flow expectations. Existing saved models are not rewritten on startup.
