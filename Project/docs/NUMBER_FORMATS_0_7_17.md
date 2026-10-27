# Area and rent number formats — 0.7.17

Updated October 23, 2026 in the local chat workspace. Box files are unchanged.

| Field | Display example | Editing |
| --- | --- | --- |
| Area / SF | `12,345` | Full stored value, including existing fractional area |
| Rent per SF, yearly or monthly | `$24.50` | Decimals supported, including precision beyond cents |
| Annual or monthly rent total | `$125,000` | Whole-dollar values omit unused cents |
| Rent total with cents | `$125,000.50` | Entered decimals remain in the model |

Focus selects the full saved amount without dollar signs or grouping so typing
replaces the value. Click again to place the caret for a partial edit. Leaving the
field restores its display format. Focus, blur and Enter without edits do not write
rounded values back to the model. Stored amounts remain numbers; no currency
conversion, rent-unit conversion or schema migration is introduced.

Pasted dollar signs, valid US comma grouping, signed amounts and accounting
parentheses are supported. Empty required amounts retain the existing zero
behavior. Invalid or partial values such as `12,34` or `12abc` are marked invalid
and do not overwrite the saved amount. The input's validation message and tooltip
explain the correction. Escape discards an unfinished entry. Normal navigation
continues to use the last valid model value.

Formats apply to tenant grids and the lease drawer, phone cards, property/tenant
area changes, recovery denominator areas, absorption blocks, market rent categories
and profile rates, ground rent and miscellaneous rent. Rent-schedule amounts follow
their unit. Percent inputs keep their percentage behavior. Changing a linked market
rate still unlinks it; simply viewing its full precision leaves the link intact.
Reports retain their existing whole-dollar financial summary conventions.

## Rent-schedule correction

The prior Add Base action always created a `psfyr` schedule row using the tenant's
raw rent. A lease with $120,000 annual rent on 1,000 SF therefore incorrectly became
$120,000/SF/year when that row was added. The action now retains the selected unit
and amount; this example produces $10,000 monthly rent. Monthly total and monthly
per-SF cases are also checked, as is 95% of $30/SF/year on 1,000 SF = $2,375/month.
Existing schedules are not rewritten. The canonical financial engine is unchanged.

## Verification

- Before editing, `npm test` passed 651 cases across 35 suites plus build/source
  checks. The initial sandboxed run could not launch a subprocess for the Python
  launcher test; the authorized rerun with subprocess access passed.
- After editing, `npm test` passed all 657 cases across 36 suites, including the
  existing independent financial fixtures and the new six-case formatting suite.
  Canonical source checks matched twenty application modules, the unchanged
  four-module calculation worker and three parsed inline scripts.
- The nine focused Chromium workflows passed in 15.384 seconds after correcting
  replacement selection on focus and invalid-entry propagation. The full browser
  run also includes a market-percentage oracle for the new schedule-row behavior.
- Eight captured desktop/phone views at 1440, 390 and 320 pixel widths have no
  page-width overflow, clipped formatted inputs or uncaught browser errors.
  Formats retain the shared UI font, right alignment and tabular digits in light
  and dark themes. Captures are in the companion `ui_preview_v7_17` folder.
- The complete offline Chromium suite passed all 129 workflows in 235.729 seconds
  with exit status 0, including the new number-format checks and the existing
  saving, scenarios, recovery, financial reports, import, settings, navigation,
  keyboard and mobile workflows.

No third-party dependencies or network services were added. Live AI calls,
optional PDF/spreadsheet dependency checks, physical devices and non-Chromium
browsers were not retested for this input/UI change.

## Release integrity

The release script verifies the unchanged v7.16 archive, byte-identical financial
engine, repeatable build, deterministic ZIP contents/CRC, and an incremental patch
that reproduces the final project. App/ZIP checksums accompany the release.
