"""Source-period reconciliation and Apply; controlled extraction, no live AI."""
import copy
import json
import unittest
from pathlib import Path
from playwright.sync_api import expect
import browser_test as harness

FIXTURE=json.loads((Path(__file__).parent/'fixtures/intake/reporting_periods.json').read_text())

class IntakeReconciliationBrowserTests(unittest.TestCase):
    setUpClass=classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp=harness.BrowserTests.setUp
    tearDown=harness.BrowserTests.tearDown

    def seed(self,documents=None):
        documents=copy.deepcopy(documents if documents is not None else FIXTURE['documents'])
        self.page.evaluate('''documents=>{
          S=blankState();Object.assign(S,{startYear:2026,startMonth:1,years:2,gvRate:0,clRate:0});
          S.areas[0].sf=1000;S.tenants=[];S.ops=[];S.misc=[];S.infl.forEach(x=>x.rates=[0,0,0]);
          const answers=documents.map(d=>d.results[0]);let call=0;
          INT.docs=documents.map(d=>({...d,kind:'Text',unit:'Page',on:true,status:'ready',images:[],results:[],err:'',warn:''}));
          _intLim={maxPromptBytes:150000};getSample=async()=>({json:async()=>answers[call++]});
          DIRTY();setMode('inputs');go('tools','import');
        }''',documents)
        self.before=self.page.evaluate('JSON.stringify(S)')
        self.page.evaluate('intExtract()')
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),self.before)
        self.panel=self.page.locator('[data-intake-reconciliation]')

    def expand(self):
        if not self.panel.evaluate('node=>node.open'):self.panel.locator(':scope > summary').click()

    def apply(self):
        self.page.get_by_role('button',name='Apply selected',exact=True).click()
        self.page.wait_for_function('!INT.applying && !!INT.applied')

    def test_totals_use_own_period_and_apply_annualizes_once(self):
        self.seed();self.expand()
        expect(self.panel).to_contain_text('As of 2026-01-01')
        expect(self.panel).to_contain_text('Actual · 2028-01-01 to 2028-06-30 · 6 Months')
        row=self.panel.get_by_role('row').filter(has_text='Reported Operating Expenses')
        expect(row).to_contain_text('$4,000');expect(row).to_contain_text('Totals Match')
        expect(self.page.locator('#pane')).to_contain_text('Annualized from 6 Months')
        self.apply();values=self.page.evaluate('({ops:S.ops.map(x=>x.amt),income:S.misc[0].amt,op:calc(S).ann.op[0]})')
        self.assertEqual(values['ops'],[6000,3000,-1000]);self.assertEqual(values['income'],1200);self.assertAlmostEqual(values['op'],8000)

    def test_zero_noi_mismatch_is_visible_before_apply(self):
        docs=copy.deepcopy(FIXTURE['documents']);docs[1]['results'][0]['totals']['noi']=0
        self.seed(docs);expect(self.panel).to_have_attribute('open','true')
        row=self.panel.get_by_role('row').filter(has_text='Revenue Less Expenses = NOI');expect(row).to_contain_text('Mismatch');expect(row).to_contain_text('$0')
        expect(self.page.locator('.ichk').filter(has_text='Revenue Less Expenses = NOI')).to_contain_text('Mismatch')

    def test_unknown_period_is_disclosed_and_financial_lines_are_withheld(self):
        docs=copy.deepcopy(FIXTURE['documents']);pnl=docs[1]['results'][0];pnl.pop('reporting')
        for row in pnl['expenses']+pnl['otherIncome']:row.pop('months')
        self.seed(docs);expect(self.panel).to_contain_text('Not Fully Checked')
        self.assertEqual(self.page.evaluate('[INT.x.expenses.length,INT.x.other.length]'),[0,0])
        expect(self.page.locator('#pane')).to_contain_text('This expense was not proposed')
        self.apply();self.assertEqual(self.page.evaluate('[S.ops.length,S.misc.length]'),[0,0])

    def test_same_named_upload_source_opens_correct_statement(self):
        docs=copy.deepcopy(FIXTURE['documents']);docs[1]['name']=docs[0]['name']
        self.seed(docs);self.expand();row=self.panel.get_by_role('row').filter(has_text='Revenue Less Expenses = NOI')
        row.locator('summary').filter(has_text='Source Evidence').click()
        row.get_by_role('button',name='View Source',exact=True).click()
        source=self.page.get_by_role('dialog',name='Source Document',exact=True)
        expect(source.locator('pre')).to_contain_text('Actual January 1 through June 30, 2028')
        source.get_by_role('button',name='Close Source').click()
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),self.before)

    def test_invalid_expense_period_and_subtotal_cannot_reach_the_model(self):
        docs=copy.deepcopy(FIXTURE['documents']);pnl=docs[1]['results'][0]
        pnl['expenses'][0]['months']=0;pnl['expenses'].append({'name':'Total Operating Expenses','amount':4000,'months':6,'basis':'total','recoverable':False})
        self.seed(docs);expect(self.panel).to_contain_text('Not Fully Checked');self.apply()
        self.assertEqual(self.page.evaluate('S.ops.map(x=>[x.name,x.amt])'),[['Insurance',3000],['Utility credit',-1000]])

    def test_future_only_rent_is_incomplete_and_never_used_as_current_check(self):
        docs=copy.deepcopy(FIXTURE['documents']);docs[0]['results'][0]['tenants'][0]['rent'].pop(0)
        self.seed(docs);row=self.panel.get_by_role('row').filter(has_text='Current Annual Base Rent')
        expect(row).to_contain_text('Not Fully Checked');expect(row).to_contain_text('current rent amount')

    def test_reconciliation_values_survive_native_export_import(self):
        self.seed();self.apply()
        result=self.page.evaluate('''async()=>{const bytes=await basisCreateArchive({kind:'property',model:S}),file=await basisReadArchive(new Blob([bytes]));
          return {before:calc(S).ann.op,after:calc(file.model).ann.op,log:file.model.srcLog.filter(x=>x.target.startsWith('Expense')).map(x=>x.docId)};}''')
        self.assertEqual(result['before'],result['after']);self.assertEqual(result['log'],['pnl-jun']*3)

    def test_document_text_in_reconciliation_is_rendered_as_text(self):
        docs=copy.deepcopy(FIXTURE['documents']);docs[0]['name']='<img src=x onerror="window.badReconciliation=true">'
        self.seed(docs);self.expand();expect(self.panel).to_contain_text('<img src=x')
        self.assertEqual(self.panel.locator('img').count(),0);self.assertFalse(self.page.evaluate('!!window.badReconciliation'))

if __name__=='__main__':unittest.main(verbosity=2)
