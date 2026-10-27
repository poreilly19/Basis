"""Atomic library action UI tests: python3 tests/library_actions_browser_test.py."""
import unittest

from playwright.sync_api import expect

import browser_test as support


class LibraryActionsBrowserTests(unittest.TestCase):
    setUpClass = classmethod(support.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(support.BrowserTests.tearDownClass.__func__)
    tearDown = support.BrowserTests.tearDown

    def setUp(self):
        support.BrowserTests.setUp(self)
        self.fixture = self.page.evaluate('''async () => {
          S.name='First active';await pwSaveCur();
          const first=PW.cur,pf=PW.pf,base=PW.sc;
          const second=await pwAdopt({...blankState(),name:'Second source'},{quiet:true});
          const spare=await pwCreateScenario(pf,base,'Spare scenario',false);
          const destination=await pwCreatePortfolio('Destination portfolio');
          const destinationScenario=pwPf(destination).scs[0].id;
          PWV.sub='members';setMode('portfolio');drawPane();
          window.actionFixture={first,second,pf,base,spare,destination,destinationScenario};
          return window.actionFixture;
        }''')
        expect(self.page.locator('.pwhead')).to_be_visible()

    def snapshot(self):
        return self.page.evaluate('''async () => {
          await PW.q;
          const keys=await pwTx('readonly',store=>store.getAllKeys());
          const storage=[];for(const key of keys)storage.push([key,await pwGet(key)]);
          return {live:JSON.stringify({ix:PW.ix,cur:PW.cur,pf:PW.pf,sc:PW.sc,model:S}),storage};
        }''')

    def fail_next_commit(self, message):
        self.page.evaluate('''message => {
          const original=pwCommit;
          pwCommit=async(...args)=>{pwCommit=original;throw Error(message);};
        }''', message)

    def error_notice(self, message):
        notice = self.page.get_by_role('alertdialog').filter(has_text=message)
        expect(notice).to_be_visible()
        return notice

    def dirty_current_model(self):
        self.page.evaluate('''() => {
          S.unsavedActionMarker='Keep these local edits';
          PW.local.edited=Date.now();pwCaptureDraft(JSON.stringify(S));
        }''')

    def assert_visible_originals(self):
        expect(self.page.locator('.pwhead').get_by_label('Portfolio')).to_have_value(self.fixture['pf'])
        expect(self.page.locator('.pwhead').get_by_label('Scenario')).to_have_value(self.fixture['base'])
        grid=self.page.locator('.basis-workspace-main')
        expect(grid.get_by_role('button', name='First active', exact=True)).to_be_visible()
        expect(grid.get_by_role('button', name='Second source', exact=True)).to_be_visible()

    def test_failed_portfolio_delete_preserves_visible_library_and_dirty_current_model(self):
        self.dirty_current_model()
        before = self.snapshot()
        self.fail_next_commit('Injected portfolio delete failure')
        self.page.locator('.pwhead').get_by_role('button', name='Delete', exact=True).nth(0).click()
        confirmation = self.page.get_by_role('alertdialog').filter(has_text='Delete the portfolio')
        expect(confirmation).to_be_visible()
        confirmation.get_by_role('button', name='Delete', exact=True).click()
        notice = self.error_notice('Injected portfolio delete failure')
        self.assertEqual(self.snapshot(), before)
        notice.get_by_role('button', name='OK', exact=True).click()
        self.assert_visible_originals()

    def test_failed_scenario_delete_preserves_visible_library_and_dirty_current_model(self):
        self.dirty_current_model()
        before = self.snapshot()
        self.fail_next_commit('Injected scenario delete failure')
        self.page.locator('.pwhead').get_by_role('button', name='Delete', exact=True).nth(1).click()
        confirmation = self.page.get_by_role('alertdialog').filter(has_text='Delete the scenario')
        expect(confirmation).to_be_visible()
        confirmation.get_by_role('button', name='Delete', exact=True).click()
        notice = self.error_notice('Injected scenario delete failure')
        self.assertEqual(self.snapshot(), before)
        notice.get_by_role('button', name='OK', exact=True).click()
        self.assert_visible_originals()

    def test_later_model_failure_in_new_scenario_copy_leaves_no_partial_scenario(self):
        before = self.snapshot()
        self.page.evaluate('''() => {
          const original=pwPrepareModel;window.preparedActionModels=[];
          pwPrepareModel=async(id,json,...args)=>{
            const name=JSON.parse(json).name;window.preparedActionModels.push(name);
            if(name==='Second source'){pwPrepareModel=original;throw Error('Injected later copy model failure');}
            return original(id,json,...args);
          };
        }''')
        self.page.locator('.pwhead').get_by_role('button', name='New', exact=True).nth(1).click()
        dialog = self.page.get_by_role('dialog', name='New Scenario', exact=True)
        dialog.get_by_label('Scenario name').fill('Must not partially exist')
        expect(dialog.get_by_role('checkbox')).to_be_checked()
        dialog.get_by_role('button', name='OK', exact=True).click()
        notice = self.error_notice('Injected later copy model failure')
        self.assertEqual(self.snapshot(), before)
        self.assertIn('First active', self.page.evaluate('window.preparedActionModels'))
        self.assertIn('Second source', self.page.evaluate('window.preparedActionModels'))
        notice.get_by_role('button', name='OK', exact=True).click()
        self.assert_visible_originals()
        expect(self.page.locator('.pwhead').get_by_label('Scenario').get_by_role(
            'option', name='Must not partially exist', exact=True)).to_have_count(0)

    def test_failed_rename_and_move_keep_original_names_membership_and_selection(self):
        before = self.snapshot()
        self.fail_next_commit('Injected rename failure')
        self.page.locator('.pwhead').get_by_role('button', name='Rename', exact=True).nth(0).click()
        dialog = self.page.get_by_role('dialog', name='Rename Portfolio', exact=True)
        dialog.get_by_label('Portfolio name').fill('Must not replace original')
        dialog.get_by_role('button', name='OK', exact=True).click()
        notice = self.error_notice('Injected rename failure')
        self.assertEqual(self.snapshot(), before)
        notice.get_by_role('button', name='OK', exact=True).click()
        self.page.get_by_role('checkbox', name='Check First active', exact=True).check()
        before = self.snapshot()
        self.fail_next_commit('Injected move failure')
        self.page.get_by_role('button', name='Move to…', exact=True).click()
        dialog = self.page.get_by_role('dialog', name='Move 1 property to', exact=True)
        dialog.get_by_label('Portfolio', exact=True).select_option(self.fixture['destination'])
        dialog.get_by_label('Scenario', exact=True).select_option(self.fixture['destinationScenario'])
        dialog.get_by_role('button', name='Move', exact=True).click()
        notice = self.error_notice('Injected move failure')
        self.assertEqual(self.snapshot(), before)
        notice.get_by_role('button', name='OK', exact=True).click()
        self.assert_visible_originals()
        expect(self.page.get_by_role('checkbox', name='Check First active', exact=True)).to_be_checked()

    def test_property_arriving_during_delete_confirmation_requires_new_confirmation(self):
        self.page.locator('.pwhead').get_by_role('button', name='Delete', exact=True).nth(0).click()
        confirmation = self.page.get_by_role('alertdialog').filter(has_text='Delete the portfolio')
        expect(confirmation).to_be_visible()
        self.page.evaluate('''async () => {
          await pwAdopt({...blankState(),name:'Arrived during confirmation'},
            {quiet:true,pf:actionFixture.pf,sc:actionFixture.base});drawPane();
        }''')
        before = self.snapshot()
        confirmation.get_by_role('button', name='Delete', exact=True).click()
        notice = self.error_notice('changed while confirmation was open')
        self.assertEqual(self.snapshot(), before)
        notice.get_by_role('button', name='OK', exact=True).click()
        self.assert_visible_originals()
        expect(self.page.locator('.basis-workspace-main').get_by_role('button', name='Arrived during confirmation', exact=True)).to_be_visible()
        self.assertEqual(self.page.evaluate('''async () => {
          for(const property of PW.ix.props)if(!(await pwGetModel(property.id,property)))return false;
          return true;
        }'''), True)

    def test_async_dialog_submission_runs_only_once(self):
        self.page.evaluate('''() => {
          window.actionDialogCalls=0;
          window.actionDialogResult=pwDialog({title:'Async submission probe',
            body:[el('input',{type:'text','aria-label':'Probe value',value:'Ready'})],
            onOk:async()=>{window.actionDialogCalls++;await new Promise(resolve=>{
              window.releaseActionDialog=resolve;});return true;}});
        }''')
        dialog = self.page.get_by_role('dialog', name='Async submission probe', exact=True)
        button = dialog.get_by_role('button', name='OK', exact=True)
        button.evaluate('(element)=>{element.click();element.click();}')
        dialog.get_by_label('Probe value').press('Enter')
        expect(button).to_be_disabled()
        self.assertEqual(self.page.evaluate('window.actionDialogCalls'), 1)
        self.page.evaluate('window.releaseActionDialog()')
        expect(dialog).not_to_be_visible()
        self.assertEqual(self.page.evaluate('window.actionDialogResult'), True)
        self.assertEqual(self.page.evaluate('window.actionDialogCalls'), 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
