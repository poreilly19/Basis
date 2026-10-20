// Select a supported Python without shell quoting or retrying a failed test run.
'use strict';
const nativeSpawnSync=require('node:child_process').spawnSync;
const signals=require('node:os').constants.signals;
const VERSION_PROBE="import sys;sys.stdout.write('%d.%d' % sys.version_info[:2])";

function runPython(args,{spawnSync=nativeSpawnSync,platform=process.platform,env=process.env,
  cwd=process.cwd(),stderr=process.stderr}={}){
  const report=message=>stderr.write(message+'\n');
  if(!Array.isArray(args)||!args.length||args.some(value=>typeof value!=='string')){
    report('Usage: node scripts/run-python.cjs PYTHON_ARGUMENT [ARGUMENT ...]');return 2;
  }
  const explicit=Object.prototype.hasOwnProperty.call(env,'BASIS_PYTHON');
  if(explicit&&(typeof env.BASIS_PYTHON!=='string'||!env.BASIS_PYTHON.trim())){
    report('BASIS_PYTHON must name a Python executable path.');return 2;
  }
  const candidates=explicit?[[env.BASIS_PYTHON,[]]]:platform==='win32'?
    [['python',[]],['py',['-3']],['python3',[]]]:[['python3',[]],['python',[]]];
  const failures=[];let selected=null;
  for(const [command,prefix]of candidates){
    let probe;
    try{probe=spawnSync(command,[...prefix,'-c',VERSION_PROBE],{
      cwd,env,encoding:'utf8',shell:false,windowsHide:true,timeout:5000,maxBuffer:4096});}
    catch(error){failures.push(command+': '+(error.message||error));continue;}
    if(probe.error){failures.push(command+': '+(probe.error.code||probe.error.message||'unavailable'));continue;}
    if(probe.status!==0){failures.push(command+': version probe failed');continue;}
    const match=/^(\d+)\.(\d+)$/.exec(String(probe.stdout||'').trim());
    if(!match||!(+match[1]>3||(+match[1]===3&&+match[2]>=10))){
      failures.push(command+': requires Python 3.10 or newer');continue;
    }
    selected={command,prefix};break;
  }
  if(!selected){report('A supported Python executable was not found. Install Python 3.10+ or set BASIS_PYTHON to its executable path.\n'+failures.join('\n'));return 2;}
  let result;
  try{result=spawnSync(selected.command,[...selected.prefix,...args],{cwd,env,stdio:'inherit',shell:false,windowsHide:false});}
  catch(error){report('Could not start the selected Python: '+(error.message||error));return 1;}
  // Interpreter selection is complete. A test failure, missing script or launch
  // error must never rerun an operation through another Python installation.
  if(result.error){report('Could not run the selected Python: '+(result.error.message||result.error));return result.error.code==='ENOENT'?127:1;}
  if(Number.isInteger(result.status))return result.status;
  if(result.signal){report('Python stopped by '+result.signal+'.');return 128+(signals[result.signal]||1);}
  report('Python exited without an exit status.');return 1;
}

module.exports={runPython,VERSION_PROBE};
if(require.main===module)process.exitCode=runPython(process.argv.slice(2));
