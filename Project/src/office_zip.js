/* BEGIN BASIS OFFICE ZIP: bounded browser reader for Office document parts. */
const OFFICE_ZIP_LIMITS=Object.freeze({archive:64*1024*1024,entry:32*1024*1024,total:128*1024*1024,entries:4096});
const OFFICE_SHEET_LIMITS=Object.freeze({rows:100000,cols:2048,cells:2000000});
function officeSheetRow(value,fallback=1){
  const text=value===null||value===undefined?String(fallback):String(value);
  if(!/^[1-9]\d{0,5}$/.test(text)||Number(text)>OFFICE_SHEET_LIMITS.rows)throw Error('Workbook row exceeds the import limit of 100,000 rows or is invalid');
  return Number(text);
}
function officeSheetCell(ref,row=1,nextCol=0){
  if(ref===null||ref===undefined){
    if(!Number.isInteger(nextCol)||nextCol<0||nextCol>=OFFICE_SHEET_LIMITS.cols)throw Error('Workbook column exceeds the import limit of 2,048 columns');
    return {row:officeSheetRow(row),col:nextCol};
  }
  const match=/^([A-Z]{1,3})([1-9]\d{0,5})$/.exec(String(ref));
  if(!match)throw Error('Invalid workbook cell reference');
  let col=0;for(const ch of match[1])col=col*26+ch.charCodeAt(0)-64;
  if(col>OFFICE_SHEET_LIMITS.cols)throw Error('Workbook column exceeds the import limit of 2,048 columns');
  return {row:officeSheetRow(match[2]),col:col-1};
}
function officeSheetBounds(book){return {book,maxRow:0,maxCol:0};}
function officeSheetUse(bounds,row,cols){
  row=officeSheetRow(row);
  if(!Number.isInteger(cols)||cols<0||cols>OFFICE_SHEET_LIMITS.cols)throw Error('Workbook column exceeds the import limit of 2,048 columns');
  const maxRow=Math.max(row,bounds.maxRow),maxCol=Math.max(cols,bounds.maxCol);
  const total=bounds.book.cells+maxRow*maxCol-bounds.maxRow*bounds.maxCol;
  if(total>OFFICE_SHEET_LIMITS.cells)throw Error('Workbook exceeds the two-million-cell import limit; split it into smaller workbooks');
  bounds.book.cells=total;bounds.maxRow=maxRow;bounds.maxCol=maxCol;
}
function officeSheetDate1904(value){
  if(value===null||value===undefined)return false;
  const text=String(value).trim();
  if(text==='1'||text==='true')return true;
  if(text==='0'||text==='false')return false;
  throw Error('Workbook contains an invalid date1904 setting');
}
function officeSheetDate(serial,roundDay=false,date1904=false){
  const n=roundDay?Math.round(serial):serial;
  // The workbook epoch applies to date-styled values, never ordinary numbers.
  const offset=date1904?1462:0;
  if(!Number.isFinite(n)||n<0||n+offset>=2958466)throw Error('Workbook contains an invalid Excel date serial');
  return new Date(Date.UTC(1899,11,30)+Math.round(n*86400000)+offset*86400000).toISOString().slice(0,10);
}
const officeZipText=new TextDecoder('utf-8',{fatal:true});
const officeZipCrcTable=(()=>{const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0;}return table;})();
function officeZipCrc(bytes){let crc=0xffffffff;for(const b of bytes)crc=officeZipCrcTable[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
function officeZipPath(name){
  const parts=name.endsWith('/')?name.slice(0,-1).split('/'):name.split('/');
  if(!name||name.length>1024||name.startsWith('/')||/[:\\\x00-\x1f\x7f]/.test(name)||parts.some(p=>!p||p==='.'||p==='..'))throw Error('Unsafe Office ZIP path');
  return name;
}
async function officeFileBuffer(file){
  if(file.size>OFFICE_ZIP_LIMITS.archive)throw Error('Office archive exceeds the 64 MiB size limit');
  const buffer=await file.arrayBuffer();
  if(buffer.byteLength>OFFICE_ZIP_LIMITS.archive)throw Error('Office archive exceeds the 64 MiB size limit');
  return buffer;
}
function officeZipOpen(buf){
  if(buf.byteLength>OFFICE_ZIP_LIMITS.archive)throw Error('Office archive exceeds the 64 MiB size limit');
  const bytes=buf instanceof Uint8Array?buf:new Uint8Array(buf),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length<22)throw Error('Not a readable Office ZIP file');
  let end=-1;
  for(let at=bytes.length-22;at>=Math.max(0,bytes.length-65557);at--){
    if(view.getUint32(at,true)===0x06054b50&&at+22+view.getUint16(at+20,true)===bytes.length){end=at;break;}
  }
  if(end<0)throw Error('Invalid Office ZIP end record');
  const count=view.getUint16(end+10,true),central=view.getUint32(end+16,true),centralSize=view.getUint32(end+12,true);
  if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==count||count>OFFICE_ZIP_LIMITS.entries||central+centralSize!==end)throw Error('Unsupported Office ZIP structure or entry count');
  const entries=new Map();let at=central,total=0;
  const extra=(start,length)=>{const stop=start+length;while(start<stop){
    if(start+4>stop)throw Error('Invalid Office ZIP extra field');
    const id=view.getUint16(start,true),size=view.getUint16(start+2,true);start+=4;
    if(id===1)throw Error('ZIP64 Office files are not supported');
    if(start+size>stop)throw Error('Invalid Office ZIP extra field');start+=size;
  }};
  for(let i=0;i<count;i++){
    if(at+46>end||view.getUint32(at,true)!==0x02014b50)throw Error('Damaged Office ZIP directory');
    const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true),crc=view.getUint32(at+16,true),compressed=view.getUint32(at+20,true),raw=view.getUint32(at+24,true),nameLength=view.getUint16(at+28,true),extraLength=view.getUint16(at+30,true),commentLength=view.getUint16(at+32,true),local=view.getUint32(at+42,true);
    if(![0,8].includes(method)||flags&~(0x808|(method===8?6:0))||view.getUint16(at+34,true))throw Error('Unsupported Office ZIP compression, encryption or disk');
    if(raw>OFFICE_ZIP_LIMITS.entry)throw Error('Office ZIP entry exceeds the 32 MiB expanded size limit');
    total+=raw;if(total>OFFICE_ZIP_LIMITS.total)throw Error('Office ZIP exceeds the 128 MiB expanded size limit');
    if(at+46+nameLength+extraLength+commentLength>end)throw Error('Truncated Office ZIP directory');
    extra(at+46+nameLength,extraLength);
    const name=officeZipPath(officeZipText.decode(bytes.subarray(at+46,at+46+nameLength)));
    if(entries.has(name))throw Error('Duplicate Office ZIP path: '+name);
    if(local+30>central||view.getUint32(local,true)!==0x04034b50||view.getUint16(local+6,true)!==flags||view.getUint16(local+8,true)!==method)throw Error('Damaged Office ZIP local header');
    const localNameLength=view.getUint16(local+26,true),localExtraLength=view.getUint16(local+28,true),start=local+30+localNameLength+localExtraLength;
    if(start+compressed>central||officeZipText.decode(bytes.subarray(local+30,local+30+localNameLength))!==name)throw Error('Invalid Office ZIP entry location');
    extra(local+30+localNameLength,localExtraLength);
    for(const [offset,expected] of [[14,crc],[18,compressed],[22,raw]]){
      const actual=view.getUint32(local+offset,true);
      if(actual!==expected&&(!(flags&8)||actual!==0))throw Error('Office ZIP local header mismatch');
    }
    let entryEnd=start+compressed;
    if(flags&8){
      const matches=pos=>pos+12<=central&&view.getUint32(pos,true)===crc&&view.getUint32(pos+4,true)===compressed&&view.getUint32(pos+8,true)===raw;
      if(entryEnd+12>central)throw Error('Missing Office ZIP data descriptor');
      if(view.getUint32(entryEnd,true)===0x08074b50&&matches(entryEnd+4))entryEnd+=4;
      else if(!matches(entryEnd))throw Error('Invalid Office ZIP data descriptor');
      entryEnd+=12;
    }
    if(method===0&&compressed!==raw)throw Error('Invalid Office ZIP STORE size');
    if(name.endsWith('/')&&raw!==0)throw Error('Office ZIP directory contains file data');
    entries.set(name,{name,method,crc,compressed,raw,local,start,end:entryEnd});
    at+=46+nameLength+extraLength+commentLength;
  }
  if(at!==end)throw Error('Unexpected Office ZIP directory bytes');
  const ranges=[...entries.values()].sort((a,b)=>a.local-b.local);
  for(let i=1;i<ranges.length;i++)if(ranges[i].local<ranges[i-1].end)throw Error('Overlapping Office ZIP entries');
  const decoded=new Map();
  const read=async name=>{
    const entry=entries.get(name);if(!entry)return null;
    if(decoded.has(name))return decoded.get(name);
    const task=(async()=>{
      const {method,crc,compressed,raw,start}=entry,input=bytes.subarray(start,start+compressed);let output;
      if(method===0)output=input;
      else{
        if(typeof DecompressionStream==='undefined')throw Error('Compressed Office ZIP files are not supported in this browser');
        let decoder;try{decoder=new DecompressionStream('deflate-raw');}catch(e){throw Error('Compressed Office ZIP files are not supported in this browser');}
        const reader=new Blob([input]).stream().pipeThrough(decoder).getReader(),chunks=[];let length=0;
        try{
          for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;
            if(length>raw)throw Error('Office ZIP expanded size exceeds its declared limit: '+name);
            chunks.push(value);
          }
        }catch(e){try{await reader.cancel();}catch(ignore){}throw e;}finally{reader.releaseLock();}
        output=new Uint8Array(length);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}
      }
      if(output.length!==raw||officeZipCrc(output)!==crc)throw Error('Office ZIP checksum or size mismatch: '+name);
      return output;
    })();
    // Share concurrent/repeated reads; a damaged entry keeps its rejected result.
    decoded.set(name,task);return task;
  };
  return {names:[...entries.keys()],read};
}
async function officeZipVerify(buf){
  const archive=officeZipOpen(buf);
  for(const name of archive.names)await archive.read(name);
  return archive;
}
/* END BASIS OFFICE ZIP */
