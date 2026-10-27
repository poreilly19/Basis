const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {betaHeaders,buildBeta}=require('../scripts/build-beta.cjs'),root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
test('beta CSP hashes the executable scripts and excludes unsafe inline/eval scripts',()=>{
 const headers=betaHeaders(html),csp=headers['Content-Security-Policy'];assert.equal((csp.match(/'sha256-/g)||[]).length,3);assert.ok(!csp.split(';').find(s=>s.trim().startsWith('script-src')).includes("'unsafe-inline'"));assert.ok(!csp.includes("'unsafe-eval'"));
 assert.match(csp,/frame-ancestors 'none'/);assert.match(csp,/https:\/\/api.openai.com/);assert.equal(headers['Cache-Control'],'no-store');
});
test('beta CSP refuses a newly introduced inline event handler or external script',()=>{
 assert.throws(()=>betaHeaders(html.replace('<body','<body onclick="alert(1)"')),/Inline event/);
 assert.throws(()=>betaHeaders(html+'<script src="https://unreviewed.test/x.js"></script>'),/external script/);
});
test('a changed script changes its CSP hash',()=>{
 assert.notEqual(betaHeaders(html)['Content-Security-Policy'],betaHeaders(html.replace("window.addEventListener('error'","/* changed */window.addEventListener('error'"))['Content-Security-Policy']);
});
test('minimal beta build is reproducible and includes only declared deployable files',()=>{
 const out=buildBeta(),first=fs.readFileSync(path.join(out.directory,'release.json'));assert.equal(out.release.appSha256,digest(html));
 assert.equal(fs.readFileSync(path.join(out.directory,'index.html'),'utf8'),html);
 for(const [name,record]of Object.entries(out.release.files)){const bytes=fs.readFileSync(path.join(out.directory,name));assert.equal(digest(bytes),record.sha256);assert.equal(bytes.length,record.bytes);}
 assert.deepEqual(buildBeta().release,out.release);assert.deepEqual(fs.readFileSync(path.join(out.directory,'release.json')),first);
 assert.ok(!Object.keys(out.release.files).some(name=>name.startsWith('tests/')||name.startsWith('samples/')||name.endsWith('.env')));
 assert.match(out.release.accessControl,/does not implement login/);
});
test('beta builder refuses to remove a directory it does not own',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'basis-beta-build-'));
 try{
  for(const name of ['app','docs','tests/fixtures'])fs.cpSync(path.join(root,name),path.join(temp,name),{recursive:true});fs.copyFileSync(path.join(root,'package.json'),path.join(temp,'package.json'));
  const out=path.join(temp,'dist/basis-beta');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'keep.txt'),'user file');
  assert.throws(()=>buildBeta(temp),/not generated/);assert.equal(fs.readFileSync(path.join(out,'keep.txt'),'utf8'),'user file');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
for(const kind of ['extra file','edited file','missing file'])test('beta rebuild preserves a user-modified output: '+kind,()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'basis-beta-owned-'));
 try{
  for(const name of ['app','docs','tests/fixtures'])fs.cpSync(path.join(root,name),path.join(temp,name),{recursive:true});fs.copyFileSync(path.join(root,'package.json'),path.join(temp,'package.json'));
  const out=buildBeta(temp).directory,release=fs.readFileSync(path.join(out,'release.json'));
  if(kind==='extra file')fs.writeFileSync(path.join(out,'keep.txt'),'user data');
  if(kind==='edited file')fs.writeFileSync(path.join(out,'index.html'),'user edit');
  if(kind==='missing file')fs.unlinkSync(path.join(out,'privacy.html'));
  assert.throws(()=>buildBeta(temp),/Modified deployment|missing files/);
  assert.deepEqual(fs.readFileSync(path.join(out,'release.json')),release);
  if(kind==='extra file')assert.equal(fs.readFileSync(path.join(out,'keep.txt'),'utf8'),'user data');
  if(kind==='edited file')assert.equal(fs.readFileSync(path.join(out,'index.html'),'utf8'),'user edit');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
