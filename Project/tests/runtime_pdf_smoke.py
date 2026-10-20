"""Optional real PDF.js smoke tests using only separately cached, pinned files.

Run: BASIS_DEPENDENCY_DIR=/path/to/artifacts python3 tests/runtime_pdf_smoke.py
No dependency or PDF is downloaded by this suite. The PDF fixture below is an
original ASCII document with computed object offsets and a complete xref table.
"""
import os
import unittest
from urllib.parse import urlsplit

from runtime_dependency_support import load_runtime_dependencies

if os.environ.get('BASIS_DEPENDENCY_DIR'):
    import browser_test as harness


def original_pdf():
    stream = (b'BT /F1 12 Tf 36 150 Td (Basis original runtime PDF fixture.) Tj '
              b'0 -24 Td (Annual rent 12000 USD.) Tj ET\n')
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] '
        b'/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        b'<< /Length ' + str(len(stream)).encode('ascii') + b' >>\nstream\n' + stream + b'endstream',
    ]
    document = bytearray(b'%PDF-1.4\n% Original Basis smoke fixture\n')
    offsets = [0]
    for number, obj in enumerate(objects, 1):
        offsets.append(len(document))
        document += str(number).encode('ascii') + b' 0 obj\n' + obj + b'\nendobj\n'
    xref = len(document)
    document += b'xref\n0 6\n0000000000 65535 f \n'
    for offset in offsets[1:]:
        document += f'{offset:010d} 00000 n \n'.encode('ascii')
    document += b'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'
    document += str(xref).encode('ascii') + b'\n%%EOF\n'
    return bytes(document)


