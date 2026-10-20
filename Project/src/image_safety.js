/* BEGIN BASIS IMAGE SAFETY */
const BASIS_IMAGE_LIMITS=Object.freeze({header:512*1024,pixels:40000000,edge:16384});
function basisImageBudget(info){
  const {width,height}=info;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('Image dimensions are invalid or unavailable; save a PNG, JPEG, WebP or GIF copy');
  if(width>BASIS_IMAGE_LIMITS.edge||height>BASIS_IMAGE_LIMITS.edge||width*height>BASIS_IMAGE_LIMITS.pixels)throw Error('Image exceeds the 40-megapixel or 16,384-pixel edge limit; resize it before adding it again');
  return info;
}
function basisImageInspect(input){
  const original=input instanceof Uint8Array?input:new Uint8Array(input),bytes=original.subarray(0,BASIS_IMAGE_LIMITS.header),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const has=(offset,count)=>offset>=0&&offset+count<=bytes.length;
  const ascii=(offset,text)=>has(offset,text.length)&&Array.from(text).every((ch,i)=>bytes[offset+i]===ch.charCodeAt(0));
  const result=(format,mime,width,height)=>basisImageBudget({format,mime,width,height});
  const malformed=()=>{throw Error('Image header is incomplete or malformed; save a PNG, JPEG, WebP or GIF copy');};
  if(has(0,8)&&[137,80,78,71,13,10,26,10].every((value,i)=>bytes[i]===value)){
    if(!has(8,25)||view.getUint32(8)!==13||!ascii(12,'IHDR'))return malformed();
    return result('png','image/png',view.getUint32(16),view.getUint32(20));
  }
  if(ascii(0,'GIF87a')||ascii(0,'GIF89a')){
    if(!has(6,7))return malformed();
    return result('gif','image/gif',view.getUint16(6,true),view.getUint16(8,true));
  }
  if(ascii(0,'RIFF')&&ascii(8,'WEBP')){
    if(!has(12,8))return malformed();
    const size=view.getUint32(16,true),total=view.getUint32(4,true)+8;
    if(total<20+size)return malformed();
    if(ascii(12,'VP8X')){
      if(size!==10||!has(20,10))return malformed();
      const u24=offset=>bytes[offset]+bytes[offset+1]*256+bytes[offset+2]*65536;
      return result('webp','image/webp',u24(24)+1,u24(27)+1);
    }
    if(ascii(12,'VP8 ')){
      if(size<10||!has(20,10)||bytes[20]&1||!ascii(23,'\x9d\x01\x2a'))return malformed();
      return result('webp','image/webp',view.getUint16(26,true)&0x3fff,view.getUint16(28,true)&0x3fff);
    }
    if(ascii(12,'VP8L')){
      if(size<5||!has(20,5)||bytes[20]!==0x2f)return malformed();
      const bits=view.getUint32(21,true);if(bits>>>29)return malformed();
      return result('webp','image/webp',(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1);
    }
    return malformed();
  }
  if(has(0,2)&&bytes[0]===0xff&&bytes[1]===0xd8){
    const frameMarkers=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);let offset=2;
    while(offset<bytes.length){
      if(bytes[offset++]!==0xff)return malformed();
      while(offset<bytes.length&&bytes[offset]===0xff)offset++;
      if(offset>=bytes.length)break;
      const marker=bytes[offset++];
      if(marker===0xd9||marker===0xda)break;
      if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
      if(marker===0x00||marker===0xd8)return malformed();
      if(!has(offset,2))break;
      const length=view.getUint16(offset);if(length<2)return malformed();
      if(frameMarkers.has(marker)){
        if(length<8||!has(offset,8))break;
        const components=bytes[offset+7];
        if(!components||length!==8+3*components||!has(offset,length))return malformed();
        return result('jpeg','image/jpeg',view.getUint16(offset+5),view.getUint16(offset+3));
      }
      if(!has(offset,length))break;
      offset+=length;
    }
    if(bytes.length>=BASIS_IMAGE_LIMITS.header)throw Error('JPEG dimensions were not found within the first 512 KiB; export a copy with less metadata');
    return malformed();
  }
  throw Error('Unsupported image content; use PNG, JPEG, WebP or GIF');
}
/* END BASIS IMAGE SAFETY */
