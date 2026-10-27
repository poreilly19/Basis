# Validation snapshot — 0.7.12

Validated locally on 2026-10-21. This pass edits the chat workspace project and
implements the first [usability changes](USABILITY_0_7_12.md).

| Command/check | Result |
| --- | --- |
| `npm test` | 633 cases pass across 34 suites, followed by source/syntax checks. |
| `npm run test:runner` | 13 Python stdlib cases pass. |
| `npm run test:browser` | All 92 Chromium workflows pass in 296.592 seconds, including all seven new usability workflows. |
| Focused usability, Settings and navigation suites | The initial six new usability workflows, five Settings workflows and four navigation workflows passed before the full run. |
| Desktop and phone previews | Workspace, rent roll and Settings inspected at 1440 × 900 and 390 × 844; no page width overflow at 390 pixels. |

## Behavior covered

- The first property can be opened by name from the initial screen at 1280 × 720.
  The Workspace heading has a visible save state; the removed logo subtitle
  stays absent. Existing portfolio boundaries and library actions are retained.
- An unapplied AI provider/model/key and keyboard focus survive preference
  changes and redraws. Delayed host detection does not overwrite an unfinished
  standalone provider setup. No draft key enters browser storage, model/workspace
  data or public status; applying setup clears the input, and clearing the
  configured key does not restore an old draft.
- Provider guidance changes with the selection. Configured credentials do not
  claim a tested connection. Autosave-off keyboard help explains manual saves,
  property switches and recovery drafts.
- Property Name has an associated label that focuses its input. Enter on Choose
  Files opens the picker and the selected original text fixture reaches intake.
- Rent Roll starts with nine labeled columns (eight inputs plus Edit) and a
  Delete action. All Columns retains 21 labeled columns plus Delete. View changes
  do not change model values, arrow-key editing continues to work, a committed
  edit survives navigation, and uniform sizing counts only visible columns.
- The simulated extraction workflow checks the less conclusive validation
  wording and retains explicit review/Apply.
- Save-state regression injects a failed write, checks the error after redraw,
  retries successfully and checks the library-conflict status.

## Source identities

| Source | SHA-256 |
| --- | --- |
| `app/index.html` | `14f0f0d876500317c8dc5e17be91360c6e09782dcda80ab14d598ffd73842d9d` |
| `src/workspace_settings_ui.js` | `a85e8d1b2b2b018a408df114b0e52c20902dfb2edf1d518b42a94b67b5d0f2b4` |
| `src/financial_engine.js` | `ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936` |
| Immutable 0.7.11 archive | `f861ce0cf44b8aa8bc91562602398756d66a4e46c09d6994b3d79711a5bd849e` |

The financial engine and native data format are unchanged. Packaging checks the
repeated build, exact reconstruction using the incremental 0.7.11 patch, unique
ZIP entries, CRC/content, deterministic ZIP bytes and the unchanged prior archive.

## Scope and limits

Browser checks use isolated storage, loopback HTTP and blocked or simulated
external requests. No real API key, paid request or user document was sent to a
provider. Live provider/model access, CORS and extraction accuracy remain
unverified. The seventeen optional real PDF.js/SheetJS checks last passed in
0.7.9; their runtime modules are unchanged and those downloads were not repeated.

Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium
154.0.8037.57 on Linux. Native Windows, other browser engines, screen readers and
GitHub-hosted CI were not run here. Phone-sized Chromium checks are not a complete
mobile usability or accessibility study. The tall phone header and horizontal
rent-roll scrolling remain in the next-step recommendations.
