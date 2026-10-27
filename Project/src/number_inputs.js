/* BEGIN BASIS NUMBER INPUTS */
// Presentation only: never write a rounded display value back to the model.
const BASIS_NUMBER_FORMATS={
  sf:new Intl.NumberFormat('en-US',{maximumFractionDigits:0}),
  psf:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}),
  money:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})
};
function basisParseNumber(value){
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string')return null;
  let text=value.trim(),negative=false;
  if(!text)return 0; // Clearing a required numeric amount retains the existing zero behavior.
  if(text.startsWith('(')&&text.endsWith(')')){negative=true;text=text.slice(1,-1).trim();}
  // Accept pasted US currency, but reject partial numbers and malformed grouping.
  const match=/^([+-]?)\s*\$?\s*([+-]?)((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.exec(text);
  if(!match||(match[1]&&match[2])||(negative&&(match[1]||match[2])))return null;
  const number=Number((negative?'-':match[1]||match[2])+match[3].replace(/,/g,'')+(match[4]||''));
  return Number.isFinite(number)?number:null;
}
function basisFormatNumber(value,format){
  if(value===null||value===undefined||value==='')return '';
  const number=basisParseNumber(value);
  if(number===null)return String(value);
  const formatter=format==='money'&&!Number.isInteger(number)?BASIS_NUMBER_FORMATS.psf:BASIS_NUMBER_FORMATS[format];
  return formatter.format(Object.is(number,-0)?0:number);
}
function basisRentNumberFormat(unit){
  return ['amt','yramt','moamt','annual','monthly','year','month','amtyr','amtmo'].includes(unit)?'money':'psf';
}
function basisNumberInput(get,set,format){
  const input=el('input',{type:'text',class:'num basis-number',inputmode:'decimal',autocomplete:'off',spellcheck:'false','data-number-format':format});
  const raw=()=>{const value=get();if(value===null||value===undefined||value==='')return '';const number=basisParseNumber(value);return number===null?String(value):String(number);};
  let lastText='',edited=false,originalTitle=null;
  const clearError=()=>{input.classList.remove('bad');input.removeAttribute('aria-invalid');input.setCustomValidity('');if(originalTitle!==null){input.title=originalTitle;originalTitle=null;}};
  const show=()=>{input.value=basisFormatNumber(get(),format);lastText=input.value;edited=false;};
  const commit=()=>{
    if(!edited&&input.value===lastText)return !input.hasAttribute('aria-invalid');
    const number=basisParseNumber(input.value);
    if(number===null){
      const message='Enter a number such as '+(format==='sf'?'12,345':'$12,345.67')+'. The saved value has not changed.';
      if(!input.hasAttribute('aria-invalid'))originalTitle=input.title;
      input.classList.add('bad');input.setAttribute('aria-invalid','true');input.setCustomValidity(message);input.title=message;
      return false;
    }
    clearError();lastText=input.value;edited=false;set(number);return true;
  };
  input.addEventListener('focus',()=>{if(!input.hasAttribute('aria-invalid')){
    // Select the editable value after replacing the display. Keyboard entry and
    // autofill must replace it rather than append to a selection reset by value=.
    input.value=raw();lastText=input.value;edited=false;input.select();
  }});
  input.addEventListener('input',()=>{edited=true;clearError();});
  input.addEventListener('change',event=>{if(!commit())event.stopPropagation();});
  input.addEventListener('blur',()=>{if(commit())show();});
  input.addEventListener('keydown',event=>{
    if(event.isComposing)return;
    if(event.key==='Enter'){event.preventDefault();if(!commit())input.reportValidity();}
    if(event.key==='Escape'&&!event.defaultPrevented){clearError();input.value=raw();lastText=input.value;edited=false;}
  });
  show();return input;
}
/* END BASIS NUMBER INPUTS */
