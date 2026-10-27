"""Exercise the built beta with its real response headers and pinned runtimes.

Run with scripts/run-beta-smoke.py. No live provider request or document upload.
"""
import json
from pathlib import Path
import tempfile
import unittest
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET
import zipfile

from playwright.sync_api import expect
import browser_test as harness
import runtime_pdf_smoke as pdf_fixture
from runtime_dependency_support import load_runtime_dependencies

ROOT = Path(__file__).resolve().parents[1]
DEPLOY = ROOT / 'dist/basis-beta'


class DeploymentHandler(harness.QuietHandler):
    def end_headers(self):
        for name, value in json.loads((DEPLOY / 'headers.json').read_text()).items():
            self.send_header(name, value)
        super().end_headers()


class BetaDeploymentSmokeTests(unittest.TestCase):
    app_directory = DEPLOY
    handler_class = DeploymentHandler

    @classmethod
    def setUpClass(cls):
        cls.artifacts = load_runtime_dependencies()
        if (DEPLOY / 'index.html').read_bytes() != (ROOT / 'app/index.html').read_bytes():
            raise RuntimeError('Run npm run build:beta before testing the deployment candidate')
        harness.BrowserTests.setUpClass.__func__(cls)

    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)

    def setUp(self):
        self.context = self.browser.new_context(accept_downloads=True)
        self.context.add_init_script("window.cspViolations=[];document.addEventListener('securitypolicyviolation',e=>cspViolations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));")
        self.requests, self.blocked = [], []

        def route(request):
            url = request.request.url
            # WebKit exposes local Blob loads to routing; they are generated
            # in this origin, not unverified external network dependencies.
            if urlsplit(url).netloc == urlsplit(self.url).netloc or url.startswith('blob:' + self.url + '/'):
                request.continue_()
            elif url in self.artifacts:
                self.requests.append(url)
                request.fulfill(body=self.artifacts[url], content_type='text/javascript',
                                headers={'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store'})
            else:
                self.blocked.append(url)
                request.abort()
        self.context.route('**/*', route)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.tmp = tempfile.TemporaryDirectory()
        self.response = self.page.goto(self.url)
        self.wait_for_workspace()

    def wait_for_workspace(self):
        # Observe completed initialization instead of exporting its pending
        # Promise through the browser protocol after navigation. Chromium can
        # report that Promise as garbage collected during a Windows reload.
        self.page.wait_for_function('''() => typeof PW !== 'undefined' &&
            PW.cur && document.querySelector('#startup')?.hidden === true''')

    def tearDown(self):
        violations = self.page.evaluate('cspViolations')
        harness.BrowserTests.tearDown(self)
        self.assertEqual(violations, [], 'Unexpected Content Security Policy violations')
        self.assertEqual(self.blocked, [], 'Unpinned external requests')

    def test_headers_release_and_unapproved_inline_script_blocked(self):
        headers = json.loads((DEPLOY / 'headers.json').read_text())
        for name, value in headers.items():
            self.assertEqual(self.response.headers[name.lower()], value)
        release = self.context.request.get(self.url + '/release.json').json()
        self.assertEqual(release['version'], json.loads((ROOT / 'package.json').read_text())['version'])
        for path in ['/src/ai_provider.js', '/tests/fixtures/runtime_dependencies.json', '/.env', '/package.json']:
            self.assertEqual(self.context.request.get(self.url + path).status, 404)
        for path in ['/privacy.html', '/limitations.html', '/THIRD_PARTY_NOTICES.txt']:
            self.assertEqual(self.context.request.get(self.url + path).status, 200)
        # Observe the actual browser event; WebKit can apply CSP to Playwright's
        # string-predicate polling after this deliberate policy violation.
        self.page.evaluate('''()=>new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(Error('Missing CSP enforcement event')),5000);
          document.addEventListener('securitypolicyviolation',()=>{clearTimeout(timer);resolve();},{once:true});
          const script=document.createElement('script');script.textContent='window.unapprovedScriptRan=true';document.body.append(script);
        })''')
        self.assertFalse(self.page.evaluate('window.unapprovedScriptRan===true'))
        self.assertTrue(all(v['blocked'] == 'inline' for v in self.page.evaluate('cspViolations')))
        self.page.evaluate('cspViolations=[]')

    def test_manual_save_reload_worker_and_native_backup(self):
        self.page.evaluate('studioOpenSettings()')
        self.page.get_by_label('Autosave While Editing', exact=True).uncheck()
        self.page.evaluate("()=>{S.name='Saved Beta Fixture';S.tenants[0].rent=25.125;DIRTY();}")
        self.page.locator('#basisSaveChanges').click()
        self.page.evaluate('PW.q')
        expected = self.page.evaluate('JSON.stringify(S)')
        self.page.reload();self.wait_for_workspace()
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'), expected)
        result = self.page.evaluate('''async()=>{
          const snapshot=JSON.parse(JSON.stringify(S));
          const calculated=await basisRunCalculation('property',snapshot,'beta-test');
          const bytes=await basisCreateArchive({kind:'property',model:snapshot});
          const restored=await basisReadArchive(new Blob([bytes]));
          return {workerNoi:calculated.noiY1,expectedNoi:calc(snapshot).noiY1,
            same:JSON.stringify(restored.model)===JSON.stringify(snapshot)};
        }''')
        self.assertAlmostEqual(result['workerNoi'], result['expectedNoi'], places=6)
        self.assertTrue(result['same'])

    def test_real_report_workbook_download_preserves_numbers_and_safe_text(self):
        self.page.evaluate('''()=>{
          const s=blankState();Object.assign(s,{name:'Beta Workbook',startYear:2026,startMonth:4,years:2,gvRate:0,clRate:0,inflExp:0,inflRent:0,inflCPI:0,priceMode:'amount',price:120000,exitCap:.08,costSale:0,discount:.1,loanOn:false});
          s.infl.forEach(i=>i.rates=[0,0,0,0]);s.areas=[{id:'a',name:'Building',sf:1000,basis:true}];
          s.tgroups=[{id:'one',name:'Industrial'},{id:'two',name:'Credit'}];
          s.tenants=[{id:'t',name:'=HYPERLINK("https://example.invalid","Text")',suite:'001',sf:1000,start:'2026-04',end:'2035-12',rent:12.125,step:0,free:0,rec:s.recs[1].id,mla:s.mlas[0].id,expiry:'Vacate',groups:['one','two']}];
          s.ops=[{id:'o',name:'Operating Costs',amt:2400,basis:'amt',fixedPct:1,infl:0,recov:false}];
          S=s;DIRTY();setMode('inputs');go('tools','dump');
        }''')
        expected = self.page.evaluate('JSON.stringify(S)')
        with self.page.expect_download() as pending:
            self.page.get_by_role('button', name='Download Report Workbook (.xlsx)', exact=True).click()
        file = Path(self.tmp.name) / pending.value.suggested_filename
        pending.value.save_as(file)
        self.page.wait_for_function('!BASIS_REPORT_EXPORT.job')
        self.assertTrue(file.name.endswith('_Basis_Report_Package.xlsx'))
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'), expected)
        # Inspect OOXML independently of the writer: no formulas or external links.
        with zipfile.ZipFile(file) as z:
            self.assertIsNone(z.testzip())
            ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            workbook = ET.fromstring(z.read('xl/workbook.xml'))
            names = [s.attrib['name'] for s in workbook.findall('s:sheets/s:sheet', ns)]
            self.assertEqual(names, ['README', 'Property Summary', 'Tenant Rent Roll', 'Tenant Summary', 'Cash Flow', 'All Terms Report', 'Input Assumptions'])
            for name in z.namelist():
                if name.startswith('xl/worksheets/') and name.endswith('.xml'):
                    self.assertEqual(ET.fromstring(z.read(name)).findall('.//s:f', ns), [])
                self.assertNotIn('externalLinks', name)
            cash = ET.fromstring(z.read('xl/worksheets/sheet5.xml'))
            numeric = {c.attrib['r']: float(c.find('s:v', ns).text) for c in cash.findall('.//s:c', ns) if c.attrib.get('t', 'n') == 'n' and c.find('s:v', ns) is not None}
            self.assertAlmostEqual(numeric['B2'], 12125, places=6)
            self.assertAlmostEqual(numeric['C2'], 12125, places=6)
        parsed = self.page.evaluate('''async bytes=>{
          const lib=await pfXlsxLib(),wb=lib.read(new Uint8Array(bytes),{type:'array',cellNF:true});
          const rows=lib.utils.sheet_to_json(wb.Sheets['Cash Flow'],{header:1}),roll=wb.Sheets['Tenant Rent Roll'];
          return {noi:rows.find(r=>r[0]==='Net Operating Income').slice(1),expense:rows.find(r=>r[0]==='Operating Costs').slice(1),
            rent:roll.F2,tenant:roll.A2,groups:roll.N2.v,area:roll.C2,headers:rows[0]};
        }''', list(file.read_bytes()))
        for noi in parsed['noi']:
            self.assertAlmostEqual(noi, 9725, places=6)
        for expense in parsed['expense']:
            self.assertAlmostEqual(expense, -2400, places=6)
        self.assertEqual((parsed['rent']['t'], parsed['rent']['v']), ('n', 12.125))
        self.assertIn('0.00', parsed['rent']['z'])
        self.assertEqual(parsed['area']['z'], '#,##0')
        self.assertEqual(parsed['tenant']['t'], 's')
        self.assertNotIn('f', parsed['tenant'])
        self.assertEqual(parsed['groups'], 'Industrial; Credit')
        self.assertEqual(parsed['headers'][1], 'Year 1 · 2026-04 to 2027-03')

    def test_real_pdf_text_worker_render_and_cleanup(self):
        result = pdf_fixture.RuntimePdfSmokeTests.read_render_dispose(self)
        self.assertEqual(result['version'], '4.10.38')
        self.assertTrue(result['dedicated'])
        self.assertTrue(result['verified'])
        self.assertTrue(result['disposed'])
        self.assertEqual(result['pages'][0]['text'], 'Basis original runtime PDF fixture.\nAnnual rent 12000 USD.')
        self.assertGreater(result['rendering']['dark'], 100)
        self.assertTrue(result['rendering']['canvasReleased'])

    def test_beta_help_and_support_info_under_security_policy(self):
        self.page.get_by_role('tab', name='File', exact=True).click()
        self.page.get_by_role('button', name='About Basis', exact=True).click()
        dialog = self.page.get_by_role('dialog', name='About Basis', exact=True)
        expect(dialog).to_contain_text(json.loads((ROOT / 'package.json').read_text())['version'])
        dialog.get_by_role('button', name='Data & Privacy', exact=True).click()
        expect(dialog).to_contain_text('API keys stay in memory')
        with self.page.expect_download() as pending:
            dialog.get_by_role('button', name='Download Support Info', exact=True).click()
        file = Path(self.tmp.name) / 'support.json'
        pending.value.save_as(file)
        self.assertEqual(set(json.loads(file.read_text())), {'application','version','channel','browser','secureContext','protocol','theme'})

    def test_ai_connection_request_allowed_by_csp_with_simulated_provider(self):
        calls = []
        def provider(route):
            calls.append(json.loads(route.request.post_data))
            route.fulfill(json={'status':'completed','output':[{'content':[{'type':'output_text','text':'{"basis":"ok"}'}]}]}, headers={'Access-Control-Allow-Origin':'*'})
        self.context.route('https://api.openai.com/v1/responses', provider)
        self.page.evaluate('studioOpenSettings()')
        self.page.get_by_label('AI Provider', exact=True).select_option('openai')
        self.page.get_by_label('API Key', exact=True).fill('test-beta-connection-only')
        self.page.get_by_role('button', name='Use AI Setup', exact=True).click()
        self.assertEqual(calls, [])
        self.page.get_by_role('button', name='Test AI Connection', exact=True).click()
        expect(self.page.locator('[data-ai-connection-status]')).to_contain_text('Connection Successful')
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]['max_output_tokens'], 128)
        self.assertNotIn(self.page.evaluate('S.name'), json.dumps(calls))


if __name__ == '__main__':
    unittest.main(verbosity=2)
