"""Workbook lifecycle and explicit AI connection checks; network is simulated."""
import unittest
from playwright.sync_api import expect
import browser_test as harness

class BetaFeaturesBrowserTests(unittest.TestCase):
    setUpClass=classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp=harness.BrowserTests.setUp
    tearDown=harness.BrowserTests.tearDown

    def reports(self):
        self.page.evaluate("setMode('inputs');go('tools','dump')")

    def prepare_export(self):
        self.reports()
        self.page.evaluate('''()=>{window.offered=[];basisReportToXlsx=pkg=>new Uint8Array([1,2,3]);offerFile=async(name,bytes)=>{offered.push({name,bytes:[...bytes]});return 'saved';};}''')

    def test_workbook_load_failure_is_visible_and_retry_preserves_model(self):
        self.prepare_export();before=self.page.evaluate('JSON.stringify(S)')
        self.page.evaluate("()=>{pfXlsxLib=async()=>{throw Error('Fixture library unavailable')};}")
        self.page.get_by_role('button',name='Download Report Workbook (.xlsx)',exact=True).click()
        expect(self.page.get_by_role('alert')).to_contain_text('Fixture library unavailable')
        self.assertEqual(self.page.evaluate('offered.length'),0)
        self.page.evaluate('()=>{pfXlsxLib=async()=>({});}')
        self.page.get_by_role('button',name='Download Report Workbook (.xlsx)',exact=True).click()
        self.page.wait_for_function('offered.length===1 && !BASIS_REPORT_EXPORT.job')
        self.assertTrue(self.page.evaluate('offered[0].name.endsWith(".xlsx")'))
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),before)

    def test_delayed_export_rejects_edits_and_portfolio_changes(self):
        for change in ["S.city='Changed during export';DIRTY()", "const id=await pwCreatePortfolio('Changed Portfolio');pwSetPf(id)"]:
            with self.subTest(change=change):
                self.prepare_export()
                self.page.evaluate('()=>{window.releaseLibrary=null;pfXlsxLib=()=>new Promise(resolve=>{releaseLibrary=()=>resolve({})});}')
                self.page.get_by_role('button',name='Download Report Workbook (.xlsx)',exact=True).click()
                self.page.wait_for_function('!!releaseLibrary')
                self.page.evaluate('async()=>{'+change+';releaseLibrary();}')
                self.page.wait_for_function('!BASIS_REPORT_EXPORT.job')
                self.assertEqual(self.page.evaluate('offered.length'),0)
                self.assertIn('changed',self.page.evaluate('BASIS_REPORT_EXPORT.error'))

    def test_cancel_and_declined_download_never_retry_or_change_inputs(self):
        self.prepare_export();before=self.page.evaluate('JSON.stringify(S)')
        self.page.evaluate('()=>{window.releaseLibrary=null;pfXlsxLib=()=>new Promise(resolve=>{releaseLibrary=()=>resolve({})});}')
        self.page.get_by_role('button',name='Download Report Workbook (.xlsx)',exact=True).click()
        self.page.wait_for_function('!!releaseLibrary')
        self.assertEqual(self.page.evaluate('exportDumpXlsx()'),'busy')
        self.page.get_by_role('button',name='Cancel Export',exact=True).click();self.page.evaluate('releaseLibrary()')
        self.page.wait_for_function('!BASIS_REPORT_EXPORT.job');self.assertEqual(self.page.evaluate('offered.length'),0)
        self.page.evaluate("()=>{pfXlsxLib=async()=>({});offerFile=async()=>{offered.push('declined');return 'declined';};}")
        self.page.get_by_role('button',name='Download Report Workbook (.xlsx)',exact=True).click()
        self.page.wait_for_function('!BASIS_REPORT_EXPORT.job && offered.length===1')
        expect(self.page.locator('#pane').get_by_role('status')).to_contain_text('Export cancelled')
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),before)

    def test_export_calculates_current_edited_snapshot(self):
        self.prepare_export()
        self.page.evaluate('''()=>{S.tenants[0].rent=22.55;DIRTY();clearTimeout(tmr);window.expectedNOI=calc(S).noiY1;window.capturedNOI=null;
          basisReportToXlsx=pkg=>{capturedNOI=pkg.sheets.find(s=>s.name==='Property Summary').rows.find(r=>r[0]==='Year 1 NOI')[1];return new Uint8Array([1]);};pfXlsxLib=async()=>({});}''')
        self.page.get_by_role('button',name='Download Report Workbook (.xlsx)',exact=True).click()
        self.page.wait_for_function('offered.length===1')
        self.assertAlmostEqual(self.page.evaluate('capturedNOI'),self.page.evaluate('expectedNOI'),places=6)

    def configure(self):
        self.page.evaluate('studioOpenSettings()')
        self.page.get_by_label('AI Provider',exact=True).select_option('openai')
        self.page.get_by_label('API Key',exact=True).fill('test-beta-session-key')
        self.page.get_by_role('button',name='Use AI Setup',exact=True).click()

    def test_json_report_also_uses_fresh_snapshot_without_loading_excel(self):
        self.reports()
        self.page.evaluate('''()=>{S.tenants[0].rent=23.125;DIRTY();clearTimeout(tmr);window.expectedNOI=calc(S).noiY1;
          window.savedJSON=null;offerFile=async(name,bytes)=>{savedJSON=JSON.parse(bytes);return 'saved';};
          pfXlsxLib=async()=>{throw Error('JSON must not load Excel');};}''')
        self.page.get_by_role('button',name='Export report tables (.json)',exact=True).click()
        self.page.wait_for_function('!!savedJSON')
        self.assertAlmostEqual(self.page.evaluate("savedJSON.reports['Property Summary'].find(row=>row[0]==='Year 1 NOI')[1]"), self.page.evaluate('expectedNOI'), places=6)

    def test_ai_connection_is_explicit_and_sends_no_model_or_documents(self):
        self.page.evaluate('''()=>{window.aiCalls=[];window.fetch=async(url,options)=>{aiCalls.push(JSON.parse(options.body));return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:'{"basis":"ok"}'}]}]}));};}''')
        before=self.page.evaluate('JSON.stringify(S)');self.configure();self.assertEqual(self.page.evaluate('aiCalls.length'),0)
        self.page.get_by_role('button',name='Test AI Connection',exact=True).click()
        expect(self.page.locator('[data-ai-connection-status]')).to_contain_text('Connection Successful')
        self.assertEqual(self.page.evaluate('aiCalls.length'),1)
        self.assertEqual(self.page.evaluate('aiCalls[0].max_output_tokens'),128)
        self.assertNotIn(self.page.evaluate('S.name'),self.page.evaluate('JSON.stringify(aiCalls)'))
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),before)
        self.assertFalse(self.page.evaluate("JSON.stringify([localStorage,sessionStorage,S,PW.ix]).includes('test-beta-session-key')"))
        self.page.get_by_label('AI Model',exact=True).fill('another-model')
        expect(self.page.get_by_role('button',name='Test AI Connection',exact=True)).to_be_disabled()

    def test_ai_failed_key_is_actionable_and_edit_cancels_pending_check(self):
        self.configure();self.page.evaluate("()=>{window.fetch=async()=>new Response('secret-error-body',{status:401});}")
        self.page.get_by_role('button',name='Test AI Connection',exact=True).click()
        expect(self.page.locator('[data-ai-connection-status]')).to_contain_text('rejected this API key')
        expect(self.page.locator('[data-ai-connection-status]')).not_to_contain_text('secret-error-body')
        self.page.evaluate('()=>{window.fetch=()=>new Promise(()=>{});}')
        self.page.get_by_role('button',name='Test AI Connection',exact=True).click()
        self.page.get_by_role('button',name='Cancel Connection Test',exact=True).click()
        expect(self.page.locator('[data-ai-connection-status]')).to_contain_text('cancelled')
        expect(self.page.get_by_role('button',name='Test AI Connection',exact=True)).to_be_enabled()

    def test_about_beta_privacy_and_keyboard_focus_work_without_network(self):
        import json
        from pathlib import Path
        version=json.loads((Path(__file__).resolve().parents[1]/'package.json').read_text())['version']
        self.page.get_by_role('tab',name='File',exact=True).click()
        opener=self.page.get_by_role('button',name='About Basis',exact=True);opener.click()
        dialog=self.page.get_by_role('dialog',name='About Basis',exact=True)
        expect(dialog).to_contain_text(version)
        dialog.get_by_role('button',name='Data & Privacy',exact=True).click()
        expect(dialog).to_contain_text('API keys stay in memory')
        dialog.get_by_role('button',name='Limitations',exact=True).click()
        expect(dialog).to_contain_text('does not prove extraction accuracy')
        self.page.keyboard.press('Escape');expect(dialog).to_have_count(0);expect(opener).to_be_focused()

    def test_support_download_is_allowlisted_and_does_not_include_model_or_credentials(self):
        import json
        from pathlib import Path
        self.page.evaluate("()=>{S.name='PRIVATE_PROPERTY_NEEDLE';S.city='PRIVATE_CITY_NEEDLE';basisConfigureAI({provider:'openai',apiKey:'private-key-needle',model:'private-model-needle'});}")
        before=self.page.evaluate('JSON.stringify(S)')
        self.page.evaluate('basisOpenBetaInfo()')
        with self.page.expect_download() as pending:
            self.page.get_by_role('button',name='Download Support Info',exact=True).click()
        target=Path(self.tmp.name)/'support.json';pending.value.save_as(target)
        data=json.loads(target.read_text());self.assertEqual(set(data),{'application','version','channel','browser','secureContext','protocol','theme'})
        for value in ['PRIVATE_PROPERTY_NEEDLE','PRIVATE_CITY_NEEDLE','private-key-needle','private-model-needle']:
            self.assertNotIn(value,target.read_text())
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),before)

    def test_about_phone_layout_and_declined_support_download_are_recoverable(self):
        self.page.set_viewport_size({'width':390,'height':844});self.page.evaluate('basisOpenBetaInfo()')
        self.page.evaluate("()=>{window.supportCalls=0;offerFile=async()=>{supportCalls++;return 'declined';};}")
        self.page.get_by_role('button',name='Download Support Info',exact=True).click()
        expect(self.page.locator('#basisBetaInfo').get_by_role('status')).to_contain_text('cancelled')
        self.assertEqual(self.page.evaluate('supportCalls'),1)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        expect(self.page.get_by_role('button',name='Download Support Info',exact=True)).to_be_enabled()
