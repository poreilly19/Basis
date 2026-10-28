"""Extraction review against synthetic document facts. No live provider requests."""
import copy
import json
import unittest
from pathlib import Path
from playwright.sync_api import expect
import browser_test as harness

FIXTURE=json.loads((Path(__file__).parent/'fixtures/intake/partial_abatement.json').read_text())

class IntakeQualityBrowserTests(unittest.TestCase):
    setUpClass=classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp=harness.BrowserTests.setUp
    tearDown=harness.BrowserTests.tearDown

    def seed(self,documents=None,ambiguous=False):
        documents=copy.deepcopy(documents if documents is not None else FIXTURE['documents'])
        self.page.evaluate('''({documents,ambiguous})=>{
          S=blankState();Object.assign(S,{startYear:2026,startMonth:1,years:2,gvRate:0,clRate:0});
          S.areas[0].sf=ambiguous?2000:1000;S.ops=[];S.infl.forEach(x=>x.rates=[0,0,0]);
          S.tenants=[{id:'first',name:'North Labs LLC',suite:'100',sf:1000,start:'2026-01-01',end:'2030-12-31',rent:10,rentBasis:'psfyr',step:0,free:0,rec:S.recs[1].id,mla:S.mlas[0].id,expiry:'Vacate'}];
          if(ambiguous)S.tenants.push({...S.tenants[0],id:'second',suite:'200'});
          const answers=documents.map(d=>d.results[0]);let call=0;
          INT.docs=documents.map(d=>({...d,kind:'Text',unit:'Page',on:true,status:'ready',images:[],results:[],err:'',warn:''}));
          _intLim={maxPromptBytes:150000};getSample=async()=>({json:async()=>answers[call++]});
          DIRTY();setMode('inputs');go('tools','import');
        }''',{'documents':documents,'ambiguous':ambiguous})
        self.before=self.page.evaluate('JSON.stringify(S)')
        self.page.evaluate('intExtract()')
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),self.before)

    def apply(self):
        self.page.get_by_role('button',name='Apply selected',exact=True).click()
        self.page.wait_for_function('!INT.applying && !!INT.applied')

    def ambiguous(self):
        docs=copy.deepcopy(FIXTURE['documents'][:1]);docs[0]['results'][0]['tenants'][0].pop('suite')
        self.seed(docs,ambiguous=True)

    def test_partial_abatement_cash_flow_and_native_round_trip(self):
        self.seed();review=self.page.get_by_role('region',name='Review Tenant Fields')
        expect(review.locator('[data-review-field="abatement"]')).to_contain_text('Proposed: 50%')
        self.apply()
        result=self.page.evaluate('''async()=>{const bytes=await basisCreateArchive({kind:'property',model:S}),restored=await basisReadArchive(new Blob([bytes]));return {cash:calc(S).monthly.sched.slice(0,12),again:calc(restored.model).monthly.sched.slice(0,12),free:S.tenants[0].free};}''')
        self.assertEqual(result['free'],6)
        for actual,expected in zip(result['cash'],FIXTURE['expected']['monthlyRentYearOne']):self.assertAlmostEqual(actual,expected,places=7)
        self.assertEqual(result['again'],result['cash'])

    def test_each_field_opens_the_right_file_even_with_duplicate_names(self):
        self.seed();review=self.page.get_by_role('region',name='Review Tenant Fields')
        for field,summary,text in [('rent','Source Evidence for Rent Terms','Annual base rent is $12,000.'),('end','Source Evidence for Expiry','extended to December 31, 2032')]:
            row=review.locator('[data-review-field="'+field+'"]');row.get_by_text(summary,exact=True).click()
            expect(row).to_contain_text('Quote found in uploaded page text')
            row.get_by_role('button',name='View Source',exact=True).click()
            source=self.page.get_by_role('dialog',name='Source Document',exact=True)
            expect(source.locator('pre')).to_contain_text(text);source.get_by_role('button',name='Close Source').click()
            row.get_by_text(summary,exact=True).click()

    def test_missing_quote_is_flagged_without_claiming_verification(self):
        docs=copy.deepcopy(FIXTURE['documents']);docs[0]['results'][0]['tenants'][0]['fieldSources']['rent']['quote']='Annual base rent is $99,000.'
        self.seed(docs);row=self.page.locator('[data-review-field="rent"]');row.get_by_text('Source Evidence for Rent Terms',exact=True).click()
        expect(row).to_contain_text('Quote not found on this page');self.assertEqual(self.page.evaluate('JSON.stringify(S)'),self.before)

    def test_ambiguous_target_blocks_apply_until_an_existing_lease_is_chosen(self):
        self.ambiguous();apply=self.page.get_by_role('button',name='Apply selected',exact=True)
        expect(apply).to_be_disabled();expect(self.page.get_by_role('region',name='Selected Changes')).to_contain_text('choose an existing lease')
        self.page.get_by_label('Apply To for North Labs LLC',exact=True).select_option('id:second');expect(apply).to_be_enabled();self.apply()
        self.assertEqual(self.page.evaluate('S.tenants.map(t=>[t.id,t.rent])'),[['first',10],['second',12]])

    def test_add_new_is_an_explicit_resolution_and_keeps_existing_leases(self):
        self.ambiguous();self.page.get_by_label('Apply To for North Labs LLC',exact=True).select_option('new');self.apply()
        self.assertEqual(self.page.evaluate('S.tenants.length'),3);self.assertEqual(self.page.evaluate('S.tenants.slice(0,2).map(t=>t.rent)'),[10,10])

    def test_target_change_resets_corrections_from_the_previous_lease(self):
        self.ambiguous();target=self.page.get_by_label('Apply To for North Labs LLC',exact=True);target.select_option('id:first')
        review=self.page.get_by_role('region',name='Review Tenant Fields');review.get_by_label('Decision for Rent Terms',exact=True).select_option('edit')
        review.get_by_label('Correct Base Rent',exact=True).fill('99');review.get_by_label('Correct Base Rent',exact=True).press('Tab')
        target.select_option('id:second');expect(review.get_by_label('Decision for Rent Terms',exact=True)).to_have_value('accept')
        self.apply();self.assertEqual(self.page.evaluate('S.tenants.map(t=>t.rent)'),[10,12])

    def test_manual_abatement_correction_changes_the_same_months_in_preview_and_apply(self):
        self.seed();review=self.page.get_by_role('region',name='Review Tenant Fields');review.get_by_label('Decision for Free Rent Terms',exact=True).select_option('edit')
        share=review.get_by_label('Correct Share Abated (0.5 = 50%)',exact=True);share.fill('2');share.press('Tab')
        expect(self.page.get_by_role('button',name='Apply selected',exact=True)).to_be_disabled();share.fill('0.25');share.press('Tab')
        expected=self.page.evaluate('calc(intPrepareApply(JSON.parse(INT.target.json),INT.x,INT.pick,INT.mode,INT.review).model).monthly.sched.slice(0,12)')
        self.apply();actual=self.page.evaluate('calc(S).monthly.sched.slice(0,12)');self.assertEqual(actual,expected);self.assertAlmostEqual(actual[6],750)

    def test_unsupported_rent_is_unchecked_and_does_not_overwrite_existing_rent(self):
        docs=copy.deepcopy(FIXTURE['documents'][:1]);docs[0]['results'][0]['tenants'][0]['rent'][0]['unit']='weekly'
        self.seed(docs);include=self.page.locator('input[aria-label^="Include t:"]');expect(include).not_to_be_checked()
        expect(self.page.locator('#pane')).to_contain_text('no supported annual, monthly, or per-SF unit')
        include.check();expect(self.page.get_by_role('region',name='Selected Changes')).to_contain_text('rent terms were not applied')
        self.apply();self.assertEqual(self.page.evaluate('S.tenants[0].rent'),10)

    def test_per_sf_rent_stays_constant_when_reviewed_area_changes(self):
        docs=copy.deepcopy(FIXTURE['documents'][:1]);t=docs[0]['results'][0]['tenants'][0];t['sf']=1500;t['rent']=[{'from':'2026-01-01','amount':12,'unit':'psf_year'}]
        self.seed(docs);review=self.page.get_by_role('region',name='Review Tenant Fields');review.get_by_label('Decision for Area (SF)',exact=True).select_option('edit')
        field=review.get_by_label('Correct Area (SF)',exact=True);field.fill('2000');field.press('Tab')
        expect(review).to_contain_text('$24,000/year');self.apply();self.assertEqual(self.page.evaluate('[S.tenants[0].sf,S.tenants[0].rent]'),[2000,12])

    def test_unknown_recovery_keeps_correction_controls_and_blocks_apply_until_reviewed(self):
        docs=copy.deepcopy(FIXTURE['documents'][:1]);docs[0]['results'][0]['tenants'][0]['recovery']={'type':'unsupported'}
        self.seed(docs);include=self.page.locator('input[aria-label^="Include t:"]');expect(include).not_to_be_checked()
        before=self.page.evaluate('S.tenants[0].rec');include.check()
        review=self.page.get_by_role('region',name='Review Tenant Fields');expect(review.locator('[data-review-field="rec"]')).to_be_visible()
        expect(self.page.get_by_role('button',name='Apply selected',exact=True)).to_be_disabled()
        review.get_by_label('Decision for Recoveries',exact=True).select_option('keep')
        expect(self.page.get_by_role('button',name='Apply selected',exact=True)).to_be_enabled();self.apply()
        self.assertEqual(self.page.evaluate('S.tenants[0].rec'),before)

if __name__=='__main__':unittest.main(verbosity=2)
