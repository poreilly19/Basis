"""Workspace preferences and standalone AI workflows; all provider calls are fake."""
import unittest
from playwright.sync_api import expect
import browser_test as harness


class WorkspaceSettingsBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp = harness.BrowserTests.setUp
    tearDown = harness.BrowserTests.tearDown

    def settings(self):
        self.page.get_by_role('button', name='Portfolio', exact=True).click()
        self.page.get_by_role('tab', name='Settings', exact=True).click()
        expect(self.page.locator('#basisWorkspaceSettings')).to_be_visible()

    def ready_after_reload(self):
        self.page.reload()
        self.page.evaluate('PW.ready')
        self.page.wait_for_function('PW.cur && document.querySelector("#startup").hidden')

    def test_theme_and_column_preferences_persist_and_apply_to_new_tables(self):
        self.settings()
        self.page.get_by_label('Appearance', exact=True).select_option('dark')
        self.page.get_by_label('Fit Columns to Content', exact=True).uncheck()
        self.ready_after_reload()
        self.assertEqual(self.page.evaluate('document.documentElement.dataset.theme'), 'dark')
        self.assertFalse(self.page.evaluate('BASIS_PREFS.get().autoFitColumns'))
        self.page.evaluate("setMode('inputs');go('tenants','rr')")
        table = self.page.locator('#pane .scroll > table').first
        expect(table).to_be_visible()
        self.assertEqual(table.evaluate('node=>getComputedStyle(node).tableLayout'), 'fixed')
        self.settings()
        self.page.get_by_label('Fit Columns to Content', exact=True).check()
        self.page.get_by_label('Appearance', exact=True).select_option('system')
        self.page.emulate_media(color_scheme='light')
        light = self.page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--bg')")
        self.page.emulate_media(color_scheme='dark')
        dark = self.page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--bg')")
        self.assertNotEqual(light, dark)
        self.assertFalse(self.page.evaluate("document.documentElement.hasAttribute('data-theme')"))
        self.page.evaluate("setMode('inputs');go('tenants','rr')")
        self.page.get_by_label('Rent Roll View',exact=True).select_option('All')
        self.assertEqual(table.evaluate('node=>getComputedStyle(node).tableLayout'), 'auto')

    def test_autosave_off_retains_recovery_and_manual_save_then_reenables_idle_save(self):
        self.settings()
        self.page.get_by_label('Autosave While Editing', exact=True).uncheck()
        original = self.page.evaluate('pwGetModel(PW.cur).then(row=>JSON.parse(row.json).city)')
        self.page.evaluate("S.city='Manual save city';DIRTY()")
        self.assertTrue(self.page.evaluate('!!PW.local.edited && PW.timer===null'))
        self.assertEqual(self.page.evaluate('pwGetModel(PW.cur).then(row=>JSON.parse(row.json).city)'), original)
        self.assertEqual(self.page.evaluate('PW.drafts.get(PW.drafts.writerId).model.city'), 'Manual save city')
        self.page.get_by_role('button', name='Save Changes', exact=True).click()
        self.page.wait_for_function('!PW.local.edited')
        expect(self.page.get_by_role('button', name='Save Changes', exact=True)).to_be_hidden()
        self.assertEqual(self.page.evaluate('pwGetModel(PW.cur).then(row=>JSON.parse(row.json).city)'), 'Manual save city')
        self.page.evaluate("S.city='Idle save city';DIRTY()")
        self.page.get_by_label('Autosave While Editing', exact=True).check()
        self.page.wait_for_function('!PW.local.edited')
        self.assertEqual(self.page.evaluate('pwGetModel(PW.cur).then(row=>JSON.parse(row.json).city)'), 'Idle save city')

    def test_ai_setup_does_not_send_documents_and_key_stays_out_of_storage_and_archives(self):
        self.settings()
        self.page.evaluate('''() => {window.aiRequests=[];window.fetch=async(url,options)=>{
          window.aiRequests.push({url,body:JSON.parse(options.body)});
          return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify({property:{city:'Reviewed city'}})}]}]}),{status:200,headers:{'Content-Type':'application/json'}});
        };}''')
        self.page.get_by_label('AI Provider', exact=True).select_option('openai')
        self.page.get_by_label('API Key', exact=True).fill('test-key-session-only')
        self.page.get_by_role('button', name='Use AI Setup', exact=True).click()
        self.assertEqual(self.page.evaluate('window.aiRequests.length'), 0)
        self.assertTrue(self.page.evaluate('basisAIStatus().configured'))
        self.page.get_by_label('AI Provider', exact=True).select_option('anthropic')
        self.assertEqual(self.page.get_by_label('AI Model', exact=True).input_value(), 'claude-sonnet-4-5')
        self.page.get_by_label('AI Provider', exact=True).select_option('openai')
        self.assertEqual(self.page.get_by_label('AI Model', exact=True).input_value(), 'gpt-4.1')
        self.page.get_by_role('button', name='Use AI Setup', exact=True).click()
        self.assertTrue(self.page.evaluate('basisAIStatus().configured'))
        self.assertEqual(self.page.get_by_label('API Key', exact=True).input_value(), '')
        self.assertFalse(self.page.evaluate('''() => {
          const needle='test-key-session-only';
          return JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage),S,PW.ix,basisAIStatus()]).includes(needle);
        }'''))
        archive = harness.BrowserTests.archive(self, "({kind:'property',model:S})")
        self.assertNotIn(b'test-key-session-only', archive.read_bytes())
        self.page.get_by_role('button', name='Open Document Import', exact=True).click()
        self.page.get_by_text('Or paste text (an email, a copied table)', exact=True).click()
        self.page.locator('#pfpage textarea').fill('Fixture lease. Property city: Reviewed city.')
        self.page.get_by_role('button', name='Add as a document', exact=True).click()
        self.page.wait_for_function('INT.docs.some(d=>d.status==="ready")')
        self.assertEqual(self.page.evaluate('window.aiRequests.length'), 0)
        self.page.get_by_role('button', name='Extract with OpenAI', exact=True).click()
        self.page.wait_for_function('!!INT.x && !INT.busy')
        expect(self.page.locator('#pfpage')).to_contain_text('No validation issues found')
        expect(self.page.locator('#pfpage')).not_to_contain_text("lines agree with the documents' totals")
        self.assertEqual(self.page.evaluate('window.aiRequests.length'), 1)
        self.assertNotEqual(self.page.evaluate('S.city'), 'Reviewed city')
        self.page.get_by_role('button', name='Apply selected', exact=True).click()
        self.page.wait_for_function("S.city==='Reviewed city'")
        self.assertTrue(self.page.evaluate('S.srcLog.some(row=>row.target==="Property · city")'))
        self.ready_after_reload()
        self.assertFalse(self.page.evaluate('basisAIStatus().configured'))

    def test_workspace_import_requires_a_property_in_the_selected_portfolio(self):
        self.page.evaluate('''async () => {
          const id=await pwCreatePortfolio('Empty portfolio');pwSetPf(id);studioOpenDocumentImport();
        }''')
        expect(self.page.locator('#pfpage')).to_contain_text('Open a property in this portfolio and scenario')
        expect(self.page.get_by_role('button', name='Choose a Property', exact=True)).to_be_visible()
        self.assertEqual(self.page.locator('#pfpage input[type=file]').count(), 0)

    def test_delayed_host_detection_refreshes_workspace_settings(self):
        self.page.add_init_script('''window.claude={use:name=>name==='sample'?new Promise(resolve=>{window.resolveHost=resolve;}):Promise.resolve(null)};''')
        self.ready_after_reload()
        self.settings()
        expect(self.page.locator('#basisWorkspaceSettings')).to_contain_text('No compatible host AI service detected')
        self.page.evaluate('window.resolveHost({json:async()=>({property:{city:"Fixture city"}})})')
        expect(self.page.locator('#basisWorkspaceSettings')).to_contain_text('Ready: Host Integration')


if __name__ == '__main__':
    unittest.main()
