"""Real bundled PDF/Excel smoke checks with a narrow mock desktop bridge.

Run after build:desktop: python -m unittest discover -s tests -p desktop_runtime_smoke.py -v
The bridge is mocked here; the Windows Tauri-driver suite tests native commands.
All non-loopback networking is blocked, including every public runtime CDN.
"""
import base64
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from urllib.parse import urlsplit

import browser_test as harness
from runtime_pdf_smoke import original_pdf

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = ROOT / 'dist/basis-desktop'
BRIDGE = r"""(() => {
  let snapshot={schemaVersion:1,revision:'0',entries:{}},sequence=0;
  window.__TAURI__={core:{invoke:async(command,args={})=>{
    if(command==='desktop_store_read')return structuredClone(snapshot);
    if(command==='desktop_store_commit'){
      if(args.expectedRevision!==snapshot.revision)throw Error('Stale desktop test transaction');
      const entries=structuredClone(snapshot.entries);
      for(const key of args.deletes||[])delete entries[key];Object.assign(entries,structuredClone(args.puts));
      snapshot={schemaVersion:1,revision:String(++sequence),entries};return structuredClone(snapshot);
    }
    if(command==='desktop_store_info')return {dataDirectory:'Test-only mock storage',backupDirectory:'Test-only mock backups',backups:[]};
    if(command==='desktop_key_status')return false;
    throw Error('Unexpected desktop smoke command: '+command);
  }},window:{getCurrentWindow:()=>({onCloseRequested:async()=>()=>{},close:async()=>{}})}};
})();"""


class DesktopRuntimeSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (DESKTOP / 'desktop-release.json').is_file():
            raise RuntimeError('Build dist/basis-desktop before running desktop runtime smoke checks.')
        cls.app_directory = DESKTOP
        harness.BrowserTests.setUpClass.__func__(cls)

    @classmethod
    def tearDownClass(cls):
        harness.BrowserTests.tearDownClass.__func__(cls)

    def setUp(self):
        self.requests, self.blocked, self.errors = [], [], []
        self.tamper = None
        self.context = self.browser.new_context(accept_downloads=True)
        self.context.add_init_script(BRIDGE)

        def route(request):
            url = request.request.url
            parsed = urlsplit(url)
            if parsed.netloc != urlsplit(self.url).netloc:
                self.blocked.append(url)
                request.abort()
                return
            if parsed.path.startswith('/vendor/'):
                self.requests.append(parsed.path)
                if parsed.path == self.tamper:
                    data = bytearray((DESKTOP / parsed.path.lstrip('/')).read_bytes())
                    data[0] ^= 1
                    request.fulfill(body=bytes(data), content_type='text/javascript')
                    return
            request.continue_()
        self.context.route('**/*', route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.tmp = tempfile.TemporaryDirectory()
        self.page.goto(self.url)
        self.page.evaluate('PW.ready')
        self.page.wait_for_function('PW.cur && document.querySelector("#startup").hidden')
        self.assertEqual(self.page.evaluate('PWS.kind'), 'desktop')

    def tearDown(self):
        self.context.close()
        self.tmp.cleanup()
        self.assertEqual(self.errors, [], 'Uncaught desktop browser errors')
        self.assertEqual(self.blocked, [], 'Desktop document handling must make no external request')

    def test_manifest_hashes_and_bundled_license_inventory(self):
        release = json.loads((DESKTOP / 'desktop-release.json').read_text())
        self.assertTrue(release['sharedApplication'])
        self.assertTrue(release['offlineDocumentLibraries'])
        for name, record in release['files'].items():
            data = (DESKTOP / name).read_bytes()
            self.assertEqual(len(data), record['bytes'])
            self.assertEqual(hashlib.sha256(data).hexdigest(), record['sha256'])
        self.assertEqual((DESKTOP / 'index.html').read_bytes(), (ROOT / 'app/index.html').read_bytes())
        self.assertEqual((DESKTOP / 'LICENSE.txt').read_bytes(), (ROOT / 'LICENSE').read_bytes())
        self.assertEqual(len(release['runtimes']), 3)
        self.assertFalse((DESKTOP / '_headers').exists())
        self.assertFalse((DESKTOP / 'release.json').exists())

    def test_real_bundled_excel_roundtrip_preserves_inputs_offline(self):
        result = self.page.evaluate('''async () => {
          const lib=await pfXlsxLib(),model=blankState();model.name='Offline Café';
          model.tgroups=[{id:'a',name:'Industrial'},{id:'b',name:'Credit'}];
          model.tenants=[{id:'tenant',name:'A & B',sf:1234.5,start:'2026-01',end:'2030-12',rent:24.125,group:'a',groups:['a','b']}];
          const pkg=pfPackage(model,{results:false,members:false}),bytes=pfToXLSX(pkg,lib);
          const result=await pfReadFile(new File([bytes],'offline.basis.xlsx')),restored=result.props[0].st;
          return {version:lib.version,check:result.check,name:restored.name,tenant:restored.tenants[0],signature:[...bytes.slice(0,4)]};
        }''')
        self.assertEqual(result['version'], '0.20.3')
        self.assertEqual(result['check'], 'match')
        self.assertEqual(result['name'], 'Offline Café')
        self.assertEqual(result['signature'], [80, 75, 3, 4])
        self.assertEqual(result['tenant']['sf'], 1234.5)
        self.assertEqual(result['tenant']['rent'], 24.125)
        self.assertEqual(result['tenant']['groups'], ['a', 'b'])
        self.assertEqual(self.requests, ['/vendor/xlsx-0.20.3.min.js'])

    def test_real_bundled_pdf_text_dedicated_worker_render_and_cleanup(self):
        result = self.page.evaluate('''async encoded => {
          const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),lib=await intPdfLib(),pair=await _basisPdfLoader.load();
          const task=lib.getDocument({data:bytes,useSystemFonts:true}),pdf=await task.promise;
          let page,bitmap;
          try{
            page=await pdf.getPage(1);const text=await page.getTextContent(),viewport=page.getViewport({scale:1});
            const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
            const context=canvas.getContext('2d');await page.render({canvasContext:context,viewport}).promise;
            const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
            let dark=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<180&&pixels[i+1]<180&&pixels[i+2]<180)dark++;
            const worker=task._worker,result={version:lib.version,verified:pair.verified,workerUrl:pair.workerUrl,
              dedicated:worker?._webWorker instanceof Worker,text:text.items.map(item=>item.str).join(' '),dark};
            page.cleanup();await task.destroy();result.disposed=task.destroyed&&worker.destroyed;return result;
          }finally{if(!task.destroyed)await task.destroy();}
        }''', base64.b64encode(original_pdf()).decode())
        self.assertEqual(result['version'], '4.10.38')
        self.assertTrue(result['verified'])
        self.assertTrue(result['dedicated'])
        self.assertTrue(result['disposed'])
        self.assertTrue(result['workerUrl'].startswith('blob:' + self.url))
        self.assertIn('Basis original runtime PDF fixture.', result['text'])
        self.assertIn('Annual rent 12000 USD.', result['text'])
        self.assertGreater(result['dark'], 100)
        self.assertCountEqual(self.requests, ['/vendor/pdf-4.10.38.min.mjs', '/vendor/pdf.worker-4.10.38.min.mjs'])

    def test_modified_local_excel_fails_integrity_without_network_fallback(self):
        self.tamper = '/vendor/xlsx-0.20.3.min.js'
        result = self.page.evaluate('''async () => {
          try{await pfXlsxLib();return 'unexpected success';}catch(error){return error.code;}
        }''')
        self.assertEqual(result, 'xlsx_load_failed')
        self.assertEqual(self.requests, [self.tamper])
        self.tamper = None
        self.assertEqual(self.page.evaluate('pfXlsxLib().then(lib=>lib.version)'), '0.20.3')

    def test_modified_local_pdf_worker_fails_hash_before_execution_then_recovers(self):
        self.tamper = '/vendor/pdf.worker-4.10.38.min.mjs'
        result = self.page.evaluate('''async () => {
          try{await intPdfLib();return 'unexpected success';}catch(error){return {code:error.code,attempts:error.attempts.length,cause:error.cause.code};}
        }''')
        self.assertEqual(result, {'code': 'pdf_load_failed', 'attempts': 1, 'cause': 'pdf_integrity_digest'})
        self.assertTrue(all(item.startswith('/vendor/') for item in self.requests))
        self.tamper = None
        self.assertEqual(self.page.evaluate('intPdfLib().then(lib=>lib.version)'), '4.10.38')


if __name__ == '__main__':
    unittest.main(verbosity=2)
