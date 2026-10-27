# Basis CRE Native Model Format — Draft 1.0

**Extension:** `.basiscre` (proposed, not registered). **MIME:** `application/zip` for compatibility (no custom MIME registered). **Manifest identifier:** `org.basisstudio.cre-model`. Version 1. No encryption, no code, no executable contents.

## Container

A normal ZIP archive containing UTF-8 JSON entries with `/`-separated relative paths. Basis v7 creates uncompressed ZIP entries (compression method 0, STORE). It can read DEFLATE (method 8) in browsers supporting `DecompressionStream('deflate-raw')`; do not count on universal DEFLATE read compatibility yet. Writer applies CRC-32 and optionally SHA-256. ZIP64, multipart ZIP, encrypted entries and absolute/parent-traversal paths are unsupported.

**Property**:

```text
Sample_Property.basiscre
  manifest.json
  assets/model.json
  audit.json
```

**Portfolio**:

```text
Sample_Portfolio.basiscre
  manifest.json
  portfolio.json
  assets/property_0001.json
  assets/property_0002.json
  ...
  audit.json
```

## Manifest

```json
{
  "format":"org.basisstudio.cre-model",
  "schemaVersion":1,
  "kind":"property",
  "createdAt":"2026-10-15T14:40:00.000Z",
  "producer":"Basis Studio",
  "modelFile":"assets/model.json",
  "checksums":[
    {"path":"assets/model.json","size":1234,"crc32":"0123abcd","sha256":null}
  ]
}
```

A portfolio manifest instead sets `kind: "portfolio"` and `portfolioFile: "portfolio.json"`. `checksums` also includes `portfolio.json` and `audit.json`. In v1, `modelFile` or `portfolioFile` is required for its respective kind. `checksums` is required and must contain exactly one record for every archive entry except `manifest.json`; duplicate checksum paths and uncovered entries are rejected. Each size is a non-negative integer, CRC-32 is eight lowercase hexadecimal characters, and SHA-256 is either absent, null, or 64 lowercase hexadecimal characters. SHA-256 can be null if Web Crypto is unavailable; ZIP CRC-32 is always enforced. These hashes detect accidental changes and mismatched content; they do not authenticate who created an archive. The sample timestamp, hash and size are illustrative.

## Property data

`assets/model.json` is the complete serialized Basis application property model (the currently supported `S` model tree), not results-only data. `name` is required and must be a string up to 1000 characters. A name-only or otherwise partial model remains supported; omitted fields receive application defaults when adopted. Unknown additive fields and their nested data are preserved on save/open.

When present, `years` must be an integer from 1–100, `startMonth` an integer from 1–12, and `startYear` an integer from 1000–9899. The year range keeps analysis labels in the engine's supported four-digit calendar range. Known calendar fields accept `YYYY-MM` or `YYYY-MM-DD`, including valid leap days; null or empty strings remain allowed for optional dates. Invalid months/days, non-string dates and malformed date text are rejected before calculation. The recovery-specific `tenants[].baseYear` field additionally accepts a four-digit year string or integer year (1000–9999), matching existing workbook/document importer output. This exception does not apply to lease dates, and the validator preserves the supplied value without changing its calculation semantics.

Known record collections must be arrays of JSON objects; null, primitive and array-valued records are rejected. These collections include areas, leases, market assumptions, inflation series, revenues, expenses, recoveries, absorption blocks, loans, closing costs, adjustments, classifications, actuals/budgets, source logs and embedded portfolio members. Known child collections (`areas[].sched`, `mlas[].sched`, tenant rent/area schedules, free-rent windows, miscellaneous rents and sales categories, recovery lines and range entries) receive the same shape checks. An optional record `id`, when present, must be a nonempty string up to 1000 characters and unique **within that collection**. IDs can repeat across separate collections or different parents' child lists. Missing IDs in partial records remain supported. Embedded member models receive the same model checks.

Known references must be strings (or omitted/null), and known numeric input fields reject object/array/boolean payloads. Financial amounts and rates retain legacy numeric strings without coercing the stored inputs; negative amounts, blank overrides and unknown enums are not given new financial interpretations by this validator. Inflation `rates` must be an array of numbers, numeric text or null.

As of 0.7.13, optional `tenants[].groups` contains up to 1,000 unique, nonempty
string references to `tgroups[].id`, each at most 1,000 characters. When present,
this array is authoritative; `[]` means no groups. Otherwise the legacy scalar
`tenants[].group` supplies the one membership. The editor mirrors the first ID
to that scalar for older readers, but reading does not migrate the data. Unknown
group IDs are retained, and deleting one group preserves other memberships.
Malformed arrays, null, duplicate IDs and non-string entries are rejected, also
inside embedded properties. This additive schema-v1 field is classification
metadata and does not change financial calculations. See [tenant groups](TENANT_GROUPS.md)
for workbook cells and compatibility with older builds and external adapters.

