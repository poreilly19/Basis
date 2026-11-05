"""Exercise the compiled Windows app through the official Tauri WebDriver.

Uses only Python's standard library. The native driver must already be running
on loopback. Creates fixture edits in the runner's isolated desktop workspace;
never invokes a paid AI API or opens a native save dialog.
"""
import argparse
import base64
import json
from pathlib import Path
import sys
import time
from urllib.request import Request, urlopen


def request(url, method='GET', data=None):
    payload=None if data is None else json.dumps(data).encode('utf-8')
    with urlopen(Request(url, data=payload, method=method,
                         headers={'Content-Type':'application/json'}), timeout=100) as response:
        value=json.load(response).get('value')
    if isinstance(value, dict) and value.get('error'):
        raise RuntimeError(str(value.get('message', value['error'])))
    return value


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--application',type=Path,required=True)
    parser.add_argument('--port',type=int,default=4444)
    args=parser.parse_args()
    if not args.application.is_file():raise RuntimeError('Compiled application is missing')
    origin=f'http://127.0.0.1:{args.port}'
    session=None
    def start():
        nonlocal session
        result=request(origin+'/session','POST',{'capabilities':{'alwaysMatch':{
            'tauri:options':{'application':str(args.application.resolve())}}}})
        session=result['sessionId']
        request(f'{origin}/session/{session}/timeouts','POST',{'script':90000})
        deadline=time.monotonic()+45
        while time.monotonic()<deadline:
            if run("return typeof PW!=='undefined' && !!PW.cur && document.querySelector('#startup')?.hidden;"):
                return
            time.sleep(.25)
        raise RuntimeError('The native workspace did not become ready')
    def run(script,args=None):
        return request(f'{origin}/session/{session}/execute/sync','POST',{'script':script,'args':args or []})
    def asynchronous(script,args=None):
        result=request(f'{origin}/session/{session}/execute/async','POST',{
            'script':"const done=arguments[arguments.length-1];Promise.resolve().then(async()=>{"+script+"}).then(value=>done({ok:true,value}),error=>done({ok:false,error:String(error.message||error)}));",
            'args':args or []})
        if not result.get('ok'):raise RuntimeError(result.get('error','Native operation failed'))
        return result.get('value')
    try:
        start()
        assert run("return BASIS_DESKTOP.available && PWS.kind==='desktop' && isSecureContext;")
        print('PASS native window, secure origin and durable desktop backend',flush=True)
        evidence=asynchronous("""
          S.name='Desktop persistence fixture';DIRTY();await pwSaveCur();await PW.q;
          const snapshot=await BASIS_DESKTOP.readSnapshot();
          return {name:S.name,index:snapshot.entries.pw_index.props.find(p=>p.id===PW.cur).name,revision:snapshot.revision};
        """)
        assert evidence['name']==evidence['index']=='Desktop persistence fixture'
        request(f'{origin}/session/{session}','DELETE');session=None
        start()
        assert run("return S.name;")=='Desktop persistence fixture'
        print('PASS real native save and process restart preserve model edits',flush=True)
        result=asynchronous("""
          const model=blankState();model.years=1;model.startYear=2026;model.startMonth=1;
          model.gvRate=0;model.clRate=0;model.ops=[];model.nonops=[];model.caps=[];
          model.groundLeases=[];model.tenants=[];
          const before=calc(model),bytes=await basisCreateArchive({kind:'property',model});
          const restored=await basisReadArchive(new Blob([bytes]));
          return {before:before.noiY1,after:calc(restored.model).noiY1};
        """)
        assert result['before']==result['after']==0
        print('PASS native archive round trip and shared calculation engine',flush=True)
        assert asynchronous("""
          const lib=await pfXlsxLib(),book=lib.utils.book_new();
          lib.utils.book_append_sheet(book,lib.utils.aoa_to_sheet([['Amount'],[1234567890.12345]]),'Fixture');
          const bytes=lib.write(book,{type:'array',bookType:'xlsx'});
          const reopened=lib.read(bytes,{type:'array'});
          return reopened.Sheets.Fixture.A2.v;
        """)==1234567890.12345
        print('PASS packaged Excel library and decimal precision',flush=True)
        sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tests'))
        from runtime_pdf_smoke import original_pdf
        pdf=base64.b64encode(original_pdf()).decode('ascii')
        result=asynchronous("""
          const bytes=Uint8Array.from(atob(arguments[0]),c=>c.charCodeAt(0));
          const library=await intPdfLib(),original=intPdfLib;let task,output;
          intPdfLib=async()=>({...library,getDocument(options){task=library.getDocument(options);return task;}});
          try{
            output=await intPdf(bytes.buffer,null,{active:()=>true});
            const worker=task?._worker;
            return {text:output.pages.map(page=>page.text).join('\n'),pages:output.pages.length,version:library.version,
              dedicated:worker?._webWorker instanceof Worker && worker.port===worker._webWorker};
          }finally{intPdfLib=original;if(output)await intPdfCleanup(output.pdf,{active:()=>true});}
        """,[pdf])
        assert result['version']=='4.10.38' and result['pages']==1 and result['dedicated'] and 'Annual rent 12000' in result['text']
        print('PASS packaged PDF reader and dedicated worker',flush=True)
        result=asynchronous("""
          const name=await BASIS_DESKTOP.createBackup(),info=await BASIS_DESKTOP.info();
          return {name,found:info.backups.some(item=>item.name===name)};
        """)
        assert result['found']
        print('PASS native backup creation and inventory',flush=True)
        assert asynchronous("""
          await BASIS_DESKTOP.storeKey('openai','basis-ci-not-a-real-api-key');
          try{return await BASIS_DESKTOP.keyStatus('openai');}
          finally{await BASIS_DESKTOP.deleteKey('openai');}
        """) is True
        assert asynchronous("return await BASIS_DESKTOP.keyStatus('openai');") is False
        print('PASS Windows Credential Manager store/status/delete without API requests',flush=True)
        print('PASS all seven native desktop smoke checks',flush=True)
    finally:
        if session:
            try:request(f'{origin}/session/{session}','DELETE')
            except Exception:pass


if __name__=='__main__':main()
