# First task to paste into Codex

Review update: 0.7.25 restores the supplied reference's ribbon button order,
groups and left portfolio/building Navigator on the corrected application.
Start with `docs/RIBBON_0_7_25.md`, `docs/VALIDATION_0_7_25.md`, `CHANGELOG.md`
and the updated release checklist.
The original task below records the handoff priorities; it is not a statement that
all of them are now complete.

You are taking over an existing Basis Studio v7 commercial real-estate modeling codebase. Read README.md, AGENTS.md, docs/FILE_FORMAT.md and docs/RELEASE_CHECKLIST.md first. Do not start over.

1. Run `npm test` and summarize findings.
2. Inspect app/index.html and the native `.basiscre` integration. Confirm property and portfolio exports are safe, readable and round-trip exactly.
3. Implement browser-level automated tests for save/open, multiple scenarios and properties, preservation of edits, corrupt archives, cancellation, and mobile navigation. Test with a local HTTP server.
4. Add independent golden financial test cases and compare pre/post modeling results before touching calculation code.
5. Plan and begin extracting the monolithic app into independently testable modules while keeping its currently working browser interface. Preserve legacy XLSX/JSON/CSV exports.
6. Record external libraries and audit their licenses and any potentially competitor-derived UI/report expressions. Avoid claiming a formal clean room or public-release clearance.
7. Update release checklist and developer docs; report exactly which tests ran and remaining risks.

Do not publish this repo or apply a public license until an authorized human approves the IP review and license choice. Prioritize data integrity, original UI design, maintainability, browser compatibility and traceable changes.
