"""Exercise the compiled Windows app through the official Tauri WebDriver.

Uses only Python's standard library. The native driver must already be running
on loopback. Creates fixture edits in the runner's isolated desktop workspace;
never invokes a paid AI API or opens a native save dialog.
"""
import argparse
import base64
import csv
import io
import json
from pathlib import Path
import subprocess
import sys
import time
import zlib
from urllib.error import HTTPError
from urllib.request import Request, build_opener, ProxyHandler


def request(url, method='GET', data=None):
    payload=None if data is None else json.dumps(data).encode('utf-8')
    try:
        # This helper only calls its literal loopback driver address.
        with build_opener(ProxyHandler({})).open(Request(url, data=payload, method=method,
                             headers={'Content-Type':'application/json'}), timeout=100) as response:
            value=json.load(response).get('value')
    except HTTPError as error:
        body=error.read(8192).decode('utf-8',errors='replace')
        raise RuntimeError(f'Native WebDriver HTTP {error.code}: {body}') from error
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
          model.gvRate=0;model.clRate=0;
          model.ops=[{id:'native-fixed-expense',name:'Fixed operating cost',amt:1200,basis:'amt',fixedPct:1,infl:0,recov:false}];
          model.nonops=[];model.caps=[];
          model.groundLeases=[];model.tenants=[];
          const before=calc(model),bytes=await basisCreateArchive({kind:'property',model});
          const restored=await basisReadArchive(new Blob([bytes]));
          await recalcInBackground();
          const worker=await basisRunCalculation('property',restored.model,'desktop-smoke');
          return {before:before.noiY1,after:calc(restored.model).noiY1,worker:worker.noiY1};
        """)
        assert result['before']==result['after']==result['worker']==-1200
        print('PASS native archive, real calculation worker and independent expense golden',flush=True)
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
        closing=asynchronous("""
          S.name='Desktop close-save fixture';DIRTY();
          return {id:PW.cur,info:await BASIS_DESKTOP.info()};
        """)
        run('void BASIS_DESKTOP.close();return true;')
        deadline=time.monotonic()+30
        while time.monotonic()<deadline:
            processes=subprocess.check_output(['tasklist','/FI','IMAGENAME eq basis-desktop.exe','/FO','CSV','/NH'],text=True)
            if not any(row and row[0].casefold()=='basis-desktop.exe' for row in csv.reader(io.StringIO(processes))):break
            time.sleep(.2)
        else:raise RuntimeError('The native close handler did not finish saving and exit')
        saved=json.loads((Path(closing['info']['dataDirectory'])/'workspace.json').read_text(encoding='utf-8'))
        entries=saved['entries'];record=next(item for item in entries['pw_index']['props'] if item['id']==closing['id'])
        header=entries[record.get('storageKey','pwm_'+closing['id'])]
        text=header['s']+''.join(entries[f"pwm_{closing['id']}_{header['part']}_{part}"]['s'] for part in range(1,header['n']))
        if header['enc']=='dr64':text=zlib.decompress(base64.b64decode(text),-zlib.MAX_WBITS).decode('utf-8')
        assert record['name']==json.loads(text)['name']=='Desktop close-save fixture'
        print('PASS native window close waits for durable model and index save',flush=True)
        print('PASS all eight installed desktop smoke checks',flush=True)
    finally:
        if session:
            try:request(f'{origin}/session/{session}','DELETE')
            except Exception:pass


if __name__=='__main__':main()
