# Owner preview acceptance — 2026-10-28

Production: **https://basis.pjoreilly19.workers.dev/**.

## Confirmed

- The owner reported that Google sign-in succeeds and the Basis workspace opens
  at the production URL. This is a manual user report. Browser/OS and the exact
  displayed build were not supplied; the report is not a served-byte check.
- The MIT update is deployed from code commit
  `b411335b7c66e92c6a8b865c7cc5c9b50eb66bb7`, version 0.7.28.
  Cloudflare build `8017042e-2cef-4345-be87-e5920e45d13e` succeeded; Worker version
  `b91dfc02-8cde-4647-b84e-e137eac19f40`.
- Deployed-build application SHA-256:
  `dc08cda7db43b5c51baf42311b88ebcdfb6ed0129d44c1035f6460a635605674`.
  The 12-file bundle includes the MIT license and separate third-party notices.
- All nine hosted jobs passed for that code commit:
  [GitHub Actions run 40610276752](https://github.com/poreilly19/Basis/actions/runs/40610276752).
  This covers Node 20/24 and launcher checks on Windows/Ubuntu, beta smoke on
  Windows Chromium and Ubuntu Chromium/Firefox/WebKit, and full Chromium and
  actual-library integration tests.
- Initial anonymous Access checks and configuration are recorded in the
  [October 27 infrastructure snapshot](DEPLOYMENT_2026_10_27.md). No new testers
  or identity-policy changes were made for this confirmation.

## Remaining live acceptance

Use a synthetic test property and the [acceptance checklist](BETA_ACCEPTANCE.md).

- Save an edit, refresh, and verify it persists. Test manual save with autosave off.
- Download a property/portfolio backup, restore it into a separate test profile,
  and compare inputs and scenarios.
- Open the report workbook in the intended spreadsheet application and compare
  rent, expenses and NOI with the synthetic expected values.
- Verify a separate uninvited identity is denied; test session expiry/revocation.
- Check authenticated release bytes and headers, synthetic live-provider AI
  extraction, rollback and representative analyst-reviewed calculations.

Owner login and automated CI success complete those specific checks. Broader
tester invitations still depend on the remaining live acceptance results.
