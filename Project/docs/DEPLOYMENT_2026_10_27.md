# Basis owner preview — 2026-10-27

The owner preview is deployed at **https://basis.pjoreilly19.workers.dev/**.
This records infrastructure and automated checks; wider beta acceptance remains
open. The application is still version 0.7.27.

## Deployment evidence

- Source: `poreilly19/Basis`, branch `main`, application/configuration commit
  `63b68e6ae8607bcf97004764c2e1804602dfe27e` and complete documentation correction
  `67f3b1948f56895ad94216df0323306e63789bff`.
- Cloudflare build `a11e0e2a-dbae-45f3-813f-4e44b1aa311e` succeeded at that latter
  commit; Worker version `babf8b09-0bc3-4de5-bdb1-61d67d997da5`.
- Build output verified the 11-file release inventory. Wrangler uploaded the
  ten served assets and consumed `_headers` as configuration. The later
  documentation-only deployment reused the same assets.
- Application SHA-256:
  `69e7cdb157af0c91fb86a45fa56519408e42467924fb1c06798c37076315fc41`.
  Canonical source, GitHub source and Cloudflare build agree. Application UI,
  financial engine and model schema were not changed for this deployment.
- Production hostname enabled; preview URLs disabled. No handler, database,
  shared AI secret, custom domain or Workers Cache was added.

## Access and validation

A Worker-scoped Access application protects only `basis`, with the existing
Google identity provider, an eight-hour session, and an exact-email Allow rule
for the account owner. Existing applications and identity providers were
preserved. No additional testers have been added.

All ten paths in `deploy/cloudflare/check-access.cjs` redirected anonymous
requests to `offshore-ai-fish.cloudflareaccess.com`. The login page rendered
the Basis Beta name and Google option. The probe used its existing injectable
HTTP transport with curl through the inherited environment proxy; native Node
requests returned HTTP 403 / error 1010 in this environment. A generic 403 was
not counted as a passing Access check. No credentials were sent in these probes.

Local Wrangler 4.154.0 dry-run validation passed. Its local static-asset server
passed exact-byte and security-header checks for ten served resources, including
extensionless document URLs and the custom HTTP 404 response. `npm test`, the
release build and local manifest verification passed. The changed readiness
check passed six beta smoke cases locally in both Chromium and Firefox.

Hosted CI is recorded at
[run 40594198426](https://github.com/poreilly19/Basis/actions/runs/40594198426).
All functional checks passed: Node 20/24 suites and launcher checks on Ubuntu
and Windows, Chromium beta on both platforms, Firefox and WebKit beta on Ubuntu,
and the full Chromium workflow and actual-library integration suites. The final
job was completing post-job cleanup when this record was written.

The preceding hosted Firefox run reported `Page.reload: Page crashed`. It passed
on the latest unchanged run, and ten targeted local reload repetitions passed.
No automatic retry or weakened assertion was introduced to hide the crash.
Continue monitoring this intermittent browser/runner failure.

## Remaining acceptance

- Complete owner Google login and verify an uninvited identity is denied.
- Verify the served bytes and headers through an authenticated live session;
  local serving checks and build hashes are not a substitute for that check.
- Exercise live save/reload, backup restore, export/import and synthetic AI
  extraction; verify session expiry and rollback. Do not use confidential
  documents for initial acceptance.
- Complete analyst review of representative underwriting models and the
  [beta acceptance checklist](BETA_ACCEPTANCE.md) before expanding invitations.
- Select an open-source license before describing the public repository as
  an open-source licensed release.

Models remain local to each browser and origin. Import an Editable Model Backup
to move work from localhost to this URL. Cloudflare Access does not synchronize
models or erase downloaded/local models when access is revoked.
