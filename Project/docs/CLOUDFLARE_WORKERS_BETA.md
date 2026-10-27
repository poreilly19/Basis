# Cloudflare Workers + Access beta deployment

The selected host is the existing **`basis` Cloudflare Worker**, serving the
static release at **https://basis.pjoreilly19.workers.dev/**. The deployment
configuration is prepared; this guide does not establish that deployment or
live acceptance checks have passed. Record those results separately before
inviting testers. [Cloudflare Pages](CLOUDFLARE_BETA.md) remains an alternative.

The Worker serves static assets only. It needs no JavaScript handler, Functions,
database, application server or AI provider secrets. Models remain in each
tester's browser; Access controls entry to the site and does not synchronize
models or create shared application accounts.

## Build and deployment settings

Use these settings for the connected `poreilly19/Basis` repository:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `Project` |
| Build command | `npm run build:beta && npm run verify:beta` |
| Deploy command | `npx --yes wrangler@4.154.0 deploy --config deploy/cloudflare/wrangler.worker.jsonc` |
| Wrangler configuration | `deploy/cloudflare/wrangler.worker.jsonc` |
| Static asset directory | `dist/basis-beta` relative to `Project` |
| Preview URLs | Disabled (`preview_urls: false`) |

The asset path in the configuration resolves relative to the configuration file,
so it points to `../../dist/basis-beta`. Upload only that generated release
directory. Never use the repository root, source ZIP or `Project` itself as the
asset directory. Keep deployment credentials in Cloudflare's connected build
environment or the operator's secret manager, outside the repository and app.

For a manual deployment, run the same build and deploy commands from `Project`
with Wrangler authenticated to the intended account. Complete the Access setup
below before enabling the production hostname with the application deployed.
Keep the Wrangler setting and dashboard setting consistent so a later deploy
does not unexpectedly change hostname availability.

## Protect this Worker

Use one self-hosted Cloudflare Access application with a **Worker destination**
for `basis` (`type: "worker"` and its immutable Worker ID). This protects requests
to the Worker, including production and preview deployments. Do not select
account-wide protection or modify Access applications for unrelated sites.

For the initial beta, restrict the application to the existing **Google identity
provider** and an Allow policy containing **only the account owner's exact email
address**. A successful Google login alone must not grant access. Keep an explicit
session duration, such as eight hours. Add individual invited addresses only
when the beta is ready for them; do not use Everyone or a broad email-domain rule.

Review any existing hostname or preview-specific Access applications: those
more-specific destinations can override the Worker policy. Leave previews
disabled in both the configuration and dashboard. If previews are later enabled,
verify their actual URLs through Access as well. Do not change existing identity
providers, other applications or account-wide policies to configure Basis.

See [Cloudflare's Worker Access guide](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
for the current dashboard and API setup. Configure the gate before exposing the
real bundle, then confirm anonymous requests redirect to the expected team login:

```sh
node deploy/cloudflare/check-access.cjs --url https://basis.pjoreilly19.workers.dev/ --team offshore-ai-fish.cloudflareaccess.com
```

The probe is read-only, sends no credentials and does not follow redirects. An
error or generic 403 is not a passing gate check. Anonymous redirects alone do
not establish that the allowlist works: complete a login as the owner, then
confirm a separate uninvited identity cannot reach the application.

## Preserve release behavior

Workers static assets support the generated `_headers` file directly. Keep it
with the matching HTML: it contains the CSP hashes and security/cache headers.
Cloudflare consumes `_headers` as configuration rather than serving it as a file.
Do not inject analytics, rewrite HTML/scripts or enable transformations that
change the verified bytes. Adding a handler or Functions requires a separate
review because their responses do not automatically use these asset headers.

Use `html_handling: "auto-trailing-slash"` and
`not_found_handling: "404-page"`. The app is served at `/`; `/privacy` and
`/limitations` resolve their HTML documents. Unknown paths must return the
supplied `404.html` with status 404 rather than falling back to the application.
See [static asset routing](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/)
and [response headers](https://developers.cloudflare.com/workers/static-assets/headers/).

## Cost and tester data

The `workers.dev` address requires no purchased domain. Static asset requests
are free and unlimited under the documented Workers pricing, and this bundle
fits the Free plan's asset limits. **Leave the separate Workers Cache feature
disabled**: enabling it makes normally free static asset requests count at the
standard Worker request rate. Do not upgrade the account or enable paid services
as part of this static deployment. Check the selected Access plan's user limit
before expanding invitations. See [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
and [Workers Cache pricing](https://developers.cloudflare.com/workers/cache/).

Each tester supplies their own supported AI provider account and key. Provider
API charges are separate from hosting; never place a shared AI key in the site
or its deployment configuration. Access authentication does not send a tester's
browser models to a shared Basis database.

Choose the stable URL before testers save work. Browser storage is specific to
the browser and origin; it does not follow a move from localhost or another
hostname. Download an Editable Model Backup before changing origins. Access
logout or revocation does not erase models already stored locally or downloaded,
and an already loaded application may continue to work locally.

## Live checks still required

Record the release version/hash, deployment identifier, URL, date and outcomes in
the deployment record. Prepared files and passing local tests do not complete
these checks:

- Verify anonymous requests to the root, app files and unknown paths reach the
  expected Access gate; verify owner login and rejection of an uninvited identity.
- Through an authenticated session, compare served release bytes with the local
  trusted release inventory, inspect CSP and other response headers, and confirm
  extensionless document routes and real 404 responses.
- Exercise save/reload, backup restoration, Excel export, PDF import and a
  synthetic AI extraction on the live origin. Check session expiry and recovery
  of unsaved work. Follow the [beta acceptance checklist](BETA_ACCEPTANCE.md).
- Confirm preview URLs remain disabled, preserve the previous verified bundle
  with its matching headers, and rehearse rollback to the same protected URL.

Redeploy the previous verified bundle for rollback; keep Access enabled and
preserve testers' browser data. The beta is ready for invitations only after
the remaining live-host and analyst acceptance results are recorded as passed.
