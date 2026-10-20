# Scenario valuation settings — version 1

Workspace portfolio valuation belongs to the active scenario. Switching between
properties in that scenario must not change its discount rate or joint-sale
policy. Individual property valuation continues to use that property's assumptions.

The workspace scenario record stores an optional settings object:

```json
{
  "id": "base",
  "name": "Base",
  "settings": {
    "version": 1,
    "portDisc": 0.075,
    "portCap": 0.065,
    "portSingleExit": false,
    "portResaleNoi": "forward"
  }
}
```

`portDisc` must be a finite number greater than -1. `portCap` must be a finite,
non-negative number and must be positive when `portSingleExit` is true.
`portSingleExit` must be boolean. `portResaleNoi` is `forward` or `trailing` and
describes income capitalized at a joint sale; it is independent of property
`resaleNoi`. No new arbitrary upper limit is applied to either rate. Stored version
1 settings require all four typed fields. Unsupported settings versions and
malformed stored values fail visibly instead of silently changing valuation.

## Migration and persistence

Reading settings never changes a scenario, library index or property model.
Without stored settings, the read defaults are 7.5% discount, 6.5% exit cap,
separate property sales and forward NOI. These defaults are stable across property
switches.

Workspace initialization performs an explicit additive metadata migration for
scenarios missing settings. It selects the first saved property assigned to each
scenario in the existing `PW.ix.props` order and reads its legacy `S.port*` fields.
This selection is independent of the property currently open. Native portfolio
imports without settings use the first incoming property assigned to each
scenario. An empty scenario uses defaults. Existing settings are never replaced
by legacy fallback values. Migration must commit through the index's existing
revision check; it does not rewrite any property model or its legacy fields.

Legacy fallback accepts finite numbers and numeric strings for the two rate
fields. Invalid or missing fields individually use defaults. Flags must already
be boolean and terminal NOI must already be a supported value. A legacy joint
sale with a zero/invalid cap receives the positive default cap. These are safe
metadata defaults, not a statement that malformed old assumptions were valid.

New scenarios start from defaults, or copy the source scenario's settings when
copying a scenario. Explicit edits persist complete version 1 settings. A failed
validation or failed index commit must retain the prior scenario and its settings.

## Pure helper API

`src/scenario_settings.js` is canonical and is embedded in the distributable HTML.

| Function | Result |
| --- | --- |
| `basisScenarioSettings(scenario, fallback?)` | A validated copy of stored settings, or defaults with an explicitly supplied legacy fallback. Never mutates inputs. Portfolio reads call it without the active property as fallback. |
| `basisValidateScenarioSettings(settings)` | A validated independent copy of complete version 1 settings; invalid input throws. |
| `basisSaveScenarioSettings(scenario, patch, fallback?)` | An independent scenario record with validated settings applied. The caller explicitly persists it. Fallback is used only when the input scenario has no settings. |

Updates accept the four known fields and optional `version: 1`. Unknown update
field names are rejected to expose typos. Unknown additive JSON fields already
present on a scenario or its settings survive known-field updates. Returned
objects share no mutable nested data with the original scenario. Reserved keys,
non-JSON values, circular references and excessive metadata depth/size are rejected.

## Native interchange and legacy snapshots

Native portfolio `portfolio.json` scenario records preserve optional `settings`
and other additive scenario fields. This is an additive extension to archive
schema version 1. Missing settings remain absent when an archive is read; the
workspace performs the explicit migration when adopting it. Older application
versions can discard scenario metadata, so use this updated reader when restoring
a scenario-settings backup.

Property `.basiscre`, JSON and workbook exports retain their existing property
model fields. Scenario edits do not rewrite `S.portDisc`, `S.portCap`,
`S.portSingleExit` or `S.portResaleNoi` in every property. Those legacy property
fields remain available for old readers and deterministic migration; they are not
the authoritative workspace scenario valuation after migration. Use a native
portfolio archive to preserve the full set of scenario settings.

Workspace legacy portfolio JSON keeps its existing `scenarios: ["Base", ...]`
names and name-based property membership. An additive `scenarioSettings` array
carries complete scenario metadata/settings keyed by `name`; this reader restores
it while generating fresh internal IDs. Older JSON without the array still
imports and seeds each scenario from its first incoming property. Malformed,
unknown-name or duplicate settings records are rejected before writing anything.
Legacy JSON export requires unique nonempty scenario names because its membership
format cannot distinguish two scenarios with the same name. Native portfolios
retain distinct IDs and can safely represent duplicate names.

`tests/scenario_settings.test.cjs` covers immutable reads, explicit legacy fallback,
strict settings validation, scenario independence, failed edits and additive
metadata. Native codec tests cover settings round trips, absent-settings
compatibility, unchanged property snapshots and malformed/unknown-version inputs.
`tests/scenario_workspace.test.cjs` exercises explicit initialization migration,
queued edits and commit failures/conflicts, scenario switches during saves,
new/copy behavior, native backups, and old/new legacy portfolio JSON.
