# Validation snapshot — 0.7.24

Validated October 27, 2026 in the local Linux environment. See
[interface notes](APPEARANCE_0_7_24.md) for the supplied reference and restored
appearance.

| Check | Result |
| --- | --- |
| Baseline `npm test` | 820 passing code cases across 42 files before changes. |
| Final `npm test` | 820 passing code cases across 42 files. |
| Full `npm run test:browser` | 185 workflows executed in 464.517 seconds: 178 passed; seven older property-name selectors became ambiguous because names now appear in both navigator and grid. |
| Affected browser suites | All 10 legacy-import and library-action workflows passed in 33.763 seconds after the selectors were scoped to the main property grid. All seven initial failures are included in this follow-up. |
| Final distinct browser coverage | 185 workflows have passing latest results, including four added workflows. The follow-up does not add 10 distinct cases to this total. |
| Earlier affected UI pass | 31 navigation, contrast, usability and Settings cases passed. These overlap the full run. |
| Build and syntax | 26 canonical application modules and four worker sources match; all three inline scripts parse. |
| Destinations and previews | All 53 Model and 44 Insights pages are reachable. Eleven final-build previews were inspected, with no uncaught errors or page overflow in the captures. |
| Preserved sources | Engine, native codec, AI/extraction modules, readers, storage modules, launchers and samples are byte-identical to 0.7.23. Native schema remains version 1. |
| Actual PDF.js/SheetJS runtime suite | Last passed 17 workflows in 0.7.21. Runtime sources remain unchanged; this optional suite was not repeated. Ordinary browser reader regressions ran in the full suite. |

## Functional checks for the restored interface

- Wide-screen metrics use the current calculation result, hide while recalculating
  and disappear when the current property falls outside the selected context.
  Smaller screens retain Summary, including its current results and Model Checks.
- The Navigator and grid use the selected portfolio/scenario. Scenario changes,
  portfolio changes, opening a model from the navigator and collapse/expand after
  a redraw are covered.
- In Roll-up saves through the existing atomic library action. An injected write
  failure displays an error and restores the saved checkbox state. Successful
  changes survive reload and update the existing portfolio summary.
- Grid filtering, row selection, bulk-action visibility, keyboard opening and
  phone widths of 320 and 390 pixels are covered without changing model inputs.
- Existing workflows continue to cover tab save/close behavior, stale loads,
  numeric formats, dark/light contrast, the lease drawer, multiple tenant groups,
  document review/Apply, source evidence, exports, recovery and financial outputs.

The initial full-run failures were strict-locator errors, not failed storage or
math expectations. The restored Navigator deliberately adds another button for
each visible property. The legacy-import and library-action tests now target the
main grid explicitly. Their assertions and application code were unchanged for
the follow-up. The adjacent raw logs preserve both runs; `browser_coverage.json`
records the latest passing result for every distinct workflow. No single green
full-suite run is claimed after those test-only locator edits.

## Visual review and limits

The supplied HTML and the final build were rendered in isolated Chromium sessions
with external HTTPS blocked. Final previews cover Rent Roll, Workspace, Property
Setup, Document Import, dark Rent Roll/Workspace, phone Rent Roll/Workspace,
Settings, the lease editor and Insights. The previews use the sample property.

This validation does not certify every underwriting scenario. Financial fixtures
and engine parity checks passed with the retained engine. Live AI account/CORS
behavior, extraction accuracy on additional real documents, native Windows
execution, Safari/Firefox/Edge and screen-reader review were not tested here.

## Release identities

| Artifact | SHA-256 |
| --- | --- |
| Supplied visual reference HTML | `8a63732e12617046e5346d3e6651599e1fd9dac774af5334521cc5e9ce2ddf3e` |
| Final `app/index.html` | `df70589e66b4ddb46cdc7dc01d87c0bd5bac453be7409f1796ea01392698cacd` |
| Unchanged financial engine | `5b4878931d4e3221c47b2efb90c6063d791d2e93e6b014711a121bc43468d188` |
| Unchanged native codec | `1499e9b86cd4007b3792fd06fa17eb110a0eba05fdb8211cd7b9533479ea83c3` |
| Previous 0.7.23 ZIP | `1907d7e728eb0d3f71192520de0204ce8575738cc19a7ed6a551c7fbda63aedd` |

Packaging verifies previous-archive integrity, repeat-build identity, exact patch
reproduction, deterministic ZIP bytes, archive CRCs, unique members and the full
source inventory. The adjacent SHA-256 and package-verification files record the
new archive's identity and validation evidence.
