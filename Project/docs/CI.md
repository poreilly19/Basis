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

The workflow has been syntax-checked locally. It has not been pushed or run on
GitHub. Hosted runner images, Windows execution and Node 20 remain unverified in
this session; the local checks used Node 24 and Python 3.12 on Linux.

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
