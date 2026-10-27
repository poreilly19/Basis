# Expanded code review — 0.7.18

Reviewed October 25–26, 2026. This pass covers the local chat project, including
the seven approved usability changes. No Box files or published application were
modified. The previous v7.17 ZIP is retained unchanged.

## Confirmed accuracy and workflow issues fixed

| Priority | Finding | Fix and evidence |
| --- | --- | --- |
| High | Document mapping divided annual rent by `SF || 1`. With no area, a $12,000 annual lease became $12,000/SF/year; entering area later could magnify rent. | Retain annual-dollar units until area is known. Flag fixed per-SF escalation that cannot yet be converted. An independent case verifies $12,000 annual rent after adding 1,000 SF. |
| High | Document import rounded tenant/building SF to integers, normalized rent to four decimals, and expense amounts/rates to two/four decimals before saving. | Preserve the source input and conversion precision. Cases cover 1,000.25 SF, $12,345.67 annual rent, $3.45678/SF expenses, a 0.0123456 fee rate and fractional schedule amounts. Display rounding remains separate. |
| Medium | Native models permit up to 100 entered years, while the property engine projects a maximum of 40. The old property page also displayed a literal zero months. | New setup accepts 1–40 years. Longer imported models remain intact, with an error-level Model Check and a link to the hold input. Ten years displays 120 months; a retained 60-year input explicitly shows 480 modeled months. No calculation horizon was silently extended. |
| Medium | Committing a lease field could rebuild the drawer between pointer-down and the disclosure click, losing the intended section change. | Defer replacement during pointer interactions, preserve open sections synchronously and clean up pointer listeners on close. Verify editing a suite, opening Lease Details, changing term/option fields and navigating tenants. |

The review also caught defects in the new usability work before packaging:

| Finding | Resolution |
| --- | --- |
| Invalid correction text could disappear on redraw and leave Apply enabled. | Keep invalid drafts in session review state, restore their inputs and block Apply until corrected or deliberately rejected. |
| Per-field decisions could change while an asynchronous confirmation was open. | Capture and recheck review decisions alongside model, property, scenario and item selections. A delayed-confirmation case proves stale decisions cannot apply. |
| A source viewer covered the proposed fields at laptop width. | Reflow the review beside the source panel on desktop; use a full source view with Close on narrower screens. Text and validated scan previews remain local. |
| Malformed report-shortcut storage such as JSON `null` could break reports. | Bound and validate preference loading, filter unknown report IDs and recover to defaults. |
| A clean Model Checks page had no CSV data rows and could not export. | Export the column headings and an explicit no-automated-findings row, retaining the source-review qualification. |
| Repeated summary renders repeated validation work and tenant-space scans. | Cache summary findings for the current calculation generation and index validation lookups while preserving first-match semantics. |

## Scope and preservation checks

- Inspected the calculation client/UI, validation, native/Office archive boundaries,
  saved-library validation and draft recovery, AI request/response handling, tenant
  groups, number formatting, navigation and the new setup/review/export/launcher code.
- Searched dynamic HTML/evaluation sinks. Remaining reviewed HTML assignments use
  fixed markup/icons or clear containers; model/source strings use text nodes.
  Existing hostile-name, formula-string, archive-integrity and malformed-input
  regressions are retained.
- Reran failures and race scenarios for saves, stale tabs, late imports, scenario
  actions, pending calculations, AI setup and document review. Keys remain confined
  to the AI adapter's session closure and are excluded from model/browser storage.
- Verified the pinned PDF.js and SheetJS artifacts with the actual-library runtime
  suite using the existing local cache. This did not contact an AI service or perform
  a fresh external vulnerability-advisory audit.
- Compared the engine against the immutable v7.17 archive: **all engine source
  outside `validateModel` is byte-identical**. Changes inside validation add optional
  structured targets, the explicit hold-limit finding and indexed lookups. Legacy
  finding objects retain their shape; financial formulas and native schema v1 are
  unchanged. Import precision/unit fixes intentionally change how affected source
  documents become model inputs.
- Kept all model/report routes, advanced lease/property inputs, multiple tenant
  groups, scenario/portfolio management, native and legacy files, recovery, existing
  financial fixtures and the full report list. Controls were reorganized; old
  releases remain available. The original-v7 feature inventory remains documented
  in `FEATURE_REVIEW_0_7_13.md`; this pass does not claim a new original-ZIP inventory.

Exact commands, counts, environment details and package hashes are recorded in
[the validation snapshot](VALIDATION_0_7_18.md). Earlier failing intermediate runs
were used to fix behavior or update selectors for intentional UI changes; they
are not counted as passing final evidence.

## Remaining priorities

1. **Run the included Windows CMD test and a real double-click walkthrough on
   Windows.** Linux verifies the portable server, folder independence and port
   handling; the Windows CI job is configured but was not executed here. Test Edge,
   Firefox, Safari/iOS and screen-reader workflows separately.
2. **Validate extraction with representative real leases, amendments, rent rolls
   and P&Ls.** The AI tests use fixed responses. They establish review/apply behavior,
   not provider availability, CORS, costs or extraction accuracy. Rent schedules
   have an advanced JSON correction control; a source-linked schedule grid would
   make complex amendments easier to review.
3. **Expand independent financial reconciliation.** Existing golden cases and
   exact result fingerprints are useful evidence, not proof of every combination
   of rollover, recovery caps/gross-up, exact-day timing and future-funded debt.
   Automated findings do not verify economic assumptions or source documents.
4. **Finish server-side collaboration guarantees before multi-user hosting.**
   Browser IndexedDB commits have revision protection; the optional host API still
   lacks a documented server-side compare-and-swap. See `STORAGE.md`.
5. **Continue separating the embedded application and measuring large-model work.**
   Some startup, export, metadata and validation paths still run on the UI thread.
   Review complexity limits and maintain fixtures while extracting more modules.
   Complete the existing license/provenance and dependency review before a public
   release. This report is not financial certification or legal clearance.
