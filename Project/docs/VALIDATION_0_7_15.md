# Validation snapshot — 0.7.15

Reviewed locally on 2026-10-22. This release implements improvements 1 and 2:
the compact header/mobile workflow and a collapsible sidebar with one property
context bar. Development and packaging use the chat workspace.

## Checks

| Check | Result |
| --- | --- |
| Baseline `npm test` | 651 cases across 35 suites passed before edits, plus source/syntax checks. |
| Final `npm test` | All 651 cases across 35 suites passed against the final app hash below. Headless storage fixtures stub the new presentation module; the actual DOM is covered by browser workflows. |
| `npm run test:runner` | All 13 cases passed in 0.292 seconds. |
| Final `npm run test:browser` | 119 of 120 workflows passed in 331.642 seconds. One case failed in setup at `Page.goto`, waiting 30 seconds for the page load; its test body did not run. |
| Targeted rerun | The scenario-copy/contract-renewal case passed in 3.204 seconds against the same app hash, with no source or test change. Thus all 120 workflows were exercised successfully across the full run and rerun; the full command itself did not exit green. |
| Build checks | All nineteen main application modules match their canonical sources; the worker matches its unchanged four modules; all three inline scripts parse. |

The 12 navigation workflows passed before the final hidden-table keyboard fix.
A separate regression demonstrated that an old desktop row selection could
duplicate a tenant after the table became hidden on a phone. The added test now
passes: hidden rows cannot be duplicated/deleted, and the visible table still
supports duplication.

The single page-load timeout's root cause was not established. No test assertion
was weakened, timeout increased or automatic retry added. The final full run
passed all nine new navigation cases and all other existing workflows.

## Behavior covered

- Every existing NAV and RNAV destination is rendered through the new sidebar.
  Collapse/expand retains the route and inputs. Refresh keeps sidebar focus.
  The mobile modal supports Escape, selection, focus return and resize to desktop.
- The first tenant and Edit Lease action fit above the bottom navigation without
  scrolling at 320, 390 and 640 pixel viewport widths. The property picker stays
  visible; there is one primary mobile navigation bar and no page-width overflow.
  Cards can switch to the editable table; drawer edits return focus to the card.
- Property choices exclude other portfolios and scenarios. Context mismatch
  suppresses the previous model and summary. A deliberately delayed property read
  retains the actual displayed name, saves the outgoing edit and opens the target
  only when ready. The removed logo subtitle remains absent.
- Summary shows the current property and calculated metrics, clears pending
  numbers, survives a refresh within the same context and closes on context changes.
  Zero rentable area displays a dash instead of Infinity for value per SF.
- Hidden table rows cannot be duplicated/deleted through a retained keyboard
  selection. Existing lease drawer, document review, group, storage, native and
  financial regressions remain part of the full suite.

## Visual evidence

Desktop and dark-theme previews were inspected at 1440 × 900. Phone previews use
390 × 844. In the phone rent roll, the pane starts at y=217.55, compared with
y=600.75 in the v7.13 review. The first Edit Lease button spans y=479.55–523.55;
the bottom navigation starts at y=777. There is no page-width overflow or uncaught
browser error in the capture. These are measurements of the bundled example;
long names, warnings and user text settings can increase content height.

## Scope and limits

- Financial engine source is unchanged. This release changes presentation and
  navigation only; it does not certify underwriting formulas or source inputs.
- Native schema remains version 1; no input fields, formats, migrations or model
  calculation paths were removed. Presentation state is not serialized.
- Workspace portfolio aggregate metrics retain their existing layout. The new
  Summary contains the current property's metrics in Model and Insights.
- Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium 154.0.8037.57 on Linux
  were used. Physical mobile devices, Firefox, Safari and Edge remain unverified.
  Dedicated screen-reader and user task testing remain next steps.
- Real optional PDF.js/SheetJS runtime checks and live AI provider requests were
  not repeated for this UI release; their code and dependency pins are unchanged.
  The ordinary browser suite blocks external HTTPS and uses isolated storage.
- Existing accuracy/export priorities and IP/dependency release-review status
  remain applicable; see [the feature review](FEATURE_REVIEW_0_7_13.md).

## Integrity

Final app SHA-256:
`25ed35e63a44db40c1300fe6d2ada99d456b9d99cfad2cd494e184474945bbe1`

Financial engine SHA-256:
`ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936`

Previous v7.14 ZIP SHA-256:
`069b6722400382d46f14b3294707188c44c28e524dbe87763fe418b1ae6e9f10`

The packaging check verifies a byte-identical repeat build, the unchanged engine
and previous ZIP, deterministic archive contents/CRC, and a patch that reproduces
the complete final project from v7.14. Results and artifact hashes accompany the ZIP.
