# Validation snapshot — 0.7.13

Validated locally on 2026-10-21. This release adds [multiple tenant groups](TENANT_GROUPS.md)
and completes the [original-file comparison](FEATURE_REVIEW_0_7_13.md) using the
reattached ZIP. Work was performed in the chat workspace.

| Command/check | Result |
| --- | --- |
| Baseline `npm test` before edits | Existing 633 cases and source/syntax checks passed. |
| Updated `npm test` | 646 cases passed across 35 suites, followed by module/worker/syntax checks. |
| `npm run test:runner` | 13 Python stdlib cases passed. |
| `npm run test:browser` | All 101 Chromium workflows passed in 185.984 seconds. |
| Final tenant-group browser suite | All nine passed again in 43.071 seconds after final search-field sizing and Add Group label changes. |
| Real SheetJS XLSX suite | All 14 passed in 47.701 seconds, including multiple, legacy and explicitly empty group memberships. |
| Original-v7 browser comparison | Both versions loaded without uncaught errors; no registered routes/builders/default top-level fields removed. |
| Desktop/phone visual review | Group assignments and picker inspected at 1440 × 900 and 390 × 844; light/dark themes, no phone page-width overflow. Final phone dialog bounds: x=17, y=156.5, width=356, height=530.984375. |

## Behavior covered

- Legacy scalar membership reads do not migrate model data. Explicit arrays take
  precedence, including an empty array. New assignments deduplicate and copy IDs,
  mirror the primary scalar, and reject malformed or oversized values before
  changing the tenant.
- Native property and portfolio archives preserve multiple/empty/legacy groups,
  unknown IDs and additive metadata. Both archive writing and reading reject
  malformed memberships, including in embedded properties.
- Basis JSON and workbook tables preserve assignments; display-only group names
  are ignored on import. Blank optional cells retain legacy semantics; explicit
  JSON `[]` clears memberships. Dictionary-less workbooks infer the known JSON
  field. The actual pinned SheetJS writer/reader also passed this mixed-row case.
- Group area counts a tenant once per group. Deleting one group retains other
  assignments and supports undo. Renewals and scenario copies use independent
  memberships; saves, reloads, property switches and native download/import
  retain the selected groups.
- Cancel, search, Apply and clear selections work. The Essentials lease editor
  and full/classification rent-roll views expose the same picker. Changed models,
  memberships or deleted selected groups cannot be overwritten by a stale picker.
  Keyboard focus cycles inside the modal, Escape cancels, close restores focus,
  unresolved IDs remain visible and HTML-like names render as text.
- Tenant Summary and bulk tenant tables include group names. Bulk report rows
  match their headings, and the NOI export excludes the unlabeled forward year.
  The Workbook Import / Export panel is reachable through navigation and warns about unsupported
  custom classifications on both import and export.
- Source Log CSV downloads without a host service and retains source content
  while neutralizing spreadsheet formula-like text.
- Assigning additional groups leaves **all calculated results** of the sample
  property unchanged. Existing independent financial, portfolio and expense-stop
  fixtures and frozen-engine regression cases also passed.

## Source identities and packaging

| Source | SHA-256 |
| --- | --- |
| Final `app/index.html` | `278301c082f557f8edd5b85e17ddeff9cf5cd232b245f704b4c7eff344d5fbfb` |
| `src/financial_engine.js` | `ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936` |
| Immutable 0.7.12 archive | `39f631fe8a87fbecd9f013eebb1d60258fe0b2fbc90f4104db3b235fd689f405` |
| Reattached original ZIP | `5ccabb5cf57fb58506d095e06e586e18dc1acd1aaf3d3d388abbd04b271d09db` |

The canonical financial engine is byte-identical to 0.7.12. Archive schema v1
retains its version with the documented optional `tenants[].groups` field.
The application embeds seventeen canonical modules; its worker uses the updated
validator. Packaging verifies a repeat build, exact reconstruction from the
incremental 0.7.12 patch, ZIP entry uniqueness/CRC/content, deterministic ZIP bytes
and the unchanged prior archive. Separate package verification and SHA-256 files
accompany the deliverable.

## Limits

These checks do not establish that every financial calculation or imported term
is correct. Complex underwriting reference cases, mixed currency/area guards,
complete bulk reports and IRR ambiguity handling remain the priorities documented
in the [feature/accuracy review](FEATURE_REVIEW_0_7_13.md). The XLSX suite uses
original synthetic fixtures; it does not establish arbitrary external workbook
compatibility. Older Basis builds do not understand multiple memberships, and
the XL4ADW adapter does not map them.

Runtime libraries were fetched into a separate cache and verified against the
existing URL/size/SHA-256 manifest. They are not included in the deliverable ZIP.
Real PDF.js worker smoke tests were not repeated in this pass because PDF code
was unchanged; ordinary PDF browser regressions passed in the full suite.
Browser tests block or simulate external requests except verified cached XLSX
library responses. No real user document, API key or paid AI request was sent.

Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium
154.0.8037.57 on Linux. Windows-native execution, other browser engines, screen
readers and hosted CI were not run here. Phone viewport checks are not a complete
mobile/accessibility study; the tall mobile header remains a usability follow-up.
