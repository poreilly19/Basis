# Basis Studio

Basis Studio is a web application with a Windows desktop edition for commercial
real-estate cash flow, valuation, portfolio scenarios, rent rolls and reviewed
document extraction. The current version is **0.7.30, a beta candidate**.

The complete application and its development files are in [`Project/`](Project/).
This update replaces the earlier v7.9 encoded upload with directly usable files.
No Base64 restoration step is required. Earlier uploads remain in Git history.

## Run the application

The **web application remains available** at
**https://basis.pjoreilly19.workers.dev/** under its existing invited-user access
policy. The Windows desktop edition uses the same interface and calculation
engine, with native local saving and packaged PDF/Excel readers. See
[desktop installation, model transfer and build instructions](Project/docs/DESKTOP.md).
Desktop installers do not require starting Python or a local server.

[Download the Windows desktop beta](https://github.com/poreilly19/Basis/releases/tag/v0.7.30-desktop-beta.1)
and read its [validation record](Project/docs/DESKTOP_RELEASE_0_7_30.md).

Web and desktop libraries are separate. Move editable properties and portfolios
with `.basiscre` backups; installing desktop does not migrate browser data or add
cloud synchronization. Initial Windows installers may be unsigned. Consult the
release's validation notes before using the desktop beta.

To run the web application locally from source:

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

In the web edition, models are stored in your browser. Download an Editable Model Backup before
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

Desktop tooling is isolated under `Project/desktop` and additionally requires
Rust and Windows build tools. The separate
[desktop workflow](.github/workflows/desktop.yml) builds the Windows installer;
it does not replace the existing web checks or deployment workflow.

## Hosting

The selected deployment uses **Cloudflare Workers static assets + Access** at
**https://basis.pjoreilly19.workers.dev/**, with no purchased domain or application
server. Follow the [Workers beta deployment guide](Project/docs/CLOUDFLARE_WORKERS_BETA.md)
for the build configuration, owner-only Google access and required live checks.
Preview URLs remain disabled. Owner login has been confirmed; the remaining
[beta acceptance checks](Project/docs/BETA_ACCEPTANCE.md) still apply before
broader invitations. Desktop builds do not change this hosted access policy.

Build from `Project` using `npm run build:beta && npm run verify:beta`; only
`Project/dist/basis-beta` is published. Static asset requests are free; leave the
separate Workers Cache feature disabled. The
[Cloudflare Pages + Access guide](Project/docs/CLOUDFLARE_BETA.md) remains an
alternative. Uploading source to GitHub does not itself deploy the site or
configure Access.

## Status and license

This repository contains a beta candidate, not a completed production release.
See [v0.7.29 review and validation](Project/docs/CODE_REVIEW_0_7_29.md), the
[acceptance checklist](Project/docs/BETA_ACCEPTANCE.md), and the
[release checklist](Project/docs/RELEASE_CHECKLIST.md) for tested behavior and
remaining live-host, AI-provider, Windows and analyst acceptance work. See the
[desktop guide](Project/docs/DESKTOP.md) for additional installer and offline
acceptance requirements.

Basis Studio's original code is licensed under the **[MIT License](LICENSE)**.
Third-party components retain their own licenses; see
[the notices](Project/docs/THIRD_PARTY_NOTICES.md). Provenance and release reviews
remain documented in the project; choosing MIT does not mark those reviews complete.

For application details, see [Project/README.md](Project/README.md) and the
[changelog](Project/CHANGELOG.md).
