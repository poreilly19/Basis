/* BEGIN BASIS BETA UI */
const BASIS_BETA_VERSION='0.7.29';
function basisBetaSupportInfo(){
  // Explicit allowlist: never serialize property data, source documents, keys,
  // browser storage, page URLs, provider settings or raw error messages.
  return {application:'Basis Studio',version:BASIS_BETA_VERSION,channel:'beta-candidate',
    browser:navigator.userAgent,secureContext:window.isSecureContext===true,
    protocol:location.protocol,theme:BASIS_PREFS.get().theme};
}
function basisOpenBetaInfo(){
  const existing=document.querySelector('#basisBetaInfo');if(existing){existing.focus();return;}
  const previous=document.activeElement,dialog=el('dialog',{id:'basisBetaInfo','aria-label':'About Basis',style:'width:min(620px,calc(100vw - 32px));max-height:85vh;overflow:auto;padding:20px;background:var(--panel);color:var(--ink);border:1px solid var(--line)'});
  const body=el('div',{}),status=el('p',{role:'status','aria-live':'polite',class:'hint'});
  const topics={
    'About':[
      'Basis Studio '+BASIS_BETA_VERSION+' · Beta Candidate',
      'Pre-release: review assumptions and source documents before relying on modeled results. Automated checks cover defined cases; they do not certify every underwriting structure.',
      'Save a .basiscre portfolio backup before upgrades. Browser storage belongs to this browser profile and site address. A different site address or browser does not inherit your library.',
      'Report problems through the private contact in your beta invitation. Include steps, expected versus actual behavior and a synthetic example. Download Support Info includes only version and basic browser details; it sends nothing automatically.'
    ],
    'Data & Privacy':[
      'Models and recovery drafts are saved in this browser in the standalone app. Anyone using this browser profile may access them. There is no team editing or cloud synchronization.',
      'Document reading is local. Choosing Extract sends selected document text or images, filenames and limited property context to your chosen OpenAI or Anthropic account, or to an available host integration. Review the provider’s terms before sending confidential documents.',
      'API keys stay in memory for this tab. Your API account pays usage charges. Test AI Connection sends only a small fixed message. Review AI proposals and sources before Apply.',
      'Optional Excel and PDF libraries load from SheetJS and cdnjs. These services and the host receive connection metadata. Basis adds no analytics or automatic model/error uploads. Cloudflare Pages and Access handle hosting and login; consult your invitation for the operator’s logging and retention settings.',
      'Clearing site data removes the local library, preferences and recovery drafts. It does not erase downloaded files or information sent to an AI provider. Back up first.'
    ],
    'Limitations':[
      'The beta stores models locally. Invite-only access must be configured by the host. Access login does not synchronize or isolate models between people sharing one browser profile.',
      'Excel reports contain calculated values and assumptions; they are not editable model backups or guaranteed third-party report-layout equivalents. Use .basiscre for complete backups.',
      'AI may miss or misinterpret lease terms. A successful connection test or reconciled total does not prove extraction accuracy.',
      'Desktop automated tests do not establish native Windows, Safari/iOS or native Excel compatibility. Follow the release acceptance checklist on your intended device and review representative models independently.',
      'Keep API keys, tenant personal data and confidential documents out of feedback attachments. Use synthetic or redacted examples.'
    ]
  };
  const tabs=el('div',{class:'bar',role:'group','aria-label':'Beta information'});
  function show(topic){body.replaceChildren(el('h3',{text:topic}),...topics[topic].map(text=>el('p',{text})));for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.textContent===topic));}
  for(const topic of Object.keys(topics))tabs.append(el('button',{class:'btn',text:topic,onclick:()=>show(topic)}));
  const download=el('button',{class:'btn',text:'Download Support Info',onclick:async()=>{
    download.disabled=true;status.textContent='';
    try{const result=await offerFile('Basis_'+BASIS_BETA_VERSION+'_Support.json',JSON.stringify(basisBetaSupportInfo(),null,2));status.textContent=result==='saved'?'Support info downloaded. Review it before sharing.':result==='declined'?'Download cancelled.':'Download did not complete. Try again.';}
    catch(ignore){status.textContent='Support info could not be downloaded. Try again.';}finally{download.disabled=false;}
  }});
  dialog.append(el('h2',{text:'About Basis'}),tabs,body,status,el('div',{class:'bar'},[download,el('button',{class:'btn p',text:'Close',onclick:()=>dialog.close()})]));
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();});
  show('About');document.body.append(dialog);dialog.showModal();
}
/* END BASIS BETA UI */
