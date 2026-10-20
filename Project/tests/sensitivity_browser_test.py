"""Actual embedded-worker sensitivity workflows, with external requests blocked."""
import unittest
import browser_test as harness


class SensitivityBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp = harness.BrowserTests.setUp
    tearDown = harness.BrowserTests.tearDown

    def test_render_is_on_demand_and_all_three_worker_grids_complete(self):
        result = self.page.evaluate('''async () => {
          setMode('inputs');go('valuation','sens');
          const idle=!SENS_VALUE_RUN&&!SENS_RUN&&!SENS_GRID&&basisCalculationClients.size===0;
          const expected=calc(S),results=await Promise.all([sensValueRun(),sensRun(),sensGridRun()]);
          return {idle,value:results[0].values[2][2]===expected.pv,
            market:results[1].t.every(t=>t.rows.find(r=>r.x===0).pv===expected.pv),
            grid:results[2].complete&&results[2].pv.length===5&&results[2].irr.length===5,
            busy:!!(SENS_VALUE_RUN||SENS_RUN||SENS_GRID.busy),
            cells:document.querySelectorAll('#pane td').length};
        }''')
        self.assertTrue(result['idle'] and result['value'] and result['market'] and result['grid'])
        self.assertFalse(result['busy'])
        self.assertGreater(result['cells'], 100)

    def test_cancel_and_model_edits_prevent_late_sensitivity_publication(self):
        result = self.page.evaluate('''async () => {
          setMode('inputs');go('valuation','sens');
          const value=sensValueRun();sensValueCancel();await value;
          const cancelled=!SENS_VALUE_RUN&&!SENS_VALUE&&SENS_VALUE_ERROR.includes('cancelled');
          const jobs=[sensValueRun(),sensRun(),sensGridRun()];
          S.discount=.123;DIRTY();clearTimeout(tmr);tmr=null;await Promise.all(jobs);
          const invalidated=!SENS_VALUE&&!SENS_VALUE_RUN&&!SENS_RES&&!SENS_RUN&&!SENS_GRID;
          await recalcInBackground();await sensGridRun();
          return {cancelled,invalidated,recovered:!!SENS_GRID.complete&&!SENS_GRID.busy,
            current:SENS_GRID.key===JSON.stringify(S)};
        }''')
        self.assertTrue(all(result.values()), result)

    def test_worker_error_is_visible_and_sensitivity_can_retry(self):
        result = self.page.evaluate('''async () => {
          setMode('inputs');go('valuation','sens');
          const factory=window.Worker;window.Worker=undefined;
          await sensValueRun();const error=SENS_VALUE_ERROR,visible=document.getElementById('pane').textContent;
          window.Worker=factory;const recovered=await sensValueRun();
          return {error,visible,recovered:!!recovered&&!SENS_VALUE_RUN&&!SENS_VALUE_ERROR};
        }''')
        self.assertIn('unavailable', result['error'])
        self.assertIn('unavailable', result['visible'])
        self.assertTrue(result['recovered'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
