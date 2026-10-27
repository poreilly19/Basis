# Basis Studio

Basis Studio is a browser application for commercial real-estate cash flow,
valuation, portfolio scenarios, rent rolls and reviewed document extraction.
The current version is **0.7.28, a beta candidate**.

The complete application and its development files are in [`Project/`](Project/).
This update replaces the earlier v7.9 encoded upload with directly usable files.
No Base64 restoration step is required. Earlier uploads remain in Git history.

## Run the application

Download this repository using **Code → Download ZIP** and extract it, or clone it:

```sh
git clone https://github.com/poreilly19/Basis.git
cd Basis/Project
```

- **Windows:** open the extracted `Project` folder and double-click
  **Start Basis.cmd**. Install Python 3.10 or newer if prompted.
- **macOS/Linux:** run `python3 scripts/start-basis.py` inside `Project`.

Open **http://127.0.0.1:8765/** and keep the server window open.
Node is only required for development and deployment builds.

Models are stored in your browser. Download an Editable Model Backup before
changing browser or website address; storage does not follow the application.
AI extraction uses the user's own supported provider account and API key, with
field review before applying extracted values. Provider API charges are separate
from hosting. No API keys or cloud credentials are included in this repository.

## Develop and verify

Use Node.js 20 or newer and Python 3.10 or newer. From `Project`:

```sh
npm test
npm run build:beta
npm run verify:beta
```

No npm packages are needed for these commands. Browser tests require the separate
Playwright setup described in [the project guide](Project/README.md).
The repository-root [GitHub Actions workflow](.github/workflows/ci.yml) runs the
project's Node, launcher, browser and deployment checks on pushes and pull requests.
Its commands run in `Project`; the nested workflow is retained as part of the
portable project package.

## Hosting

The selected deployment uses **Cloudflare Workers static assets + Access** at
**https://basis.pjoreilly19.workers.dev/**, with no purchased domain or application
server. Follow the [Workers beta deployment guide](Project/docs/CLOUDFLARE_WORKERS_BETA.md)
for the prepared build configuration, owner-only Google access and required live
checks. Preview URLs remain disabled. Deployment configuration being prepared
does not establish that the site is live or ready for invitations.

Build from `Project` using `npm run build:beta && npm run verify:beta`; only
`Project/dist/basis-beta` is published. Static asset requests are free; leave the
separate Workers Cache feature disabled. The
[Cloudflare Pages + Access guide](Project/docs/CLOUDFLARE_BETA.md) remains an
alternative. Uploading source to GitHub does not itself deploy the site or
configure Access.

## Status and license

This repository contains a beta candidate, not a completed production release.
See [v0.7.28 validation](Project/docs/VALIDATION_0_7_28.md), the
[acceptance checklist](Project/docs/BETA_ACCEPTANCE.md), and the
[release checklist](Project/docs/RELEASE_CHECKLIST.md) for tested behavior and
remaining live-host, AI-provider, Windows and analyst acceptance work.

**An open-source license has not been selected.** Public source availability alone
does not grant an open-source license. Third-party components retain their own
licenses; see [the notices](Project/docs/THIRD_PARTY_NOTICES.md).
Provenance and release reviews remain documented in the project.

For application details, see [Project/README.md](Project/README.md) and the
[changelog](Project/CHANGELOG.md).
