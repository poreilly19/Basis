"""Focused recovery-dialog tests: python3 tests/recovery_browser_test.py."""
import unittest

from playwright.sync_api import expect

import browser_test as support


class RecoveryBrowserTests(unittest.TestCase):
    setUpClass = classmethod(support.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(support.BrowserTests.tearDownClass.__func__)
    setUp = support.BrowserTests.setUp
    tearDown = support.BrowserTests.tearDown

    def seed(self, names):
        return self.page.evaluate('''names => names.map(name => {
          const source=basisCreateRecoveryStore({local:localStorage,
            session:{getItem:()=>null,setItem(){}},validateModel:basisValidateModel});
          return source.capture(JSON.stringify({...S,name}),{propertyId:PW.cur}).id;
        })''', names)

    def open_recovery(self):
        self.page.evaluate('setMode("portfolio")')
        support.open_library_actions(self.page)
        self.page.get_by_role('button', name='Recover drafts', exact=True).click()
        dialog = self.page.get_by_role('dialog', name='Recovery drafts', exact=True)
        expect(dialog).to_be_visible()
        return dialog

    def test_restoration_creates_a_new_property_and_renders_names_as_text(self):
        hostile = '<img src=x onerror="window.recoveryInjected=true">'
        names = ['Crash ' + hostile, 'Other draft']
        ids = self.seed(names)
        before = self.page.evaluate('({cur:PW.cur,model:JSON.stringify(S),count:PW.ix.props.length})')
        dialog = self.open_recovery()
        expect(dialog.get_by_role('heading', name=names[0], exact=True)).to_be_visible()
        expect(dialog.locator('img')).to_have_count(0)
        self.assertFalse(self.page.evaluate('Boolean(window.recoveryInjected)'))
        row = dialog.get_by_role('article', name=names[0], exact=True)
        row.get_by_role('button', name='Restore as new property', exact=True).click()
        expect(dialog.get_by_role('status')).to_contain_text('Restored as')
        self.assertEqual(self.page.evaluate('PW.ix.props.length'), before['count'] + 1)
        self.assertEqual(self.page.evaluate('PW.cur'), before['cur'])
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'), before['model'])
        self.assertEqual(self.page.evaluate('pwRecoveryList().map(d=>d.id).sort()'), sorted(ids))
        self.assertEqual(self.page.evaluate('PW.ix.props.at(-1).name'), names[0] + ' (recovered)')
        dialog.get_by_role('button', name='Close recovery', exact=True).click()
        expect(self.page.get_by_role('button', name='Recover drafts', exact=True)).to_be_focused()

    def test_discard_requires_confirmation_and_removes_only_the_selected_draft(self):
        ids = self.seed(['First draft', 'Second draft'])
        count = self.page.evaluate('PW.ix.props.length')
        dialog = self.open_recovery()
        row = dialog.get_by_role('article', name='First draft', exact=True)
        expect(row.get_by_role('button', name='Confirm discard', exact=True)).not_to_be_visible()
        row.get_by_role('button', name='Discard draft', exact=True).click()
        row.get_by_role('button', name='Cancel discard', exact=True).click()
        self.assertEqual(self.page.evaluate('pwRecoveryList().length'), 2)
        row.get_by_role('button', name='Discard draft', exact=True).click()
        row.get_by_role('button', name='Confirm discard', exact=True).click()
        expect(dialog.get_by_role('status')).to_have_text('Recovery draft discarded.')
        self.assertEqual(self.page.evaluate('pwRecoveryList().map(d=>d.id)'), [ids[1]])
        self.assertEqual(self.page.evaluate('PW.ix.props.length'), count)

    def test_restore_failures_are_visible_and_leave_the_source_available(self):
        self.seed(['Preserve me'])
        self.page.evaluate('() => {pwRecoveryRestore=async()=>{throw Error("Simulated recovery failure");};}')
        dialog = self.open_recovery()
        dialog.get_by_role('button', name='Restore as new property', exact=True).click()
        expect(dialog.get_by_role('alert').filter(has_text='Simulated recovery failure')).to_be_visible()
        self.assertEqual(self.page.evaluate('pwRecoveryList().length'), 1)
        expect(dialog.get_by_role('button', name='Restore as new property', exact=True)).to_be_enabled()

    def test_quota_warning_and_memory_only_candidate_are_visible(self):
        self.page.evaluate('''() => {
          const blocked={get length(){return localStorage.length;},key:i=>localStorage.key(i),
            getItem:k=>localStorage.getItem(k),removeItem:k=>localStorage.removeItem(k),
            setItem(){throw Error('Simulated draft quota');}};
          PW.drafts=basisCreateRecoveryStore({local:blocked,session:sessionStorage,
            validateModel:basisValidateModel});
          PW.drafts.capture(JSON.stringify({...S,name:'Memory draft'}),{propertyId:PW.cur});
        }''')
        dialog = self.open_recovery()
        expect(dialog.get_by_role('alert').filter(has_text='Simulated draft quota')).to_be_visible()
        expect(dialog.get_by_role('article', name='Memory draft').get_by_text(
            'Memory only. Export before closing this page.', exact=True)).to_be_visible()

    def test_unreadable_drafts_cannot_restore_and_keyboard_focus_stays_in_dialog(self):
        self.page.evaluate('localStorage.setItem("basis.draft.v1.broken", "{malformed")')
        dialog = self.open_recovery()
        row = dialog.get_by_role('article', name='Unreadable recovery draft', exact=True)
        expect(row.get_by_role('button', name='Restore as new property', exact=True)).to_be_disabled()
        for _ in range(8):
            self.page.keyboard.press('Tab')
            self.assertTrue(self.page.evaluate('''document.querySelector(
                '#basisRecoveryDialog [role=dialog]').contains(document.activeElement)'''))
        self.page.keyboard.press('Escape')
        expect(dialog).not_to_be_visible()
        expect(self.page.get_by_role('button', name='Recover drafts', exact=True)).to_be_focused()


    def test_two_real_tabs_keep_independent_unsaved_snapshots(self):
        second = self.context.new_page()
        second.goto(self.url)
        second.evaluate('PW.ready')
        a = self.page.evaluate("PW.drafts.capture(JSON.stringify({...S,name:'Unsaved first tab'}),{propertyId:PW.cur})")
        b = second.evaluate("PW.drafts.capture(JSON.stringify({...S,name:'Unsaved second tab'}),{propertyId:PW.cur})")
        self.assertNotEqual(a['id'], b['id'])
        for page in (self.page, second):
            self.assertEqual(sorted(page.evaluate('pwRecoveryList().map(d=>d.name)')),
                             ['Unsaved first tab', 'Unsaved second tab'])
        self.page.evaluate("PW.drafts.capture(JSON.stringify({...S,name:'Later first edits'}),{propertyId:PW.cur})")
        second.wait_for_function("pwRecoveryList().some(draft=>draft.name==='Later first edits')")
        self.assertEqual(sorted(second.evaluate('pwRecoveryList().map(d=>d.name)')),
                         ['Later first edits', 'Unsaved second tab'])
        second.close()

    def test_legacy_snapshot_is_offered_without_replacing_saved_property(self):
        before = self.page.evaluate("({cur:PW.cur,json:JSON.stringify(S),count:PW.ix.props.length})")
        legacy = self.page.evaluate("JSON.stringify({...S,name:'Legacy unsaved snapshot'})")
        self.page.evaluate('value=>localStorage.setItem("basis.model",value)', legacy)
        self.page.reload()
        self.page.evaluate('PW.ready')
        self.assertEqual(self.page.evaluate('PW.cur'), before['cur'])
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'), before['json'])
        self.assertEqual(self.page.evaluate('PW.ix.props.length'), before['count'])
        self.assertEqual(self.page.evaluate('localStorage.getItem("basis.model")'), legacy)
        dialog = self.open_recovery()
        expect(dialog.get_by_role('article', name='Legacy unsaved snapshot', exact=True)).to_be_visible()

    def test_draft_exports_without_writing_library_or_removing_source(self):
        from pathlib import Path
        ids = self.seed(['Export this draft'])
        before = self.page.evaluate('JSON.stringify({ix:PW.ix,cur:PW.cur,model:S})')
        dialog = self.open_recovery()
        with self.page.expect_download() as download:
            dialog.get_by_role('article', name='Export this draft', exact=True).get_by_role(
                'button', name='Export draft .basiscre', exact=True).click()
        path = Path(self.tmp.name) / 'draft.basiscre'
        download.value.save_as(path)
        self.assertEqual(support.BrowserTests.read_archive(self, path)['model']['name'], 'Export this draft')
        self.assertEqual(self.page.evaluate('JSON.stringify({ix:PW.ix,cur:PW.cur,model:S})'), before)
        self.assertEqual(self.page.evaluate('pwRecoveryList().map(d=>d.id)'), ids)

    def test_reload_confirmation_keeps_edits_when_save_and_edit_clocks_collide(self):
        for clock in [1000, 999, 0]:
            with self.subTest(edit_clock=clock):
                saved_name = self.page.evaluate('''async () => {
                  Date.now=()=>1000;await pwSaveCur();
                  setMode('inputs');go('property','desc');return S.name;
                }''')
                self.page.evaluate('value=>{Date.now=()=>value;}', clock)
                name = f'Unsaved edits at clock {clock}'
                name_input = self.page.locator('#pane .f').filter(
                    has=self.page.get_by_text('Property Name', exact=True)).locator('input')
                name_input.fill(name)
                name_input.press('Tab')
                self.assertEqual(self.page.evaluate('S.name'), name)
                self.page.evaluate('''() => {
                  clearTimeout(PW.timer);PW.timer=null;setMode('portfolio');
                }''')
                support.open_library_actions(self.page)
                self.page.get_by_role('button', name='Reload library', exact=True).click()
                dialog = self.page.get_by_role('alertdialog')
                expect(dialog).to_contain_text("discard this tab's unsaved edits")
                dialog.get_by_role('button', name='Cancel', exact=True).click()
                self.assertEqual(self.page.evaluate('S.name'), name)
                self.assertEqual(self.page.evaluate('pwGetModel(PW.cur).then(saved=>JSON.parse(saved.json).name)'), saved_name)
                self.assertEqual(self.page.evaluate('PW.drafts.get(PW.drafts.writerId).model.name'), name)
                self.assertGreater(self.page.evaluate('PW.local.edited'), 0)
        self.page.evaluate('pwSaveCur()')
        self.assertEqual(self.page.evaluate('PW.local.edited'), 0)
        self.assertTrue(self.page.evaluate('pwRefreshLibrary()'))
        expect(self.page.get_by_role('alertdialog')).to_have_count(0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
