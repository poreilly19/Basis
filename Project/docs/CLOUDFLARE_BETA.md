# Cloudflare Pages + Access beta handoff

Prepared October 27, 2026 for the user's selected hosting approach. This package
does not create a Cloudflare project, upload the application, configure Access,
or send invitations. The current environment has no Cloudflare account binding
or deployment credentials. Those live steps remain to be performed in the
owner's account after reviewing this configuration.

Use a **Direct Upload Pages project with Cloudflare Access in front of every
hostname**. The app remains static and stores models in the tester's browser;
Access supplies entry control, not shared model storage or application accounts.
Choose one stable origin before testers start saving work. Browser storage does
not follow a later domain, protocol or port change.

## Files supplied

| File or folder | Purpose |
| --- | --- |
| `dist/basis-beta/` | Generated application bundle; upload only this folder after access checks |
| `deploy/cloudflare/bootstrap/` | Harmless setup placeholder; use for the first public upload |
| `deploy/cloudflare/wrangler.example.json` | Optional Pages configuration template; replace the project name before use |
| `deploy/cloudflare/check-access.cjs` | Read-only anonymous Access gate probe; never logs in or sends credentials |
| `scripts/verify-beta.cjs` | Check trusted local release inventory and optionally authenticated hosted bytes/headers |

The Wrangler template resolves `../../dist/basis-beta` relative to its own
directory. It declares no Worker, Function, database, binding or secret. Keep it
outside the deployed asset directory. For an existing project, compare the
dashboard's downloaded Wrangler configuration before adopting the template;
the configuration file can supersede relevant dashboard settings.
[Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)

## Account and release inputs

Record these in the private deployment record:

- Cloudflare account ID and the exact assigned Pages project name/hostname.
- Production branch name (use `main` for this handoff), Zero Trust team hostname,
  and the optional stable custom hostname.
- Named deployment/support owner, private feedback contact, tester email list,
  and excluded test identity for access validation.
- Release version, `release.json`, local ZIP/app SHA-256, and previous verified
  release for rollback.
- Chosen account plan, user capacity and any charges, accepted by the owner.

