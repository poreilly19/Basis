"""Exercise the installed Windows app through Microsoft's WebView2 WebDriver.

Uses only Python's standard library. The native driver must already be running
on loopback. Creates fixture edits in the runner's isolated desktop workspace;
never invokes a paid AI API or opens a native save dialog.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import subprocess
import socket
import sys
import tempfile
import time
import zlib
from urllib.error import HTTPError
from urllib.request import Request, build_opener, ProxyHandler


def request(url, method='GET', data=None, *, unwrap=True, timeout=100):
    payload=None if data is None else json.dumps(data).encode('utf-8')
    try:
        # This helper only calls its literal loopback driver address.
        with build_opener(ProxyHandler({})).open(Request(url, data=payload, method=method,
                             headers={'Content-Type':'application/json'}), timeout=timeout) as response:
            result=json.load(response)
            value=result.get('value') if unwrap else result
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
    parser.add_argument('--log-dir',type=Path)
    args=parser.parse_args()
    if not args.application.is_file():raise RuntimeError('Compiled application is missing')
    origin=f'http://127.0.0.1:{args.port}'
    debugger='127.0.0.1:9222'
    debug_origin='http://'+debugger
    log_dir=(args.log_dir or Path(tempfile.mkdtemp(prefix='basis-desktop-native-'))).resolve()
    log_dir.mkdir(parents=True,exist_ok=True)
    session=None
    application=None
    launch_number=0
    output_files=[]
    output_paths=[]

    def port_open():
        try:
            with socket.create_connection(('127.0.0.1',9222),timeout=.3):return True
        except OSError:return False

    def output_tail():
        return '\n'.join(f'{path.name}: {path.read_text(encoding="utf-8",errors="replace")[-4000:]}'
                         for path in output_paths if path.is_file())

    def close_output_files():
        for stream in output_files:stream.close()
        output_files.clear()

    def capture_startup_health():
        if os.name!='nt' or application is None:return
        # Capture the owned native process before failure cleanup. No model
        # contents, credential values or process environment are inspected.
        screenshot=str(log_dir/f'basis-startup-health-{launch_number}.png').replace("'","''")
        script=f"""$nativeHostId={application.pid};
          $nativeProcesses=@(Get-CimInstance Win32_Process);
          $nativeOwnedIds=[System.Collections.Generic.HashSet[uint32]]::new();
          [void]$nativeOwnedIds.Add($nativeHostId);
          do {{ $nativePreviousCount=$nativeOwnedIds.Count;
            foreach($nativeProcess in $nativeProcesses){{
              if($nativeOwnedIds.Contains([uint32]$nativeProcess.ParentProcessId)){{[void]$nativeOwnedIds.Add([uint32]$nativeProcess.ProcessId)}}
            }}
          }} while($nativePreviousCount -ne $nativeOwnedIds.Count);
          $nativeHost=Get-Process -Id $nativeHostId -ErrorAction SilentlyContinue;
          $nativeScreenshot=$null;$nativeScreenshotError=$null;
          try {{
            Add-Type -AssemblyName System.Windows.Forms,System.Drawing;
            $nativeScreen=[System.Windows.Forms.SystemInformation]::VirtualScreen;
            $nativeBitmap=[System.Drawing.Bitmap]::new($nativeScreen.Width,$nativeScreen.Height);
            $nativeGraphics=[System.Drawing.Graphics]::FromImage($nativeBitmap);
            try {{
              $nativeGraphics.CopyFromScreen($nativeScreen.Left,$nativeScreen.Top,0,0,$nativeScreen.Size);
              $nativeBitmap.Save('{screenshot}',[System.Drawing.Imaging.ImageFormat]::Png);
              $nativeScreenshot='{screenshot}';
            }} finally {{$nativeGraphics.Dispose();$nativeBitmap.Dispose()}}
          }} catch {{$nativeScreenshotError=$_.Exception.Message}}
          [ordered]@{{
            appPid=$nativeHostId;screenshot=$nativeScreenshot;screenshotError=$nativeScreenshotError;
            host=@($nativeHost | Select-Object Id,ProcessName,MainWindowTitle,Responding,CPU);
            processes=@($nativeProcesses | Where-Object {{$nativeOwnedIds.Contains([uint32]$_.ProcessId)}} | Select-Object ProcessId,ParentProcessId,Name,CommandLine);
            tcp=@(Get-NetTCPConnection -LocalPort 9222 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess)
          }} | ConvertTo-Json -Depth 6 -Compress"""
        try:
            result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',script],
                                  capture_output=True,text=True,timeout=15)
            try:health=json.loads(result.stdout)
            except (ValueError,TypeError):health={'stdout':result.stdout[-6000:],'stderr':result.stderr[-3000:],'exitCode':result.returncode}
        except Exception as error:health={'error':str(error)}
        (log_dir/f'basis-startup-health-{launch_number}.json').write_text(json.dumps(health,indent=2),encoding='utf-8')
        print('Native startup health: '+json.dumps(health)[:12000],flush=True)

    def delete_session():
        nonlocal session
        if session:
            try:request(f'{origin}/session/{session}','DELETE',timeout=10)
            except Exception:pass
            session=None

    def wait_for_exit():
        if application is None:raise RuntimeError('No owned desktop process is running')
        try:code=application.wait(timeout=30)
        except subprocess.TimeoutExpired as error:
            raise RuntimeError('The native close handler did not finish saving and exit') from error
        close_output_files()
        if code!=0:raise RuntimeError(f'The native application exited with code {code}.\n{output_tail()}')
        delete_session()
        deadline=time.monotonic()+10
        while port_open() and time.monotonic()<deadline:time.sleep(.2)
        if port_open():raise RuntimeError('The closed desktop process left its debugging endpoint active')

    def close_host():
        # A fast successful native close can remove the WebDriver target before
        # execute/sync returns. The owned process exit and durable-file checks
        # below remain authoritative; a live or failed process still fails.
        try:run('void BASIS_DESKTOP.close();return true;')
        except RuntimeError:pass
        wait_for_exit()

    def start():
        nonlocal session,application,launch_number,output_paths
        if application is not None and application.poll() is None:
            raise RuntimeError('The previous owned desktop process has not exited')
        if port_open():raise RuntimeError('The native debugging port is already occupied; refusing to attach to another process')
        launch_number+=1
        output_paths=[log_dir/f'basis-app-{launch_number}-{kind}.log' for kind in ['stdout','stderr']]
        output_files.extend(path.open('wb') for path in output_paths)
        environment=os.environ.copy()
        # Debugging is enabled for this owned CI child only. The shipped binary
        # and configuration do not expose a debugging port on normal launches.
        extra=environment.get('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS','').strip()
        environment['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS']=(extra+' --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1').strip()
        environment['TAURI_WEBVIEW_AUTOMATION']='true'
        environment['BASIS_DESKTOP_DIAGNOSTICS']='1'
        environment['BASIS_DESKTOP_AUTOMATION']='1'
        application=subprocess.Popen([str(args.application.resolve())],cwd=str(args.application.resolve().parent),
                                     env=environment,stdout=output_files[0],stderr=output_files[1])
        print(f'Native host launch {launch_number}, PID {application.pid}; diagnostics: {log_dir}',flush=True)
        deadline=time.monotonic()+45
        last_error='The WebView2 debugging endpoint has not responded.'
        while time.monotonic()<deadline:
            if application.poll() is not None:
                close_output_files()
                capture_startup_health()
                raise RuntimeError(f'The desktop application exited before WebView2 became available (code {application.returncode}).\n{output_tail()}')
            try:
                version=request(debug_origin+'/json/version',unwrap=False,timeout=2)
                if not isinstance(version,dict) or not version.get('webSocketDebuggerUrl'):
                    raise RuntimeError('The WebView2 debugging endpoint returned an incomplete version response')
                (log_dir/f'basis-host-{launch_number}.json').write_text(json.dumps({
                    'pid':application.pid,'application':str(args.application.resolve()),'browser':version.get('Browser'),
                    'protocolVersion':version.get('Protocol-Version')},indent=2),encoding='utf-8')
                break
            except Exception as error:last_error=str(error)
            time.sleep(.25)
        else:
            capture_startup_health()
            raise RuntimeError(f'The running native process did not expose its requested loopback WebView2 endpoint: {last_error}\n{output_tail()}')
        result=request(origin+'/session','POST',{'capabilities':{'alwaysMatch':{
            'browserName':'webview2','ms:edgeOptions':{'debuggerAddress':debugger}}}})
        session=result['sessionId']
        request(f'{origin}/session/{session}/timeouts','POST',{'script':90000})
        deadline=time.monotonic()+45
        last_error=None
        while time.monotonic()<deadline:
            if application.poll() is not None:raise RuntimeError(f'The native application exited during workspace startup (code {application.returncode}).\n{output_tail()}')
            try:
                if run("return typeof PW!=='undefined' && !!PW.cur && document.querySelector('#startup')?.hidden;"):
                    return
            except RuntimeError as error:last_error=str(error)
            time.sleep(.25)
        try:
            diagnostics=run("""let backend,workspace;
              try{backend=typeof PWS==='undefined'?null:PWS.kind;}catch(error){backend=String(error);}
              try{workspace=typeof PW==='undefined'?null:{current:PW.cur,initialized:!!PW.ix};}catch(error){workspace=String(error);}
              return {url:location.href,ready:document.readyState,secure:isSecureContext,title:document.title,
                crypto:!!globalThis.crypto?.subtle,tauri:!!globalThis.__TAURI__,backend,workspace,
                startup:document.querySelector('#startup')?.innerText?.slice(0,1500),body:document.body?.innerText?.slice(0,2500)};""")
        except Exception as error:diagnostics={'error':str(error)}
        (log_dir/f'basis-bootstrap-{launch_number}.json').write_text(json.dumps(diagnostics,indent=2),encoding='utf-8')
        raise RuntimeError(f'The native workspace did not become ready: {last_error}; diagnostics={json.dumps(diagnostics)}\n{output_tail()}')
    def run(script,args=None):
        return request(f'{origin}/session/{session}/execute/sync','POST',{'script':script,'args':args or []})
    def asynchronous(script,args=None):
        result=request(f'{origin}/session/{session}/execute/async','POST',{
            'script':"const done=arguments[arguments.length-1];Promise.resolve().then(async()=>{"+script+"}).then(value=>done({ok:true,value}),error=>done({ok:false,error:String(error.message||error)}));",
            'args':args or []})
        if not result.get('ok'):raise RuntimeError(result.get('error','Native operation failed'))
        return result.get('value')

    def type_without_blur(selector,text):
        found=request(f'{origin}/session/{session}/element','POST',{'using':'css selector','value':selector})
        element=found['element-6066-11e4-a52e-4f735466cecf']
        request(f'{origin}/session/{session}/element/{element}/click','POST',{})
        # Element Clear can run unfocusing steps. Ctrl+A and Send Keys preserve
        # focus so the test reaches the native close with an uncommitted edit.
        keys='\ue009a\ue000'+text
        request(f'{origin}/session/{session}/element/{element}/value','POST',{'text':keys,'value':list(keys)})
        assert run('const input=document.querySelector(arguments[0]);return input===document.activeElement && input.value===arguments[1];',[selector,text])
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
        close_host()
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
            return {text:output.pages.map(page=>page.text).join('\\n'),pages:output.pages.length,version:library.version,
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
          await recalcInBackground();await PW.q;
          setMode('inputs');go('property','desc');
          return {id:PW.cur,info:await BASIS_DESKTOP.info()};
        """)
        city='Desktop unblurred city fixture'
        type_without_blur('#pane input[data-field="city"]',city)
        assert run('return S.city;')!=city
        close_host()
        saved=json.loads((Path(closing['info']['dataDirectory'])/'workspace.json').read_text(encoding='utf-8'))
        entries=saved['entries'];record=next(item for item in entries['pw_index']['props'] if item['id']==closing['id'])
        header=entries[record.get('storageKey','pwm_'+closing['id'])]
        text=header['s']+''.join(entries[f"pwm_{closing['id']}_{header['part']}_{part}"]['s'] for part in range(1,header['n']))
        if header['enc']=='dr64':text=zlib.decompress(base64.b64decode(text),-zlib.MAX_WBITS).decode('utf-8')
        model=json.loads(text)
        assert record['name']==model['name']=='Desktop close-save fixture'
        assert model['city']==city
        print('PASS native window close commits focused input and waits for durable model and index save',flush=True)
        print('PASS all eight installed desktop smoke checks',flush=True)
    finally:
        delete_session()
        if application is not None and application.poll() is None:
            application.terminate()
            try:application.wait(timeout=5)
            except subprocess.TimeoutExpired:
                application.kill()
                application.wait(timeout=5)
        close_output_files()


if __name__=='__main__':main()
