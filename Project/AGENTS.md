# Codex instructions — Basis Studio

## Project goal
Build an original, accessible, modern commercial real-estate cash-flow/valuation application with open, documented model files. Preserve ordinary CRE math and existing working input/output behavior while improving product distinctiveness, interoperability and regression coverage.

## Project rules
- Treat `app/index.html` as the current deployable baseline. Keep the app working after every change.
- Native `.basiscre` data is ZIP + UTF-8 JSON, schema v1; see `docs/FILE_FORMAT.md`. The extension is proposed and needs clearance review.
- First run `npm test`. Add tests for all format changes, migrations, corrupt/hostile input, and scenario integrity.
- **Do not change underwriting math** without adding and running golden-case test vectors. Track any intentional numerical differences with explanations.
- Do not copy distinctive competitor UI elements, text, screenshots, manuals, code or assets. Build original task-focused Basis workflows. Use generally known accounting/financial principles and public neutral specifications.
- Do not claim “clean-room defense established,” “legally cleared,” or “financial regression certified.” Document factual provenance and review status only.
- Avoid third-party licensed code/assets until licensing and disclosure are audited. Keep key secrets out of source and test fixtures.
- Make safe migrations: never silently overwrite user models and never load archive contents without verifying manifest, CRC and schema. Retain legacy XLSX, JSON and CSV interoperability.
- Keep exports deterministic where practical, include schema migration tests, and provide clear recoverable errors for malformed files.
- Maintain a changelog and update docs and tests for every substantive change.

## Suggested first task
Review this repo, execute tests, run full browser workflows, create financial golden fixtures from independently defined input assumptions, and then incrementally split the monolithic app into modules without output changes. Open a pull request or commit describing tests and known gaps.
