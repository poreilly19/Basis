"""Startup and saved-library recovery checks against the served application."""
import unittest

from playwright.sync_api import expect

import browser_test as support


class InitializationBrowserTests(unittest.TestCase):
    setUpClass = classmethod(support.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(support.BrowserTests.tearDownClass.__func__)
    setUp = support.BrowserTests.setUp
    tearDown = support.BrowserTests.tearDown

    def reload_ready(self):
        self.page.reload()
        self.page.evaluate('PW.ready')
        self.page.evaluate('PW.q')
        self.page.wait_for_function('document.querySelector("#startup").hidden')

    def test_deleting_the_last_property_does_not_recreate_the_starter_on_reload(self):
        removed = self.page.evaluate('''async () => {
          const id=PW.cur;await pwRemove([id]);
          return {id,revision:(await pwGet('pw_index')).rev};
        }''')
        self.reload_ready()
        result = self.page.evaluate('''async id => ({cur:PW.cur,kind:PWS.kind,
          count:PW.ix.props.length,index:await pwGet('pw_index'),
          removedHeader:await pwGet('pwm_'+id)})''', removed['id'])
        self.assertEqual(result['count'], 0)
        self.assertIsNone(result['cur'])
        self.assertEqual(result['kind'], 'idb')
        self.assertEqual(result['index']['rev'], removed['revision'])
        self.assertEqual(result['index']['props'], [])
        self.assertIsNone(result['removedHeader'])
        expect(self.page.get_by_role('button', name='Recover drafts', exact=True)).to_be_visible()

    def test_corrupt_index_starts_a_writable_recovery_workspace_without_replacing_source(self):
        invalid = {'v': 1, 'rev': 'corrupt-source', 'pfs': 'invalid', 'props': []}
        self.page.evaluate("index => pwTx('readwrite',st=>st.put(index,'pw_index'))", invalid)
        self.reload_ready()
        self.assertEqual(self.page.evaluate('PWS.kind'), 'memory')
        self.assertIsNone(self.page.evaluate('PW.rev'))
        self.assertIsNone(self.page.evaluate('PW.cur'))
        self.assertIn('recovery is in memory', self.page.evaluate('PW.status'))
        recovered = self.page.evaluate('''() => pwAdopt({...blankState(),name:'Recovered locally'},
          {quiet:true})''')
        result = self.page.evaluate('''async id => ({source:await pwGet('pw_index',PW.recoverySource),
          local:PW.ix.props.find(p=>p.id===id),stored:await pwGetModel(id)})''', recovered)
        self.assertEqual(result['source'], invalid)
        self.assertEqual(result['local']['name'], 'Recovered locally')
        self.assertIn('Recovered locally', result['stored']['json'])

    def test_reload_can_open_a_healthy_source_property_after_the_current_one_is_missing(self):
        prepared = self.page.evaluate('''async () => {
          const missing=PW.cur;
          const healthy=await pwAdopt({...blankState(),name:'Healthy saved property'},{quiet:true});
          const revision=(await pwGet('pw_index')).rev;
          await pwTx('readwrite',st=>st.delete('pwm_'+missing));
          return {missing,healthy,revision};
        }''')
        self.reload_ready()
        self.assertEqual(self.page.evaluate('PWS.kind'), 'memory')
        self.assertTrue(self.page.evaluate('pwRefreshLibrary()'))
        result = self.page.evaluate('''async () => ({kind:PWS.kind,cur:PW.cur,name:S.name,
          unavailable:PW.unavailable,index:await pwGet('pw_index')})''')
        self.assertEqual(result['kind'], 'idb')
        self.assertEqual(result['cur'], prepared['healthy'])
        self.assertEqual(result['name'], 'Healthy saved property')
        self.assertEqual(result['index']['rev'], prepared['revision'])
        self.assertEqual(len(result['index']['props']), 2)
        self.assertEqual(result['unavailable'][0]['id'], prepared['missing'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
