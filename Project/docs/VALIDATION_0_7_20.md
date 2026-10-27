# Validation snapshot — 0.7.20

Validated October 27, 2026 on the local Linux execution environment. See
[the extraction changes and remaining limits](AI_EXTRACTION_0_7_20.md).

| Check | Result |
| --- | --- |
| Baseline `npm test` before edits | 705 passing code cases across 39 files; build checks passed. |
| Final `npm test` | 738 passing code cases across 40 files; no failures or skips. |
| `npm run test:browser` | 157 passing Chromium workflows, including nine new extraction workflows. |
| `npm run test:dependencies` with verified cached libraries | 17 passing real PDF.js/SheetJS integration workflows. |
| `npm run check` | 24 canonical application modules and the four-source worker match; all three inline scripts parse. |
| Visual check | 1280 × 900 review screen: Apply To next to the tenant, readable source disclosures and no uncaught errors. |
| Financial engine | Byte-identical to 0.7.19; its existing output-fingerprint and financial golden tests pass. |

## New checks

`tests/intake_quality.test.cjs` adds 31 cases covering partial and gross abatement,
kept/corrected shares, source lineage, duplicate filenames, missing/excluded/image
citations, supported/unsupported rent units, malformed values, invalid or conflicting
step dates, per-SF area correction, ambiguous matching, duplicate/removed targets,
order-independent missing-suite grouping, expense recovery eligibility and the area
correction editor's initially empty draft. Two additional provider tests check
separate trusted instruction fields for OpenAI and Anthropic.

The synthetic fixture in `tests/fixtures/intake/partial_abatement.json` contains
base-lease and amendment text, fixture provider responses and independently stated
monthly rent expectations. At $12,000 annual base rent, six months at 50% abatement
beginning July produce $1,000/month in January–June, $500/month in July–December,
$9,000 in year one and $12,000 in year two. Gross-scope cases independently check
recovery abatement. These check mapping and engine integration, not what a live
provider would extract from the text.

Nine new browser cases exercise actual controls for existing/new tenant choices,
correction resets, percentage corrections and invalid drafts, duplicate-name source
viewing, quote warnings, unsupported rent, per-SF area changes, and a native model
save/read round trip. The browser suite blocks external requests; runtime integration
uses previously verified cached library bytes. No user documents or API keys were
sent to a live provider.

## Reproducible release

- App SHA-256: `7815f41a0976feeaeb0404c54ce13fd8afed1b35aebb41a5ad96937a8672b41e`
- Engine SHA-256: `5b4878931d4e3221c47b2efb90c6063d791d2e93e6b014711a121bc43468d188`
- Native archive schema: **1**, unchanged.
- A repeated build must leave every package file byte-identical.
- Packaging verifies every ZIP member, CRC, deterministic ZIP bytes, and an upgrade
  patch that reproduces the exact project from the previous release.
- The previous 0.7.19 ZIP is retained and its SHA-256 checked before and after packaging.
- Package SHA-256 and verification details accompany the downloaded ZIP. Full final
  logs are included alongside the release artifacts.

## Limits

A passing synthetic suite does not establish live AI extraction accuracy, semantic
citation accuracy, legal amendment precedence or correctness of every financial
model. Scanned-image quotes require visual review. Provider confidence is advisory.
Same-priority amendments, partial clauses and schedules still need document review.
Native Windows launcher execution was not performed on Linux; the unchanged launcher
retains its existing Windows CI test. No deployment, Box upload or live provider
benchmark was performed in this release.
