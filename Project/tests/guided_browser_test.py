"""Guided underwriting workflows; extraction responses are offline fixtures."""
import unittest
from playwright.sync_api import expect
import browser_test as harness
import workflow_browser_test as workflow

class GuidedBrowserTests(unittest.TestCase):
    setUpClass=classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp=harness.BrowserTests.setUp
    tearDown=harness.BrowserTests.tearDown
    seed_import=workflow.WorkflowBrowserTests.seed_import
    tenants=workflow.WorkflowBrowserTests.tenants

    def extract(self, kind='leases'):
        self.seed_import()
        self.page.evaluate("kind=>{setMode('inputs');go(kind==='leases'?'tenants':'expenses',kind==='leases'?'rr':'op');basisOpenTaskImport(kind)}",kind)
        self.page.evaluate('intExtract()')
        expect(self.page.get_by_role('region',name='Review Tenant Fields')).to_be_visible()

    def test_property_wizard_is_cancelable_scoped_and_reaches_rent_roll(self):
        before=self.page.evaluate('JSON.stringify(S)')
        self.page.get_by_role('button',name='New Property',exact=True).click()
        dialog=self.page.get_by_role('dialog',name='Create Property',exact=True)
        dialog.get_by_label('Property Name',exact=True).fill('Cancelled')
        dialog.get_by_role('button',name='Cancel',exact=True).click()
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),before)
        self.page.get_by_role('button',name='New Property',exact=True).click()
        dialog=self.page.get_by_role('dialog',name='Create Property',exact=True)
        dialog.get_by_label('Property Name',exact=True).fill('Guided Property')
        dialog.get_by_label('Rentable Area (SF)',exact=True).fill('12,345')
        dialog.get_by_label('Analysis Start',exact=True).fill('2027-04-01')
        dialog.get_by_label('Hold Period (Years)',exact=True).fill('10')
        scope=self.page.evaluate('[PW.pf,PW.sc]')
        dialog.get_by_role('button',name='Create and Continue',exact=True).click()
        expect(dialog).not_to_be_visible()
        self.assertEqual(self.page.evaluate('[S.name,S.areas[0].sf,S.startYear,S.startMonth,S.years,T1,T2]'),['Guided Property',12345,2027,4,10,'tenants','rr'])
        self.assertEqual(self.page.evaluate('[pwRec(PW.cur).pf,pwRec(PW.cur).sc]'),scope)

    def test_property_basics_show_months_and_preserve_advanced_fields(self):
        self.page.evaluate("S.years=10;S.externalId='Keep-ID';setMode('inputs');go('property','desc')")
        expect(self.page.locator('[data-analysis-months]')).to_have_text('120 Months')
        self.page.get_by_label('Hold Period (Years)',exact=True).fill('7')
        self.page.get_by_label('Hold Period (Years)',exact=True).press('Tab')
        expect(self.page.locator('[data-analysis-months]')).to_have_text('84 Months')
        self.assertEqual(self.page.evaluate('S.externalId'),'Keep-ID')
        expect(self.page.locator('details.basis-advanced')).not_to_have_attribute('open','')
        self.page.get_by_role('button',name='Continue to Rent Roll',exact=True).click()
        expect(self.page.get_by_role('button',name='Upload Lease / Rent Roll')).to_be_visible()

    def test_drawer_navigation_commits_valid_edits_and_blocks_invalid_numbers(self):
        self.tenants();self.page.get_by_role('button',name='Edit lease for Alpha',exact=True).click()
        drawer=self.page.locator('.basis-lease-drawer')
        expect(drawer.get_by_label('Base Rent',exact=True)).to_be_visible()
        drawer.get_by_label('Base Rent',exact=True).fill('$17.45')
        drawer.get_by_role('button',name='Next Tenant',exact=True).click()
        expect(drawer).to_have_attribute('aria-label','Lease Editor for Beta')
        self.assertEqual(self.page.evaluate('S.tenants[0].rent'),17.45)
        drawer.get_by_label('Base Rent',exact=True).fill('not a number')
        drawer.get_by_role('button',name='Previous Tenant',exact=True).click()
        expect(drawer).to_have_attribute('aria-label','Lease Editor for Beta')
        expect(drawer.get_by_label('Base Rent',exact=True)).to_have_attribute('aria-invalid','true')

    def test_document_field_review_keeps_existing_area_and_normalizes_accepted_rent(self):
        self.extract()
        self.page.evaluate("INT.x.tenants[0].r.sf=2000;drawPane()")
        review=self.page.get_by_role('region',name='Review Tenant Fields')
        review.get_by_label('Decision for Area (SF)',exact=True).select_option('keep')
        self.assertEqual(self.page.evaluate('S.tenants[0].rent'),10)
        proposed=self.page.evaluate("intPrepareApply(JSON.parse(INT.target.json),INT.x,INT.pick,INT.mode,INT.review).model.tenants[0]")
        self.assertEqual((proposed['sf'],proposed['rent']),(1000,12))
        self.page.get_by_label('Include prop:city',exact=True).uncheck()
        self.page.get_by_role('button',name='Apply selected',exact=True).click()
        self.page.wait_for_function('!INT.applying && !!INT.applied')
        self.assertEqual(self.page.evaluate('[S.tenants[0].sf,S.tenants[0].rent,T1,T2]'),[1000,12,'tenants','rr'])
        expect(self.page.locator('.basis-import-changed')).to_have_count(1)
        self.assertFalse(self.page.evaluate("S.srcLog.some(x=>x.target.includes('area (SF)')&&x.value==='2000')"))

    def test_document_corrections_and_sources_match_apply(self):
        self.extract()
        review=self.page.get_by_role('region',name='Review Tenant Fields')
        review.get_by_label('Decision for Rent Terms',exact=True).select_option('edit')
        review.get_by_label('Correct Base Rent',exact=True).fill('18.25')
        review.get_by_label('Correct Base Rent',exact=True).press('Tab')
        proposed=self.page.get_by_role('region',name='Selected Changes')
        expect(proposed).to_contain_text('$18.25 /SF/year')
        review.get_by_role('button',name='View Source',exact=True).click()
        source=self.page.get_by_role('dialog',name='Source Document',exact=True)
        expect(source.locator('pre')).to_contain_text('Annual rent is $12,000.')
        bounds=review.get_by_label('Correct Base Rent',exact=True).bounding_box()
        self.assertLessEqual(bounds['x']+bounds['width'],source.bounding_box()['x'],'Source must not cover the correction control')
        source.get_by_role('button',name='Close Source').click()
        self.page.get_by_role('button',name='Apply selected',exact=True).click()
        self.page.wait_for_function('!INT.applying && !!INT.applied')
        self.assertEqual(self.page.evaluate('S.tenants[0].rent'),18.25)
        self.assertTrue(self.page.evaluate("S.srcLog.some(x=>x.target.endsWith(' · rent')&&x.value.includes('Manual correction: $18.25 /SF/year'))"))

    def test_model_check_targets_duplicate_names_by_id_and_returns_to_updated_checks(self):
        self.tenants()
        self.page.evaluate("S.tenants[1].name='Alpha';S.tenants[1].sf=0;DIRTY();basisOpenChecks()")
        self.page.wait_for_function('!!R && !calcPending')
        self.page.evaluate('drawPane()')
        issue=self.page.locator('.basis-check-item').filter(has_text='has zero area')
        issue.get_by_role('button',name='Go to Field').click()
        self.assertEqual(self.page.evaluate('basisLeaseDrawer.tenant.id===S.tenants[1].id'),True)
        expect(self.page.locator('.basis-lease-drawer [data-field="sf"]')).to_be_focused()
        self.page.locator('.basis-lease-drawer [data-field="sf"]').fill('500')
        self.page.get_by_role('button',name='Close Lease Editor').click()
        self.page.get_by_role('button',name='Return to Model Checks').click()
        self.page.wait_for_function('!!R && !calcPending')
        self.page.evaluate('drawPane()')
        expect(self.page.locator('.basis-check-item').filter(has_text='has zero area')).to_have_count(0)

    def test_essentials_fit_laptop_and_identity_stays_visible_in_full_table(self):
        self.page.set_viewport_size({'width':1280,'height':720})
        self.page.evaluate("setMode('inputs');go('tenants','rr')")
        widths=self.page.locator('.basis-rent-table .scroll').evaluate('n=>[n.clientWidth,n.scrollWidth]')
        self.assertLessEqual(widths[1],widths[0]+2,widths)
        date=self.page.locator('.basis-rent-table tbody [data-field="start"]').first
        self.assertTrue(date.evaluate('''n=>{const style=getComputedStyle(n),canvas=document.createElement('canvas'),context=canvas.getContext('2d');context.font=style.font;return context.measureText(n.value).width<=n.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)}'''),'Full date text must fit in its input')
        self.page.get_by_label('Rent Roll View').select_option('All')
        table=self.page.locator('.basis-rent-table .scroll')
        table.evaluate('n=>n.scrollLeft=500')
        name=self.page.locator('tbody [data-rent-column="1"]').first
        self.assertEqual(name.evaluate('n=>getComputedStyle(n).position'),'sticky')
        self.assertGreaterEqual(name.bounding_box()['x'],table.bounding_box()['x'])

    def test_selection_only_actions_report_shortcuts_and_truthful_save_label(self):
        expect(self.page.get_by_role('button', name='Duplicate Records', exact=True)).to_be_disabled()
        self.page.locator('input[aria-label^="Check "]').first.check()
        expect(self.page.get_by_role('button',name='Duplicate Records')).to_be_enabled()
        self.assertEqual(self.page.evaluate('pwSelIds().length'),1)
        self.page.get_by_role('button',name='Select None',exact=True).click()
        expect(self.page.get_by_role('button', name='Duplicate Records', exact=True)).to_be_disabled()
        self.page.evaluate("setMode('reports');go('prop','cf');pwStatus('Saved')")
        expect(self.page.locator('#pwst')).to_contain_text('Saved in This Browser')
        self.page.get_by_role('button',name='Unpin Report',exact=True).click()
        expect(self.page.get_by_role('button',name='Pin Report',exact=True)).to_be_visible()
        self.page.get_by_role('button',name='Pin Report',exact=True).click()
        self.assertIn('cf',self.page.evaluate('basisReportState().pinned'))

    def test_export_cancel_and_failure_remain_reviewable_and_success_downloads_backup(self):
        self.page.evaluate("setMode('inputs');go('tools','file');window.originalOffer=offerFile;offerFile=async()=> 'cancelled'")
        self.page.get_by_role('button',name='Export / Backup',exact=True).click()
        dialog=self.page.get_by_role('dialog',name='Export and Backup')
        dialog.get_by_role('button',name='Download',exact=True).click()
        expect(dialog).to_be_visible()
        self.page.evaluate("offerFile=async()=> 'failed'")
        dialog.get_by_role('button',name='Download',exact=True).click()
        expect(dialog.get_by_role('alert')).to_contain_text('did not complete')
        self.page.evaluate('() => {offerFile=window.originalOffer;}')
        with self.page.expect_download() as download:
            dialog.get_by_role('button',name='Download',exact=True).click()
        self.assertTrue(download.value.suggested_filename.endswith('.basiscre'))
        expect(dialog).not_to_be_visible()

    def test_invalid_review_draft_survives_redraw_and_blocks_apply(self):
        self.extract()
        review=self.page.get_by_role('region',name='Review Tenant Fields')
        review.get_by_label('Decision for Rent Terms',exact=True).select_option('edit')
        field=review.get_by_label('Correct Base Rent',exact=True)
        field.fill('invalid amount');field.press('Tab')
        self.page.evaluate('drawPane()')
        expect(review.get_by_label('Correct Base Rent',exact=True)).to_have_value('invalid amount')
        expect(self.page.get_by_role('button',name='Apply selected',exact=True)).to_be_disabled()
        self.assertFalse(self.page.evaluate('intApplySelected()'))
        self.assertEqual(self.page.evaluate('S.tenants[0].rent'),10)
        review.get_by_label('Correct Base Rent',exact=True).fill('15.25')
        review.get_by_label('Correct Base Rent',exact=True).press('Tab')
        expect(self.page.get_by_role('button',name='Apply selected',exact=True)).to_be_enabled()

    def test_contextual_operating_statement_import_preselects_costs_and_returns_to_expenses(self):
        self.page.evaluate("""() => {
          S.ops=[];INT.docs=[{id:'cost',name:'Statement',kind:'Text',on:true,status:'ready',pages:[{n:1,text:'Insurance $24,000'}],images:[],results:[]}];
          _intLim={maxPromptBytes:150000};_sample={json:async()=>({docType:'operating_statement',property:{city:'Unrelated City'},expenses:[{name:'Insurance',amount:24000,basis:'annual',recoverable:true,src:{page:1,quote:'Insurance $24,000'}}]})};getSample=async()=>_sample;
          setMode('inputs');go('expenses','op');
        }""")
        self.page.get_by_role('button',name='Upload Operating Statement',exact=True).click()
        self.page.evaluate('intExtract()')
        self.assertFalse(self.page.evaluate("INT.pick['prop:city']"))
        self.assertTrue(self.page.evaluate("Object.entries(INT.pick).some(([key,value])=>key.startsWith('e:')&&value)"))
        self.page.get_by_role('button',name='Apply selected',exact=True).click()
        self.page.wait_for_function('!INT.applying && !!INT.applied')
        self.assertEqual(self.page.evaluate('[T1,T2,S.ops[0].amt]'),['expenses','op',24000])
        expect(self.page.locator('.basis-import-changed')).to_have_count(1)

    def test_review_change_during_confirmation_cannot_apply_stale_decisions(self):
        self.extract()
        self.page.evaluate("""() => {INT.mode='replace';kConfirm=()=>new Promise(resolve=>window.answerReview=resolve);window.pendingApply=intApplySelected();}""")
        self.page.wait_for_function("typeof window.answerReview==='function'")
        before=self.page.evaluate('JSON.stringify(S)')
        self.page.evaluate("() => {const key=INT.x.tenants[0].key;INT.review={[key]:{rent:{mode:'keep'}}};window.answerReview(true);}")
        self.assertFalse(self.page.evaluate('window.pendingApply'))
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),before)
        self.assertIn('changed',self.page.evaluate('INT.err'))

    def test_corrupt_report_preferences_and_long_imported_hold_are_recoverable(self):
        self.page.evaluate("() => {localStorage.setItem('basis.report-shortcuts.v1','null');basisReportPrefs=null;setMode('reports');go('prop','cf');}")
        expect(self.page.get_by_label('Pinned and Recent Reports')).to_be_visible()
        self.page.evaluate("S.years=60;DIRTY();setMode('inputs');go('property','desc')")
        expect(self.page.locator('[data-analysis-months]')).to_have_text('480 Months Modeled (60 Years Entered)')
        self.page.get_by_label('Hold Period (Years)',exact=True).fill('41')
        self.page.get_by_label('Hold Period (Years)',exact=True).press('Tab')
        self.assertEqual(self.page.evaluate('S.years'),60)
        expect(self.page.get_by_label('Hold Period (Years)',exact=True)).to_have_attribute('aria-invalid','true')

    def test_current_model_checks_report_exports_actual_findings(self):
        self.page.evaluate('basisOpenChecks()')
        self.page.wait_for_function('!!R && !calcPending')
        self.page.get_by_role('button',name='Export / Backup',exact=True).click()
        dialog=self.page.get_by_role('dialog',name='Export and Backup',exact=True)
        dialog.get_by_label('Export Type',exact=True).select_option('report')
        with self.page.expect_download() as download:
            dialog.get_by_role('button',name='Download',exact=True).click()
        text=download.value.path().read_text()
        self.assertIn('Severity',text);self.assertIn('Finding',text)
        self.assertGreater(len(text.splitlines()),1)

if __name__=='__main__':unittest.main(verbosity=2)
