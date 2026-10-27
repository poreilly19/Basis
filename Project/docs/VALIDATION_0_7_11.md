# Validation snapshot — 0.7.11

Verified on 2026-10-21. This update removes the changing portfolio/scenario/property
subtitle beneath the Basis Property Intelligence logo, including both rendering
updates and its desktop/mobile styles.

- `npm test`: 633 cases across 34 suites pass, including source/syntax checks.
- Existing navigation browser suite: four workflows pass in 9.873 seconds.
  The portfolio-boundary check now expects the removed subtitle to be absent.
- Desktop and mobile Workspace/Settings previews refreshed; Settings has no page
  overflow at 390 pixels.
- The full 85-workflow browser suite and 13 runner checks last passed in 0.7.10;
  this small presentation update reruns the affected navigation suite.

Current `app/index.html` SHA-256:
`6b40be90121b1a697154887f1cade9024174cf6b06739199821cd2d0454b8886`.

Canonical modules and financial calculations are unchanged. Packaging verifies
the unchanged repeated build, ZIP CRC/content, deterministic ZIP bytes and exact
reconstruction from the incremental 0.7.10 patch. The prior 0.7.10 archive remains
unchanged. See [the previous snapshot](VALIDATION_0_7_10.md) for the broader
validation scope and remaining live API/device limitations.
