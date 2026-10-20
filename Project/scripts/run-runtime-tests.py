"""Run the explicitly requested runtime smoke suites with a verified local cache.

Usage: python scripts/run-runtime-tests.py [--cache CACHE_DIRECTORY]
Without --cache, BASIS_DEPENDENCY_DIR must already identify the audited cache.
Discovery is performed in Python so shell quoting cannot turn a run into zero
tests on Windows. Missing/altered artifacts, empty discovery and all-skipped
runs fail explicitly; this runner never downloads dependencies.
"""
import argparse
import os
from pathlib import Path
import sys
import unittest


ROOT = Path(__file__).resolve().parents[1]
TESTS = ROOT / 'tests'
PATTERN = 'runtime_*_smoke.py'


def validate_runtime_cache():
    from runtime_dependency_support import load_runtime_dependencies
    return load_runtime_dependencies()


def run_runtime_tests(*, start_dir=TESTS, validate_cache=None, loader=None,
                      test_runner=None, stream=None):
    """Return 0 on executed success, 1 on test failure, or 2 on invalid setup.

    Injectable collaborators let the stdlib unit tests exercise failure paths
    without downloading artifacts, importing Playwright or starting Chromium.
    """
    stream = sys.stderr if stream is None else stream
    tests_path = str(TESTS)
    if tests_path not in sys.path:
        sys.path.insert(0, tests_path)
    try:
        verified = (validate_cache or validate_runtime_cache)()
        if not isinstance(verified, dict) or not verified:
            raise RuntimeError('The runtime preflight returned no verified artifacts')
    except Exception as error:
        print(f'Runtime preflight failed: {error}', file=stream)
        return 2
    print(f'Verified {len(verified)} pinned runtime artifact(s).', file=stream)
    try:
        suite = (loader or unittest.TestLoader()).discover(
            start_dir=str(Path(start_dir).resolve()), pattern=PATTERN)
        count = suite.countTestCases()
        if count < 1:
            raise RuntimeError(f'No runtime tests matched {PATTERN} in {Path(start_dir).resolve()}')
    except Exception as error:
        print(f'Runtime discovery failed: {error}', file=stream)
        return 2
    print(f'Discovered {count} runtime test(s).', file=stream)
    result = (test_runner or unittest.TextTestRunner(verbosity=2, stream=stream)).run(suite)
    if not result.wasSuccessful():
        return 1
    if result.testsRun < 1 or result.testsRun == len(result.skipped):
        print('Runtime run failed: no test executed without being skipped.', file=stream)
        return 2
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path,
                        help='Audited artifact directory; overrides BASIS_DEPENDENCY_DIR')
    options = parser.parse_args(argv)
    if options.cache is not None:
        os.environ['BASIS_DEPENDENCY_DIR'] = str(options.cache.resolve())
    return run_runtime_tests()


if __name__ == '__main__':
    raise SystemExit(main())
