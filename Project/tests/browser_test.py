"""Chromium integration tests. Run: python tests/browser_test.py.

Requires the development-only Playwright Python package and Chromium. Serves the
actual app over loopback HTTP; blocks external requests so tests run offline.
"""
import base64
import functools
import http.server
import os
from pathlib import Path
import shutil
import tempfile
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def open_library_actions(page):
    tab = page.get_by_role('tab', name='File', exact=True)
    if tab.get_attribute('aria-selected') != 'true':
        tab.click()


def open_import_menu(page):
    page.get_by_role('tab', name='Home', exact=True).click()
    page.get_by_role('button', name='Import', exact=True).click()


class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(getattr(cls, 'handler_class', QuietHandler), directory=str(getattr(cls, 'app_directory', ROOT / 'app')))
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.playwright = sync_playwright().start()
        engine = os.environ.get('BASIS_TEST_BROWSER', 'chromium')
        if engine not in ('chromium', 'firefox', 'webkit'):
            raise RuntimeError('BASIS_TEST_BROWSER must be chromium, firefox or webkit')
        options = {'headless': True}
        if engine == 'chromium':
            options.update(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'), args=['--no-sandbox'])
        cls.browser = getattr(cls.playwright, engine).launch(**options)
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.context = self.browser.new_context(accept_downloads=True)
        self.context.route('https://**/*', lambda route: route.abort())
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.tmp = tempfile.TemporaryDirectory()
        self.page.goto(self.url)
        self.page.evaluate('PW.ready')
        self.page.wait_for_function('PW.cur && document.querySelector("#startup").hidden')

    def tearDown(self):
        self.context.close()
        self.tmp.cleanup()
        self.assertEqual(self.errors, [], 'Uncaught browser errors')

    def archive(self, expression, name='model.basiscre'):
        encoded = self.page.evaluate('''async expression => {
          const bytes = await basisCreateArchive(eval(expression));
          return pwB64(bytes);
        }''', expression)
        target = Path(self.tmp.name) / name
        target.write_bytes(base64.b64decode(encoded))
        return target

    def upload(self, file):
        self.page.evaluate('setMode("portfolio")')
        open_import_menu(self.page)
        with self.page.expect_file_chooser() as choice:
            self.page.get_by_role('menuitem', name='Basis property or portfolio file…', exact=True).click()
        choice.value.set_files(str(file))

    def read_archive(self, file):
        return self.page.evaluate('''async bytes => {
          return basisReadArchive(new Blob([new Uint8Array(bytes)]));
        }''', list(file.read_bytes()))

    def test_property_download_upload_preserves_all_inputs(self):
        self.page.evaluate('''() => {
          S.name='Café 東京'; S.custom={zero:0,flag:false,value:1e-9};
          S.tenants[0].rent=19.125; DIRTY();
          setMode('inputs'); go('tools','file');
        }''')
        expected = self.page.evaluate('JSON.parse(JSON.stringify(S))')
        with self.page.expect_download() as download:
            self.page.get_by_role('button', name='Export / Backup', exact=True).click()
            self.page.get_by_role('dialog', name='Export and Backup', exact=True).get_by_role('button', name='Download', exact=True).click()
        saved = Path(self.tmp.name) / download.value.suggested_filename
        download.value.save_as(saved)
        self.assertEqual(self.read_archive(saved)['model'], expected)
        self.upload(saved)
        self.page.wait_for_function('PW.ix.props.length===2')
        self.page.evaluate('PW.q')
        self.assertEqual(self.page.evaluate('JSON.parse(JSON.stringify(S))'), expected)
        self.assertEqual(self.page.evaluate('PW.ix.props[0].id===PW.ix.props[1].id'), False)

    def test_portfolio_scenarios_and_exclusions_survive_roundtrip(self):
        expression = '''({kind:'portfolio',portfolio:{name:'Scenario portfolio',
          scenarios:[{id:'base',name:'Base'},{id:'down',name:'Downside'},{id:'empty',name:'Empty'}],
          properties:[{id:'a',scenarioId:'base',include:true,model:{...S,name:'Alpha'}},
                      {id:'b',scenarioId:'down',include:false,model:{...S,name:'Beta',custom:{edited:17}}}]}})'''
        archive = self.archive(expression)
        before = self.read_archive(archive)['portfolio']
        self.upload(archive)
        self.page.wait_for_function('PW.ix.pfs.length===2 && PW.ix.props.length===3')
        self.page.evaluate('PW.q')
        self.page.locator('.deal-choice').filter(has_text='Scenario portfolio').click()
        self.page.wait_for_function('pwPf().name==="Scenario portfolio"')
        open_library_actions(self.page)
        with self.page.expect_download() as download:
            self.page.get_by_role('button', name='Export / Backup', exact=True).click()
            self.page.get_by_role('dialog', name='Export and Backup', exact=True).get_by_role('button', name='Download', exact=True).click()
        saved = Path(self.tmp.name) / 'export.basiscre'
        download.value.save_as(saved)
        after = self.read_archive(saved)['portfolio']
        self.assertEqual([s['name'] for s in after['scenarios']], ['Base', 'Downside', 'Empty'])
        for old, new in zip(before['properties'], after['properties']):
            self.assertEqual(old['include'], new['include'])
            self.assertEqual(old['model'], new['model'])
            self.assertEqual(next(s['name'] for s in before['scenarios'] if s['id']==old['scenarioId']),
                             next(s['name'] for s in after['scenarios'] if s['id']==new['scenarioId']))
            self.assertNotEqual(old['id'], new['id'])

    def test_corrupt_upload_has_no_side_effects(self):
        archive = self.archive("({kind:'property',model:{...S,name:'CRC TARGET'}})")
        data = bytearray(archive.read_bytes())
        position = data.index(b'CRC TARGET')
        data[position] ^= 1
        archive.write_bytes(data)
        before = self.page.evaluate('JSON.stringify({ix:PW.ix,cur:PW.cur,model:S})')
        self.upload(archive)
        self.page.wait_for_function('document.body.textContent.includes("checksum")')
        self.assertEqual(self.page.evaluate('JSON.stringify({ix:PW.ix,cur:PW.cur,model:S})'), before)

    def test_edits_persist_across_switch_and_reload(self):
        first = self.page.evaluate('PW.cur')
        second = self.page.evaluate("pwAdopt({...blankState(),name:'Second'})")
        self.page.evaluate('''async first => {
          await pwOpen(first); S.name='Edited asset'; S.custom={retained:true}; DIRTY();
        }''', first)
        self.page.evaluate('pwOpen', second)
        self.page.evaluate('pwOpen', first)
        self.assertEqual(self.page.evaluate('S.name'), 'Edited asset')
        self.page.evaluate('pwSaveCur()')
        self.page.reload()
        self.page.evaluate('PW.ready')
        self.assertEqual(self.page.evaluate('S.name'), 'Edited asset')
        self.assertEqual(self.page.evaluate('S.custom'), {'retained': True})

    def test_declined_save_is_not_retried(self):
        result = self.page.evaluate('''async () => {
          let calls=0, anchors=0;
          const original=HTMLAnchorElement.prototype.click;
          HTMLAnchorElement.prototype.click=function(){anchors++;};
          _dl={save:async()=>{calls++;throw {code:'declined'};}};
          try {return {status:await basisSaveCurrent(),calls,anchors};}
          finally {HTMLAnchorElement.prototype.click=original;_dl=null;}
        }''')
        self.assertEqual(result, {'status': 'declined', 'calls': 1, 'anchors': 0})

    def test_failed_portfolio_commit_preserves_existing_library(self):
        archive = self.archive("({kind:'portfolio',portfolio:{name:'Failed portfolio',scenarios:[{id:'base',name:'Base'}],properties:[{id:'a',scenarioId:'base',model:{...S,name:'Staged asset'}}]}})")
        original_id = self.page.evaluate('PW.cur')
        self.page.evaluate('''() => {
          window.originalPwCommit=pwCommit;
          pwCommit=async(ix,...args)=>{
            if(ix.pfs.length>1) throw Error('injected commit failure');
            return window.originalPwCommit(ix,...args);
          };
        }''')
        self.upload(archive)
        self.page.wait_for_function('document.body.textContent.includes("injected commit failure")')
        self.assertEqual(self.page.evaluate('({pfs:PW.ix.pfs.length,props:PW.ix.props.length,cur:PW.cur})'),
                         {'pfs':1,'props':1,'cur':original_id})
        self.page.evaluate('''async () => {
          pwCommit=window.originalPwCommit; await PW.q;
          const keys=await pwTx('readonly',store=>store.getAllKeys());
          if(keys.filter(k=>k.startsWith('pwm_')).length!==1) throw Error('Staged model leaked');
        }''')
        self.page.reload()
        self.page.evaluate('PW.ready')
        self.assertEqual(self.page.evaluate('({pfs:PW.ix.pfs.length,props:PW.ix.props.length,cur:PW.cur})'),
                         {'pfs':1,'props':1,'cur':original_id})

    def test_async_ui_failure_is_recoverable(self):
        self.page.evaluate('''() => {
          window.originalPwPrepareModel=pwPrepareModel;
          pwPrepareModel=async()=>{throw Error('injected quota failure');};
        }''')
        self.page.get_by_role('button', name='New Property', exact=True).click()
        dialog=self.page.get_by_role('dialog', name='Create Property', exact=True)
        dialog.get_by_role('button', name='Create and Continue', exact=True).click()
        expect_message=dialog.get_by_role('alert')
        self.page.wait_for_function('document.body.textContent.includes("injected quota failure")')
        self.assertIn('injected quota failure',expect_message.inner_text())
        self.assertEqual(self.page.evaluate('PW.ix.props.length'), 1)
        self.page.evaluate('() => {pwPrepareModel=window.originalPwPrepareModel;}')
        dialog.get_by_role('button', name='Create and Continue', exact=True).click()
        self.page.wait_for_function('PW.ix.props.length===2 && MODE==="inputs"')

    def test_cancel_new_portfolio_preserves_library(self):
        self.page.locator('.ribbon').get_by_role('button', name='New Portfolio', exact=True).click()
        self.page.get_by_role('button', name='Cancel', exact=True).click()
        self.assertEqual(self.page.evaluate('PW.ix.pfs.length'), 1)

    def test_mobile_navigation_and_command_search(self):
        self.page.set_viewport_size({'width':390,'height':844})
        for mode in ['inputs','reports','portfolio']:
            self.page.locator(f'#studioDock [data-basis-mode="{mode}"]').click()
            self.assertEqual(self.page.evaluate('MODE'), mode)
            self.assertEqual(self.page.locator(f'#studioDock [data-basis-mode="{mode}"]').get_attribute('aria-pressed'), 'true')
        self.page.keyboard.press('Control+k')
        self.page.get_by_role('searchbox', name='Search modeling tasks').fill('Loan Interest')
        self.page.keyboard.press('Enter')
        self.assertEqual(self.page.evaluate('({mode:MODE,pane:T2})'), {'mode':'reports','pane':'loanint'})
        self.assertEqual(self.page.locator('.basis-palette').is_visible(), False)

    def test_report_and_lease_names_are_rendered_as_text(self):
        result = self.page.evaluate('''() => {
          const payload='<img src=x onerror="window.__basisXSS=1">';
          const holder=document.createElement('div');document.body.append(holder);
          holder.append(rTable({cols:[{h:payload,h2:payload}],rows:[]}));
          S.tenants[0].name=payload; S.tenants[0].suite=payload;
          LEASE_SEL=S.tenants[0].id; RENT_SEL=S.tenants[0].id;
          holder.append(leaseDetailEditor(),rentSchedEditor());
          S.ops[0].name=payload; recalc();
          holder.append(PANES['reports.cf'](),PANES['reports.leasesum'](),PANES['reports.validate']());
          const result={images:holder.querySelectorAll('img').length,text:holder.textContent.includes(payload)};
          holder.remove(); return result;
        }''')
        self.assertEqual(result, {'images':0,'text':True})

    def test_workspace_yield_uses_a_single_percentage_conversion(self):
        self.page.locator('.basis-portfolio-trend > summary').click()
        expected = self.page.evaluate('''() => { const included=pwList().filter(p=>p.inc!==false);
          return pc(included.reduce((a,p)=>a+num(p.noi),0)/included.reduce((a,p)=>a+num(p.pv),0),2);
        }''')
        self.assertIn('Implied NOI yield · '+expected,
                      self.page.locator('.studio-context').inner_text())

    def test_all_visible_model_and_report_routes_render(self):
        failures = self.page.evaluate('''() => {
          const failures=[];
          for(const mode of ['inputs','reports']) {
            setMode(mode);
            for(const group of mode==='inputs'?NAV:RNAV) for(const [sub] of group.subs) {
              T1=group.id;T2=sub;drawPane();
              const pane=document.querySelector('#pane');
              if(pane.textContent.includes('This pane failed to render:'))
                failures.push({mode,route:T1+'.'+T2,error:pane.textContent});
            }
          }
          return failures;
        }''')
        self.assertEqual(failures, [])

    def test_legacy_workbook_preflight_rejects_corruption_before_parsing(self):
        result = self.page.evaluate('''async () => {
          let parsed=0;const original=window.XLSX;
          window.XLSX={read:()=>{parsed++;throw Error('parser should not run');}};
          try {
            const bytes=basisZipWrite([{name:'xl/workbook.xml',data:'<workbook>CRC_TARGET</workbook>'}]);
            const target=new TextEncoder().encode('CRC_TARGET');
            const position=bytes.findIndex((_,i)=>target.every((value,j)=>bytes[i+j]===value));
            if(position<0)throw Error('Missing test payload');
            bytes[position]^=1;
            let error='';try{await pfReadFile(new File([bytes],'hostile.xlsx'));}catch(e){error=e.message;}
            return {parsed,error};
          }finally{window.XLSX=original;}
        }''')
        self.assertEqual(result['parsed'], 0)
        self.assertIn('checksum', result['error'])

    def test_legacy_workbook_bounds_precede_sparse_expansion(self):
        result = self.page.evaluate('''async () => {
          const original=window.XLSX;let expanded=0;
          window.XLSX={version:'0.20.3',write:()=>{},
            read:()=>({SheetNames:['Properties'],Sheets:{Properties:{'!ref':'A1:XFD1048576'}}}),
            utils:{book_new:()=>{},aoa_to_sheet:()=>{},encode_cell:()=>{},encode_col:()=>{},book_append_sheet:()=>{},
              sheet_to_json:()=>{expanded++;return [];}}};
          try{
            let error='';try{await pfReadFile(new File(['CFB_PLACEHOLDER'],'oversized.xls'));}catch(e){error=e.message;}
            return {expanded,error};
          }finally{window.XLSX=original;}
        }''')
        self.assertEqual(result['expanded'], 0)
        self.assertIn('range exceeds', result['error'])

    def test_stale_tab_preserves_edits_and_can_export_then_reload(self):
        self.page.evaluate('PW.q')
        second = self.context.new_page()
        second.on('pageerror', lambda error: self.errors.append(str(error)))
        second.goto(self.url)
        second.evaluate('PW.ready')
        second.evaluate('PW.q')
        self.page.evaluate("async () => {S.name='Saved in first tab';DIRTY();await pwSaveCur();}")
        outcome = second.evaluate('''async () => {
          S.name='Unsaved second-tab edits';DIRTY();
          try{await pwSaveCur();return 'unexpected save';}catch(error){return error.code;}
        }''')
        self.assertEqual(outcome, 'conflict')
        self.assertEqual(second.evaluate('S.name'), 'Unsaved second-tab edits')
        self.assertEqual(self.page.evaluate("pwGetModel(PW.cur).then(x=>JSON.parse(x.json).name)"), 'Saved in first tab')
        second.get_by_role('button', name='OK', exact=True).click()
        with second.expect_download() as download:
            second.evaluate('basisSaveCurrent()')
        saved = Path(self.tmp.name) / 'conflict-backup.basiscre'
        download.value.save_as(saved)
        self.assertEqual(self.read_archive(saved)['model']['name'], 'Unsaved second-tab edits')
        open_library_actions(second)
        second.get_by_role('button', name='Reload library', exact=True).click()
        second.get_by_role('alertdialog').get_by_role('button', name='Cancel', exact=True).click()
        self.assertEqual(second.evaluate('S.name'), 'Unsaved second-tab edits')
        open_library_actions(second)
        second.get_by_role('button', name='Reload library', exact=True).click()
        second.get_by_role('alertdialog').get_by_role('button', name='Reload library', exact=True).click()
        second.wait_for_function("S.name==='Saved in first tab' && !PW.conflict")
        second.evaluate("async () => {S.name='Saved after reload';DIRTY();await pwSaveCur();}")
        self.assertEqual(second.evaluate("pwGetModel(PW.cur).then(x=>JSON.parse(x.json).name)"), 'Saved after reload')
        second.close()

    def test_portfolio_dates_controls_and_invalid_rate_recovery(self):
        self.page.evaluate('''async () => {
          pwRec(PW.cur).inc=false;await pwSaveIndex();
          function asset(name,startMonth){
            const s=blankState();Object.assign(s,{name,startYear:2026,startMonth,years:1,
              gvRate:0,clRate:0,inflExp:0,inflRent:0,inflCPI:0,
              priceMode:'amount',price:120000,pvMode:'annual',discount:.1,
              exitCap:.08,costSale:0,loanOn:false});
            s.infl.forEach(x=>x.rates=[0,0,0,0]);
            s.areas=[{id:'building',name:'Building',sf:1000,basis:true}];
            s.tenants=[{id:'tenant',name:'Tenant',sf:1000,start:'2026-'+String(startMonth).padStart(2,'0'),
              end:'2035-12',rent:12,step:0,free:0,rec:s.recs[1].id,mla:s.mlas[0].id,expiry:'Vacate'}];
            s.ops=[{id:'expense',name:'Fixed expenses',amt:2400,basis:'amt',fixedPct:1,infl:0,recov:false}];
            return s;
          }
          await pwAdopt(asset('January asset',1));await pwAdopt(asset('July asset',7));
          await pwSetScenarioSettings({portDisc:.1,portCap:.08,portSingleExit:false});
          setMode('portfolio');PWV.sub='cf';drawPane();
        }''')
        self.assertIn('jan 2027 – jun 2027 (6 months)', self.page.locator('#pfpage').inner_text().lower())
        self.assertEqual(self.page.locator('#pfpage tr').filter(has_text='NET OPERATING INCOME').inner_text().split()[-2:], ['14,400','4,800'])
        self.page.get_by_role('tab', name='Portfolio Value', exact=True).click()
        discount = self.page.locator('#pfpage .f').filter(has_text='Portfolio discount rate').locator('input')
        discount.fill('20')
        discount.press('Tab')
        self.page.wait_for_function('pwSc().settings.portDisc===.2')
        expected = self.page.evaluate('money(129600/1.2+129600/1.2**1.5)')
        self.assertEqual(self.page.locator('#pfpage tr').filter(has_text='Portfolio present value').locator('td').nth(1).inner_text(), expected)
        self.page.locator('#pfpage .f').filter(has_text='Single portfolio exit').locator('input').check()
        self.page.wait_for_function('pwSc().settings.portSingleExit===true')
        cap = self.page.locator('#pfpage .f').filter(has_text='Portfolio exit cap').locator('input')
        cap.fill('0')
        cap.press('Tab')
        self.page.locator('#pfpage [role=alert]').filter(has_text='positive cap rate').wait_for(state='visible')
        self.assertEqual(self.page.evaluate('pwSc().settings.portCap'), .08)
        cap = self.page.locator('#pfpage .f').filter(has_text='Portfolio exit cap').locator('input')
        cap.fill('8')
        cap.press('Tab')
        self.page.wait_for_function('!Array.from(document.querySelectorAll("#pfpage input")).some(n=>n.disabled) && !Array.from(document.querySelectorAll("#pfpage [role=alert]")).some(n=>!n.hidden)')
        self.assertEqual(self.page.locator('#pfpage tr').filter(has_text='Residual at portfolio cap').locator('td').nth(1).inner_text(), '240,000')
        self.page.locator('#pfpage .f').filter(has_text='Income capitalized at joint sale').locator('select').select_option('trailing')
        self.page.wait_for_function('pwSc().settings.portResaleNoi==="trailing"')
        self.assertEqual(self.page.evaluate('pwRollup().portResaleNoi'), 'trailing')

    def test_office_xml_rejects_sparse_expansion_before_allocation(self):
        result = self.page.evaluate('''async () => {
          async function read(sheet){
            const files={
              'xl/workbook.xml':'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Test" r:id="r1"/></sheets></workbook>',
              'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
              'xl/worksheets/sheet1.xml':sheet
            };
            return intXlsx({text:async path=>files[path]||null},{keepRows:true});
          }
          const valid=await read('<worksheet><sheetData><row r="3"><c r="B3" t="inlineStr"><is><t>Café</t></is></c></row></sheetData></worksheet>');
          const attacks=[
            '<row r="4000000000"/>',
            '<row r="1"><c r="XFD1"><v>1</v></c></row>',
            '<row r="100000"><c r="V100000"><v>1</v></c></row>',
            '<row r="1"><c r="A2"><v>1</v></c></row>',
            '<row r="1"><c r="A1"/><c r="A1"/></row>',
            '<row r=""/>'];
          const errors=[];
          for(const attack of attacks){try{await read('<worksheet><sheetData>'+attack+'</sheetData></worksheet>');errors.push('');}catch(error){errors.push(error.message);}}
          return {value:valid[0].rows[2][1],rowCount:valid[0].rows.length,errors};
        }''')
        self.assertEqual(result['value'], 'Café')
        self.assertEqual(result['rowCount'], 3)
        self.assertTrue(all(result['errors']), result['errors'])

    def test_calculation_work_limits_fail_recoverably(self):
        result = self.page.evaluate('''() => {
          const original=S.mlas[0].termYears;S.mlas[0].termYears=1e12;
          let error='';try{calc(S);}catch(e){error=e.message;}
          S.mlas[0].termYears=original;
          return {error,validPV:calc(S).pv};
        }''')
        self.assertIn('1200-month', result['error'])
        self.assertTrue(result['validPV'] > 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
