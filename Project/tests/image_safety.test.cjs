const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'src/image_safety.js'),'utf8'),html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const start=html.indexOf('async function intFitImage(file,lim){'),end=html.indexOf('let _intLim=',start);assert.ok(start>=0&&end>start);
function setup(){
  const state={decoded:0,closed:0},context=vm.createContext({Uint8Array,
    createImageBitmap:async()=>{state.decoded++;return {width:100,height:50,close:()=>state.closed++};},
    intCanvasBlob:async draw=>{draw({drawImage(){}});return 'converted';}});
  vm.runInContext(source+'\n'+html.slice(start,end),context);
  const run=code=>vm.runInContext(code,context);
  return {context,state,run,inspect:bytes=>{context.bytes=bytes;return run('basisImageInspect(bytes)');}};
}
// Header fixtures are independently assembled test data, not third-party images.
function png(width,height){const b=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.writeUInt32BE(13,8);b.write('IHDR',12);b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);b[24]=8;b[25]=6;return b;}
function gif(width,height,version='89a'){const b=Buffer.alloc(13);b.write('GIF'+version);b.writeUInt16LE(width,6);b.writeUInt16LE(height,8);return b;}
function jpeg(width,height,marker=0xc0,extra=Buffer.alloc(0)){
  const frame=Buffer.alloc(19);frame[0]=0xff;frame[1]=marker;frame.writeUInt16BE(17,2);frame[4]=8;frame.writeUInt16BE(height,5);frame.writeUInt16BE(width,7);frame[9]=3;
  return Buffer.concat([Buffer.from([0xff,0xd8]),extra,frame,Buffer.from([0xff,0xd9])]);
}
function webp(width,height,kind='VP8X'){
  const size=kind==='VP8L'?5:10,b=Buffer.alloc(20+size);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WEBP',8);b.write(kind,12);b.writeUInt32LE(size,16);
  if(kind==='VP8X'){b.writeUIntLE(width-1,24,3);b.writeUIntLE(height-1,27,3);}
  else if(kind==='VP8 '){b.set([0x9d,1,0x2a],23);b.writeUInt16LE(width,26);b.writeUInt16LE(height,28);}
  else{b[20]=0x2f;b.writeUInt32LE(((width-1)|((height-1)<<14))>>>0,21);}
  return b;
}

test('image headers identify actual PNG, JPEG, GIF and WebP dimensions',()=>{
  const {inspect}=setup();
  for(const [bytes,format,mime] of [[png(640,480),'png','image/png'],[jpeg(640,480),'jpeg','image/jpeg'],[gif(640,480),'gif','image/gif'],[gif(640,480,'87a'),'gif','image/gif'],...[ 'VP8X','VP8 ','VP8L'].map(kind=>[webp(640,480,kind),'webp','image/webp'])]){
    assert.deepEqual(structuredClone(inspect(bytes)),{format,mime,width:640,height:480});
  }
  const padded=Buffer.concat([Buffer.alloc(7),png(12,9),Buffer.alloc(4)]);assert.equal(inspect(padded.subarray(7,padded.length-4)).width,12);
});

test('image header dimensions enforce both edge and total pixel budgets before decoding',()=>{
  const {inspect,state}=setup();
  assert.equal(inspect(png(8000,5000)).width,8000);assert.equal(inspect(png(16384,1)).width,16384);
  for(const bytes of [png(8001,5000),png(16385,1),png(0,1),gif(20000,1),jpeg(10000,5000),webp(8001,5000)])assert.throws(()=>inspect(bytes),/Image exceeds|dimensions are invalid/);
  assert.equal(state.decoded,0);
});

test('JPEG metadata and progressive/lossless frame markers are parsed with bounded scanning',()=>{
  const {inspect}=setup(),metadata=Buffer.from([0xff,0xe1,0,6,1,2,3,4]);
  for(const marker of [0xc0,0xc2,0xc3])assert.equal(inspect(jpeg(640,480,marker,metadata)).height,480);
  const segment=Buffer.alloc(65537);segment[0]=0xff;segment[1]=0xe1;segment.writeUInt16BE(65535,2);
  assert.throws(()=>inspect(jpeg(640,480,0xc0,Buffer.concat(Array(8).fill(segment)))),/first 512 KiB/);
  assert.throws(()=>inspect(jpeg(640,0)),/dimensions are invalid/);
  assert.throws(()=>inspect(Buffer.from([0xff,0xd8,0xff,0xe1,0,0])),/malformed/);
  assert.throws(()=>inspect(Buffer.from([0xff,0xd8,0xff,0xda,0,2])),/malformed/);
});

test('truncated, unsupported or inconsistent image headers fail clearly',()=>{
  const {inspect}=setup();
  for(const bytes of [Buffer.from('<svg/>'),Buffer.alloc(0),png(10,10).subarray(0,24),gif(10,10).subarray(0,9),webp(10,10).subarray(0,25),jpeg(10,10).subarray(0,10)])assert.throws(()=>inspect(bytes),/Unsupported image|malformed/);
  const badPng=png(10,10);badPng.write('IDAT',12);assert.throws(()=>inspect(badPng),/malformed/);
  const badWebp=webp(10,10);badWebp.writeUInt32LE(1,4);assert.throws(()=>inspect(badWebp),/malformed/);
  const badLossless=webp(10,10,'VP8L');badLossless[24]|=0x20;assert.throws(()=>inspect(badLossless),/malformed/);
});

test('image fitting inspects a bounded header before allowed pass-through and rejects giant sources',async()=>{
  const {context,run,state}=setup();let sliceEnd;
  const blob=new Blob([png(100,50)],{type:'image/png'}),file={size:blob.size,type:blob.type,slice:(start,end,type)=>{sliceEnd=end;return blob.slice(start,end,type);}};
  context.file=file;context.limits={images:{mediaTypes:['image/png'],maxInputBytes:1000}};
  assert.equal(await run('intFitImage(file,limits)'),file);assert.equal(sliceEnd,512*1024);assert.equal(state.decoded,0);
  for(const types of [['image/png'],['image/jpeg']]){
    context.file=new Blob([png(40000,40000)],{type:'image/png'});context.limits={images:{mediaTypes:types,maxInputBytes:1000}};
    await assert.rejects(run('intFitImage(file,limits)'),/40-megapixel/);assert.equal(state.decoded,0);
  }
});

test('image fitting uses actual content MIME and rejects unsupported bytes before decoding',async()=>{
  const {context,run,state}=setup();context.file=new Blob([png(100,50)],{type:'image/jpeg'});context.limits={images:{mediaTypes:['image/png'],maxInputBytes:1000}};
  const normalized=await run('intFitImage(file,limits)');assert.equal(normalized.type,'image/png');assert.deepEqual(Buffer.from(await normalized.arrayBuffer()),png(100,50));assert.equal(state.decoded,0);
  context.file=new Blob(['<svg/>'],{type:'image/png'});await assert.rejects(run('intFitImage(file,limits)'),/Unsupported image/);assert.equal(state.decoded,0);
});

test('decoded bitmap dimensions are rechecked and resources close when the decoder disagrees',async()=>{
  const {context,run,state}=setup();context.file=new Blob([png(100,50)],{type:'image/png'});context.limits={images:{mediaTypes:['image/jpeg']}};
  context.createImageBitmap=async()=>{state.decoded++;return {width:40000,height:40000,close:()=>state.closed++};};
  await assert.rejects(run('intFitImage(file,limits)'),/40-megapixel/);assert.equal(state.closed,1);
});
