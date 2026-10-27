# Original handoff comparison and accuracy priorities — 0.7.13

Reviewed locally on October 21, 2026 using the reattached original
`Basis_Studio_v7_Codex_Handoff.zip` and the current chat-workspace project. The
original ZIP is unchanged. This completes the original-file comparison that
could not be done during the preceding 0.7.12 assessment.

## Are features missing?

No registered model pages, report pages, pane/report builders or default
top-level model fields were removed compared with the original upload. Both
versions were loaded in isolated Chromium sessions with external HTTPS blocked.

| Inventory | Original v7 | v7.13 | Change |
| --- | ---: | ---: | --- |
| Model navigation routes | 51 | 53 | Document Import and ARGUS/XL4ADW exposed |
| Report navigation routes | 44 | 44 | None removed |
| Registered pane builders | 62 | 62 | None removed |
| Registered report builders | 44 | 44 | None removed |
| Default top-level model fields | 117 | 118 | `portResaleNoi` added |

Presence is not proof that every field, report or third-party import mapping is
complete. This inventory is not an exhaustive semantic comparison of every
feature combination. Concrete findings from the original are:

- **Hidden document and spreadsheet tools:** the original already registered
  Document Intake and ARGUS/XL4ADW panels but omitted them from ordinary model
  navigation. Document Import was exposed in 0.7.10; ARGUS/XL4ADW is exposed in
  0.7.13 under Data Workspace. Existing adapter mapping limitations remain.
- **Source Log download:** the original Download CSV did nothing in a standalone
  browser without the optional host service. The current button downloads a CSV
  locally, and formula-like source text is neutralized for spreadsheets.
- **Cash Flow bulk export:** the original supplied only NOI, with eleven values
  under ten year headings in its ten-year sample. Version 0.7.13 fixes the extra
  unlabeled value by exporting only the displayed analysis horizon. The bulk
  Cash Flow table still needs the other cash-flow lines.
- **All Terms and bulk reports:** the original download already contained only
  five tables, and All Terms repeated six basic rent-roll fields. Adding Tenant
  Groups makes seven fields; it does not make this a complete terms report.
  The five-table download is JSON, separate from the retained editable model
  XLSX export and from the 44 on-screen reports.
- **Summary alternate tables:** the original already filtered the older alternate
  layout blocks out of its Property and Tenant summaries. This was not lost in
  the later UI edits.
- **Full rent roll and portfolio controls:** Essentials hides optional columns
  initially; All Columns and Edit retain them. Portfolio inclusion, grouping and
  classifications remain under Portfolio Analysis → Properties. The numbered
  shortcut row and changing logo subtitle were removed at the user's request.

The new tenant memberships are documented in [TENANT_GROUPS.md](TENANT_GROUPS.md).
Existing models with a single group remain readable. Current native/Basis model
files retain multiple memberships; the external XL4ADW adapter explicitly warns
that custom tenant classifications are unsupported.

## What would most improve financial confidence?

The engine is byte-identical to 0.7.12. A new regression case confirms that adding
a second group leaves all calculated results of the sample property unchanged.
Neither that check nor the larger regression suite proves every financial path
correct. The following work remains the priority:

1. **Independent reference calculations and reconciliations.** Add separately
   specified golden cases and analyst-reviewed reference workbooks for complex
   renewals, partial months, CPI, gross-up/stops/caps/admin recoveries, percentage
   rent, TI/LC, floating-rate loans, future funding and balloons. Reconcile every
   monthly line and annual total, debt balance, sale proceeds, PV and return.
   Frozen earlier engine outputs only establish regression consistency.
2. **Currency and area compatibility.** Current portfolio aggregation can add raw
   USD/EUR amounts and SF/SM areas. Add a compatibility guard before supporting
   explicit dated FX and area conversions. Current labels do not perform those
   conversions; heterogeneous portfolios need review.
3. **Complete, traceable exports.** Build complete cash-flow and lease-terms tables
   from shared report data and test periods, columns and totals against displayed
   reports. Until then, rename or clearly explain the limited All Terms download.
   Record assumptions, engine version and source references with results.
4. **Explain uncertain returns.** Distinguish ambiguous, undefined and failed IRR
   calculations. The current solver returns null for `[-100,230,-132]`, which has
   10% and 20% roots, and for `[-100,200,-100]`, which has a tangent root at 0%.
   Add an NPV profile, residual diagnostics and stated return conventions.
5. **Validate real input workflows.** Reconcile representative leases, rent rolls
   and P&Ls against approved models, including AI-extracted proposed values.
   Measure extraction accuracy separately from provider/API workflow tests.
   Review stale capability/help wording and test supported workflows on Windows
   and other browser engines as well as Linux Chromium.

Core existing financial coverage comprises 21 financial cases, 18 portfolio cases
and five expense-stop cases; 22 engine checks cover 18 frozen scenarios and the
extraction boundary. Most other tests protect storage, imports, safety and UI
behavior. See [financial history](FINANCIAL_VALIDATION.md),
[portfolio conventions](PORTFOLIO_MATH.md) and [release validation](VALIDATION_0_7_13.md).

## Evidence and identities

Machine-readable route, report-shape, download and source-hash observations are in
[the comparison record](ORIGINAL_V7_COMPARISON.json). Both browser sessions
completed without uncaught errors. Synthetic fixtures were used; no real user
document, API key or paid provider request was sent.

| Source | SHA-256 |
| --- | --- |
| Reattached original ZIP | `5ccabb5cf57fb58506d095e06e586e18dc1acd1aaf3d3d388abbd04b271d09db` |
| Original application HTML | `40c16952d92395ac15c8b0a40059fed35a9fc2c4a41e7d974c65b7fe3750b95c` |
| Current canonical financial engine | `ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936` |

The original engine was inline. Intentional amortization, IRR, portfolio timing
and year-only recovery-stop corrections between the original and later releases
are documented in the financial history; this review does not claim those
versions have identical financial code or certify all underwriting mathematics.
