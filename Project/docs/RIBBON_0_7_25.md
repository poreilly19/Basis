# Reference button layout — 0.7.25

This update follows the user's request to match the supplied Basis HTML's button
layout one for one, with portfolio/building selection on the left. The reference
SHA-256 is `8a63732e12617046e5346d3e6651599e1fd9dac774af5334521cc5e9ce2ddf3e`.
It changes the presentation on the corrected 0.7.24 application.

## Restored controls

The top modes are **Portfolio / Inputs / Reports**, corresponding to the previous
Workspace / Model / Insights modes. Portfolio mode has the
reference's **File / Home / View / Reports** ribbon tabs. Home restores the same
19 buttons in the same order, with the same icon sizes, stacked/large-button
arrangement and group captions:

| Group | Buttons, in order |
| --- | --- |
| New | New Portfolio; New Property; New Scenario |
| Property | Open Property; Duplicate Records; Copy To…; Move To…; Delete Records |
| Selection | Select All; Select None |
| Portfolio | Rename Portfolio; Delete Portfolio; Rename Scenario; Delete Scenario |
| Data | Import; Export |
| Calculate | Calculate; automatic-calculation indicator |
| Reports | Combined Cash Flow; Portfolio Value |

**View** restores Navigator/Classifications toggles, grouping, Clear Search and
Grouping, and Light / Dark. **Reports** restores Combined Cash Flow, Portfolio
Value, Property List, Open in Reports, and the ARGUS Dump Package entry.
**File** restores Back, New Portfolio, New Property, New Scenario, Open Property,
Import, Export Portfolio, Options, About Basis and Recent Properties. Current
recovery, library reload, document import and backup controls remain below them.

The 250-pixel desktop Navigator uses folder/building icons, portfolio cards,
scenario captions and an expand/collapse arrow. Buildings are listed only for
the active portfolio and scenario; the corrected editor's open-property tabs
remain scoped the same way. The main header has the portfolio name and Scenario
selector. Properties, Combined Cash Flow and Portfolio Value occupy the original
positions, with Document Import and Settings at the right. The grid restores
column sorting, grouping, classifications and selection checkboxes. The blue
footer reports actual save state and storage location.

Portfolio summary metrics, unit economics and the NOI chart remain in the
expandable **Portfolio Overview**. On small screens the ribbon, sub-tabs and grid
scroll internally; the Navigator starts collapsed on a newly opened phone-sized
window and can be expanded. Desktop and mobile use the same three mode names.
The changing subtitle below the logo remains removed.

## Corrected behavior retained

Buttons call the existing corrected library actions, new-property wizard,
scenario functions, guarded imports/exports and review-before-Apply document
intake. Menu keyboard navigation supports arrows, Home/End and Escape with focus
return. Menus close on redraw/resize. File-action focus and unfinished Settings
inputs survive background redraws. Failed inclusion and calculation writes show
recoverable errors. Report opening checks that the intended property loaded and
that its portfolio/scenario is still selected.

The **ARGUS Dump Package** ribbon label is retained to match the reference. It
opens the current Basis Reports page, which explicitly offers semantic report
tables as **JSON**. This release does not reintroduce the historical dump-workbook
export. The Export menu names the actual JSON format; other export entries open
the corrected native/legacy export dialog or XL4ADW tools. New Property opens the
current guided setup rather than instantly creating a blank record. Options
opens the current Settings page.

No financial engine, native codec/schema, extraction/provider/reader module,
storage module, sample model, launcher or runtime dependency is replaced by code
from the visual reference. The reference's existing inline SVG icons and ribbon
presentation are reused; no new external asset or font is added. This is a
record of the supplied reference and changes, not a new provenance or legal
clearance conclusion.

See [validation](VALIDATION_0_7_25.md) for actual regression evidence.
