# Spreadsheet upgrade and input policy — 0.7.7

The app now requires SheetJS Community Edition 0.20.3 from the official CDN.
Upstream's [standalone installation guide](https://docs.sheetjs.com/docs/getting-started/installation/standalone/)
listed that release as current when checked on 2026-10-19. The fetched package
metadata identifies version 0.20.3, Apache-2.0 and no package dependencies. Its
package/distribution license files match; notices are recorded in
[third-party disclosures](THIRD_PARTY_NOTICES.md). This does not establish a
complete bundled-component or public-release audit.

Upstream lists versions through 0.19.2 as affected by
[CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533), and versions
through 0.20.1 as affected by
[CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363).
The selected release is beyond both documented affected ranges. This is an
upstream version/advisory check, not a claim that every vulnerability is fixed or
that either exploit was reproduced against Basis.

## Artifact and compatibility

The script URL is:

```
https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
```

Its observed size is 951,904 bytes, SHA-256 is
`cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41`,
and the browser loader pins:

```
sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT
```

The existing coalesced load, deadline, retry and API checks remain. Older complete
globals are rejected; they cannot act as fallbacks. Runtime bytes remain outside
the handoff ZIP. The pinned test manifest includes the previous writer only for
cross-version compatibility checks with original input in a separate iframe.

Real-runtime checks cover both workbook epochs, tenant and loan dates, Unicode,
leading-zero identifiers/references, child ordering, literal formula-like text,
cached formulas, multiple/excluded members, unknown additive input and a workbook
written by the old artifact. Blank/null and empty-list normalization remains the
legacy table behavior. These small fixtures do not replace a broad Office corpus
or desktop Excel/LibreOffice interoperability testing.

## Formula values

Basis reads stored formula results; it does not evaluate or refresh formulas.
Previously an uncached formula or an Excel error could become a blank rent and
then calculate as zero. Inputs now fail before table conversion when a formula
or array-formula cell lacks a usable cached result, or a consumed cell contains
an Excel error. The error names the sheet and cell and asks the user to
recalculate/save the workbook in Excel before retrying. A failed read does not
publish a partial model.

Numeric zero, false and cached empty text are valid results. Formula-like string
cells remain ordinary text. Input tables, metadata, child tables and `Other_`
additive tables receive the checks; unrelated worksheets and `Results_` sheets
cannot overwrite inputs and do not block import because of their formulas.
Cached results can be stale; Basis cannot verify their freshness. The user must
recalculate the source workbook when its dependencies change.

## Calendar dates

Workbook date epochs remain explicit. Missing date-column mappings now cover
loan starts, actual/budget cutoffs, valuation dates, tenant increase/availability,
ground-lease ends, area changes and miscellaneous rent dates. Modern styled
numeric dates therefore convert before structural validation. Independent tests
verify both epochs without changing financial formulas.

The legacy handling of early 1900 serials remains a known limitation: values
before March 1900 and Excel's fictional 1900-02-29 require a separate calendar
compatibility decision. This pass does not claim all historic date cases.


## 0.7.9 inflation schedule expansion

The legacy workbook table importer checks `InflationRates.Year_Index` before
allocating a rate array. Indices must be nonnegative safe integers below 100,000;
numeric text is accepted, and duplicate indices within a property/series reject.
There is a separate workbook-wide limit of 200,000 expanded rate values across
all properties and series, including zero-filled gaps. These limits apply to
reconstructed schedules, independently of worksheet row/cell budgets. Invalid
indices no longer round or become zero silently. Errors identify the sheet,
field, property and series where applicable.

The prior code assigned an unchecked index to a sparse array and filled every
missing entry afterward. A tiny fixture with index 4,294,967,294 reached that
loop; a bounded Node VM reproduction timed out after 20 ms. No browser lockup
or out-of-memory experiment was attempted. The browser regression uses the first
unsupported index (100,000) through actual SheetJS/OOXML, plus malformed indices
and a valid sparse schedule. Values at the supported boundary and the aggregate
budget have separate Node checks. Supported rates and financial formulas retain
their prior interpretation.
