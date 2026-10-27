// Read-only anonymous Access gate probe. No cookies, API keys, or login attempts.
'use strict';
const PATHS=Object.freeze(['/', '/release.json', '/privacy', '/limitations', '/headers.json', '/runtime-inventory.json', '/THIRD_PARTY_NOTICES.txt', '/third_party/SHEETJS_LICENSE_0_20_3.txt', '/third_party/PDFJS_LICENSE_4_10_38.txt', '/basis-access-probe-not-a-real-file']);
function targetOrigin(value,allowHttp=false){
  let url;try{url=new URL(value);}catch{throw Error('Provide a complete HTTPS site origin.');}
  const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if((url.protocol!=='https:'&&!(allowHttp&&loopback&&url.protocol==='http:'))||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Use an HTTPS origin with no credentials, path, query or fragment; HTTP requires explicit loopback test mode.');
  return url.origin;
}
function loginTeam(value){
  if(typeof value!=='string'||!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.cloudflareaccess\.com$/.test(value))throw Error('Provide the exact team hostname, such as team-name.cloudflareaccess.com.');
  return value;
}
function validLoginRedirect(response,team){
  if(![302,303,307,308].includes(response.status))return false;
  let location;try{location=new URL(response.headers.get('location'));}catch{return false;}
  return location.protocol==='https:'&&location.hostname===team&&!location.port&&!location.username&&!location.password&&/^\/cdn-cgi\/access\/login(?:\/|$)/.test(location.pathname);
}
async function checkAccess(site,team,{allowHttp=false,fetchImpl=globalThis.fetch,timeoutMs=10000}={}){
  const origin=targetOrigin(site,allowHttp);team=loginTeam(team);
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('Invalid probe deadline.');
  const checked=[];
  for(const pathname of PATHS){
    const ctl=new AbortController();let timer;
    try{
      const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{ctl.abort();reject(Error('timeout'));},timeoutMs);});
      const response=await Promise.race([Promise.resolve().then(()=>fetchImpl(origin+pathname,{method:'GET',redirect:'manual',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:ctl.signal,headers:{Accept:'text/html,application/json;q=0.9,*/*;q=0.1'}})),deadline]);
      if(response.body)response.body.cancel().catch(()=>{});
      if(!validLoginRedirect(response,team))throw Error('not-protected');
      checked.push(pathname);
    }catch{
      throw Error('Access gate was not confirmed for '+pathname+'. Require a redirect to the expected Cloudflare Access login; public content, denial/outage pages, other redirects and timeouts do not pass.');
    }finally{clearTimeout(timer);ctl.abort();}
  }
  return {origin,team,anonymousGateConfirmed:true,pathsChecked:checked,limits:'This checks anonymous redirects only. Verify invited and excluded identities, every deployed hostname, expiry/revocation and authenticated release bytes separately.'};
}
async function main(args){
  const flags={};
  for(let i=0;i<args.length;i++){
    const key=args[i];if(key==='--allow-http'){if(flags.allowHttp)throw Error('Duplicate argument');flags.allowHttp=true;}
    else if(['--url','--team'].includes(key)){if(flags[key]||!args[i+1]||args[i+1].startsWith('--'))throw Error('Invalid or duplicate argument');flags[key]=args[++i];}
    else throw Error('Usage: node deploy/cloudflare/check-access.cjs --url https://project.pages.dev/ --team team-name.cloudflareaccess.com [--allow-http]');
  }
  const result=await checkAccess(flags['--url'],flags['--team'],{allowHttp:flags.allowHttp});
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(require.main===module)main(process.argv.slice(2)).catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
module.exports={PATHS,targetOrigin,loginTeam,validLoginRedirect,checkAccess};
