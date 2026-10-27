# Validation snapshot — 0.7.23

Validated October 27, 2026 in the local Linux execution environment. See the
[restored layout guide](LAYOUT_0_7_23.md) for behavior and retained preferences.

| Check | Result |
| --- | --- |
| Baseline `npm test` | 812 passing code cases across 42 files, before changes. |
| Final `npm test` | 820 passing code cases across 42 files, including eight new workspace/tab lifecycle cases. |
| Full `npm run test:browser` | 181 passing Chromium workflows in 712.463 seconds, including six new property-tab workflows. |
| Desktop destinations | All 53 Model pages and 44 Insights pages reached through the two horizontal tab rows. |
| Build and syntax | 26 canonical application modules and four worker sources match; all three inline scripts parse. |
| Visual inspection | Six final-build previews: Rent Roll, Property Setup, Document Import, dark Rent Roll, mobile Rent Roll and Workspace. No uncaught browser errors or page overflow in these captures. |
| Preserved sources | Financial engine, native codec, AI extraction/provider modules, file readers, launchers and samples are byte-identical to 0.7.22. Native schema remains version 1. |
| Actual PDF.js/SheetJS runtime suite | Last passed 17 workflows in 0.7.21. Readers remain unchanged; this optional suite was not repeated. Ordinary Chromium reader regressions ran with the full suite. |

## What the layout checks establish

- The restored section/page tabs reach every current destination, and desktop
  content uses the full work area. Model and Insights retain separate routes.
- Open-property tabs and the picker respect both portfolio and scenario. Hidden
  contexts' open-tab preferences remain available when returning to them.
- Active-tab closing saves before opening a replacement. Closing the last tab
  saves and returns to Workspace; returning to Model reopens it. Closing an
  inactive tab preserves all saved models and current inputs.
- Save failures, replacement-read failures and edits during a save keep the tab
  open. A later portfolio or scenario selection cannot be reversed by a delayed
  property load.
- Left/Right and Home/End move tab focus without activating a different model.
  Enter activates the focused destination. Background redraws preserve focus.
- Long property names and many open tabs scroll inside their strip at 1,024 px.
  Mobile checks cover 320, 390 and 640 px widths, dialog closing and resize focus,
  tenant cards, the full-screen lease editor and bottom mode controls.
- Workspace remains visible after leaving Model, and Settings, Document Import,
  library actions, Summary, contrast, groups and numeric entry retain coverage.

The first targeted UI run caught a Workspace mount inside the newly hidden Model
panel. The mount was corrected before the final full run. A separate injected
save-failure test was corrected so Playwright did not invoke the injected
function while assigning it. The successful focused follow-ups are retained in
the adjacent test logs; their cases are included in the 181 total.

One final code-suite attempt stopped at the existing subprocess launcher check
because the sandbox denied `spawnSync` with `EPERM`. The complete suite was then
rerun with subprocess access and all 820 cases passed. No launcher changes were
needed.

## Scope and limits

These are deterministic code/browser regressions, not a guarantee for every
underwriting case. Financial fixtures and engine parity checks passed with the
unchanged engine. Provider responses in browser tests are controlled fixtures;
live AI extraction accuracy and account/CORS behavior were not retested. Native
Windows launch, Safari/Firefox/Edge behavior and screen-reader review remain
outside this validation. The previews use the supplied sample property.

## Release identities

| Artifact | SHA-256 |
| --- | --- |
| Final `app/index.html` | `6ce5a49baee2ba68649a5cdb21d137dae5a013507f7f5f7684dc82598f75d09f` |
| Unchanged financial engine | `5b4878931d4e3221c47b2efb90c6063d791d2e93e6b014711a121bc43468d188` |
| Unchanged native codec | `1499e9b86cd4007b3792fd06fa17eb110a0eba05fdb8211cd7b9533479ea83c3` |
| Previous 0.7.22 ZIP | `204e64327e4dbb7404ed2e3ade514d8cf8b6e92fb33fa82ad263b6afefc9a0d6` |

Packaging verifies the previous archive's unchanged bytes, repeat-build identity,
exact patch reproduction, deterministic ZIP bytes, archive CRCs, member uniqueness
and a full source inventory. The adjacent SHA-256 and package-verification files
record the final ZIP identity and checks.
