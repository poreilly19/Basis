"""Task-focused workspace, settings, intake and rent-roll regressions."""
import unittest
from playwright.sync_api import expect
import browser_test as harness


class UsabilityBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp = harness.BrowserTests.setUp
    tearDown = harness.BrowserTests.tearDown

    def test_property_can_be_opened_from_first_screen_and_save_state_is_visible(self):
        self.page.set_viewport_size({'width': 1280, 'height': 720})
        button = self.page.locator('.pwgrid .pwlink').first
        bounds = button.bounding_box()
        self.assertGreaterEqual(bounds['y'], 0)
        self.assertLess(bounds['y'] + bounds['height'], 720)
        expect(self.page.locator('#pfst')).to_be_in_viewport()
        expect(self.page.locator('#subttl')).to_have_count(0)
        expected = self.page.evaluate('pwList()[0].id')
        button.click()
        self.page.wait_for_function('(id)=>PW.cur===id && MODE==="inputs"', arg=expected)
        expect(self.page.get_by_label('Property Name', exact=True)).to_be_visible()

    def test_unapplied_ai_setup_and_focus_survive_preferences_and_redraw(self):
        self.page.evaluate('studioOpenSettings()')
        provider = self.page.get_by_label('AI Provider', exact=True)
        model = self.page.get_by_label('AI Model', exact=True)
        key = self.page.get_by_label('API Key', exact=True)
        provider.select_option('openai')
        expect(self.page.locator('#basisWorkspaceSettings')).to_contain_text('Enter your OpenAI API key')
        expect(self.page.locator('#basisWorkspaceSettings')).not_to_contain_text('No compatible host')
        model.fill('review-draft-model')
        key.fill('test-draft-only-key')
        self.page.get_by_label('Autosave While Editing', exact=True).uncheck()
        self.page.get_by_label('Appearance', exact=True).select_option('dark')
        self.page.get_by_label('Fit Columns to Content', exact=True).uncheck()
        key.focus()
        self.page.evaluate('pwPageDraw()')
        expect(key).to_be_focused()
        expect(provider).to_have_value('openai')
        expect(model).to_have_value('review-draft-model')
        expect(key).to_have_value('test-draft-only-key')
        self.assertFalse(self.page.evaluate('basisAIStatus().configured'))
        self.assertFalse(self.page.evaluate("JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage),S,PW.ix,basisAIStatus()]).includes('test-draft-only-key')"))
        self.page.get_by_role('button', name='Use AI Setup', exact=True).click()
        expect(key).to_have_value('')
        expect(self.page.locator('#basisWorkspaceSettings')).to_contain_text('Configured for This Session: OpenAI')
        self.page.get_by_role('button', name='Clear API Key', exact=True).click()
        self.page.evaluate('pwPageDraw()')
        expect(key).to_have_value('')
        self.assertFalse(self.page.evaluate('basisAIStatus().configured'))

    def test_late_host_detection_does_not_replace_unapplied_provider(self):
        self.page.add_init_script("window.claude={use:name=>name==='sample'?new Promise(resolve=>{window.resolveHost=resolve;}):Promise.resolve(null)};")
        self.page.reload()
        self.page.evaluate('PW.ready')
        self.page.evaluate('studioOpenSettings()')
        self.page.get_by_label('AI Provider', exact=True).select_option('openai')
        self.page.get_by_label('API Key', exact=True).fill('test-late-host-draft')
        self.page.evaluate('window.resolveHost({json:async()=>({})})')
        self.page.wait_for_function('basisAIStatus().configured')
        expect(self.page.get_by_label('AI Provider', exact=True)).to_have_value('openai')
        expect(self.page.get_by_label('API Key', exact=True)).to_have_value('test-late-host-draft')
        expect(self.page.locator('#basisWorkspaceSettings')).to_contain_text('unapplied changes')

    def test_labels_focus_inputs_and_file_picker_is_keyboard_operable(self):
        self.page.evaluate("setMode('inputs');go('property','desc')")
        name = self.page.get_by_label('Property Name', exact=True)
        self.page.get_by_text('Property Name', exact=True).click()
        expect(name).to_be_focused()
        self.page.evaluate('studioOpenDocumentImport()')
        choose = self.page.get_by_role('button', name='Choose Files', exact=True)
        choose.focus()
        with self.page.expect_file_chooser() as chooser:
            choose.press('Enter')
        chooser.value.set_files({'name': 'keyboard-intake.txt', 'mimeType': 'text/plain',
                                'buffer': b'Original keyboard upload fixture.'})
        self.page.wait_for_function("INT.docs.some(d=>d.name==='keyboard-intake.txt'&&d.status==='ready')")

    def test_essential_columns_preserve_values_keyboard_editing_and_full_view(self):
        self.page.set_viewport_size({'width': 1440, 'height': 900})
        self.page.evaluate("setMode('inputs');go('tenants','rr')")
        view = self.page.get_by_label('Rent Roll View', exact=True)
        table = self.page.locator('#pane table.kgrid').first
        headers = table.locator('thead tr:not(.band) th:visible')
        expect(view).to_have_value('Essentials')
        expect(headers).to_have_text(['Lease', 'Name', 'Suite', 'Area', 'Start Date',
                                    'Lease Expiry', 'Base Rent Unit', 'Base Rent', 'Recovery Structure'])
        snapshot = self.page.evaluate('JSON.stringify(S)')
        view.select_option('All')
        self.assertEqual(headers.count(), 21)
        view.select_option('General')
        view.select_option('Essentials')
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'), snapshot)
        row = table.locator('tbody tr').first
        name = row.locator('td').nth(1).locator('input')
        suite = row.locator('td').nth(2).locator('input')
        name.focus()
        name.press('ArrowRight')
        expect(suite).to_be_focused()
        suite.fill('Edited suite')
        suite.press('Tab')
        self.assertEqual(self.page.evaluate('S.tenants[0].suite'), 'Edited suite')
        self.page.evaluate('studioSetPreference({autoFitColumns:false})')
        self.assertEqual(table.evaluate("n=>n.style.getPropertyValue('--basis-column-count')"), '10')
        view.select_option('All')
        self.page.evaluate("go('property','desc');go('tenants','rr')")
        expect(view).to_have_value('All')
        self.assertEqual(table.evaluate("n=>n.style.getPropertyValue('--basis-column-count')"), '22')
        self.assertEqual(self.page.evaluate('S.tenants[0].suite'), 'Edited suite')

    def test_keyboard_help_explains_manual_saves_when_autosave_is_off(self):
        self.page.evaluate("studioSetPreference({autosave:false});setMode('inputs')")
        self.page.get_by_role('button', name='Keyboard shortcuts', exact=True).click()
        dialog = self.page.get_by_role('alertdialog', name='Keyboard shortcuts', exact=True)
        expect(dialog).to_contain_text('Autosave while editing is off')
        expect(dialog).to_contain_text('Use Save Changes')
        expect(dialog).not_to_contain_text('Every change saves automatically')

    def test_workspace_save_status_distinguishes_pending_and_failed_writes(self):
        self.page.evaluate("studioSetPreference({autosave:false});S.name='Pending save';DIRTY();pwPageDraw()")
        status = self.page.locator('#pfst')
        expect(status).to_have_text('Unsaved changes')
        expect(status).to_have_attribute('data-state', 'pending')
        self.page.evaluate('''async () => {
          const original=pwCommit;
          pwCommit=async()=>{throw Error('injected usability save failure');};
          try {await pwSaveCur();}
          catch(error){if(error.message!=='injected usability save failure')throw error;}
          finally {pwCommit=original;}
        }''')
        expect(status).to_have_text('Not saved')
        expect(status).to_have_attribute('data-state', 'error')
        self.page.evaluate('pwPageDraw()')
        expect(status).to_have_attribute('data-state', 'error')
        self.page.evaluate('pwSaveCur()')
        expect(status).to_contain_text('Saved in This Browser')
        expect(status).to_have_attribute('data-state', 'saved')
        self.page.evaluate("pwStatus('Not saved: library changed');pwPageDraw()")
        expect(status).to_have_attribute('data-state', 'error')


if __name__ == '__main__':
    unittest.main()
