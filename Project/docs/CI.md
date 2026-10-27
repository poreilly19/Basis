# Automated checks and portable Python commands

The [GitHub Actions workflow](../.github/workflows/ci.yml) is configured for
Node 20/24 on Ubuntu and Windows. Those jobs verify the committed standalone
build, repeat the build to check byte stability, and run the Node and Python
runner unit tests. A separate Ubuntu job installs Playwright 1.62.0 and Chromium,
then runs the ordinary browser suite and verified real-runtime tests.

Action references are pinned to exact commits observed from the upstream major
tags on 2026-10-19. Checkout does not persist credentials, repository permissions
are read-only, jobs have deadlines, and newer runs cancel older runs on the same
workflow/ref. Runtime library fixtures live in a separate cache keyed by the
manifest hash. Restored bytes are verified before any test uses them.

The first hosted run rejected the workflow before jobs started because
`runner.temp` was referenced in job-level environment settings. The CI-only
correction resolves that path inside steps and passes the cache explicitly with
`--cache`; runtime downloads remain outside the checkout in the runner temporary
directory. Local YAML and CLI validation pass. Hosted runner images, Windows
execution and Node 20 remain unverified until the corrected hosted checks finish.
The preceding local checks used Node 24 and Python 3.12 on Linux.

The corrected workflow then passed Node regression suites on Windows, but its
launcher checks exposed Windows socket reuse accepting a second listener on an
occupied port. The launcher now requests exclusive Windows socket ownership and
keeps the existing identity check for a repeated launch. A portable competing-
listener regression supplements the same-release and different-release tests;
native Windows validation of this correction is still pending a hosted rerun.

## Local commands

Install Node 20+ and Python 3.10+. The browser suites also need the development-only
Playwright/Chromium setup in README. Then run:

```sh
npm run check
npm test
npm run test:runner
npm run test:browser
node scripts/run-python.cjs scripts/fetch-test-dependencies.py ../basis-runtime-cache
npm run test:dependencies -- --cache ../basis-runtime-cache
```

The ordinary suites do not download runtime libraries. The explicit fetch command
uses public HTTPS and checks the recorded artifact sizes/hashes; the runtime test
command uses only that local cache. See [runtime evidence](RUNTIME_DEPENDENCY_TESTS.md).

`scripts/run-python.cjs` selects Python 3.10+ without invoking a shell: `python3`
then `python` on POSIX, or `python`, `py -3`, then `python3` on Windows. Each
version probe has a five-second deadline. `BASIS_PYTHON` can name one explicit
executable path, including a path containing spaces. The launcher preserves
arguments and propagates the selected interpreter's exit status; it never retries
a failed test through another installation. A small actual launcher smoke check
is included in `npm test`, so Python is required for that suite too.

Runtime test discovery now happens inside Python with a literal filename pattern.
Missing/altered caches, zero discovered tests, all-skipped runs and test failures
return nonzero. The `--cache` argument works without shell-specific environment
assignment. `BASIS_DEPENDENCY_DIR` remains supported for existing scripts.


Version 0.7.18 adds `npm run test:launcher` to both Windows and Linux matrix jobs.
The native CMD integration test is skipped on Linux and runs on Windows. The
local review exercised Linux only; adding this job does not mean GitHub CI or
Windows has been executed. The launcher tests use temporary folders with spaces,
loopback HTTP, occupied-port handling and missing-file/version diagnostics.

Version 0.7.26 adds a separate beta matrix: Chromium, Firefox and WebKit on Ubuntu,
plus Chromium on Windows. Each job builds `dist/basis-beta`, serves its exact
security headers and tests startup, blocked unauthorized scripts, manual saving,
native backup, calculation workers, real report XLSX generation, real PDF
rendering/cleanup and a simulated AI connection. Install the selected Playwright
browser, then run `npm run build:beta` and
`npm run test:beta -- --cache ../basis-runtime-cache --browser firefox` (or
`chromium` / `webkit`). These configured jobs still need a completed GitHub run.
Local results and platform distinctions are recorded in
[the 0.7.26 validation snapshot](VALIDATION_0_7_26.md).

Version 0.7.27 also runs `npm run verify:beta` after building each deployment
candidate, plus Node fixtures for exact hosted byte/header verification and
anonymous Cloudflare Access probes. These local fixtures do not configure or
verify a real Cloudflare account.
