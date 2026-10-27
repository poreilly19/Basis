"""Amendment review against synthetic document facts; no live AI requests."""
import copy
import json
import unittest
from pathlib import Path
from playwright.sync_api import expect
import browser_test as harness

FIXTURE=json.loads((Path(__file__).parent/'fixtures/intake/amendment_schedule.json').read_text())
class IntakeAmendmentsBrowserTests(unittest.TestCase):
    setUpClass=classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp=harness.BrowserTests.setUp
    tearDown=harness.BrowserTests.tearDown

    def seed(self,documents=None,advanced=False):
        docs=copy.deepcopy(FIXTURE['documents'] if documents is None else documents)
        self.page.evaluate('''({docs,advanced})=>{
          S=blankState();Object.assign(S,{startYear:2026,startMonth:1,years:4,gvRate:0,clRate:0});S.areas[0].sf=1000;S.ops=[];S.infl.forEach(x=>x.rates=[0,0,0,0,0]);
          S.tenants=[{id:'tenant',name:'Harbor Research LLC',suite:'100',sf:1000,start:'2026-01-01',end:'2030-12-31',rent:12,rentBasis:'psfyr',step:0,free:0,rec:S.recs[1].id,mla:S.mlas[0].id,expiry:'Vacate'}];
          if(advanced)S.tenants[0].cpi='manual-cpi';
          const answers=docs.map(d=>d.results[0]);let call=0;
          INT.docs=docs.map(d=>({...d,kind:'Text',unit:'Page',on:true,status:'ready',images:[],results:[],err:'',warn:''}));
          _intLim={maxPromptBytes:150000};getSample=async()=>({json:async()=>answers[call++]});DIRTY();setMode('inputs');go('tools','import');
        }''',{'docs':docs,'advanced':advanced})
        self.before=self.page.evaluate('JSON.stringify(S)');self.page.evaluate('intExtract()');self.assertEqual(self.page.evaluate('JSON.stringify(S)'),self.before)

    def apply(self):
        self.page.get_by_role('button',name='Apply selected',exact=True).click();self.page.wait_for_function('!INT.applying && !!INT.applied')

    def blocked(self):
        docs=copy.deepcopy(FIXTURE['documents']);docs[1]['results'][0]['tenants'][0].pop('rentChange');self.seed(docs)
        include=self.page.locator('input[aria-label^="Include t:"]');expect(include).not_to_be_checked();include.check()
        expect(self.page.get_by_role('button',name='Apply selected',exact=True)).to_be_disabled()

    def test_midyear_amendment_preserves_history_and_native_roundtrip(self):
        self.seed();expect(self.page.get_by_role('region',name='Review Tenant Fields')).to_contain_text('Replace rent from 2027-07-01')
        self.apply();result=self.page.evaluate('''async()=>{const bytes=await basisCreateArchive({kind:'property',model:S}),restored=await basisReadArchive(new Blob([bytes]));return {annual:calc(S).ann.sched.slice(0,4),monthly:calc(S).monthly.sched.slice(12,24),again:calc(restored.model).ann.sched.slice(0,4)};}''')
        for actual,expected in zip(result['annual'],FIXTURE['expected']['yearlyRent']):self.assertAlmostEqual(actual,expected,places=7)
        self.assertEqual(result['annual'],result['again'])
        for actual,expected in zip(result['monthly'],FIXTURE['expected']['yearTwoMonthlyRent']):self.assertAlmostEqual(actual,expected,places=7)

    def test_both_base_and_amendment_quotes_are_available_for_combined_rent(self):
        self.seed();row=self.page.locator('[data-review-field="rent"]');row.get_by_text('Source Evidence for Rent Terms',exact=True).click()
        expect(row).to_contain_text('Base Lease.txt');expect(row).to_contain_text('Amendment 1.txt')
        source=row.locator('.basis-source').filter(has_text='Annual rent: $12,000').first
        source.get_by_role('button',name='View Source',exact=True).click()
        expect(self.page.get_by_role('dialog',name='Source Document').locator('pre')).to_contain_text('$13,200 from January 1, 2027')

    def test_unknown_treatment_cannot_apply_even_when_called_programmatically(self):
        self.blocked();expect(self.page.get_by_role('region',name='Selected Changes')).to_contain_text('explicit treatment')
        self.assertFalse(self.page.evaluate('intApplySelected()'));self.assertEqual(self.page.evaluate('JSON.stringify(S)'),self.before)

    def test_keep_current_resolves_an_unclear_rent_amendment(self):
        self.blocked();self.page.get_by_label('Decision for Rent Terms',exact=True).select_option('keep')
        expect(self.page.get_by_role('button',name='Apply selected',exact=True)).to_be_enabled();self.apply()
        self.assertEqual(self.page.evaluate('[S.tenants[0].rent,S.tenants[0].sched||[]]'),[12,[]])

    def test_manual_complete_schedule_resolves_an_unclear_amendment(self):
        self.blocked();row=self.page.locator('[data-review-field="rent"]');row.get_by_label('Decision for Rent Terms',exact=True).select_option('edit')
        expect(self.page.get_by_role('button',name='Apply selected',exact=True)).to_be_disabled()
        row.get_by_label('Correct Base Rent',exact=True).fill('15');row.get_by_label('Correct Base Rent',exact=True).press('Tab')
        row.get_by_text('Correct Rent Schedule (JSON)',exact=True).click();field=row.get_by_label('Correct Rent Schedule',exact=True)
        field.fill('[]');field.press('Tab');expect(self.page.get_by_role('button',name='Apply selected',exact=True)).to_be_enabled();self.apply()
        self.assertAlmostEqual(self.page.evaluate('calc(S).ann.sched[0]'),15000)

    def test_listed_steps_preserve_future_steps_that_the_amendment_does_not_change(self):
        docs=copy.deepcopy(FIXTURE['documents']);docs[1]['results'][0]['tenants'][0]['rentChange']['mode']='listed_steps';self.seed(docs)
        expect(self.page.get_by_role('region',name='Review Tenant Fields')).to_contain_text('Change only listed rent steps')
        self.apply();self.assertTrue(self.page.evaluate("S.tenants[0].sched.some(row=>row.date==='2028-01-01'&&row.amt===14400)"))

    def recovery(self,future=False):
        docs=copy.deepcopy(FIXTURE['documents']);base=docs[0]['results'][0]['tenants'][0];amendment=docs[1]['results'][0]['tenants'][0]
        base['recovery']={'type':'base_year','baseYear':2024,'adminFeePct':.1,'grossUpPct':.95}
        amendment.pop('rent');amendment.pop('rentChange');amendment['recovery']={'adminFeePct':0}
        amendment['recoveryChange']={'mode':'patch','effectiveDate':'2026-07-01' if future else '2026-01-01'};self.seed(docs)

    def test_partial_recovery_keeps_the_base_year_and_unchanged_terms(self):
        self.recovery();expect(self.page.get_by_role('region',name='Review Tenant Fields')).to_contain_text('Retain unchanged recovery terms')
        self.apply();self.assertEqual(self.page.evaluate('''(()=>{const t=S.tenants[0],r=S.recs.find(r=>r.id===t.rec);return [t.baseYear,r.method,r.grossUp,r.adminFee]})()'''),['2024','STOP',.95,0])

    def test_future_recovery_change_blocks_until_current_terms_are_kept(self):
        self.recovery(future=True);expect(self.page.get_by_role('button',name='Apply selected',exact=True)).to_be_disabled()
        expect(self.page.get_by_role('region',name='Selected Changes')).to_contain_text('after the analysis begins')
        self.page.get_by_label('Decision for Recoveries',exact=True).select_option('keep');self.apply()
        self.assertTrue(self.page.evaluate('S.tenants[0].rec===S.recs[1].id'))

    def test_ordering_uncertainty_is_not_resolved_by_upload_order(self):
        docs=copy.deepcopy(FIXTURE['documents']);other=copy.deepcopy(docs[1]);other['id']='other';other['name']='Another Amendment';other['results'][0].pop('amendmentDate');other['results'][0]['tenants'][0]['rent'][0]['amount']=30000;docs.insert(0,other)
        self.seed(docs);self.page.locator('input[aria-label^="Include t:"]').check()
        expect(self.page.get_by_role('button',name='Apply selected',exact=True)).to_be_disabled()
        expect(self.page.get_by_role('region',name='Selected Changes')).to_contain_text('distinct execution dates')

    def test_uploaded_base_does_not_hide_an_existing_cpi_dependency(self):
        self.seed(advanced=True)
        expect(self.page.get_by_role('button',name='Apply selected',exact=True)).to_be_disabled()
        expect(self.page.get_by_role('region',name='Selected Changes')).to_contain_text('CPI or changing-area rent')
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),self.before)

if __name__=='__main__':unittest.main(verbosity=2)
