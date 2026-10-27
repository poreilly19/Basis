# AI extraction improvements — 0.7.20

This release improves the path from a provider's proposed document facts to a
reviewed model. It changes local chat files only. It does not use live credentials,
send documents to an external model, update Box, or establish a live-model accuracy
rate. See [validation evidence](VALIDATION_0_7_20.md).

## What changed

| Finding | Result |
| --- | --- |
| The extraction prompt converted 50% abatement for six months into three fully free months. Annual totals could hide the wrong monthly cash flow. | Preserve six months, a 0.5 share and base/gross scope. Review amount, timing, share and scope together. An independently specified example produces $1,000/month in January–June and $500/month in July–December, not three zero-rent months. |
| Per-SF rent could be turned into annual dollars using a source area and then divided by a corrected area. | Preserve the stated per-SF rate through area review, including dated schedules and proposals missing area. Annual/monthly dollar amounts still normalize from their own units. |
| Missing or unknown rent units defaulted to annual, and numeric prefixes could be accepted from malformed strings. | Accept only the four supported rent units and complete numeric values. Reject invalid dates, conflicting same-date steps and undated multi-step schedules. Withhold an affected schedule as a whole; the tenant is unchecked initially and a review note explains the omission. |
| Fuzzy names and missing suites could update the first matching lease. | Exact, unambiguous normalized names/suites can match automatically. Fuzzy, ambiguous or occupied-suite-only matches require an **Apply To** choice. Choose an existing lease or **Add New Tenant**. Two selected proposals cannot update the same existing lease in one Apply. |
| An unspecified suite could bridge two leases across documents, depending on order. | Group known suites first. Keep ambiguous unspecified suites as separate proposals with a warning. Review or deselect overlapping proposals instead of applying both to one lease. |
| Merged tenant fields inherited the source of the tenant name; duplicate filenames could open the wrong upload. | Request field citations, retain the selected field's document/page/quote, and bind citations to local upload IDs. Field review, selected changes and source-log writes use the relevant source. Legacy ambiguous filenames do not silently select the first file. |
| Source quotes had no indication of whether their page/text existed locally. | Label a quote found in page text, a quote not found, an invalid/excluded page, missing/short citation or an image needing visual review. A found quote establishes text occurrence only, not correctness, completeness or contractual priority. |
| Expense categories implied recovery eligibility even when a P&L did not say whether a tenant must reimburse them. | Ask for explicit support. Unknown new expenses are unchecked by default. If deliberately included, they are added as non-recoverable with a follow-up note. Updates preserve existing recovery flags unless the document states a value. |
| Area correction could attempt to validate an absent draft value and remove its own editor. | Opening the editor retains a usable proposal until a correction is entered. Invalid completed drafts still block Apply. |

Extraction rules are now sent separately from the document message through the
OpenAI `instructions` or Anthropic `system` field. Filenames, document text and
images are evidence rather than instruction sources. This is an instruction
boundary, not a guarantee that a provider resists every prompt injection.

## Using it

1. Open **Workspace → Document Import**, or use **Upload Lease / Rent Roll** in
   the rent roll. **Configure AI** accepts a user's provider/key for the current
   tab; keys are not saved in exported models.
2. Upload and select the documents/pages, then choose **Extract**. Local upload
   alone does not send the document; the explicit extraction action does.
3. Review **Apply To**, especially same-name tenants and missing suites. Changing
   the target resets that proposal's field decisions so a correction intended for
   one lease is not carried into another.
4. In **Review Tenant Fields**, expand **Source Evidence for …** and **View Source**.
   Compare the exact field, unit, timing and clause with the original. A tenant-level
   fallback quote is labelled as such.
5. Review **Selected Changes**, document warnings and follow-up notes. Keep current
   values, correct proposals or uncheck items. **Apply selected** validates a copy
   before publishing any model or source-log change. Run **Model Checks** afterward.

If a schedule has unsupported units or dates, correct it in the lease editor or
rerun extraction with clearer supporting pages. Including that tenant applies
other selected supported fields; it does not silently apply the withheld schedule.
If multiple proposals target one lease, review and consolidate their clauses
before importing them together; the current interface does not combine ambiguous
proposals automatically.

## Numerical and compatibility scope

The financial engine is byte-identical to 0.7.19. The intended numerical differences
come from more faithful input mapping: partial vs. full abatement timing, preserved
per-SF units when area changes, and non-recoverable defaults for deliberately
included new expenses lacking recovery support. No saved model is rewritten by
opening the app. Native format remains schema v1. Added source-log document IDs
and evidence status are optional JSON metadata; the existing CSV columns remain.

Old extraction responses without field-specific citations remain readable and
show tenant-level citation status. If an abatement omits share or scope, existing
settings (or ordinary new-tenant defaults) are retained with a review note. Zero
abatement remains valid. Unsupported shares/scopes, fractional durations or starts
that are not lease-month anniversaries leave the existing grant unchanged. Existing
additional free-rent windows are retained and explicitly noted for review.

## What still needs work

- **Measure live extraction on reviewed documents.** Build a de-identified corpus of
  real leases, amendments, rent rolls and P&Ls with independently reviewed expected
  values and citations. Record provider/model versions, missing-field rates, unit
  errors, citation accuracy and accepted corrections. The supplied fixture is a
  synthetic integration test, not a model benchmark.
- **Resolve amendments by clause and effective date.** Existing document-type and
  confidence precedence still proposes a winner; it does not determine legal
  supersession, execution/effective-date order, or reconstruct every partial rent
  schedule/recovery clause. Review conflicts against all relevant documents.
- **Add a rent-step and abatement grid.** Multiple non-contiguous grants and
  fractional/off-anniversary periods need richer editing and independent timing
  cases. Current unsupported grants are not rounded into a different cash flow.
- **Expand expense/recovery review.** A statement's classification is insufficient
  to establish lease eligibility. Add clause-linked recovery pools, actual/budget
  column choices and per-document/as-of reconciliation of subtotals and NOI.
- **Measure scanned-document quality.** Local text matching cannot verify OCR,
  signatures, cross-page tables or images; the source viewer remains essential.

Provider-reported confidence remains advisory, not a calibrated probability.
These improvements reduce specific known failure modes; they do not certify
financial correctness or make uploaded documents self-verifying.
