"""Stdlib-only regressions for the optional runtime test command."""
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest
from unittest import mock
import uuid


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/run-runtime-tests.py'
SPEC = importlib.util.spec_from_file_location('basis_runtime_runner', SCRIPT)
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


class RuntimeRunnerTests(unittest.TestCase):
    def fixture(self, directory, body):
        name = 'runtime_probe_' + uuid.uuid4().hex + '_smoke.py'
        (Path(directory) / name).write_text(textwrap.dedent(body), encoding='utf-8')
        self.addCleanup(sys.modules.pop, name[:-3], None)
        return name

    def run_fixture(self, body):
        output = io.StringIO()
        with tempfile.TemporaryDirectory(prefix='basis runtime runner ') as directory:
            self.fixture(directory, body)
            code = runner.run_runtime_tests(start_dir=directory, stream=output,
                                           validate_cache=lambda: {'https://fixture.invalid/runtime': b'verified'})
        return code, output.getvalue()

    def test_missing_cache_environment_fails_before_discovering_tests(self):
        loader, output = mock.Mock(), io.StringIO()
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('BASIS_DEPENDENCY_DIR', None)
            code = runner.run_runtime_tests(loader=loader, stream=output)
        self.assertEqual(code, 2)
        self.assertIn('Set BASIS_DEPENDENCY_DIR', output.getvalue())
        loader.discover.assert_not_called()

    def test_nonexistent_cache_fails_before_discovering_tests(self):
        loader, output = mock.Mock(), io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            with mock.patch.dict(os.environ, {'BASIS_DEPENDENCY_DIR': str(Path(directory) / 'missing')}):
                code = runner.run_runtime_tests(loader=loader, stream=output)
        self.assertEqual(code, 2)
        self.assertIn('is not a directory', output.getvalue())
        loader.discover.assert_not_called()

    def test_missing_artifact_fails_real_preflight_before_discovery(self):
        loader, output = mock.Mock(), io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            with mock.patch.dict(os.environ, {'BASIS_DEPENDENCY_DIR': directory}):
                code = runner.run_runtime_tests(loader=loader, stream=output)
        self.assertEqual(code, 2)
        self.assertIn('Missing runtime dependency artifact', output.getvalue())
        loader.discover.assert_not_called()

    def test_wrong_cached_bytes_fail_sha256_validation_before_discovery(self):
        manifest = json.loads((ROOT / 'tests/fixtures/runtime_dependencies.json').read_text(encoding='utf-8'))
        artifact = manifest['artifacts'][0]
        loader, output = mock.Mock(), io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / artifact['file']).write_bytes(b'\0' * artifact['size'])
            with mock.patch.dict(os.environ, {'BASIS_DEPENDENCY_DIR': directory}):
                code = runner.run_runtime_tests(loader=loader, stream=output)
        self.assertEqual(code, 2)
        self.assertIn('SHA-256 mismatch', output.getvalue())
        loader.discover.assert_not_called()

    def test_preflight_cannot_return_an_empty_verified_cache(self):
        loader, output = mock.Mock(), io.StringIO()
        code = runner.run_runtime_tests(validate_cache=lambda: {}, loader=loader, stream=output)
        self.assertEqual(code, 2)
        self.assertIn('no verified artifacts', output.getvalue())
        loader.discover.assert_not_called()

    def test_fixed_discovery_pattern_executes_tests_from_a_path_with_spaces(self):
        code, output = self.run_fixture('''
            import unittest
            class RuntimeProbe(unittest.TestCase):
                def test_first(self): self.assertEqual(2+2,4)
                def test_second(self): self.assertTrue(True)
        ''')
        self.assertEqual(code, 0, output)
        self.assertIn('Discovered 2 runtime test(s)', output)
        self.assertIn('Ran 2 tests', output)
        self.assertEqual(runner.PATTERN, 'runtime_*_smoke.py')

    def test_zero_discovered_tests_are_an_explicit_failure(self):
        output = io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'unrelated.py').write_text('raise AssertionError("Must not be imported")', encoding='utf-8')
            code = runner.run_runtime_tests(start_dir=directory, stream=output,
                                           validate_cache=lambda: {'https://fixture.invalid/runtime': b'verified'})
        self.assertEqual(code, 2)
        self.assertIn('No runtime tests matched runtime_*_smoke.py', output.getvalue())

    def test_discovery_exception_reports_failure_instead_of_running_an_empty_suite(self):
        loader, output = mock.Mock(), io.StringIO()
        loader.discover.side_effect = ImportError('Discovery failed deliberately')
        code = runner.run_runtime_tests(validate_cache=lambda: {'fixture': b'ok'}, loader=loader, stream=output)
        self.assertEqual(code, 2)
        self.assertIn('Discovery failed deliberately', output.getvalue())

    def test_an_assertion_failure_has_a_nonzero_exit_status(self):
        code, output = self.run_fixture('''
            import unittest
            class RuntimeProbe(unittest.TestCase):
                def test_failure(self): self.fail('Deliberate runtime failure')
        ''')
        self.assertEqual(code, 1)
        self.assertIn('Deliberate runtime failure', output)

    def test_class_setup_failure_cannot_pass_with_zero_executed_tests(self):
        code, output = self.run_fixture('''
            import unittest
            class RuntimeProbe(unittest.TestCase):
                @classmethod
                def setUpClass(cls): raise RuntimeError('Browser startup failed')
                def test_never_runs(self): pass
        ''')
        self.assertEqual(code, 1)
        self.assertIn('Browser startup failed', output)

    def test_all_skipped_runtime_tests_are_an_explicit_failure(self):
        code, output = self.run_fixture('''
            import unittest
            @unittest.skip('Runtime must not silently skip')
            class RuntimeProbe(unittest.TestCase):
                def test_skipped(self): pass
        ''')
        self.assertEqual(code, 2)
        self.assertIn('no test executed without being skipped', output)

    def test_cache_argument_overrides_environment_before_preflight(self):
        with tempfile.TemporaryDirectory(prefix='basis cache with spaces ') as directory:
            with mock.patch.dict(os.environ, {'BASIS_DEPENDENCY_DIR': 'wrong-original-directory'}):
                with mock.patch.object(runner, 'run_runtime_tests') as execute:
                    execute.side_effect = lambda: 0 if os.environ['BASIS_DEPENDENCY_DIR'] == str(Path(directory).resolve()) else 99
                    code = runner.main(['--cache', directory])
                self.assertEqual(code, 0)
                execute.assert_called_once_with()

    def test_cli_uses_its_repository_path_when_launched_from_another_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([sys.executable, str(SCRIPT), '--cache', str(Path(directory) / 'missing')],
                                    cwd=directory, capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn('Runtime preflight failed', result.stderr)
        self.assertIn('is not a directory', result.stderr)
        self.assertNotIn('ModuleNotFoundError', result.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
