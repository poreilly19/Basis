# Validation snapshot — 0.7.3

Verified on 2026-10-16 22:21 UTC.

| Command | Result |
| --- | --- |
| `npm run build` | Eight canonical app modules and the four-module embedded worker synchronized. |
| `npm test` | 274 cases pass, plus exact build/source and script syntax checks. |
| `npm run test:browser` | 36 Chromium workflows pass; no uncaught page errors. External HTTPS blocked. |

The browser suites cover 18 existing application workflows, seven edit/worker
workflows, eight recovery workflows and three sensitivity workflows. This includes
real two-tab conflicts and independent drafts, restoration/export without model
overwrite, explicit legacy recovery, failed commits and malformed inputs,
cancellation/retry, latest-snapshot publication, pane normalization, focused input
preservation and actual embedded-worker calculations.

Node suite counts: native 47; workspace 25; concurrency 18; financial 21;
engine extraction 22; portfolio 18; recovery math 5; draft store 17;
scenario metadata 12; scenario workspace 16; worker protocol 7; worker client 26;
legacy 13; Office 16; spreadsheet exports 3; sensitivity integration 8.

## Reproducibility

| File | SHA-256 |
| --- | --- |
| `app/index.html` | `aa6f9ec667730eab08c796cc2540e3084b9530665c28554632d70b6e096e4daa` |
| `src/financial_engine.js` | `ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936` |
| Prior reviewed 0.7.2 archive | `62b6e35763b2a41149662478ccecc4f5d4b10f59aa36292d90f7a329eb7f26fe` |

The current engine matches immutable 0.7.1/0.7.2 sample outputs exactly in all
three valuation modes. See [financial evidence](FINANCIAL_VALIDATION.md) for
inputs, comparison scope, source identities and historical original-upload results.
For the cumulative patch, the original source tree was reconstructed by reversing
the previously delivered 0.7.2 patch against its reviewed archive. Its original
`app/index.html` hash matches the recorded upload source:
`40c16952d92395ac15c8b0a40059fed35a9fc2c4a41e7d974c65b7fe3750b95c`.
This does not recreate or verify the original ZIP container bytes.

Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.0 and Chromium
154.0.8037.57 on Linux. Browser tests serve temporary loopback HTTP. Direct file
navigation was blocked by managed Chromium policy and remains unverified.
CDN-dependent XLSX/PDF/AI integrations, other browser engines, broader model
combinations and simultaneous host cross-device publication remain outside this
validated scope. Some startup, metadata, export and portfolio calculations still
run synchronously; see [worker scope](CALCULATION_WORKER.md).
