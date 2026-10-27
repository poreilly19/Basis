# Navigation and mobile editing — 0.7.15

Historical release notes. Version 0.7.23 restores desktop tabs; see the
[current layout guide](LAYOUT_0_7_23.md). Mobile navigation, Summary and editing
behavior described below are retained.

This release implements recommendations 1 and 2 from the UI improvement list.
It retains all Model and Insights destinations, the v7.14 lease drawer,
document review and multi-group workflows.

## Find a screen

Desktop Model and Insights have one sidebar. Expand a category, then choose a
screen. Opening a category closes the previous category, keeping the list compact.
The current screen is highlighted and named in the work area's context bar.
Collapse the sidebar with its top arrow; the remaining menu button expands it.
The command search and its Ctrl+K shortcut still find every modeling task/report.

At widths of 900 pixels or less, **Sections** opens the same navigation tree in a
modal panel. Escape or Close dismisses it and returns focus to Sections. Choosing
a screen closes it and focuses the screen's location. Resizing to desktop closes
the modal and puts the tree back in the sidebar. At widths of 700 pixels or less,
Workspace / Model / Insights appear only in the bottom navigation bar.

## Know which property is open

One property picker replaces the open-property tabs, duplicate picker and arrow
buttons. It lists properties from the selected portfolio **and scenario** only.
Click the portfolio/scenario name beside it to open the context selection dialog.
The Workspace library's own selection controls remain available in Workspace.
Alt+PageUp / Alt+PageDown still step through the selected context's properties.

Changing context does not display another context's previous model or metrics.
If no matching property opens automatically, choose a property from the picker
or return to Workspace. During a property read, the picker keeps the name of the
model actually on screen. Existing outgoing-save and concurrent-edit guards still
control activation. Save status, Undo, Redo, keyboard help, calculation cancellation
and manual Save Changes remain available.

## Summary and phone rent roll

**Summary** is closed initially and reveals the active property's modeled NOI,
value, value per SF, yield, IRRs and debt coverage when applicable. Its title names
the property and context. Pending/failed calculations show a status instead of
old numbers. A zero rentable area displays a dash for value per SF. Changing
property, portfolio, scenario or workspace mode closes Summary. Workspace's
portfolio aggregate metrics retain their existing layout.

Phones show tenant cards with name, suite/status, area, base rent and its input
unit, lease dates and group names. Search and group filters apply to cards and
the table. **Edit Lease** opens the existing full-screen editor; closing it restores
focus to the visible card. **View → Editable Table** retains inline editing,
all-column views and row deletion. Desktop retains the Essentials table by default.
Table row shortcuts ignore hidden rows when the card view is active.

Sidebar, Summary and card/table choices are presentation state in this tab.
They do not add fields to properties, native archives, exports or preferences.
The removed changing subtitle below the logo remains absent.

## Follow-up evaluation

Ask users to find a recovery assumption, edit a tenant and return to valuation.
Compare navigation errors and completion time with the earlier stacked tabs.
Test the phone workflow on physical Safari/iOS and Android browsers, and check
screen-reader announcements and larger system text. Automated Chromium checks
and viewport previews support this release; they do not replace usability testing.