@unittest.skipUnless(os.environ.get('BASIS_DEPENDENCY_DIR'), 'Set BASIS_DEPENDENCY_DIR for optional audited-runtime tests')
class RuntimePdfSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.artifacts = load_runtime_dependencies()
        harness.BrowserTests.setUpClass.__func__(cls)

    @classmethod
    def tearDownClass(cls):
        harness.BrowserTests.tearDownClass.__func__(cls)

    def setUp(self):
        harness.BrowserTests.setUp(self)
        self.requests, self.blocked = [], []
        self.reject_primary = False

        def route(request):
            url = request.request.url
            if urlsplit(url).netloc == urlsplit(self.url).netloc:
                request.continue_()
            elif url in self.artifacts and '/pdf.js/' in url:
                self.requests.append(url)
                if self.reject_primary and '/4.10.38/' in url:
                    request.fulfill(status=503, body='Primary PDF runtime deliberately unavailable',
                                    content_type='text/plain', headers={'Access-Control-Allow-Origin': '*'})
                else:
                    request.fulfill(status=200, body=self.artifacts[url], content_type='text/javascript',
                                    headers={'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store'})
            else:
                self.blocked.append(url)
                request.abort()
        self.context.route('**/*', route)

    def tearDown(self):
        harness.BrowserTests.tearDown(self)

    def read_render_dispose(self):
        return self.page.evaluate('''async bytes => {
          const lib=await intPdfLib(),pair=await _basisPdfLoader.load(),original=intPdfLib,tasks=[],canvases=[];
          intPdfLib=async()=>({...lib,getDocument(options){const task=lib.getDocument(options);tasks.push(task);return task;}});
          const scope={active:()=>true,pdfTimeouts:{load:5000,open:5000,page:5000,render:5000,dispose:2000}};
          let result,bitmap,canvas,worker;
          try {
            result=await intPdf(new Uint8Array(bytes).buffer,null,scope);
            worker=tasks[0]._worker;
            const dedicated=worker?._webWorker instanceof Worker&&worker.port===worker._webWorker;
            const create=document.createElement.bind(document);
            document.createElement=function(tag,...args){const node=create(tag,...args);if(tag==='canvas')canvases.push(node);return node;};
            let blob;try{blob=await intRenderPage(result.pdf,1,scope);}finally{document.createElement=create;}
            bitmap=await createImageBitmap(blob);canvas=create('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
            const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);
            const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
            let dark=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<180&&pixels[i+1]<180&&pixels[i+2]<180)dark++;
            const rendering={type:blob.type,size:blob.size,width:bitmap.width,height:bitmap.height,dark,
              canvasReleased:canvases.length>0&&canvases[0].width===0&&canvases[0].height===0};
            await intPdfCleanup(result.pdf,scope);
            return {version:lib.version,workerSrc:lib.GlobalWorkerOptions.workerSrc,dedicated,
              verified:pair.verified===true,workerUrl:pair.workerUrl,hasWorkerExport:'worker' in pair,
              pages:result.pages,scans:result.scans,rendering,disposed:tasks[0].destroyed&&worker.destroyed};
          }finally{
            if(result)await intPdfCleanup(result.pdf,scope);
            if(bitmap)bitmap.close();if(canvas){canvas.width=0;canvas.height=0;}intPdfLib=original;
          }
        }''', list(original_pdf()))

    def assert_runtime_result(self, version):
        result = self.read_render_dispose()
        self.assertEqual(result['version'], version)
        self.assertTrue(result['workerSrc'].startswith('blob:' + self.url + '/'), 'The worker must use verified local Blob bytes')
        self.assertEqual(result['workerSrc'], result['workerUrl'])
        self.assertTrue(result['verified'])
        self.assertFalse(result['hasWorkerExport'], 'The verified worker module must not be evaluated in the main window')
        self.assertTrue(result['dedicated'], 'The approved real PDF.js reader must start a dedicated Worker')
        self.assertEqual(result['pages'], [{'n': 1, 'text': 'Basis original runtime PDF fixture.\nAnnual rent 12000 USD.'}])
        self.assertEqual(result['scans'], [])
        self.assertEqual(result['rendering']['type'], 'image/jpeg')
        self.assertGreater(result['rendering']['size'], 100)
        self.assertEqual((result['rendering']['width'], result['rendering']['height']), (750, 500))
        self.assertGreater(result['rendering']['dark'], 100, 'The real rasterizer must paint the original text')
        self.assertTrue(result['rendering']['canvasReleased'])
        self.assertTrue(result['disposed'])
        self.assertEqual(self.blocked, [], 'No unpinned external request may be required')
        self.assertTrue(any(f'/{version}/pdf.min.mjs' in url for url in self.requests))
        self.assertTrue(any(f'/{version}/pdf.worker.min.mjs' in url for url in self.requests))

    def test_primary_real_pdf_text_worker_render_and_disposal(self):
        self.assert_runtime_result('4.10.38')
        requests = list(self.requests)
        self.assert_runtime_result('4.10.38')
        self.assertEqual(self.requests, requests, 'A second document must reuse verified bytes and a live worker Blob URL')

    def test_unavailable_primary_uses_matched_real_fallback(self):
        self.reject_primary = True
        self.assert_runtime_result('4.4.168')
        self.assertTrue(any('/4.10.38/' in url for url in self.requests))

    def test_corrupt_pdf_has_bounded_visible_error_and_disposes_loading_task(self):
        result = self.page.evaluate('''async () => {
          const lib=await intPdfLib(),original=intPdfLib,tasks=[];
          intPdfLib=async()=>({...lib,getDocument(options){const task=lib.getDocument(options);tasks.push(task);return task;}});
          const start=performance.now();
          try{
            setMode('inputs');go('tools','import');
            await basisPdfWait(intAdd([new File(['%PDF-1.4\\nDeliberately corrupt original PDF fixture.\\n%%EOF\\n'],
              'corrupt-original.pdf',{type:'application/pdf'})]),{timeoutMs:8000,label:'Corrupt PDF smoke test'});
            const doc=INT.docs.at(-1);
            return {status:doc.status,error:doc.err,visible:document.body.innerText.includes(doc.err),
              elapsed:performance.now()-start,disposed:tasks.length===1&&tasks[0].destroyed};
          }finally{intPdfLib=original;}
        }''')
        self.assertEqual(result['status'], 'error')
        self.assertRegex(result['error'], '(?i)invalid|pdf|structure')
        self.assertTrue(result['visible'], 'The import pane must display the PDF failure')
        self.assertLess(result['elapsed'], 8000)
        self.assertTrue(result['disposed'])
        self.assertEqual(self.blocked, [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
