"""Offline browser regressions for embedded workers and scenario ownership."""
import unittest
import browser_test as harness


class CalculationBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp = harness.BrowserTests.setUp
    tearDown = harness.BrowserTests.tearDown

    def test_embedded_worker_preserves_values_arrays_aliases_and_payoff(self):
        result = self.page.evaluate('''async () => {
          const snapshot=JSON.parse(JSON.stringify(S));snapshot.loanOn=true;
          const checks=[];
          for(const pvMode of ['annual','effective','nominal']){
            snapshot.pvMode=pvMode;
            const direct=calc(snapshot),remote=await basisRunCalculation('property',snapshot,'browser-parity');
            checks.push({pv:remote.pv===direct.pv,irr:remote.irrU===direct.irrU,
              monthly:remote.monthly.noi instanceof Float64Array,
              alias:remote.monthly.noi===remote.noiM,
              debt:remote.loans[0].maturity===Infinity,
              payoff:Array.from({length:remote.nM},(_,i)=>remote.payoff(i)===direct.payoff(i)).every(Boolean),
              arrays:JSON.stringify(remote.ann)===JSON.stringify(direct.ann)});
          }
          return checks;
        }''')
        self.assertTrue(all(all(case.values()) for case in result), result)

    def test_edit_recalculation_publishes_latest_snapshot_and_clears_stale_output(self):
        result = self.page.evaluate('''async () => {
          S.discount=.11;DIRTY();const cleared=R===null&&calcPending;
          const first=recalcInBackground();S.discount=.13;DIRTY();
          const expected=calc(JSON.parse(JSON.stringify(S))).pv;
          await recalcInBackground();await first;
          return {cleared,pv:R.pv,expected,busy:calcPending,issue:calcIssue};
        }''')
        self.assertTrue(result['cleared'])
        self.assertEqual(result['pv'], result['expected'])
        self.assertFalse(result['busy'])
        self.assertEqual(result['issue'], '')

    def test_pane_normalization_during_worker_calculation_restarts_current_snapshot(self):
        result = self.page.evaluate('''async () => {
          const pending=recalcInBackground();
          // The debt pane adds the optional loans array on its first render.
          delete S.loans;go('investment','debt');
          const normalized=Array.isArray(S.loans),expected=calc(JSON.parse(JSON.stringify(S))).pv;
          await pending;
          return {normalized,pv:R&&R.pv,expected,busy:calcPending,issue:calcIssue};
        }''')
        self.assertTrue(result['normalized'])
        self.assertEqual(result['pv'], result['expected'])
        self.assertFalse(result['busy'])
        self.assertEqual(result['issue'], '')

    def test_worker_refresh_preserves_uncommitted_input_and_focus(self):
        self.page.evaluate("setMode('inputs');go('property','desc')")
        name = self.page.locator('#pane .f').filter(has_text='Property name').locator('input')
        name.fill('Uncommitted typing')
        result = self.page.evaluate('''async () => {
          const active=document.activeElement,before=S.name;
          await recalcInBackground();
          return {same:document.activeElement===active&&document.contains(active),
            text:active.value,unchanged:S.name===before,refreshPending:basisPaneRefreshPending};
        }''')
        self.assertTrue(result['same'] and result['unchanged'] and result['refreshPending'])
        self.assertEqual(result['text'], 'Uncommitted typing')
        self.page.locator('#modeRp').focus()
        self.page.wait_for_function('S.name==="Uncommitted typing" && R && !calcPending && !basisPaneRefreshPending')

    def test_cancel_invalid_input_and_retry_keep_model_available(self):
        result = self.page.evaluate('''async () => {
          const before=JSON.stringify(S),pending=recalcInBackground();
          basisCancelCalculation();await pending;
          const cancelled=!calcPending&&R===null&&calcIssue.includes('cancelled')&&JSON.stringify(S)===before;
          await recalcInBackground();const retried=!!R&&!calcPending&&!calcIssue;
          const years=S.years;S.years=1000000;await recalcInBackground();
          const invalid=R===null&&!calcPending&&!!calcIssue;
          S.years=years;await recalcInBackground();
          return {cancelled,retried,invalid,recovered:!!R&&!calcPending&&!calcIssue,unchanged:JSON.stringify(S)===before};
        }''')
        self.assertTrue(all(result.values()), result)

    def test_worker_unavailable_error_is_visible_and_retry_recovers(self):
        result = self.page.evaluate('''async () => {
          const factory=window.Worker;
          for(const c of basisCalculationClients.values())c.dispose();basisCalculationClients.clear();
          window.Worker=undefined;
          await recalcInBackground();
          const message=calcIssue,visible=document.getElementById('calcSt').textContent;
          window.Worker=factory;await recalcInBackground();
          return {message,visible,recovered:!!R&&!calcIssue&&!calcPending};
        }''')
        self.assertIn('unavailable', result['message'])
        self.assertIn('unavailable', result['visible'])
        self.assertTrue(result['recovered'])

    def test_scenario_assumptions_survive_property_switch_reload_and_failed_commit(self):
        result = self.page.evaluate('''async () => {
          const first=PW.cur,second=await pwAdopt({...blankState(),name:'Different embedded settings',portDisc:.99,portCap:.9,portSingleExit:false});
          await pwSetScenarioSettings({portDisc:.123,portCap:.081,portSingleExit:true,portResaleNoi:'trailing'});
          const key=JSON.stringify(pwSc().settings),firstModel=await pwGetModel(first);
          await pwOpen(first);const firstMatches=JSON.stringify(pwSc().settings)===key&&pwRollup().portDisc===.123;
          await pwOpen(second);const secondMatches=JSON.stringify(pwSc().settings)===key&&pwRollup().portDisc===.123;
          const commit=pwCommit;pwCommit=async()=>{throw Error('injected scenario quota');};let error='';
          try{await pwSetScenarioSettings({portDisc:.5});}catch(e){error=e.message;}finally{pwCommit=commit;}
          return {firstMatches,secondMatches,unchanged:JSON.stringify(pwSc().settings)===key,
            modelUnchanged:(await pwGetModel(first)).json===firstModel.json,error};
        }''')
        self.assertTrue(result['firstMatches'] and result['secondMatches'] and result['unchanged'] and result['modelUnchanged'])
        self.assertIn('quota', result['error'])
        self.page.reload()
        self.page.evaluate('PW.ready')
        self.assertEqual(self.page.evaluate('pwRollup().portDisc'), .123)
        self.assertEqual(self.page.evaluate('pwRollup().portResaleNoi'), 'trailing')


if __name__ == '__main__':
    unittest.main(verbosity=2)
