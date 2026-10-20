"""Verified PDF byte loading, cancellation and browser image-codec regressions."""
import hashlib
import json
import unittest
import browser_test as harness
from playwright.sync_api import Error as PlaywrightError


class PdfBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp = harness.BrowserTests.setUp
    tearDown = harness.BrowserTests.tearDown

    def modules(self, broken_primary=False, tampered=None, candidates=None, timeout_ms=10000):
        self.requests, self.blocked, self.pending_routes = [], [], []
        self.stall = False
        self.bodies, artifacts = {}, {}
        for version in ['4.10.38', '4.4.168']:
            base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + version + '/'
            marker = '''globalThis.pdfFixtureTamperMarker=0;
              if(globalThis.pdfFixtureTamperMarker===1)fetch('https://tampered-pdf.invalid/executed');
            '''
            sources = {
                'worker': marker + 'globalThis.pdfFixtureWorkerExecutions=(globalThis.pdfFixtureWorkerExecutions||[]).concat(' + json.dumps(version) + ');'
                          + 'export class WorkerMessageHandler {}',
                'reader': marker + '''globalThis.pdfFixtureReaderExecutions=(globalThis.pdfFixtureReaderExecutions||[]).concat(VERSION);
                  export const version=VERSION;
                  export class GlobalWorkerOptions {static workerSrc='';}
                  export function getDocument(){return {promise:Promise.resolve({numPages:1,
                    getPage:async()=>({getTextContent:async()=>({items:[{str:'Synthetic document text verifies the local PDF application pipeline.',transform:[1,0,0,10,0,0],width:100}]}),cleanup(){}}),
                    destroy(){}}),destroy(){}};}
                '''.replace('VERSION', json.dumps(version))
            }
            artifacts[version] = {}
            for role, source in sources.items():
                url = base + ('pdf.worker.min.mjs' if role == 'worker' else 'pdf.min.mjs')
                body = source.encode('utf-8')
                artifacts[version][role] = {'url': url, 'size': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
                self.bodies[url] = body
                if tampered and version in tampered.get('versions', ['4.10.38']) and role == tampered['role']:
                    changed = body.replace(b'globalThis.pdfFixtureTamperMarker=0;', b'globalThis.pdfFixtureTamperMarker=1;')
                    self.assertEqual(len(changed), len(body), 'The tamper fixture must exercise hashing, not only length checks')
                    self.bodies[url] = changed

        def route(request):
            url = request.request.url
            if url not in self.bodies:
                self.blocked.append(url)
                request.abort()
                return
            self.requests.append(url)
            if self.stall:
                self.pending_routes.append(request)
                return
            failed = broken_primary and '/4.10.38/pdf.worker.' in url
            request.fulfill(status=503 if failed else 200, body=self.bodies[url], content_type='text/javascript',
                            headers={'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store'})
        self.context.route('https://**/*', route)
        self.page.evaluate('''({artifacts,candidates,timeoutMs}) => {
          globalThis.pdfFixtureUrls={created:[],revoked:[]};
          globalThis.pdfFixtureTransport=basisCreatePdfTransport({artifacts,
            createObjectURL(blob){const url=URL.createObjectURL(blob);pdfFixtureUrls.created.push(url);return url;},
            revokeObjectURL(url){pdfFixtureUrls.revoked.push(url);URL.revokeObjectURL(url);}});
          globalThis.pdfFixtureLoaderOptions={transport:pdfFixtureTransport,timeoutMs,candidates};
          _basisPdfLoader=basisCreatePdfLoader(pdfFixtureLoaderOptions);_pdfjs=null;
        }''', {'artifacts': artifacts, 'candidates': candidates or ['4.10.38', '4.4.168'], 'timeoutMs': timeout_ms})

    def read_pdf(self):
        return self.page.evaluate('''async () => {
          setMode('inputs');go('tools','import');
          await intAdd([new File(['%PDF-fixture'],'fixture.pdf',{type:'application/pdf'})]);
          const pair=await _basisPdfLoader.load();
          return {status:INT.docs.at(-1).status,text:INT.docs.at(-1).pages[0]?.text,
            version:_pdfjs&&_pdfjs.version,verified:pair.verified,workerUrl:pair.workerUrl,
            hasWorkerExport:'worker' in pair,workerExecutions:globalThis.pdfFixtureWorkerExecutions||[],
            readerExecutions:globalThis.pdfFixtureReaderExecutions||[],
            src:_pdfjs&&_pdfjs.GlobalWorkerOptions.workerSrc};
        }''')

    def test_actual_dynamic_import_pairs_class_apis_and_worker_url(self):
        self.modules()
        result = self.read_pdf()
        self.assertEqual(result['status'], 'ready')
        self.assertIn('Synthetic document', result['text'])
        self.assertEqual(result['version'], '4.10.38')
        self.assertTrue(result['verified'])
        self.assertFalse(result['hasWorkerExport'])
        self.assertEqual(result['workerExecutions'], [], 'Loading must not evaluate the worker in the main window')
        self.assertEqual(result['readerExecutions'], ['4.10.38'])
        self.assertTrue(result['src'].startswith('blob:' + self.url + '/'))
        self.assertEqual(result['src'], result['workerUrl'])
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(self.blocked, [])

    def test_failed_worker_fetch_uses_matched_approved_fallback(self):
        self.modules(broken_primary=True)
        result = self.read_pdf()
        self.assertEqual(result['status'], 'ready')
        self.assertEqual(result['version'], '4.4.168')
        self.assertTrue(result['verified'])
        self.assertEqual(result['readerExecutions'], ['4.4.168'], 'Neither primary module may execute before the whole pair verifies')
        self.assertEqual(result['workerExecutions'], [])
        self.assertTrue(all('/3.' not in url for url in self.requests))
        self.assertEqual(len(self.requests), 4)
        self.assertEqual(self.blocked, [])

    def test_stalled_verified_fetch_deadline_releases_reader_and_allows_retry(self):
        self.modules(timeout_ms=100)
        self.stall = True
        first = self.page.evaluate('''async () => {
          const file=new File(['%PDF-fixture'],'retry.pdf',{type:'application/pdf'});
          await intAdd([file]);return {error:INT.docs[0].status==='error'&&INT.docs[0].err.includes('could not load'),
            executions:globalThis.pdfFixtureReaderExecutions||[]};
        }''')
        # Chromium has aborted these fetches, but Playwright still owns the
        # deliberately unresolved route handlers until they are settled too.
        for pending in self.pending_routes:
            try:
                pending.abort()
            except PlaywrightError:
                pass  # The browser may already have removed its cancelled request.
        self.pending_routes.clear()
        self.assertTrue(first['error'], first)
        self.assertEqual(first['executions'], [])
        self.stall = False
        self.page.evaluate('''() => {_basisPdfLoader=basisCreatePdfLoader({...pdfFixtureLoaderOptions,timeoutMs:5000});}''')
        result = self.read_pdf()
        self.assertEqual(result['status'], 'ready')
        self.assertTrue(result['verified'])
        self.assertEqual(self.blocked, [])

    def test_reader_and_worker_same_size_tampering_cannot_execute(self):
        for role in ['reader', 'worker']:
            with self.subTest(role=role):
                self.modules(tampered={'role': role}, candidates=['4.10.38'])
                result = self.page.evaluate('''async () => {
                  try{await _basisPdfLoader.load();return {unexpected:true};}
                  catch(error){return {name:error.name,code:error.code,attempts:error.attempts,
                    readers:globalThis.pdfFixtureReaderExecutions||[],workers:globalThis.pdfFixtureWorkerExecutions||[],
                    blobs:pdfFixtureUrls.created.length,
                    marker:globalThis.pdfFixtureTamperMarker??null};}
                }''')
                self.assertEqual((result['name'], result['code']), ('PdfLoadError', 'pdf_load_failed'))
                self.assertRegex(result['attempts'][0]['message'], '(?i)hash|digest|integrity|sha|verif')
                self.assertEqual(result['readers'], [], 'A bad worker must also prevent reader code from executing')
                self.assertEqual(result['workers'], [])
                self.assertEqual(result['blobs'], 0, 'Neither unverified module may become executable Blob code')
                self.assertIsNone(result['marker'])
                self.assertEqual(self.blocked, [], 'Tampered code must never reach its network execution sentinel')

    def test_tampered_primary_falls_back_only_after_the_verified_pair_passes(self):
        self.modules(tampered={'role': 'worker'})
        result = self.read_pdf()
        self.assertEqual((result['status'], result['version'], result['verified']), ('ready', '4.4.168', True))
        self.assertEqual(result['readerExecutions'], ['4.4.168'])
        self.assertEqual(result['workerExecutions'], [])
        self.assertEqual(len(self.requests), 4)
        self.assertEqual(self.blocked, [])

    def test_verified_blob_urls_stay_live_until_transport_disposal_then_are_revoked(self):
        self.modules()
        result = self.page.evaluate('''async () => {
          const pair=await _basisPdfLoader.load(),cached=await _basisPdfLoader.load();
          const first=await fetch(pair.workerUrl).then(response=>response.text());
          _basisPdfLoader.invalidate();
          const afterInvalidate=await fetch(pair.workerUrl).then(response=>response.text());
          pdfFixtureTransport.dispose();let revoked=false;
          try{await fetch(pair.workerUrl);}catch(error){revoked=true;}
          return {samePair:pair===cached,live:first.includes('WorkerMessageHandler'),
            activeSafe:first===afterInvalidate,revoked,workerExecutions:globalThis.pdfFixtureWorkerExecutions||[],
            allRevoked:pdfFixtureUrls.created.length===2&&pdfFixtureUrls.created.every(url=>pdfFixtureUrls.revoked.includes(url))};
        }''')
        self.assertEqual(result, {'samePair': True, 'live': True, 'activeSafe': True, 'revoked': True, 'workerExecutions': [], 'allRevoked': True})
        self.assertEqual(self.blocked, [])

    def test_clear_pending_pdf_open_aborts_and_destroys_without_waiting_for_reply(self):
        self.page.evaluate('''() => {
          window.pdfStats={started:false,destroyed:0};
          intPdfLib=async()=>({getDocument(){pdfStats.started=true;return {promise:new Promise(()=>{}),destroy(){pdfStats.destroyed++;}};}});
          setMode('inputs');go('tools','import');
          window.reading=intAdd([new File(['%PDF-fixture'],'pending.pdf')]);
        }''')
        self.page.wait_for_function('pdfStats.started')
        self.page.get_by_role('button', name='Clear documents', exact=True).click()
        self.page.evaluate('reading')
        self.assertEqual(self.page.evaluate('INT.docs.length'), 0)
        self.assertEqual(self.page.evaluate('pdfStats.destroyed'), 1)

    def test_clear_pending_scan_render_cancels_task_and_cleans_page(self):
        self.page.evaluate('''() => {
          window.pdfStats={rendering:false,cancelled:0,destroyed:0,cleaned:0};
          const page={getTextContent:async()=>({items:[]}),cleanup(){pdfStats.cleaned++;},
            getViewport({scale}){return {width:80*scale,height:40*scale};},
            render(){pdfStats.rendering=true;return {promise:new Promise(()=>{}),cancel(){pdfStats.cancelled++;}};}};
          const pdf={numPages:1,getPage:async()=>page,destroy(){pdfStats.destroyed++;}};
          intPdfLib=async()=>({getDocument:()=>({promise:Promise.resolve(pdf),destroy(){pdfStats.destroyed++;}})});
          _intLim={images:{}};setMode('inputs');go('tools','import');
          window.reading=intAdd([new File(['%PDF-fixture'],'scan.pdf')]);
        }''')
        self.page.wait_for_function('pdfStats.rendering')
        self.page.get_by_role('button', name='Clear documents', exact=True).click()
        self.page.evaluate('reading')
        self.assertEqual(self.page.evaluate('INT.docs.length'), 0)
        self.assertEqual(self.page.evaluate('pdfStats.cancelled'), 1)
        self.assertEqual(self.page.evaluate('pdfStats.destroyed'), 1)
        self.assertGreaterEqual(self.page.evaluate('pdfStats.cleaned'), 2)

    def test_real_browser_image_encoders_match_header_and_conversion(self):
        results = self.page.evaluate('''async () => {
          const canvas=document.createElement('canvas');canvas.width=80;canvas.height=40;
          canvas.getContext('2d').fillRect(0,0,80,40);const results=[];
          for(const type of ['image/png','image/jpeg','image/webp']){
            const blob=await new Promise(resolve=>canvas.toBlob(resolve,type));
            const file=new File([blob],'fixture',{type:blob.type});
            const info=basisImageInspect(await file.slice(0,BASIS_IMAGE_LIMITS.header).arrayBuffer());
            const converted=await intFitImage(file,{images:{maxInputBytes:1,mediaTypes:[]}}),bitmap=await createImageBitmap(converted);
            results.push({type,header:info.width===80&&info.height===40,converted:bitmap.width===80&&bitmap.height===40});bitmap.close();
          }
          return results;
        }''')
        self.assertTrue(all(r['header'] and r['converted'] for r in results), results)

    def test_oversized_image_header_rejects_before_decoder_or_pass_through(self):
        result = self.page.evaluate('''async () => {
          const bytes=new Uint8Array(33);bytes.set([137,80,78,71,13,10,26,10]);
          const view=new DataView(bytes.buffer);view.setUint32(8,13);bytes.set([73,72,68,82],12);
          view.setUint32(16,40000);view.setUint32(20,40000);bytes[24]=8;bytes[25]=2;
          const decode=createImageBitmap;let calls=0,error='';globalThis.createImageBitmap=async()=>{calls++;throw Error('decoder should not run');};
          try{await intFitImage(new File([bytes],'large.png',{type:'image/png'}),{images:{maxInputBytes:100000,mediaTypes:['image/png']}});}catch(e){error=e.message;}finally{globalThis.createImageBitmap=decode;}
          return {calls,error};
        }''')
        self.assertEqual(result['calls'], 0)
        self.assertIn('40-megapixel', result['error'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
