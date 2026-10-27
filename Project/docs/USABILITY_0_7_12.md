# Usability update and next steps — 0.7.12

This pass implements the first set of changes from the October 21, 2026 local UI
walkthrough. It preserves the financial engine and native model format.

## Changes

- Workspace uses compact property rows. Click the property name to open its model.
  Portfolio metrics are smaller, unit ratios follow the property list, and the
  income chart stays below it. Save status appears next to the Workspace heading.
- Rent Roll starts in Essentials: tenant name, suite, area, start, expiry, rent
  unit, rent and recovery structure. Edit and Delete remain available. One View
  selector exposes All Columns and the existing groups. Choices last for the tab;
  changing views does not alter model data or spreadsheet keyboard navigation.
- Edit replaces the small gear and opens the existing lease detail editor. The
  optional count still indicates additional terms; this is not a new drawer.
- Settings retains unfinished AI setup and keyboard focus across preference
  changes and background refreshes. Provider guidance updates immediately, and
  locally configured credentials are distinguished from a tested connection.
- Choose Files is keyboard accessible. Shared form labels identify their input,
  and helper text is associated with that input. Keyboard Shortcuts describes
  manual saves when autosave while editing is off.
- Extraction review uses “No validation issues found” instead of implying that
  source totals have been verified. Review and explicit Apply remain required.

## Observations

At 1440 × 900 with the bundled example and default fitted columns, the first
property name appears around 569 pixels from the top and the Essentials rent roll
fits its 1,382-pixel table viewport. All Columns uses about 3,059 pixels. A browser
regression also checks that the first property and save state are visible at
1280 × 720. These are fixture-specific layout observations, not measured gains
from a user study.

The full rent roll has 20 data fields plus Edit and Delete actions; Essentials
shows eight data fields plus those actions. The earlier review's count of 29
included grouped heading cells. The full grid has 22 physical columns.

Workspace, rent roll and Settings were inspected at 390 × 844 as well. No page
width overflow was found, but the rent roll still scrolls within its container.
The mobile header remains tall and repeats top and bottom navigation.

## Next priorities

1. Keep AI setup inside the intake task with a short Connect AI dialog that
   returns to the same upload. Improve review to show Field, Current Value,
   Proposed Value, Source and Decision, followed by a clear change summary.
2. Move uncommon property setup fields into Advanced sections, and show a
   selection action bar only when properties are selected. Keep scenario actions
   beside the scenario selector.
3. Prototype a collapsible Model sidebar and a phone layout with fewer header
   controls, collapsed metrics and tenant cards. Trial these with representative
   users before replacing the existing navigation.
4. Check keyboard-only and screen-reader operation across all forms and grids.
   Test live extraction against representative leases, rent rolls and P&Ls using
   an account with the chosen model enabled; current automated tests use fakes.

Suggested trial tasks: open a property, edit a rent and verify its save, copy a
scenario, review/apply a rent roll, and export cash flow. Track wrong turns,
horizontal scrolling and whether users can identify the active property/scenario.
