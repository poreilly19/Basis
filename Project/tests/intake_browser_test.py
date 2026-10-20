"""Document lifecycle tests using a local fake extraction service only."""
import unittest
import browser_test as harness


class IntakeBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp = harness.BrowserTests.setUp
    tearDown = harness.BrowserTests.tearDown

    def seed(self, response):
        self.page.evaluate('''response => {
          INT.docs=[{id:'doc',name:'Local test document',kind:'Text',on:true,status:'ready',
            pages:[{n:1,text:'Fixture text'}],images:[],results:[],err:'',warn:''}];
          _intLim={maxPromptBytes:150000};
          _sample={json:async()=>response};getSample=async()=>_sample;
          setMode('inputs');go('tools','import');
        }''', response)

    def test_double_start_stop_and_late_response_keep_new_run_owned(self):
        self.seed({'property': {'city': 'Extracted city'}})
        result = self.page.evaluate('''async () => {
          let calls=0,release;_sample.json=()=>{calls++;return new Promise(r=>{release=r;});};
          const old=intExtract(),duplicate=intExtract();await new Promise(r=>setTimeout(r,0));
          const single=calls===1&&INT.busy;intStopExtraction();const stopped=!INT.busy&&!INT.x;
          _sample.json=async()=>({property:{city:'New result'}});await intExtract();
          const current=INT.x;release({property:{city:'Obsolete result'}});await old;await duplicate;
          return {single,stopped,owned:INT.x===current,city:INT.x.property.city.v,busy:INT.busy};
        }''')
        self.assertTrue(result['single'] and result['stopped'] and result['owned'])
        self.assertEqual(result['city'], 'New result')
        self.assertFalse(result['busy'])

    def test_switching_property_during_extraction_blocks_late_application(self):
        second = self.page.evaluate("pwAdopt({...blankState(),name:'Second property'})")
        self.seed({'property': {'city': 'Wrong city'}})
        result = self.page.evaluate('''async second => {
          let release;_sample.json=()=>new Promise(r=>{release=r;});
          const pending=intExtract();await new Promise(r=>setTimeout(r,0));
          await pwOpen(second);const before=JSON.stringify(S);release({property:{city:'Wrong city'}});await pending;
          return {unchanged:JSON.stringify(S)===before,blocked:!INT.x&&!INT.busy,city:S.city,error:INT.err};
        }''', self.page.evaluate('PW.ix.props.find(p=>p.id!==PW.cur).id'))
        self.assertTrue(result['unchanged'] and result['blocked'])
        self.assertNotEqual(result['city'], 'Wrong city')
        self.assertIn('changed', result['error'])

    def test_invalid_apply_rolls_back_and_success_keeps_source_log(self):
        self.seed({'property': {'city': 'Safe city'}, 'valuation': {'holdYears': 100000}})
        self.page.evaluate('intExtract()')
        before = self.page.evaluate('JSON.stringify(S)')
        self.page.evaluate('window.confirm=()=>true')
        self.page.get_by_role('button', name='Apply selected', exact=True).click()
        self.page.wait_for_function('!INT.applying && !!INT.err')
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'), before)
        self.assertIn('years', self.page.evaluate('INT.err').lower())
        self.page.evaluate('''async () => {
          INT.pick['v:holdYears']=false;await intApplySelected();
        }''')
        self.assertEqual(self.page.evaluate('S.city'), 'Safe city')
        self.assertTrue(self.page.evaluate('S.srcLog.some(r=>r.target==="Property · city")'))

    def test_replace_commits_final_copy_and_preserves_original(self):
        original = self.page.evaluate('PW.cur')
        original_json = self.page.evaluate('JSON.stringify(S)')
        self.seed({'property': {'city': 'City on copy'}})
        self.page.evaluate("async()=>{await intExtract();INT.mode='replace';window.confirm=()=>true;}")
        self.page.get_by_role('button', name='Apply selected', exact=True).click()
        self.page.wait_for_function('!INT.applying && PW.ix.props.length===2')
        self.assertNotEqual(self.page.evaluate('PW.cur'), original)
        self.assertEqual(self.page.evaluate('S.city'), 'City on copy')
        self.assertEqual(self.page.evaluate('id=>pwGetModel(id).then(m=>m.json)', original), original_json)
        self.assertEqual(self.page.evaluate('pwGetModel(PW.cur).then(m=>JSON.parse(m.json).city)'), 'City on copy')


    def test_scenario_switch_with_same_property_invalidates_extraction(self):
        self.seed({'property': {'city': 'Wrong scenario result'}})
        result = self.page.evaluate('''async () => {
          const originalSc=PW.sc,empty=await pwCreateScenario(PW.pf,PW.sc,'Empty scenario',false);
          let release;_sample.json=()=>new Promise(r=>{release=r;});const pending=intExtract();
          await new Promise(r=>setTimeout(r,0));const before=JSON.stringify(S),cur=PW.cur;
          pwSetSc(empty);release({property:{city:'Wrong scenario result'}});await pending;
          return {same:JSON.stringify(S)===before&&PW.cur===cur,scChanged:PW.sc!==originalSc,
            blocked:!INT.x&&!INT.busy,error:INT.err};
        }''')
        self.assertTrue(result['same'] and result['scChanged'] and result['blocked'])
        self.assertIn('changed', result['error'])

    def test_edits_during_copy_commit_stay_active_and_copy_is_complete(self):
        self.seed({'property': {'city': 'City on final copy'}})
        self.page.evaluate("async()=>{await intExtract();INT.mode='replace';window.confirm=()=>true;}")
        result = self.page.evaluate('''async () => {
          const current=PW.cur,commit=pwCommit;let release;
          pwCommit=async(...args)=>{await new Promise(r=>{release=r;});return commit(...args);};
          const applying=intApplySelected();while(!release)await new Promise(r=>setTimeout(r,0));
          S.name='Typed while copy saves';DIRTY();release();await applying;pwCommit=commit;
          const copy=PW.ix.props.find(p=>p.id!==current),saved=await pwGetModel(copy.id);
          return {kept:PW.cur===current&&S.name==='Typed while copy saves',
            finalCopy:JSON.parse(saved.json).city==='City on final copy',reviewKept:!!INT.x,
            done:!INT.applying};
        }''')
        self.assertTrue(all(result.values()), result)


if __name__ == '__main__':
    unittest.main(verbosity=2)
