# Validation snapshot — 0.7.25

Validated October 27, 2026 in the local Linux environment. See the
[reference ribbon and Navigator notes](RIBBON_0_7_25.md) for the button/action map.

| Check | Result |
| --- | --- |
| Baseline `npm test` | 820 passing cases across 42 code test files. |
| Final `npm test` | 820 passing cases across 42 code test files. |
| Full `npm run test:browser` | 192 workflows in 539.489 seconds: 191 passed; the existing NOI-yield assertion needed to open the new Overview disclosure. |
| Overview follow-up | The NOI-yield browser case passes after expanding Portfolio Overview; 1 case in 4.650 seconds. |
| Final distinct browser coverage | 192 workflows have passing latest results, including 7 new ribbon cases. The one-case follow-up is not an additional distinct workflow. |
| Targeted ribbon/UI passes | Initial 45 workflows: 44 passed and one test fixture incorrectly invoked its injected failure during setup. After correcting that fixture, all 8 ribbon/contrast cases passed in 25.753 seconds. These cases overlap the full run. |
| Build and syntax | 26 canonical application modules and four worker sources match; all three inline scripts parse. |
| Destinations and previews | 53 Inputs and 44 Reports pages retained. Thirteen final-build previews inspected; no uncaught errors or page overflow in the captures. |
| Preserved sources | Engine, native codec, AI/extraction modules, document readers, storage modules, samples and launchers match 0.7.24 byte for byte. Native schema remains version 1. |
| Actual PDF.js/SheetJS runtime suite | Last passed 17 workflows in 0.7.21. Runtime source files are unchanged; the optional suite was not repeated. Ordinary browser reader regressions run in the full suite. |

## Restored controls and integration

- All 19 Home buttons match the reference labels/order/group captions. The View
  and Reports ribbon buttons, icon presence and left Navigator geometry are
  covered by a reference-parity browser test.
- Zero, single and multiple selections enable the appropriate record actions.
  Duplication preserves the current model; Open Property loads the chosen copy.
  Existing atomic library/scenario tests remain in the full regression suite.
- Menu keyboard navigation, Escape focus return, background-redraw cleanup,
  document import and XL4ADW routing are covered. File actions and Settings keep
  focus/drafts through ordinary redraws; a draft API key is not persisted.
- Grouping, sorting, classifications, search reset, Navigator collapse/expand,
  portfolio/scenario boundaries and editable roll-up inclusion are covered.
- Report controls reject out-of-scope properties, and a failed open does not
  enter Reports with the previous property. The historical dump-package ribbon
  entry leads to the explicitly labeled JSON report-table page.
- Failed calculation/inclusion commits produce recoverable errors without
  changing the persisted library. The automatic-calculation badge remains
  separate from the autosave preference.
- Light/dark navigation contrast includes enabled ribbon buttons and both tab
  rows. Desktop, phone and theme previews retain the corrected input/report UI,
  lease editor, number formats, Settings and document intake.

The original NOI-yield assertion read a collapsed summary as though it were
visible. The follow-up opens Portfolio Overview before checking the same yield
expectation. Application calculations were unchanged. Raw full/follow-up logs
and the latest status for each distinct browser workflow accompany the package.
No single green full-suite run after that test-only adjustment is claimed.

An early code pass exposed the overview yield text omitted during layout work;
the existing unit-economics section was retained in Overview before the final
pass. A separate attempt reached the real Python-launcher test but lacked local
subprocess permission. The final complete code run used the required local
execution access and passed all 820 cases.

## Visual and runtime limits

The supplied HTML and updated application were rendered with external HTTPS
blocked. Previews cover Home, View, Reports and File ribbons; Import menu; dark
Home; Settings; Document Import; property inputs; Rent Roll; property reports;
and phone portfolio/rent roll. Theme captures wait for the rendered colors to
settle. The previews use the existing sample model.

Financial fixtures and engine parity checks passed with the retained engine;
this does not certify every underwriting scenario. Live AI providers/account CORS,
additional real-document extraction accuracy, native Windows execution,
Safari/Firefox/Edge and screen-reader review were not exercised in this pass.

## Release identities

| Artifact | SHA-256 |
| --- | --- |
| Supplied reference HTML | `8a63732e12617046e5346d3e6651599e1fd9dac774af5334521cc5e9ce2ddf3e` |
| Final `app/index.html` | `1c92fe9c693c62f814afdd808a09d7e8ca7ebaa08df127a99af159009759a890` |
| Unchanged financial engine | `5b4878931d4e3221c47b2efb90c6063d791d2e93e6b014711a121bc43468d188` |
| Unchanged native codec | `1499e9b86cd4007b3792fd06fa17eb110a0eba05fdb8211cd7b9533479ea83c3` |
| Previous 0.7.24 ZIP | `9809099853ebb11e78274c3f4a17f329f7edbf5bd58e8e01e4c31887e94a7b6d` |

Packaging checks previous-archive integrity, repeat-build identity, exact patch
reproduction, deterministic ZIP bytes, member uniqueness, archive CRCs and the
complete source inventory. SHA-256 and package-verification files record the new
archive identity and test evidence.
