# Validation snapshot — 0.7.21

Validated October 27, 2026 in the local Linux execution environment. See
[amendment handling and remaining limits](AI_EXTRACTION_0_7_21.md).

| Check | Result |
| --- | --- |
| Baseline `npm test` before edits | 738 passing code cases across 40 files, plus build checks. |
| Final `npm test` | 775 passing code cases across 41 files. |
| `npm run test:browser` | 167 passing Chromium workflows, including ten new amendment workflows. |
| Cached `npm run test:dependencies` | 17 passing real PDF.js/SheetJS runtime integration workflows. File-reader code is unchanged by the final amendment guard. |
| `npm run check` | 25 canonical application modules and the four-source calculation worker match; all three inline scripts parse. |
| Financial engine / native codec / launchers | Byte-identical to 0.7.20. Existing engine golden cases and output fingerprints pass. |

## Reproduced failures and independent expectations

The previous 0.7.20 source was run against the same synthetic base lease and
amendment facts. It produced annual rent of approximately **$18,000, $18,000,
$18,000, $19,200**. The independent expected sequence is **$12,000, $15,600,
$18,000, $19,200**: the July 2027 amendment must not raise 2026 or January–June
2027 rent. The new implementation matches that sequence and the monthly values
of $1,100 in January–June 2027 and $1,500 in July–December 2027.

The prior recovery mapping also retained a gross/no-recovery structure and no
base year when the uploaded base lease specified a 2024 base-year stop and the
amendment removed only an admin fee. The new mapping retains the 2024 base year
and 95% gross-up while removing the fee. A separate NNN example independently
checks $2,400 of annual reimbursable expense with the removed fee: $200/month and
$2,400/year in reimbursements.

The fixture in `tests/fixtures/intake/amendment_schedule.json` includes synthetic
source text, controlled provider responses and independent expected results.
These tests measure mapping and calculation integration, not live-provider
extraction accuracy. Reproduction output accompanies the release logs.

## Added coverage

`tests/intake_amendments.test.cjs` adds 37 cases covering replacement-from-date,
listed-step and complete schedules; native/documented history; percentage and
fixed per-SF escalation; pre-commencement and mixed-unit steps; execution-date
ordering; duplicate chunks and object-key order; missing chronology/scope/timing;
CPI, changing-area, relative/additive and unsupported escalation guards; retained
or manually corrected rent; combined citations; recovery patches, zero/false,
future changes, method changes, stop amounts, custom native structures and the
analysis date selected in the same import. New-property copies cannot borrow
removed tenant history. Unresolved changes remain blockers rather than partially
published models.

Ten new browser workflows check actual amendment notes, source buttons, Keep
Current, complete manual schedules, blocked direct Apply, future recovery guards,
CPI with an uploaded base lease, listed-step preservation and native save/read
cash-flow parity. Browser tests block external requests. The dependency suite uses
previously verified cached runtime bytes. No real API key or uploaded user document
was sent to a live AI provider.

## Reproducible release

- App SHA-256: `16714f1529bc9622b43aa024b63bf2002e2461cb1f1e378d8f6badd27e350dd1`
- Engine SHA-256: `5b4878931d4e3221c47b2efb90c6063d791d2e93e6b014711a121bc43468d188`
- Native schema remains **1**. Combined source-log evidence is optional JSON metadata.
- The release builder checks a byte-identical repeated build, every ZIP member and
  CRC, deterministic ZIP output, and a patch that reproduces the exact project from
  the previous archive.
- The previous 0.7.20 ZIP is retained and its SHA-256 checked before and after
  packaging. Package hashes and verification metadata accompany the ZIP.

## Limits

Passing synthetic tests does not establish live extraction accuracy, semantic
citation accuracy, legal amendment priority, complete document coverage or all-model
financial correctness. Dated recovery changes during the analysis and advanced rent
rules remain manual review cases. Mixed/undated scalar statements retain the prior
confidence fallback with conflict review. Native Windows execution was not performed
on Linux; the unchanged launcher retains its existing Windows CI test. No Box upload,
external deployment or live-provider benchmark was performed.
