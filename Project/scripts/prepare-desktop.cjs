// Generate native notices before any distributable desktop application is built.
// Cargo uses the pinned toolchain and lockfile; no user credentials are required.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {buildDesktop}=require('./build-desktop.cjs');
const root=path.join(__dirname,'..');
async function main(){
  const args=process.argv.slice(2);let offline=false,cache=process.env.BASIS_RUNTIME_CACHE;
  for(let i=0;i<args.length;i++){
    if(args[i]==='--offline')offline=true;
    else if(args[i]==='--cache'&&args[i+1])cache=path.resolve(args[++i]);
    else throw Error('Usage: npm run desktop:prepare -- [--offline] [--cache DIRECTORY]');
  }
  const generated=path.join(root,'desktop/src-tauri/generated');fs.mkdirSync(generated,{recursive:true});
  const metadata=cp.execFileSync('cargo',['metadata','--manifest-path',path.join(root,'desktop/src-tauri/Cargo.toml'),
    '--locked','--format-version','1','--filter-platform','x86_64-pc-windows-msvc',...(offline?['--offline']:[])],
    {cwd:path.join(root,'desktop'),encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','inherit']});
  const filename=path.join(generated,'cargo-metadata.json');fs.writeFileSync(filename,metadata);
  // Invoke the same audited generator used in CI so packaged notices are current.
  cp.execFileSync(process.execPath,[path.join(root,'scripts/native-notices.cjs'),'--metadata',filename],{cwd:root,stdio:'inherit'});
  const result=await buildDesktop({root,cache:cache&&path.resolve(cache),offline,requireNativeNotices:true});
  console.log(JSON.stringify({directory:result.directory,version:result.release.version,nativeNoticesIncluded:result.release.nativeNoticesIncluded}));
}
main().catch(error=>{console.error('Desktop preparation failed: '+error.message);process.exitCode=1;});
