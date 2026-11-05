"""Desktop adapters exercised in Chromium with a scoped fake native boundary.

These complement the Rust tests and Windows installer checks; they do not claim
to launch WebView2 or contact a live AI provider.
"""
import copy
import json
import tempfile
import unittest

from playwright.sync_api import expect
import browser_test as harness


class DesktopBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    tearDown = harness.BrowserTests.tearDown

    def setUp(self):
        self.state = {'schemaVersion': 1, 'revision': '0', 'entries': {}}
        self.keys, self.commands, self.backups = {}, [], []
        self.closes, self.fail_commits = 0, False

        def native(_source, command, args):
            self.commands.append((command, copy.deepcopy(args)))
            if command == 'desktop_store_read':
                return copy.deepcopy(self.state)
            if command == 'desktop_store_commit':
                if self.fail_commits:
                    raise RuntimeError('Fixture disk full')
                if args['expectedRevision'] != self.state['revision']:
                    raise RuntimeError('Workspace changed')
                updated = copy.deepcopy(self.state['entries'])
                for key in args['deletes']:
                    updated.pop(key, None)
                updated.update(copy.deepcopy(args['puts']))
                self.state = {'schemaVersion': 1, 'revision': str(int(self.state['revision']) + 1), 'entries': updated}
                return copy.deepcopy(self.state)
            if command == 'desktop_store_info':
                return {'dataDirectory': r'C:\BasisTest\Data', 'backupDirectory': r'C:\BasisTest\Backups', 'backups': self.backups}
            if command == 'desktop_key_store':
                self.keys[args['provider']] = args['apiKey']
                return None
            if command == 'desktop_key_status':
                return args['provider'] in self.keys
            if command == 'desktop_key_delete':
                self.keys.pop(args['provider'], None)
                return None
            if command == 'desktop_ai_request':
                if 'apiKey' not in args and args['provider'] not in self.keys:
                    raise RuntimeError('No saved key')
                return {'status': 200, 'body': json.dumps({'output': [{'content': [{'type': 'output_text', 'text': '{"basis":"ok"}'}]}]})}
            if command == 'desktop_backup_create':
                self.backups.append({'name': 'workspace-test.json', 'createdMs': 1, 'bytes': 123})
                return 'workspace-test.json'
            if command == 'desktop_open_backup_folder':
                return None
            if command == 'desktop_save_file':
                return 'declined'
            if command == 'fixture_close':
                self.closes += 1
                return None
            raise RuntimeError('Unexpected native command: ' + command)

        self.context = self.browser.new_context(accept_downloads=True)
        self.context.route('https://**/*', lambda route: route.abort())
        self.context.expose_binding('__fixtureNative', native)
        self.context.add_init_script('''window.__TAURI__={
          core:{invoke:(command,args={})=>window.__fixtureNative(command,args)},
          window:{getCurrentWindow:()=>({
            onCloseRequested:async callback=>{window.__desktopCloseHandler=callback;return ()=>{};},
            close:()=>window.__fixtureNative('fixture_close',{})
          })}
        };''')
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.tmp = tempfile.TemporaryDirectory()
        self.page.goto(self.url)
        self.ready()

    def ready(self):
        self.page.evaluate('PW.ready')
        self.page.wait_for_function('PW.cur && document.querySelector("#startup").hidden && !!window.__desktopCloseHandler')
        self.assertEqual(self.page.evaluate('PWS.kind'), 'desktop')

    def settings(self):
        self.page.evaluate('studioOpenSettings()')
        expect(self.page.locator('#basisWorkspaceSettings')).to_be_visible()

    def test_native_library_persists_after_reload_and_manual_backup_saves_current_edits(self):
        self.settings()
        self.page.get_by_label('Autosave While Editing', exact=True).uncheck()
        self.page.evaluate("S.city='Desktop current edits';DIRTY()")
        self.page.get_by_role('button', name='Back Up Workspace Now', exact=True).click()
        expect(self.page.locator('[data-desktop-settings]')).to_contain_text('Backup created: workspace-test.json')
        self.assertEqual(self.page.evaluate('pwGetModel(PW.cur).then(row=>JSON.parse(row.json).city)'), 'Desktop current edits')
        self.assertEqual(len(self.backups), 1)
        self.page.reload()
        self.ready()
        self.assertEqual(self.page.evaluate('S.city'), 'Desktop current edits')
        self.assertFalse(self.page.evaluate('PW.local.edited'))
        self.assertGreaterEqual(len([command for command, _args in self.commands if command == 'desktop_store_commit']), 2)

    def test_native_credential_opt_in_restores_without_putting_key_in_workspace(self):
        self.settings()
        self.page.get_by_label('AI Provider', exact=True).select_option('openai')
        self.page.get_by_label('API Key', exact=True).fill('desktop-fixture-private-key')
        self.page.get_by_role('button', name='Remember Key on This Device', exact=True).click()
        self.page.wait_for_function('basisAIStatus().configured')
        self.assertEqual(self.keys, {'openai': 'desktop-fixture-private-key'})
        self.assertFalse(self.page.evaluate("JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage),S,PW.ix,basisAIStatus()]).includes('desktop-fixture-private-key')"))
        self.assertNotIn('desktop-fixture-private-key', json.dumps(self.state))
        self.page.get_by_role('button', name='Test AI Connection', exact=True).click()
        expect(self.page.locator('[data-ai-connection-status]')).to_contain_text('Connection Successful')
        requests = [args for command, args in self.commands if command == 'desktop_ai_request']
        self.assertEqual(len(requests), 1)
        self.assertNotIn('apiKey', requests[0])
        self.assertNotIn('basis-desktop-saved-credential', json.dumps(requests))
        self.page.reload()
        self.ready()
        self.page.wait_for_function('basisAIStatus().configured')
        self.settings()
        self.page.get_by_role('button', name='Forget Saved Key', exact=True).click()
        self.page.wait_for_function('!basisAIStatus().configured')
        self.assertEqual(self.keys, {})

    def test_native_save_cancel_has_no_browser_fallback_and_close_failure_keeps_window_open(self):
        downloads = []
        self.page.on('download', lambda item: downloads.append(item))
        self.assertEqual(self.page.evaluate("offerFile('test.basiscre',new Uint8Array([1,2,3]))"), 'declined')
        self.assertEqual(downloads, [])
        self.assertEqual(len([command for command, _args in self.commands if command == 'desktop_save_file']), 1)
        self.page.evaluate("S.city='Unsaved on close';DIRTY()")
        self.fail_commits = True
        self.page.evaluate('''async()=>{window.closePrevented=0;await window.__desktopCloseHandler({preventDefault(){window.closePrevented++;}});}''')
        self.assertEqual(self.closes, 0)
        self.assertEqual(self.page.evaluate('window.closePrevented'), 1)
        self.assertTrue(self.page.evaluate('!!PW.local.edited'))
        expect(self.page.get_by_role('alertdialog')).to_contain_text('Basis stayed open because it could not save')
        self.fail_commits = False
        self.page.get_by_role('button', name='OK', exact=True).click()
        self.page.evaluate('''async()=>{await window.__desktopCloseHandler({preventDefault(){}});}''')
        self.assertEqual(self.closes, 1)
        self.assertEqual(self.page.evaluate('pwGetModel(PW.cur).then(row=>JSON.parse(row.json).city)'), 'Unsaved on close')


if __name__ == '__main__':
    unittest.main()
