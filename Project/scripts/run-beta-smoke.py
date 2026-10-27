"""Run explicit deployment smoke checks against pinned local runtime libraries."""
import argparse
import os
from pathlib import Path
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache',type=Path,required=True)
    parser.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium')
    args=parser.parse_args();os.environ['BASIS_DEPENDENCY_DIR']=str(args.cache.resolve());os.environ['BASIS_TEST_BROWSER']=args.browser
    sys.path.insert(0,str(ROOT/'tests'))
    from runtime_dependency_support import load_runtime_dependencies
    load_runtime_dependencies()
    suite=unittest.defaultTestLoader.loadTestsFromName('beta_deployment_smoke')
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() and result.testsRun>len(result.skipped) else 1
if __name__=='__main__':sys.exit(main())
