// Fixture-only DOM facade for Node tests. Production uses the browser's native
// DOMParser; office_xml_browser_test.py verifies native parsing and errors.
// This small parser deliberately covers the XML syntax used by our fixtures.
class Element {
  constructor(name,attrs,namespaces,parent){
    this.qualifiedName=name;this.localName=name.split(':').at(-1);this.attrs=attrs;
    this.namespaces=namespaces;this.parentNode=parent;this.childNodes=[];this.children=[];
    this.namespaceURI=namespaces[name.includes(':')?name.split(':')[0]:'']||null;
  }
  get textContent(){return this.childNodes.map(n=>typeof n==='string'?n:n.textContent).join('');}
  getAttribute(name){return Object.hasOwn(this.attrs,name)?this.attrs[name]:null;}
  getAttributeNS(namespace,name){
    for(const [key,value] of Object.entries(this.attrs)){
      const at=key.indexOf(':');
      if(at>=0&&key.slice(at+1)===name&&this.namespaces[key.slice(0,at)]===namespace)return value;
    }
    return null;
  }
  getElementsByTagNameNS(namespace,name){
    const result=[];
    for(const child of this.children){
      if((namespace==='*'||namespace===child.namespaceURI)&&(name==='*'||name===child.localName))result.push(child);
      result.push(...child.getElementsByTagNameNS(namespace,name));
    }
    return result;
  }
}
class Document extends Element {
  constructor(){super('#document',Object.create(null),Object.create(null),null);this.documentElement=null;}
}
const namePattern=/^[A-Za-z_][A-Za-z0-9_.:-]*$/;
function decode(text){
  if(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(text))throw Error('Invalid entity');
  return text.replace(/&([^;]+);/g,(_match,key)=>{
    const standard={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
    if(Object.hasOwn(standard,key))return standard[key];
    const code=key[1]==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
    if(!Number.isInteger(code)||code<=0||code>0x10ffff||(code>=0xd800&&code<=0xdfff))throw Error('Invalid character');
    return String.fromCodePoint(code);
  });
}
function parse(xml){
  const doc=new Document(),stack=[doc];let at=0;
  while(at<xml.length){
    const parent=stack.at(-1);
    if(xml[at]!=='<'){
      const next=xml.indexOf('<',at),end=next<0?xml.length:next,text=decode(xml.slice(at,end));
      if(parent===doc&&text.trim())throw Error('Text outside root');
      parent.childNodes.push(text);at=end;continue;
    }
    if(xml.startsWith('<!--',at)){const end=xml.indexOf('-->',at+4);if(end<0)throw Error('Unclosed comment');at=end+3;continue;}
    if(xml.startsWith('<?',at)){const end=xml.indexOf('?>',at+2);if(end<0)throw Error('Unclosed instruction');at=end+2;continue;}
    if(xml.startsWith('<![CDATA[',at)){const end=xml.indexOf(']]>',at+9);if(end<0||parent===doc)throw Error('Invalid CDATA');parent.childNodes.push(xml.slice(at+9,end));at=end+3;continue;}
    let end=at+1,quote='';
    for(;end<xml.length;end++){
      const char=xml[end];if(quote){if(char===quote)quote='';}else if(char==='"'||char==="'")quote=char;else if(char==='>')break;
    }
    if(end>=xml.length||quote)throw Error('Unclosed tag');
    let tag=xml.slice(at+1,end);at=end+1;
    if(tag.startsWith('/')){
      const name=tag.slice(1).trim();if(!namePattern.test(name)||stack.length===1||stack.at(-1).qualifiedName!==name)throw Error('Mismatched close');stack.pop();continue;
    }
    const closed=/\/\s*$/.test(tag);if(closed)tag=tag.replace(/\/\s*$/,'');
    const match=/^([^\s]+)([\s\S]*)$/.exec(tag);if(!match||!namePattern.test(match[1]))throw Error('Invalid name');
    const attrs=Object.create(null);let remaining=match[2];
    while(remaining.trim()){
      const attr=/^\s+([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(["'])([\s\S]*?)\2/.exec(remaining);
      if(!attr||Object.hasOwn(attrs,attr[1])||attr[3].includes('<'))throw Error('Invalid attribute');
      attrs[attr[1]]=decode(attr[3]);remaining=remaining.slice(attr[0].length);
    }
    const namespaces={...parent.namespaces};
    for(const [name,value] of Object.entries(attrs)){if(name==='xmlns')namespaces['']=value;else if(name.startsWith('xmlns:'))namespaces[name.slice(6)]=value;}
    const name=match[1];if(name.includes(':')&&!namespaces[name.split(':')[0]])throw Error('Unbound prefix');
    const element=new Element(name,attrs,namespaces,parent);
    if(parent===doc){if(doc.documentElement)throw Error('Multiple roots');doc.documentElement=element;}
    parent.children.push(element);parent.childNodes.push(element);if(!closed)stack.push(element);
  }
  if(stack.length!==1||!doc.documentElement)throw Error('Incomplete document');
  return doc;
}
class DOMParser {
  parseFromString(xml){
    try{return parse(xml);}catch(_error){const doc=new Document(),error=new Element('parsererror',{}, {},doc);doc.documentElement=error;doc.children.push(error);doc.childNodes.push(error);return doc;}
  }
}
module.exports={DOMParser};
