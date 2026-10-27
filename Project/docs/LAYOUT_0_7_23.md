# Restored original navigation layout — 0.7.23

Historical release notes. Version 0.7.24 follows the later supplied HTML's compact
blue-and-gray styling and Workspace navigator/grid; see the
[current interface guide](APPEARANCE_0_7_24.md). The tab lifecycle corrections below
remain in place.

The desktop layout again uses the original handoff's horizontal section tabs,
page tabs and open-property strip, with full-width editing and report panels.
The restoration is implemented on the current corrected application.

## Using the restored layout

- Choose **Model** or **Insights**, then a section in the first tab row and a
  page in the second. All existing destinations remain available, including
  Document Import and the interoperability tools exposed in later releases.
- Open-property tabs appear above the sections. Tabs and **All Properties**
  include only the selected portfolio **and scenario**. Use the context name
  to change the portfolio/scenario, or choose another property from the picker.
- The active tab keeps the identity of the model actually displayed while a
  different property loads. Closing a tab removes it from the open strip; it
  does not delete the saved property.
- Left/Right and Home/End move keyboard focus through each tab row. Enter or
  Space selects the focused tab. Keyboard movement alone does not change the
  active page or property. Background refreshes retain focus on existing tabs.
- At 900 px or narrower, **Sections** opens the current mobile navigation panel.
  At 700 px or narrower, the bottom Workspace/Model/Insights controls and tenant
  cards remain available. Long desktop tab rows scroll within their own strips.

## Later preferences retained

The numbered shortcut row and changing subtitle under the logo remain removed.
The interface retains one system font, title-case labels, current SF/currency
formatting, Workspace Settings, light/dark preferences, autosave controls, column
fitting, tenant groups, the lease editor and the AI upload/review/Apply workflow.
Summary remains a compact disclosure instead of taking permanent header space.
Current Workspace property rows and the Essentials/All Columns rent-roll choices
also remain available.

The change adds no native file fields and changes no financial calculation,
AI-extraction logic, provider transport, spreadsheet/PDF reader or model codec.

## Tab lifecycle corrections

The previously dormant tab-close path selected replacement tabs by portfolio
alone. It could reopen a tab in another scenario. The restored strip and close
action both use portfolio and scenario boundaries.

Closing the active tab first completes the outgoing save and any replacement
load. A failed save, failed replacement read, changed context or newly typed edit
keeps the tab open. Closing the last tab in the current context saves it and
returns to Workspace. Returning to Model reopens that current property tab.
Inactive tabs close without rewriting the current model.

An in-flight property load also rechecks the selected portfolio and scenario
after saving and reading. A later selection is not reversed by a stale load.
Existing request ownership, model-snapshot and outgoing-save protections remain.

## Reference and validation

The original layout reference was the retained uploaded v7 HTML, SHA-256
`40c16952d92395ac15c8b0a40059fed35a9fc2c4a41e7d974c65b7fe3750b95c`.
It was viewed in an isolated Chromium session with external requests blocked.
Its financial logic and historical defects were not imported into this build.
This is a restoration of the user's supplied interface organization, not a
new review of competitor products or a legal-clearance determination.

See [validation](VALIDATION_0_7_23.md) for regression checks and release identities.
The adjacent release previews show Rent Roll, Property Setup, Document Import,
dark mode, mobile cards and Workspace.
