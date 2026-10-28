# Version 0.7.28 — neutral workbook terminology

This release removes the retired product name from the current application,
source, tests, documentation and generated deployment. Menus now use
**Workbook Import / Export** and **Report Workbook**. Existing workbook
interchange, report exports and the ribbon arrangement remain available.

## Behavior and compatibility

- Rename the workbook route and its internal helpers consistently, including
  stale-read cancellation and disabled actions outside the active portfolio.
- Use `valuation_report` for the supported AI document category. Its existing
  ranking is preserved. Unknown categories remain `other` with lower priority;
  original extracted metadata is not rewritten.
- Use neutral descriptions in source logs, tooltips, import warnings and report
  exports. Imported reports are comparison evidence, not proof of completeness.
- Preserve the historical provenance disclosures in neutral wording. The old
  feature comparison identifies its text and route identifiers as edited;
  recorded source hashes and numeric findings are unchanged.
- Financial-engine edits are comments only. After parsing and normalizing
  comments/whitespace with esbuild, old and new executable output is identical:
  100,975 bytes, SHA-256
  `e35ab0f5d6ede8ef3b46624e0cfa8db1c658bd2e7e57a3377710e1c241fa4054`.
  No model-format or financial-formula change is included.

## Completed local verification

- Full `npm test` regression suite passed, including independent financial
  cases, embedded-engine parity, Office readers and import/export lifecycles.
- New coverage checks report-category precedence and unknown-category fallback,
  as well as the renamed import/export menu destinations and portfolio scope.
- Build and release-manifest verification passed for the 11-file deployment.
- Chromium, Firefox and WebKit served-release smoke suites passed, six cases
  each. WebKit used the installed workspace libraries; the system-library
  inventory did not detect them, so it was bypassed after a direct library-load
  check. All browser assertions ran normally.
- Full Chromium browser workflow suite passed: 207 cases.
- Actual pinned PDF/spreadsheet library integrations passed: 17 cases.
- A case-insensitive scan of current tracked file contents and the generated
  deployment found zero occurrences. Sample model ZIP members were also scanned.

Application SHA-256:
`b387fab8a99452b821297f55121585cfc470bdf0dc6a41f8c9c734d313e52a57`.

Hosted Windows and cross-browser results are recorded separately in GitHub
Actions for the published commit.

## October 28 MIT license update

The owner selected MIT for the original Basis code. Matching root and portable
project license files, package metadata, the complete notice embedded in the
standalone HTML, and deployment `LICENSE.txt` are included. Third-party license
texts are unchanged. All inline script blocks are byte-identical to the October
27 application; the new comment changes the file hash without changing runtime
code. The deployment now contains 12 files.

License-update application SHA-256:
`dc08cda7db43b5c51baf42311b88ebcdfb6ed0129d44c1035f6460a635605674`.

The full `npm test` suite, build/manifest verification and all six Chromium
served-release smoke cases passed after this update. The build regression also
verifies that the shipped MIT text matches the project license exactly.

## Scope

The cleanup applies to the current source tree and newly generated distribution
files. Original uploads, historical release archives and existing Git commits
are retained as historical evidence; no history rewrite is performed. User
documents, imported templates and saved models are not scrubbed or altered.

The naming cleanup did not establish legal clearance. The owner subsequently
selected the [MIT License](../LICENSE) on October 28, 2026. Owner login,
authenticated live-release checks and the remaining
[beta acceptance](BETA_ACCEPTANCE.md) still apply.