The dashboard path needs no API token in the project. For optional Wrangler/CI,
use a token scoped to the chosen account with **Cloudflare Pages: Edit** (API
permission name **Pages Write**). Store it as `CLOUDFLARE_API_TOKEN` in a secret
manager and account ID as `CLOUDFLARE_ACCOUNT_ID`; do not put either credentials or
their values in command examples, app files or chat. Access setup is separate:
programmatic policy changes require **Access: Apps and Policies Write**, and
creating the OTP identity provider requires **Access: Organizations, Identity
Providers, and Groups Write**. Routine upload automation does not need those
broader setup rights. Custom-domain DNS is managed by its zone administrator.
[Pages API permissions](https://developers.cloudflare.com/pages/configuration/api/)
and [OTP setup](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)

## Establish the site while it contains no application

Create a new Direct Upload project and upload **only**
`deploy/cloudflare/bootstrap/`. Record the assigned hostname; name collisions
can change it. A dashboard upload can use a folder or ZIP; Wrangler uploads a
folder. Direct Upload cannot later be converted to native Git integration without
a new project, though CI can continue uploading prebuilt releases.
[Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

If using a custom domain, add and verify it now, while only the harmless placeholder
exists. Cloudflare documents limitations attaching a custom hostname that already
has Access protection. Complete domain/certificate setup, then configure its Access
application before any real Basis upload.
[Custom-domain limitations](https://developers.cloudflare.com/pages/platform/known-issues/#custom-domains)

Use the dashboard first, or a separately installed, reviewed and version-pinned
Wrangler CLI. The optional commands below assume that CLI is already available
and authenticated in the owner's environment; no CLI dependency is shipped in
the application. Replace `CONFIRMED_PROJECT_NAME` with the assigned project name.

```sh
wrangler pages project create CONFIRMED_PROJECT_NAME --production-branch main
wrangler pages deploy deploy/cloudflare/bootstrap --project-name CONFIRMED_PROJECT_NAME --branch main
```

## Protect production, previews and custom domains

The Pages **Enable access policy** switch protects previews only. It does not by
itself protect the production hostname or custom domain. Hash-based preview URLs
can remain accessible after a branch moves, so protect the wildcard as well as
the current branch alias.
[Preview access and aliases](https://developers.cloudflare.com/pages/configuration/preview-deployments/)

Following Cloudflare's documented setup, enable the Pages policy, manage the
created Access application and remove its wildcard to protect the exact production
hostname. Enable the Pages access policy again to create separate wildcard preview
protection. Add a separate self-hosted Access application for the verified custom
domain. Confirm the final applications cover every path, with no path-limited
scope or unprotected alternative hostname.
[Production and custom-domain Access setup](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain)

| Access application | Public hostname scope | Required checks |
| --- | --- | --- |
| Basis beta production | `CONFIRMED_PROJECT_NAME.pages.dev` | Root, app files and unknown paths |
| Basis beta previews | `*.CONFIRMED_PROJECT_NAME.pages.dev` | A real hash URL and branch alias, including older retained deployments |
| Basis beta custom domain, if used | Exact approved hostname | Same checks; production Pages hostname still protected |

In Zero Trust identity providers, explicitly add **One-time PIN** if absent.
Configure the application login method accordingly. Add an **Allow** policy with
**Include → Emails** containing only the invited addresses and owner. Where a
login-method requirement is used, make OTP a **Require** condition. Do not use
`Everyone`, an unrestricted email-domain rule, or OTP alone as an Include rule.
Review other policies for Bypass or broader Allow rules. Set an explicit session
duration, for example eight hours, and record it in the invitation.
[Email-based Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/)

OTP availability and a displayed “code sent” message do not prove that an
excluded address has access; Cloudflare intentionally does not disclose that
distinction on the login screen. Test complete login with an invited identity,
and verify an excluded identity cannot reach the placeholder.
[OTP behavior](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)

## Test the gate before uploading Basis

Create a placeholder preview deployment to obtain a real hash URL and branch
alias, without exposing the application:

```sh
wrangler pages deploy deploy/cloudflare/bootstrap --project-name CONFIRMED_PROJECT_NAME --branch gate-check
```

Run the following read-only probe for the exact production URL, custom domain if
used, preview hash URL, and `gate-check` alias. Replace the team hostname with the
one shown by the account's Zero Trust settings.

```sh
node deploy/cloudflare/check-access.cjs --url https://CONFIRMED_PROJECT_NAME.pages.dev/ --team TEAM_NAME.cloudflareaccess.com
```

The probe sends anonymous GET requests to ten relevant paths with no cookies or
tokens and refuses to follow redirects. It passes only redirects to the expected
team's HTTPS Access login endpoint. Public responses, arbitrary redirects,
403/404 errors, outages and timeouts fail or remain inconclusive. This deliberately
does not infer that every error means protection is working. Its `--allow-http`
option is reserved for loopback test fixtures and cannot allow public HTTP.

Repeat manually in a fresh browser profile: a signed-out visitor must see the
Access gate; an invited identity must reach the placeholder; an excluded identity
must not. Check the Access dashboard for the corresponding application and policy.
Record URL, identity category (not a token), date and outcome. Passing anonymous
redirects alone does not establish that the allowlist is restrictive.

## Build and upload the verified application

From the project root, run the current release checks and build:

```sh
npm test
npm run build:beta
node scripts/verify-beta.cjs --directory dist/basis-beta
```

The provided `_headers` must remain in the upload directory. Pages parses it as
configuration rather than serving it. This bundle is entirely static: adding
Pages Functions or a `_worker.js` changes header handling and requires a separate
review. Keep the generated CSP and HTML together; disable HTML/script rewriting,
automatic script injection, analytics and transformations that change the
verified bytes. Retest after any hosting-setting change.
[Pages response headers](https://developers.cloudflare.com/pages/configuration/headers/)

Only after all placeholder gate checks pass, upload `dist/basis-beta/` with the
dashboard or:

```sh
wrangler pages deploy dist/basis-beta --project-name CONFIRMED_PROJECT_NAME --branch main
```

Do not upload the source project, complete source ZIP, `deploy/`, tests, samples,
runtime cache, credentials or workspace files. Do not configure AI provider keys
as Cloudflare environment variables: each tester enters their own key in the app.

Run the anonymous probe again for every hostname after deployment. In an invited
browser, check release version, exact response security headers, save/reload,
backup restoration, Excel export, PDF import and a synthetic AI extraction.
Use the [beta acceptance checklist](BETA_ACCEPTANCE.md) and [current validation](VALIDATION_0_7_27.md); local tests do not replace this live-origin check.

For automated authenticated byte verification, optionally create a short-lived
Access service token and a narrowly scoped **Service Auth** policy on the relevant
applications. Supply `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` through
the operator's secret manager, then run:

```sh
node scripts/verify-beta.cjs --directory dist/basis-beta --url https://CONFIRMED_PROJECT_NAME.pages.dev/ --cloudflare-pages --cloudflare-access
```

These are Access credentials, distinct from the Pages deployment API token and
from AI keys. Never expose them to the browser app. The verifier compares against
the local trusted manifest, handles Pages' extensionless HTML routes, and does
not download `_headers`. Redirects fail rather than forwarding credentials.
Keep or revoke the service token according to the verification plan; its success
does not replace human invited/excluded identity tests.

## Invitations, support and rollback

Choose the stable origin used for tester data. Include the exact release version,
backup instructions, tested platforms, `/privacy` and `/limitations`, session
duration and private support contact. Disclose Cloudflare's hosting/Access handling
of connection and login information and the operator's chosen logging/retention.
Use synthetic documents first. Access logout or revocation does not erase models
already stored in a tester's browser or downloaded files; a loaded app may continue
to work locally. That is separate from denying future site requests.

Rehearse session expiry and tester revocation while the model has unsaved work:
the local model/backup must remain recoverable, and a subsequent page load must
require authorization. Preserve the last verified release and matching headers.
Rollback by redeploying that bundle to the same protected origin, never by
temporarily disabling Access or clearing testers' browser data. Keep all retained
preview URLs protected. The beta is ready for invitations only after the live
access/content checks and remaining acceptance items are recorded as passed.