Computation limits reject inputs that would otherwise create unbounded loops or allocations: work-driving market/tenant/option terms, hold-over durations, market downtime, month-based rent schedule offsets, absorption intervals and payment spreads are limited to 1200 months (100 years); a tenant's explicit start/end dates may span at most 1200 months. Term years and months are checked separately and in combination. This limit does not restrict a ground lease's term, whose calculation is already bounded by the analysis horizon. Active absorption blocks, including linked reabsorption areas, may generate at most 10,000 leases per property. This is an input-size safeguard, not a recommendation on lease economics.

These checks establish structural and computation-size safety for supported inputs. Comprehensive financial field validation and relationship checks remain a **next milestone**; do not imply that passing this validator certifies underwriting assumptions or every engine path.

## Portfolio data

`portfolio.json` has these fields:

```json
{
  "name":"Industrial Portfolio",
  "scenarios":[{"id":"sc1","name":"Base"},{"id":"sc2","name":"Downside"}],
  "properties":[
    {"id":"p1","scenarioId":"sc1","include":true,"file":"assets/property_0001.json"},
    {"id":"p2","scenarioId":"sc2","include":false,"file":"assets/property_0002.json"}
  ]
}
```

Every property references a declared scenario. Scenario IDs and property IDs are nonempty strings and unique within their respective lists. Scenario names and the portfolio name are strings; at least one scenario is required. An `include` value, when present, must be boolean; omission defaults to true. Export and import both validate these rules so export cannot create an archive that the reader will reject for invalid membership or IDs. On import, the app creates fresh internal IDs to avoid collisions and never intentionally overwrites existing models. Include/exclude flags are retained. All properties and scenarios in the active portfolio are exported, including excluded properties.

Scenario records may additionally contain a versioned `settings` object with
`version: 1`, numeric `portDisc` and `portCap`, boolean `portSingleExit`, and
`portResaleNoi: "forward" | "trailing"`. Discount must exceed -1; cap must be
non-negative and positive for a joint exit. All four fields are required when
settings are present. Unknown settings versions or malformed known fields are
rejected. Unknown additive scenario/settings JSON fields are preserved. Missing
settings stay absent during archive decoding, so reading an older archive does
not silently migrate it. See [SCENARIO_SETTINGS.md](SCENARIO_SETTINGS.md) for
workspace migration, persistence and legacy snapshot compatibility.

## Migration and compatibility

- Reader accepts v1 natively.
- Reader accepts a **draft prototype** v0 property manifest with `modelFile`, upgrading the *manifest in memory* to v1. A missing v0 `modelFile` defaults to `assets/model.json`. The prototype may omit `checksums`; if provided, the same integrity-table rules apply. ZIP CRC verification always applies, including v0. This should not be misrepresented as support for arbitrary historical Basis versions.
- Future/unknown schema versions are rejected explicitly, not silently changed.
- `audit.json` records archive-export metadata, **not** a comprehensive historical edit log.
- Cached valuation and cash-flow outputs are not exported as authoritative inputs. Recompute in the engine after import. This avoids stale results.
- Legacy JSON, Excel and CSV import/export remain supported via separate functions; `.basiscre` is the primary native editable interchange.

## Defensive parsing constraints (current)

Files up to 66 MiB (archive plus margin); total decompressed content at most 64 MiB; individual entry at most 24 MiB; at most 256 entries; at most 1000 portfolio property records; max JSON traversal depth 72 and node count 300,000 per parsed tree; checks against unsafe paths, duplicate ZIP paths, suspicious compression ratios, prototype-polluting keys, CRC mismatches, and declared SHA-256 mismatch where SHA-256 is available. Local and central ZIP headers must agree on flags, method, CRC and sizes (allowing zero placeholders with a valid data descriptor). Signed and unsigned 32-bit data descriptors are supported. Entry ranges must not overlap each other or the central directory; unsupported flag bits, entry disk numbers, ZIP64 extra fields and malformed extra fields are rejected. DEFLATE is read incrementally and cancelled as soon as output exceeds the declared size, before collecting an oversized expanded buffer. This is a first-pass defense, not a complete security audit.

## Portability

These files can be opened by common unzip utilities and parsed with standard JSON libraries. The spec is intended to be implementable outside Basis and should remain public. Do not market the format as formally standardized or trademark-cleared without further review.
