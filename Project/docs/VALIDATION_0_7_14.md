# Validation snapshot — 0.7.14

Validated locally on 2026-10-22. This release implements UI suggestions 3, 5 and 6:
the lease editor drawer, document intake/review improvements and bulk tenant group
classification. Work and packaging were performed in the chat workspace.

| Command/check | Result |
| --- | --- |
| Baseline `npm test` before edits | Existing 646 cases and source/syntax checks passed. |
| Updated `npm test` | 651 cases passed across 35 suites, followed by module/worker/syntax checks. |
| `npm run test:runner` | All 13 Python stdlib cases passed in 0.142 seconds. |
| Full `npm run test:browser` | All 111 Chromium workflows passed in 203.456 seconds after fixing the drawer close/recalculation focus race. |
| Final focused workflow suite | All ten passed in 16.861 seconds after the imported-group filter collision fix. |
| Build verification | Eighteen application modules match their canonical sources; the worker matches its unchanged four-module bundle; all three inline scripts parse. |
| Desktop/phone visual review | Drawer, named chips/bulk selection, current/proposed/source comparison and dark theme inspected at 1440 × 1000 and 390 × 844. Final phone drawer is 390 pixels wide, with stacked labels/full-width date controls and no page-width overflow. No uncaught browser errors during capture. |

## Behavior covered

- Opening the drawer alone leaves model data unchanged. Core inputs, conditional
  term/option fields and the existing rent schedule remain editable. Drawer edits
  survive save/reload. Recalculation retains unfinished typing; closing retains
  table scroll and returns keyboard focus, including a calculation arriving later.
  Switching properties closes the drawer without committing its unfinished input
  to the old tenant or the new property. Phone sizing and light/dark control
  contrast are checked in Chromium.
- Bulk group additions/removals preserve other and unresolved memberships, make
  independent undo steps and validate the complete batch before mutation. Empty,
  duplicate, missing and oversized targets cannot cause partial writes. Filters
  leave whole-property results unchanged, clear hidden selections and reset on
  model/context changes. A filter's special choices cannot collide with imported
  group IDs. Existing native/workbook membership tests still pass.
- In-place AI setup sends no documents and keeps keys out of model, intake and
  browser storage state. Upload → Review → Apply reflects extraction/application
  state. Comparison does not modify the model, shows the mapper's current/proposed
  values and source quotes, updates on selection changes and explains copy-mode
  removals. Empty selections cannot apply. Existing validation rollback, source
  logging, copy-mode preservation and stale property/scenario protections pass.
- A selected imported going-in cap now reaches the model and source log. An
  independent fixture verifies 1,000 SF × $12/SF/year = $12,000 NOI, with no
  expenses/vacancy/credit loss, and $12,000 / 8% = $150,000 purchase price.
  Deselection retains the old cap; preview does not mutate the active model.

## Fixed during validation

The first drawer build incorrectly collapsed its initial section because the
stored title and display title differed. Browser tests also exposed batched group
actions being combined by the typing undo timer and keyboard focus being lost on
a late calculation after drawer close. All were corrected. Visual inspection
caught clipped phone dates/overlapping labels; the phone form now stacks its
fields. A test fixture's fetch stub was also corrected so Playwright did not call
the returned function itself.

## Scope and limits

- Financial engine source remains byte-identical to v7.13. The imported cap-rate
  fix changes selected input mapping, not the engine's valuation formula.
- Native schema remains version 1. No changes to existing workbook fields or
  migration behavior. New drawer/filter/selection state is not serialized.
- AI tests use local simulated responses. No live provider account or document
  accuracy benchmark was used; extracted values still need source review.
- Structured import items such as tenants are selected as a whole; the comparison
  shows their mapped field changes but does not provide per-field tenant editing.
- Tests use Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium
  154.0.8037.57 on Linux. Firefox, Safari, Edge and physical phones remain unverified.
  Real PDF.js/SheetJS optional-runtime tests were not repeated for this UI release;
  their loaders, pins and formats did not change. The ordinary browser suite uses
  isolated storage and blocks external HTTPS.
- This is regression evidence, not certification of every underwriting formula,
  financial scenario or extraction. Existing accuracy/export priorities in
  [the feature review](FEATURE_REVIEW_0_7_13.md) remain applicable. IP, dependency
  and public-release review status is unchanged.

## Release integrity

The package verification checks a byte-identical repeat build, unchanged engine
and previous archive, deterministic ZIP contents/CRC, and an incremental patch
that reproduces the final project exactly. App/package hashes and the final focused
result are recorded below and in the accompanying artifact checksum files.

Final app SHA-256:
`c781d7b78e0c0b53897d9898b5eefb38ab95be181382c5de30ef20189fd24ff9`

Financial engine SHA-256:
`ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936`

Previous v7.13 ZIP SHA-256:
`448caeb991b20037ce8adf81f2d17082cce0d5a8994f1133cadc3e536cf55a04`
