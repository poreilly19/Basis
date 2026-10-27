# Typography update — 0.7.16

Updated October 23, 2026 in the local chat workspace.

The interface now uses one system UI font for headings, navigation, buttons,
search, form fields, tenant rows, summary metrics and financial reports. The font
stack selects the platform's standard interface face, such as Segoe UI on
Windows. Alternate stack entries are fallbacks, not different fonts assigned to
different screens. No font files or external font requests were added.

The separate Inter override and monospace styling on normal fields and reports
were removed. Raw document/source previews retain fixed-width text so spacing in
copied source material remains readable. Numeric inputs and financial tables
retain right alignment and tabular digits, using the same UI typeface.

## Verification

- Before editing, `npm test` passed all 651 cases across 35 suites, plus canonical
  source, worker and script syntax checks.
- After editing, the build/source checks passed: nineteen matching application
  modules, an unchanged four-module worker bundle and three parsed inline scripts.
- Ten existing Chromium workflows passed in 15.172 seconds: seven usability
  cases, light/dark navigation contrast, phone layout at 320/390/640 pixel widths,
  and phone lease editing/focus restoration. No new test suite was needed for
  this presentation-only change.
- Inspected Workspace, rent roll, Summary, dark rent roll, property fields,
  cash-flow reporting, Document Import, Settings, phone tenant cards and the
  phone lease editor. Visible UI text and controls shared one computed font
  stack. Numeric cells retained `tabular-nums` and right alignment. Captures at
  1440 × 900 and 390 × 844 had no page-width overflow or uncaught browser errors.
- Compared every embedded script with v7.15: differences consist only of font
  references inside styles. The canonical financial engine is byte-identical.
  Financial outputs, data schemas and model persistence were not changed.
- The full browser suite, optional PDF/spreadsheet runtime checks and live AI
  requests were not repeated for this styling change. The previous full browser
  run and its setup-timeout rerun are documented in [v7.15 validation](VALIDATION_0_7_15.md).
  Physical devices and non-Chromium browsers remain unverified.

## Release integrity

App SHA-256:
`865829230688f9c3ce9c389dc25dcffa86dbe6bdc5447798a1e0c429fa8720f9`

Unchanged financial engine SHA-256:
`ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936`

Previous v7.15 ZIP SHA-256:
`a20a83e3b47426c3103ec535c1434c8f993d010a5d115323556fb9eba622107b`

The release verification checks the unchanged prior archive, a byte-identical repeat
build, deterministic ZIP contents/CRC and an incremental patch that reproduces
the final project from the previous release.
