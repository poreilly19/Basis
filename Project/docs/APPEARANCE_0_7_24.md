# Supplied interface look and feel — 0.7.24

The visual reference for this release is the newly supplied **Basis — CRE Cash
Flow & Valuation Engine.html**, SHA-256
`8a63732e12617046e5346d3e6651599e1fd9dac774af5334521cc5e9ce2ddf3e`.
It is a different reference from the earlier v7 handoff used in 0.7.23.
The file was inspected in an isolated browser with external requests blocked.

## Appearance

- Compact blue-and-gray light theme and charcoal dark theme, with flat surfaces,
  square panel edges, thin borders and smaller desktop spacing.
- A small BASIS wordmark, desktop mode controls and thin horizontal section/page
  tabs. The changing subtitle and numbered shortcut row remain removed.
- Current property metrics appear in the header at widths of at least 1,280 px.
  Summary retains the detailed property/context label and Model Checks button.
- Dense spreadsheet tables and compact form rows retain current numeric formats,
  column choices, search, filters and single-font typography. Dark primary buttons
  use dark text against the light-blue accent for readable contrast.
- Phone navigation, tenant cards and the lease editor retain larger touch controls.

The final `basis-reference-appearance` style block in `app/index.html` contains
the appearance overrides. It uses existing theme variables and component classes.
No new fonts, icon packages, external assets or runtime dependencies are added.

## Workspace

The left **Navigator** lists portfolios and the current scenario's properties.
Its arrow collapses it without leaving the current screen; the choice survives
background redraws for this document. On narrow screens it moves above the content.

Choose a scenario above the property grid. Search and sorting apply within that
portfolio and scenario. The grid shows name, property type, location, area,
analysis start, years, model value, value per SF, first-year NOI, roll-up inclusion
and the saved timestamp. Click a property name in either the navigator or grid to
open the corrected model editor. Long/wide grids scroll within the content area;
phone rows stack their labeled values.

Row selection uses the existing bulk-action bar. **In Roll-up** calls the current
atomic inclusion action; a failed write reports an error and redraws the persisted
value. It does not alter lease/model inputs. Less-used operations remain in
**Library Actions** and **Scenario Actions**. The NOI chart is available through
an **Annual Net Operating Income** disclosure.

## Corrected behavior retained

This is a presentation update on 0.7.23. Financial calculations, file codecs,
storage actions, document readers, AI extraction/provider modules, amendment and
statement reconciliation, launchers and native schema are retained. Historical
calculation code and the old spreadsheet dependency in the reference HTML were
not imported into the corrected app.

Header metrics use the same result values as Summary. Both hide results while
calculation is pending or the active model is outside the selected context.
Property tabs retain 0.7.23 save-before-close and late-load context guards.

Workspace Settings, autosave choices, recovery, current number formats, multiple
tenant groups, Essentials/All Columns, the lease drawer and Document Import's
upload → extract → review → Apply workflow remain available. This release does
not add a license, publish the application or change model-file fields.

See [validation](VALIDATION_0_7_24.md) for actual checks and release identities.
