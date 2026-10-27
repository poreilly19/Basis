"""Offline legacy/native file lifecycle checks against the served application."""
import base64
import json
import unittest

from playwright.sync_api import expect

import browser_test as support


class LegacyFileBrowserTests(unittest.TestCase):
    setUpClass = classmethod(support.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(support.BrowserTests.tearDownClass.__func__)
    setUp = support.BrowserTests.setUp
    tearDown = support.BrowserTests.tearDown

    def test_failed_preview_open_reports_the_async_error_and_keeps_the_active_model(self):
        model = self.page.evaluate("({...blankState(),name:'Preview import that must fail'})")
        self.page.evaluate("setMode('inputs');go('tools','file')")
        self.page.locator('#pane input[type=file]').set_input_files({
            'name': 'preview.basis.json', 'mimeType': 'application/json',
            'buffer': json.dumps(model).encode('utf-8')})
        expect(self.page.locator('#pane').get_by_role(
            'button', name='Open', exact=True)).to_be_visible()
        before = self.page.evaluate('JSON.stringify({model:S,cur:PW.cur,props:PW.ix.props})')
        self.page.evaluate('''() => {
          const original=pwCommit;
          pwCommit=async(...args)=>{pwCommit=original;throw Error('Injected preview Open failure');};
        }''')
        self.page.locator('#pane').get_by_role('button', name='Open', exact=True).click()
        confirmation = self.page.get_by_role('alertdialog').filter(
            has_text='Open Preview import that must fail as a new property')
        expect(confirmation).to_be_visible()
        confirmation.get_by_role('button', name='Open property', exact=True).click()
        notice = self.page.get_by_role('alertdialog').filter(has_text='Injected preview Open failure')
        expect(notice).to_be_visible()
        expect(notice).to_contain_text('This action could not be completed')
        self.assertEqual(self.page.evaluate('JSON.stringify({model:S,cur:PW.cur,props:PW.ix.props})'), before)
        self.assertEqual(self.errors, [])

    def prepare_destinations(self):
        fixture = self.page.evaluate('''async () => {
          S.name='Original import destination';await pwSaveCur();
          const original={pf:PW.pf,sc:PW.sc,property:PW.cur};
          const pf=await pwCreatePortfolio('Other import portfolio');
          const base=pwPf(pf).scs[0].id;
          const sc=await pwCreateScenario(pf,base,'Other import scenario',false);
          const property=await pwAdopt({...blankState(),name:'Destination active'},
            {quiet:true,pf,sc});
          PWV.sub='members';setMode('portfolio');drawPane();
          return {original,destination:{pf,sc,property}};
        }''')
        expect(self.page.locator('.pwhead')).to_be_visible()
        return fixture

    def switch_and_edit_destination(self, fixture):
        self.page.locator('.pwhead').get_by_label('Portfolio', exact=True).select_option(
            fixture['destination']['pf'])
        self.page.locator('.pwhead').get_by_label('Scenario', exact=True).select_option(
            fixture['destination']['sc'])
        self.page.locator('.basis-workspace-main').get_by_role('button', name='Destination active', exact=True).click()
        self.page.wait_for_function('id => PW.cur===id', arg=fixture['destination']['property'])
        self.page.evaluate('''() => {
          S.name='Destination edited while the file reads';
          S.legacyImportMarker={preserved:true};DIRTY();
        }''')

    def paused_workspace_import(self, native):
        fixture = self.prepare_destinations()
        name = 'paused-native.basiscre' if native else 'paused-legacy.basis.json'
        imported_name = 'Native read belongs to the original scenario' if native else 'Legacy read belongs to the original scenario'
        if native:
            encoded = self.page.evaluate('''async name => pwB64(await basisCreateArchive({
              kind:'property',model:{...blankState(),name}}))''', imported_name)
            data = base64.b64decode(encoded)
        else:
            model = self.page.evaluate('name => ({...blankState(),name})', imported_name)
            data = json.dumps(model).encode('utf-8')
        self.page.evaluate('''({name,method}) => {
          const original=File.prototype[method];
          window.legacyReadGate={entered:false,release:null};
          File.prototype[method]=function(...args){
            if(this.name!==name)return original.apply(this,args);
            const file=this;legacyReadGate.entered=true;
            return new Promise((resolve,reject)=>{
              legacyReadGate.release=()=>{
                File.prototype[method]=original;
                return original.apply(file,args).then(resolve,reject);
              };
            });
          };
        }''', {'name': name, 'method': 'arrayBuffer' if native else 'text'})
        support.open_import_menu(self.page)
        with self.page.expect_file_chooser() as chooser:
            self.page.get_by_role('menuitem', name='Basis property or portfolio file…', exact=True).click()
        chooser.value.set_files({'name': name,
                                'mimeType': 'application/zip' if native else 'application/json',
                                'buffer': data})
        self.page.wait_for_function('legacyReadGate.entered')
        self.switch_and_edit_destination(fixture)
        self.page.evaluate('legacyReadGate.release()')
        self.page.wait_for_function('name => PW.ix.props.some(property=>property.name===name)', arg=imported_name)
        self.page.evaluate('PW.q')
        result = self.page.evaluate('''async name => {
          const imported=PW.ix.props.find(property=>property.name===name);
          const saved=await pwGetModel(imported.id,imported);
          return {record:imported,stored:JSON.parse(saved.json),cur:PW.cur,pf:PW.pf,sc:PW.sc,
            activeName:S.name,marker:S.legacyImportMarker};
        }''', imported_name)
        self.assertEqual(result['record']['pf'], fixture['original']['pf'])
        self.assertEqual(result['record']['sc'], fixture['original']['sc'])
        self.assertEqual(result['stored']['name'], imported_name)
        self.assertEqual(result['cur'], fixture['destination']['property'])
        self.assertEqual(result['pf'], fixture['destination']['pf'])
        self.assertEqual(result['sc'], fixture['destination']['sc'])
        self.assertEqual(result['activeName'], 'Destination edited while the file reads')
        self.assertEqual(result['marker'], {'preserved': True})

    def test_paused_legacy_workspace_import_keeps_its_original_scenario_after_switch_and_edit(self):
        self.paused_workspace_import(native=False)

    def test_paused_native_workspace_import_keeps_its_original_scenario_after_switch_and_edit(self):
        self.paused_workspace_import(native=True)

    def test_oversized_json_portfolio_is_rejected_before_reading_or_changing_the_library(self):
        result = self.page.evaluate('''async () => {
          let reads=0;
          const payload={basis:'portfolio',v:1,name:'Must not import',scenarios:['Base'],
            properties:[{scenario:'Base',model:{...blankState(),name:'Must not appear'}}]};
          const file=new File([JSON.stringify(payload)],'oversized-portfolio.json',{type:'application/json'});
          Object.defineProperty(file,'size',{value:OFFICE_ZIP_LIMITS.archive+1});
          const original=file.text.bind(file);file.text=()=>{reads++;return original();};
          const before=JSON.stringify({ix:PW.ix,cur:PW.cur,model:S});
          const added=await pwImportFiles([file]);
          return {reads,added,unchanged:before===JSON.stringify({ix:PW.ix,cur:PW.cur,model:S})};
        }''')
        self.assertEqual(result, {'reads': 0, 'added': 0, 'unchanged': True})
        expect(self.page.get_by_role('alertdialog').filter(has_text='64 MiB import limit')).to_be_visible()


if __name__ == '__main__':
    unittest.main(verbosity=2)
