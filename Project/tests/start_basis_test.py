"""Portable launcher integration checks; native CMD execution runs only on Windows."""
import functools
import hashlib
import http.server
import importlib.util
import json
import os
from pathlib import Path
import queue
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.request
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('start_basis',ROOT/'scripts/start-basis.py')
launcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(launcher)

class StartBasisTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='Basis launcher spaces ')
        self.directory=Path(self.temp.name);self.app=self.directory/'app';self.app.mkdir()
        self.html=b'<!doctype html><title>Basis test</title>'
        (self.app/'index.html').write_bytes(self.html)
        (self.directory/'scripts').mkdir()
        shutil.copy2(ROOT/'scripts/start-basis.py',self.directory/'scripts/start-basis.py')
        shutil.copy2(ROOT/'Start Basis.cmd',self.directory/'Start Basis.cmd')
        self.processes=[];self.readers={}
    def tearDown(self):
        for process in self.processes:
            if process.poll() is None:
                if os.name=='nt':subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],capture_output=True,timeout=8)
                else:process.terminate()
            process.wait(timeout=8)
            if process in self.readers:self.readers[process].join(timeout=2)
            if process.stdout:process.stdout.close()
        self.temp.cleanup()
    def start(self,cmd=None):
        command=cmd or [sys.executable,str(self.directory/'scripts/start-basis.py'),'--no-browser','--port','0']
        p=subprocess.Popen(command,cwd=self.directory.parent,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
        self.processes.append(p);lines=queue.Queue()
        reader=threading.Thread(target=lambda:[lines.put(line) for line in p.stdout],daemon=True);self.readers[p]=reader;reader.start()
        output=[]
        for _ in range(8):
            line=lines.get(timeout=8);output.append(line)
            if line.startswith('Basis Studio: '):return p,line.split(': ',1)[1].strip()
        self.fail('Launcher did not print its URL: '+''.join(output))
    def get(self,url):
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        return opener.open(url,timeout=4)
    def test_relative_folder_with_spaces_serves_app_on_ipv4_loopback(self):
        _,url=self.start()
        self.assertTrue(url.startswith('http://127.0.0.1:'))
        with self.get(url) as response:
            self.assertEqual(response.read(),self.html)
            self.assertEqual(response.headers['Cache-Control'],'no-store')
        with self.get(url+launcher.HEALTH.lstrip('/')) as response:
            self.assertEqual(json.load(response),{'app':'Basis Studio','sha256':hashlib.sha256(self.html).hexdigest()})
        with self.assertRaises(Exception):self.get(url+'scripts/start-basis.py')
    def test_same_app_busy_port_reuses_the_running_server(self):
        p,url=self.start();port=int(url.rsplit(':',1)[1].strip('/'))
        result=subprocess.run([sys.executable,str(self.directory/'scripts/start-basis.py'),'--no-browser','--port',str(port)],capture_output=True,text=True,timeout=8)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('already running at '+url,result.stdout)
        self.assertIsNone(p.poll())
    def test_running_server_rejects_another_listener_even_with_address_reuse(self):
        _,url=self.start();port=int(url.rsplit(':',1)[1].strip('/'))
        with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as other:
            other.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
            with self.assertRaises(OSError):
                other.bind((launcher.HOST,port))
                other.listen()
        with self.get(url) as response:self.assertEqual(response.read(),self.html)
    def test_other_app_or_version_on_port_is_not_claimed_as_basis(self):
        _,url=self.start();port=int(url.rsplit(':',1)[1].strip('/'))
        (self.app/'index.html').write_text('Changed release',encoding='utf-8')
        result=subprocess.run([sys.executable,str(self.directory/'scripts/start-basis.py'),'--no-browser','--port',str(port)],capture_output=True,text=True,timeout=8)
        self.assertEqual(result.returncode,1)
        self.assertIn('Port '+str(port)+' is in use',result.stderr)
        self.assertIn('address has not changed',result.stderr)
    def test_missing_app_and_invalid_port_explain_recovery(self):
        (self.app/'index.html').unlink()
        result=subprocess.run([sys.executable,str(self.directory/'scripts/start-basis.py'),'--no-browser'],capture_output=True,text=True,timeout=8)
        self.assertEqual(result.returncode,1);self.assertIn('Extract the complete Basis ZIP',result.stderr)
        result=subprocess.run([sys.executable,str(self.directory/'scripts/start-basis.py'),'--port','70000'],capture_output=True,text=True,timeout=8)
        self.assertNotEqual(result.returncode,0);self.assertIn('between 0 and 65535',result.stderr)
    def test_browser_failure_prints_manual_address_instruction(self):
        with patch.object(launcher.webbrowser,'open',return_value=False) as open_browser,patch('builtins.print') as output:
            launcher.open_browser('http://127.0.0.1:8765/',True)
            open_browser.assert_called_once_with('http://127.0.0.1:8765/')
            self.assertIn('Open the address',str(output.call_args))
    @unittest.skipUnless(os.name=='nt','Native CMD execution requires Windows; portable server checks run on every OS')
    def test_native_windows_cmd_from_unrelated_folder(self):
        _,url=self.start(['cmd.exe','/d','/c',str(self.directory/'Start Basis.cmd'),'--no-browser','--port','0'])
        with self.get(url) as response:self.assertEqual(response.read(),self.html)

if __name__=='__main__':unittest.main(verbosity=2)
