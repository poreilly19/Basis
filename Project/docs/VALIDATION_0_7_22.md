# Validation snapshot — 0.7.22

Validated October 27, 2026 in the local Linux execution environment. See
[statement reconciliation](AI_EXTRACTION_0_7_22.md) and
[release readiness](RELEASE_READINESS_0_7_22.md).

| Check | Result |
| --- | --- |
| Baseline `npm test` | 775 passing code cases across 41 files, before changes. |
| Final `npm test` | 812 passing code cases across 42 files, including 37 new reconciliation/input cases. |
| Full `npm run test:browser` | 175 passing Chromium workflows in 499.950 seconds, including eight new reconciliation workflows. |
| Final presentation follow-up | All eight reconciliation workflows rerun after collapsing source details, wrapping check labels and removing unnecessary currency decimals. This follow-up does not add eight distinct cases to the full-suite total. |
| Build and syntax | 26 canonical application modules and four worker sources match; all three inline scripts parse. |
| Visual check | No uncaught browser errors; no page overflow at 390 px for the review workflow. Source details were subsequently collapsed to reduce table height and visible buttons. |
| Financial engine / native codec / launchers / provider transports | Byte-identical to 0.7.21. Native schema remains version 1. |
| Actual PDF.js/SheetJS runtime suite | Last passed 17 workflows in 0.7.21. File-reader modules are byte-identical and this optional suite was not repeated in 0.7.22. The ordinary Chromium file-reader regressions ran with the full suite. |

## Independent expectations and old/new reproductions

- The same January 2026 roll reports current annual base rent of $12,000 with
  $13,200 beginning January 2027. Adding a June 2028 P&L made 0.7.21 compare the
  older roll at $13,200. Version 0.7.22 compares it at $12,000.
- Reported revenue $6,000 minus operating expenses $4,000 is $2,000. If stated
  NOI is zero, 0.7.21 skipped the check; 0.7.22 exposes the mismatch.
- $4/SF over six months annualizes to $8/SF/year. The previous mapping proposed
  $4/SF/year; the new independent 1,000 SF fixture yields $8,000/year. Zero
  months previously accepted an amount; the new mapping withholds that line.
- A separate original-period example reconciles $3,000 taxes + $1,500 insurance
  − $500 credit = $4,000 expenses, and applies annual inputs $6,000 + $3,000
  − $1,000 = $8,000. $600 parking income becomes $1,200/year. Parenthesized
  credits already had their correct sign in 0.7.21; preservation is regression
  coverage rather than a newly corrected bug.

Tests also cover absent/invalid/multiple dates, future and vacant rents, expired
occupancy, four rent units, missing per-SF area, zero and negative totals, explicit
and derived periods, period conflicts, malformed numeric inputs, percentage
denominators, repeated rows/totals, mixed actual/budget columns, subtotal rejection,
same-name source files, native round trips, text rendering, preview purity and
integrated pre-Apply warnings. Provider responses are controlled synthetic
fixtures. No live AI extraction accuracy, native Windows execution, Safari or
Firefox compatibility is claimed.

## Release identities

| Artifact | SHA-256 |
| --- | --- |
| Final `app/index.html` | `340e7dcd46ef19505e2938916489990c9d8666063b05fb72965a3a04378f1a8f` |
| Unchanged financial engine | `5b4878931d4e3221c47b2efb90c6063d791d2e93e6b014711a121bc43468d188` |
| Previous 0.7.21 ZIP | `bc46d3b4b3d173c9230297beb93bf3b907e43d465e1df01b1cc1b31e61ae8791` |

Packaging verifies the previous archive's unchanged bytes, repeat-build identity,
exact patch reproduction, deterministic ZIP bytes, archive CRCs, member uniqueness
and a full source inventory. The adjacent SHA-256 and package-verification files
record the final ZIP identity and checks. No source license or legal clearance
is implied by these integrity checks.
