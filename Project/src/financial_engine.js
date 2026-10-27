/* BEGIN BASIS FINANCIAL ENGINE */
"use strict";
const $=(s,r=document)=>r.querySelector(s);
function el(t,a={},kids=[]){const n=document.createElement(t);
  for(const k in a){const v=a[k]; if(v===null||v===undefined||v===false)continue;
    if(k==="class")n.className=v; else if(k==="html")n.innerHTML=v; else if(k==="text")n.textContent=v;
    else if(k.startsWith("on"))n.addEventListener(k.slice(2),function(event){
      const report=err=>{console.error(err);kAlert("This action could not be completed: "+(err.message||err));};
      try{Promise.resolve(v.call(this,event)).catch(report);}catch(err){report(err);}
    }); else n.setAttribute(k,v);}
  for(const c of [].concat(kids)) if(c!==null&&c!==undefined) n.append(c);
  return n;}
const uid=()=>Math.random().toString(36).slice(2,9);
// fast path first: a double's string form parses back to itself, so skipping the string
// round trip for numbers changes no result -- and it was 69% of the engine's run time
const NUMC=new Map();   // text-to-number results, cached: imported models carry numbers as text, parsed over and over
const num=v=>{ if(typeof v==="number") return isFinite(v)?(v||0):0;
  if(typeof v!=="string"){ const n=parseFloat(String(v).replace(/[$,\s%]/g,""));return isFinite(n)?n:0; }
  let n=NUMC.get(v); if(n===undefined){ n=parseFloat(v.replace(/[$,\s%]/g,"")); n=isFinite(n)?n:0; if(NUMC.size<100000) NUMC.set(v,n); } return n; };
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const f0=new Intl.NumberFormat("en-US",{maximumFractionDigits:0});
const f2=new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const money=v=>(!v||!isFinite(v))?"—":(v<0?"("+f0.format(Math.abs(Math.round(v)))+")":f0.format(Math.round(v)));
const psf=v=>(!v||!isFinite(v))?"—":(v<0?"("+f2.format(Math.abs(v))+")":f2.format(v));
const pc=(v,d=2)=>isFinite(v)?(v*100).toFixed(d)+"%":"n/a";
const mKey=(y,m)=>y+"-"+String(m).padStart(2,"0");
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function parseM(s){if(!s)return null;const m=/^(\d{4})-(\d{1,2})/.exec(String(s).trim());return m?{y:+m[1],m:+m[2]}:null;}
function mIdx(s,S){const d=parseM(s);return d?(d.y-S.startYear)*12+(d.m-S.startMonth):null;}
function idxToM(i,S){const t=S.startYear*12+(S.startMonth-1)+i;return mKey(Math.floor(t/12),(t%12)+1);}
function labelM(i,S){const d=parseM(idxToM(i,S));return MON[d.m-1]+" "+String(d.y).slice(2);}

/* =========================== STATE =========================== */
function blankState(){
  const eg1={id:uid(),name:"Recoverable CAM pool"};
  const rec={id:uid(),name:"NNN pro rata",method:"NNN",denom:"rentable",adminFee:0.03,grossUp:1,fixed:0,pool:""};
  const gross={id:uid(),name:"Gross — none",method:"GROSS",denom:"rentable",adminFee:0,grossUp:1,fixed:0,pool:""};
  const mr={id:uid(),name:"Market rent",amt:10,growth:null};
  const fr={id:uid(),name:"Standard free rent",newMo:3,renewMo:0};
  const ti={id:uid(),name:"Standard TI",newPSF:5,renewPSF:1.5,infl:null};
  const lc={id:uid(),name:"Standard LC",newPct:0.05,renewPct:0.025,basis:"pct",infl:null};
  const mla={id:uid(),name:"Base market leasing",mrNewRef:mr.id,mrRenewRef:mr.id,mrNewLocal:10,mrRenewLocal:10,
    renewProb:0.70,downtime:6,termYears:5,termMonths:0,stepPct:0.03,sched:[],
    frRef:fr.id,frNewLocal:3,frRenewLocal:0, tiRef:ti.id,tiNewLocal:5,tiRenewLocal:1.5,
    lcRef:lc.id,lcNewLocal:0.05,lcRenewLocal:0.025, recRef:rec.id, cpiRef:""};
  return {
    name:"Untitled asset",ptype:"Industrial",ownership:"Fee simple",
    startYear:new Date().getFullYear(),startMonth:1,years:10,
    addr:"",city:"",state:"",zip:"",county:"",submarket:"",msa:"",
    areas:[{id:uid(),name:"Building Total",sf:100000,basis:true}],
    groundLeases:[],
    inflExp:0.03,inflRent:0.03,inflCPI:0.025,inflYearOne:false,
    infl:[{id:"none",name:"No Inflation",rates:[0,0]},
          {id:"gen", name:"General Inflation Rate",rates:[0,.03,.03,.03,.03,.03,.03,.03,.03,.03,.03,.03]},
          {id:"mkt", name:"Market Inflation Rate", rates:[0,.03,.03,.03,.03,.03,.03,.03,.03,.03,.03,.03]},
          {id:"exp", name:"Expense Inflation Rate",rates:[0,.03,.03,.03,.03,.03,.03,.03,.03,.03,.03,.03]},
          {id:"cpi", name:"CPI Inflation Rate",    rates:[0,.025,.025,.025,.025,.025,.025,.025,.025,.025,.025,.025]},
          {id:"lcst",name:"Leasing Costs",         rates:[0,.03,.03,.03,.03,.03,.03,.03,.03,.03,.03,.03]}],
    gvRate:0.05,gvCredit:true,clRate:0.01,
    mlas:[mla],mrents:[mr],frees:[fr],cpis:[],tis:[ti],lcs:[lc],
    misc:[],parking:[],storage:[],
    ops:[],nonops:[],caps:[],egroups:[eg1],
    tenants:[],recs:[rec,gross],tgroups:[],
    gvPerTenant:false,gvAnnual:false,gvOvLapses:false,mktInflMonthly:false,
    roundMktLeases:false,roundMktMode:"floor",lcNetFree:true,resaleNoi:"forward",acqCosts:[],sdIntRate:0,indices:[],ranges:[],payTimes:[],actuals:[],budgets:[],actEnd:"",slAcqBreak:false,valDays:false,valDate:"",fixedGrossOnly:false,guMonthly:true,gvCalcMonth:"",prop13Base:0,saleAdj:[],saleDed:[],dcAdj:[],dcYear:1,dcRate:0,dcRound:0,useInflBegins:false,ib_misc:"",ib_op:"",ib_cap:"",ib_non:"",ib_mkt:"",
    currency:"USD",areaUnit:"SF",pctOwned:1,entityId:"",label:"",template:"",purchaseDate:"",addr2:"",country:"",parcel:"",lat:"",lng:"",
    preparer:"",appraisalNo:"",loanNo:"",yearBuilt:"",yearRenov:"",portfolioName:"",notes:"",classes:[],nonOpInPV:false,mktInflLag:false,
    price:0,priceMode:"cap",goingInCap:0.06,exitCap:0.065,costSale:0.02,discount:0.075,pvMode:"nominal",
    loanOn:false,ltv:0.60,rate:0.055,amortYears:30,ioOnly:false,loanFee:0.01,
    ties:[],
    reportStart:"", reportEnd:"",
    portfolio:[],portName:"Untitled portfolio",portCap:0.065,portDisc:0.075,portSingleExit:false,portResaleNoi:"forward"
  };
}
function sampleState(){
  const S=blankState();
  S.name="Example — 3-Tenant Industrial";S.ptype="Industrial";
  S.addr="120 Ballardvale St";S.city="Wilmington";S.state="MA";S.zip="01887";
  S.county="Middlesex";S.submarket="Route 128 North";S.msa="Boston–Cambridge–Newton";
  S.startYear=2026;S.startMonth=1;S.years=10;
  S.areas=[{id:uid(),name:"Building Total",sf:152400,basis:true},
           {id:uid(),name:"Office Finish",sf:18400,basis:false},
           {id:uid(),name:"Warehouse",sf:134000,basis:false}];
  const eg=S.egroups[0], rec=S.recs[0], gross=S.recs[1];
  rec.pool=eg.id;
  const mrInd=S.mrents[0]; mrInd.name="Industrial — Rt 128N"; mrInd.amt=10.25; mrInd.growth=null;
  S.mrents.push({id:"mrflex",name:"Flex / R&D",amt:16.50,growth:0.035});
  const fr=S.frees[0]; fr.name="Industrial — 3 mo new"; fr.newMo=3; fr.renewMo=0;
  S.frees.push({id:"frflex",name:"Flex — 4 mo new / 1 renew",newMo:4,renewMo:1});
  const ti=S.tis[0]; ti.name="Industrial TI"; ti.newPSF=5.00; ti.renewPSF=1.50;
  S.tis.push({id:"tiflex",name:"Flex / lab TI",newPSF:25.00,renewPSF:8.00,infl:null});
  const lc=S.lcs[0]; lc.name="Standard 5% / 2.5%";
  S.cpis.push({id:"cpi1",name:"CPI — 2.5% every 12 mo",rate:0.025,firstAfter:12,everyN:12});
  const mlaInd=S.mlas[0];
  mlaInd.name="Industrial market"; mlaInd.mrNewRef=mrInd.id; mlaInd.mrRenewRef=mrInd.id;
  mlaInd.renewProb=0.75; mlaInd.downtime=6; mlaInd.termYears=5; mlaInd.stepPct=0.03;
  mlaInd.frRef=fr.id; mlaInd.tiRef=ti.id; mlaInd.lcRef=lc.id; mlaInd.recRef=rec.id;
  S.mlas.push({id:"mlaflex",name:"Flex / R&D market",mrNewRef:"mrflex",mrRenewRef:"mrflex",
    mrNewLocal:16.5,mrRenewLocal:16.5,renewProb:0.65,downtime:9,termYears:5,stepPct:0.03,
    frRef:"frflex",frNewLocal:4,frRenewLocal:1,tiRef:"tiflex",tiNewLocal:25,tiRenewLocal:8,
    lcRef:lc.id,lcNewLocal:0.05,lcRenewLocal:0.025,recRef:rec.id,cpiRef:""});
  S.tgroups=[{id:"tg1",name:"Warehouse / distribution"},{id:"tg2",name:"Flex / lab"}];
  S.tenants=[
    {id:uid(),name:"Acme Logistics",suite:"100",sf:78400,start:"2022-04",end:"2029-03",rent:8.15,step:0.03,
     free:0,rec:rec.id,mla:mlaInd.id,expiry:"Market",baseYear:"",cpi:"",group:"tg1"},
    {id:uid(),name:"Nor'easter Supply",suite:"200",sf:41000,start:"2021-07",end:"2027-06",rent:7.60,step:0.025,
     free:0,rec:rec.id,mla:mlaInd.id,expiry:"Market",baseYear:"",cpi:"",group:"tg1"},
    {id:uid(),name:"Bay State Instruments",suite:"300",sf:21000,start:"2024-01",end:"2031-12",rent:15.25,step:0.03,
     free:0,rec:rec.id,mla:"mlaflex",expiry:"Market",baseYear:"",cpi:"",group:"tg2"},
    {id:uid(),name:"Vacant",suite:"400",sf:12000,start:"",end:"",rent:0,step:0,
     free:0,rec:rec.id,mla:mlaInd.id,expiry:"Market",baseYear:"",cpi:"",group:"tg1"}
  ];
  S.ops=[
    {id:uid(),name:"Real estate taxes",amt:2.35,basis:"psf",recov:true,fixedPct:1.00,infl:null,group:eg.id},
    {id:uid(),name:"Insurance",        amt:0.42,basis:"psf",recov:true,fixedPct:1.00,infl:null,group:eg.id},
    {id:uid(),name:"CAM / repairs",    amt:0.95,basis:"psf",recov:true,fixedPct:0.60,infl:null,group:eg.id},
    {id:uid(),name:"Utilities",        amt:0.38,basis:"psf",recov:true,fixedPct:0.20,infl:null,group:eg.id},
    {id:uid(),name:"Management fee",   amt:0.03,basis:"pctEGR",recov:false,fixedPct:1.00,infl:null,group:""},
    {id:uid(),name:"Non-recoverable",  amt:0.15,basis:"psf",recov:false,fixedPct:1.00,infl:null,group:""}
  ];
  S.caps=[{id:uid(),name:"Capital reserves",amt:0.15,basis:"psf",year:0,infl:null}];
  S.goingInCap=0.058;S.exitCap=0.0625;S.costSale=0.02;S.discount=0.075;
  S.loanOn=true;S.ltv=0.60;S.rate=0.0575;S.amortYears=30;S.loanFee=0.01;
  return S;
}
let S=blankState();

/* lookups */
const byId=(arr,id)=>(arr||[]).find(x=>x.id===id)||null;
function rentableSF(S){
  const a=(S.areas||[]).find(x=>x.basis)||(S.areas||[])[0];
  return Math.max(a?num(a.sf):0,1);
}
function resolveMLA(m,S){
  const mrN=byId(S.mrents,m.mrNewRef), mrR=byId(S.mrents,m.mrRenewRef);
  const fr=byId(S.frees,m.frRef), ti=byId(S.tis,m.tiRef), lc=byId(S.lcs,m.lcRef);
  const gN=mrN&&mrN.growth!==null&&mrN.growth!=="" ? num(mrN.growth) : S.inflRent;
  return {
    mktNew:  mrN?num(mrN.amt):num(m.mrNewLocal),
    mktRenew:(m.renewBasis==="same"||!m.renewBasis)?(mrN?num(mrN.amt):num(m.mrNewLocal))
            :(m.renewBasis==="prior")?null            // resolved from the expiring rate
            :(mrR?num(mrR.amt):num(m.mrRenewLocal)),
    renewBasis:m.renewBasis||"same", pctPrior:num(m.pctPrior)||1,
    growth:  gN,
    growthRef: (mrN&&mrN.inflRef)||(m.mrInflRef)||"mkt",
    tiInflRef: (ti&&ti.inflRef)||(m.tiInflRef)||"lcst",
    // New and renewal TI (and $/SF commissions) can each use a separate inflation override; blank follows the series
    tiNewInflRef:(ti&&ti.newInflRef)||"", tiRenewInflRef:(ti&&ti.renewInflRef)||"",
    lcNewInflRef:(lc&&lc.newInflRef)||"", lcRenewInflRef:(lc&&lc.renewInflRef)||"",
    frNew:   fr?num(fr.newMo):num(m.frNewLocal),
    frRenew: fr?num(fr.renewMo):num(m.frRenewLocal),
    tiNew:   ti?num(ti.newPSF):num(m.tiNewLocal),
    tiRenew: ti?num(ti.renewPSF):num(m.tiRenewLocal),
    lcNew:   lc?num(lc.newPct):num(m.lcNewLocal),
    lcRenew: lc?num(lc.renewPct):num(m.lcRenewLocal),
    lcBasis: lc?lc.basis:(m.lcBasisLocal||"pct"),
    renewProb:clamp(num(m.renewProb),0,1),
    downtime:Math.max(Math.round(num(m.downtime)),0),
    termYears:num(m.termYears), stepPct:num(m.stepPct),
    rec:m.recRef, cpi:byId(S.cpis,m.cpiRef)
  };
}
// CPI uplift multiplier at month k of a lease
function cpiFactor(cpi,k){
  if(!cpi) return 1;
  const F=Math.max(num(cpi.firstAfter),0), N=Math.max(Math.round(num(cpi.everyN)),1);
  if(k<F) return 1;
  const n=1+Math.floor((k-F)/N);
  const has=v=>v!==undefined&&v!==null&&v!=="";
  // a lease commonly passes through only part of the index, bounded each time it bites
  let inc=num(cpi.rate)*(has(cpi.pass)?num(cpi.pass):1);
  if(has(cpi.floor)) inc=Math.max(inc,num(cpi.floor));
  if(has(cpi.cap))   inc=Math.min(inc,num(cpi.cap));
  return cpi.simple?1+n*inc:Math.pow(1+inc,n);
}

/* ---------- day-aware dates ----------
   Accepts YYYY-MM-DD or YYYY-MM. A bare month means day 1 for a start and the
   last day of the month for an end, which is how lease dates are normally read. */
function pD(s){const m=/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(String(s||"").trim());
  return m?{y:+m[1],m:+m[2],d:m[3]?+m[3]:0}:null;}
const dim=(y,m)=>[31,((y%4===0&&y%100!==0)||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
const ser=(y,m,d)=>y*10000+m*100+d;
function sSer(x){const p=pD(x);return p?ser(p.y,p.m,p.d||1):null;}
function eSer(x){const p=pD(x);return p?ser(p.y,p.m,p.d||dim(p.y,p.m)):null;}
function addMo(sr,n){let y=Math.floor(sr/10000),m=Math.floor(sr/100)%100,d=sr%100;
  const t=(y*12+(m-1))+n; y=Math.floor(t/12); m=(t%12)+1;
  return ser(y,m,Math.min(d,dim(y,m)));}
function serOfIdx(i,S,day){const p=pD(idxToM(i,S));return ser(p.y,p.m,day);}

/* ---------- Base Rent schedule ----------
   Columns: Date | Years | Months | Days | Type | Units | Amount | Review Type |
            Minimum Uplift | Amount | Maximum Uplift | Amount
   Rows are contiguous: each row's Years/Months/Days is the term it holds for, so the
   next row begins when this one ends. Base and Step are SEPARATE ADDITIVE components
   (the uplift formulas are struck on Base + Step + CPI - Free), which is why a Step in
   an absolute unit adds to the base rather than replacing it. A Rent Review resets the
   passing rent, subject to the uplift collar and the upward-only ratchet. */
const RENT_TYPES=[{v:"base",t:"Base"},{v:"step",t:"Step"},{v:"review",t:"Rent Review"}];
// common shorthands written by imports and older files: read as the units they mean
const RENT_ALIAS={psf:"psfyr",amt:"yramt",psfyear:"psfyr",psfmonth:"psfmo",annual:"yramt",monthly:"moamt"};
const RENT_BASES=[{v:"psfyr",t:"$ / SF / Year"},{v:"psfmo",t:"$ / SF / Month"},
  {v:"moamt",t:"$ / Month"},{v:"yramt",t:"$ / Year"},{v:"pctmkt",t:"% of Market"},
  {v:"pct",t:"% Increase"},{v:"geared",t:"Geared"}];
const REVIEW_TYPES=[{v:"up",t:"Upward Only"},{v:"updown",t:"Upward and Downward"}];
const UPLIFTS=[{v:"none",t:"None"},{v:"amtyr",t:"Amount / Year"},
  {v:"amtpsfyr",t:"Amount / SF / Year"},{v:"pct",t:"% Increase"},
  {v:"apct",t:"Annualized % Increase"}];
const serMo=sr=>Math.floor(sr/10000)*12+(Math.floor(sr/100)%100);

function resolveSched(rows,leaseStart,sf,baseAmt,baseBasis,step,leaseEnd,inflAbs,mktFn,gearFn){
  const F=inflAbs||1;
  const absVal=(u,amt,ser)=>{
    if(u==="psfyr")  return amt*F*sf/12;
    if(u==="psfmo")  return amt*F*sf;
    if(u==="moamt")  return amt*F;
    if(u==="yramt")  return amt*F/12;
    if(u==="pctmkt") return amt*(mktFn?mktFn(ser):0)*sf/12;
    if(u==="geared") return amt*(gearFn?gearFn(ser):0);
    return null;                                  // "% Increase" is relative, not absolute
  };
  const raw=(rows||[]).filter(r=>r&&(r.date||r.month)).map(r=>({
    ser:(r.mode==="month")?addMo(leaseStart,Math.max(Math.round(num(r.month))-1,0))
                          :(sSer(r.date)||leaseStart),
    type:r.type||"base", units:r.units||r.basis||"psfyr", amt:num(r.amt),
    reviewType:r.reviewType||"up",
    minUp:r.minUp||"none", minAmt:num(r.minAmt),
    maxUp:r.maxUp||"none", maxAmt:num(r.maxAmt)
  })).sort((a,b)=>a.ser-b.ser);
  const base0=absVal(baseBasis||"psfyr",baseAmt,leaseStart)||0;
  if(!raw.length){                                // no schedule: flat rate + annual step
    const out=[];
    for(let y=0;y<80;y++){
      const sr=addMo(leaseStart,y*12);
      if(leaseEnd&&sr>leaseEnd&&y>0) break;
      out.push({ser:sr,monthly:base0*Math.pow(1+num(step),y),
                base:base0*Math.pow(1+num(step),y),step:0});
    }
    return out.length?out:[{ser:leaseStart,monthly:base0,base:base0,step:0}];
  }
  const out=[]; let base=base0, stepc=0, lastRev=leaseStart;
  if(raw[0].ser>leaseStart) out.push({ser:leaseStart,monthly:base,base,step:0});
  for(const r of raw){
    const prior=base+stepc;
    if(r.type==="step"){
      // a Step is its own component on top of Base
      if(r.units==="pct"){ stepc=prior*(1+r.amt)-base; }
      else { const v=absVal(r.units,r.amt,r.ser); if(v!==null) stepc=v; }
    } else if(r.type==="review"){
      let cand;
      if(r.units==="pct") cand=prior*(1+r.amt);
      else { const v=absVal(r.units,r.amt,r.ser); cand=(v===null)?prior:v; }
      // uplift is expressed as a bound on the INCREASE over the passing rent
      const yrs=Math.max((serMo(r.ser)-serMo(lastRev))/12,0);
      const upl=(kind,amt)=>
          kind==="amtyr"    ? amt/12
        : kind==="amtpsfyr" ? amt*sf/12
        : kind==="pct"      ? prior*amt
        : kind==="apct"     ? prior*(Math.pow(1+amt,yrs)-1)
        : null;
      const fl=upl(r.minUp,r.minAmt), ce=upl(r.maxUp,r.maxAmt);
      if(fl!==null) cand=Math.max(cand,prior+fl);
      if(ce!==null) cand=Math.min(cand,prior+ce);
      if(r.reviewType==="up") cand=Math.max(cand,prior);   // upward-only ratchet
      base=cand; stepc=0; lastRev=r.ser;
    } else if(r.type==="inc"){                    // an increment on the current rent (fixed-dollar rent steps and profile steps)
      const v=absVal(r.units,r.amt,r.ser); if(v!==null) base+=v;
    } else {                                      // Base
      if(r.units==="pct") base=prior*(1+r.amt)-stepc;
      else { const v=absVal(r.units,r.amt,r.ser); if(v!==null) base=v; }
    }
    out.push({ser:r.ser,monthly:base+stepc,base,step:stepc});
  }
  return out;
}

/* Day-walk a lease into monthly rent, occupancy and abatement.
   Rate changes and lease start/end prorate within the month by day count, which is
   what makes a step on the 17th tie rather than land a few hundred dollars out. */
function walkLease(S,nM,startS,endS,sf,resolved,freeMo,cpi,wins){
  const rent=new Float64Array(nM),cpiAdj=new Float64Array(nM),
        occ=new Float64Array(nM),abate=new Float64Array(nM),recAb=new Float64Array(nM);
  const W=(wins&&wins.length)?wins
    :(freeMo>0?[{from:startS,to:addMo(startS,Math.round(freeMo)),pct:1,gross:false}]:[]);
  const startIdxAbs=(()=>{const p=pD(idxToM(0,S));return p.y*12+(p.m-1);})();
  // steps in date order are followed with a pointer that only moves forward (the days only move forward)
  const sortedR=resolved.every((x,k)=>k===0||resolved[k-1].ser<=x.ser); let kp=0;
  for(let i=0;i<nM;i++){
    const t=startIdxAbs+i, y=Math.floor(t/12), mo=(t%12)+1, D=dim(y,mo);
    let acc=0,accCpi=0,days=0,ab=0,abR=0;
    if(!(ser(y,mo,D)<startS||ser(y,mo,1)>endS)){            // a month wholly outside the lease has no days to walk
    const leaseMo=(y*12+(mo-1))-(Math.floor(startS/10000)*12+(Math.floor(startS/100)%100)-1), cF=cpiFactor(cpi,Math.max(leaseMo,0));
    for(let d=1;d<=D;d++){
      const sr=ser(y,mo,d);
      if(sr<startS||sr>endS) continue;
      days++;
      let m;
      if(sortedR){ while(kp+1<resolved.length&&resolved[kp+1].ser<=sr) kp++; m=resolved[kp].monthly; }
      else { m=resolved[0].monthly; for(let k=0;k<resolved.length;k++){ if(resolved[k].ser<=sr) m=resolved[k].monthly; else break; } }
      // keep contractual rent and indexed uplift apart so CPI reports on its own line
      const vBase=m/D, vCpi=m*(cF-1)/D;
      acc+=vBase; accCpi+=vCpi;
      for(const w of W) if(sr>=w.from&&sr<w.to){ ab+=(vBase+vCpi)*w.pct; if(w.gross) abR+=w.pct/D; break; }
    } }
    /* Rent and CPI are carried as the POTENTIAL rate for the whole month, so that the
       aggregation's x occupancy recovers exactly what the lease collects. Returning the
       day-prorated amount here prorated a mid-month start or end twice. */
    const o=days/D;
    rent[i]=o>0?acc/o:0; cpiAdj[i]=o>0?accCpi/o:0; occ[i]=o; abate[i]=ab; recAb[i]=abR;
  }
  return {rent,cpiAdj,occ,abate,recAb};
}

/* ---------- lease date helpers ---------- */
function serAddDays(sr,n){const y=Math.floor(sr/10000),m=Math.floor(sr/100)%100,d=sr%100;
  const dt=new Date(Date.UTC(y,m-1,d+n));
  return ser(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate());}
const serISO=sr=>{const y=Math.floor(sr/10000),m=Math.floor(sr/100)%100,d=sr%100;
  return y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");};
const serToIdx=(sr,S)=>(Math.floor(sr/10000)-S.startYear)*12+(Math.floor(sr/100)%100-S.startMonth);
// where the clock stands after a lease ends on serial sr (in month e): a month-end expiry
// hands over on the 1st, a lease ending 16 January hands over 16/31 of the way through it.
// Reference-model tie-out: Envision Design, Ballardvale, ends 1/16/2032 and re-lets 3/1/2032.
function curAfter(sr,e){ if(!sr) return e+1; const y=Math.floor(sr/10000), m=Math.floor(sr/100)%100, d=sr%100, D=dim(y,m);
  return (d>0&&d<D)?e+d/D:e+1; }
const labelSer=sr=>MON[Math.floor(sr/100)%100-1]+" "+String(Math.floor(sr/10000)).slice(2);
/* A lease term can be entered as an expiry date or a length; the length form
   ends the day before the anniversary, so a 5-year lease from 1 Jan ends 31 Dec. */
function leaseEnd(t){
  if(t&&t.termMode==="term"){
    const s0=sSer(t.start); const n=Math.round(num(t.termYears)*12+num(t.termMonths));
    if(s0!==null&&n>0) return serISO(serAddDays(addMo(s0,n),-1));
  }
  return (t&&t.end)||"";
}
/* Free rent as windows: a start month, a length, a share abated, and whether the
   abatement reaches recoveries (gross) or only base rent. The legacy "months from
   commencement" field is one window starting in lease month 1 at 100%. */
function freeWins(t,startS,fMo){
  const W=[], gross=(t.freeType==="gross");
  const pc0=v=>(v===undefined||v===null||v==="")?1:clamp(num(v),0,1);
  if(fMo>0){ const f0=addMo(startS,Math.max(Math.round(num(t.freeStart)||1)-1,0));
    W.push({from:f0,to:addMo(f0,Math.round(fMo)),pct:pc0(t.freePct),gross}); }
  for(const w of (t.freeList||[])){ const mo=Math.round(num(w.months)); if(mo<=0) continue;
    const f0=addMo(startS,Math.max(Math.round(num(w.start)||1)-1,0));
    W.push({from:f0,to:addMo(f0,mo),pct:pc0(w.pct),gross}); }
  return W;
}

/* ---------- named inflation series ----------
   Named inflation series carry a rate per analysis year rather than one scalar.
   The first column (analysis year 1) is never applied when inflation in year one is off,
   so the cumulative factor for year y is the product of the rates for years 2..y.
   A series can legitimately carry a 0% in an early column — Campanelli's Market
   Inflation Rate is 0% in year 2 and 3% after, which is why its rollover rents sit one
   step below the expense series. Rates beyond the entered columns carry the last value. */
/* the recovery year of a calendar month: the calendar year, or the fiscal analysis year
   (fiscal years run from the analysis start), labelled by the calendar year it begins in. Base years, stops, the year a
   stop nets over and caps on increases all use it; with a January analysis start the two agree. */
function recYearYM(S,y,m){ if(S.recYear!=="fiscal") return y; const s0=num(S.startYear)*12+(num(S.startMonth)||1)-1; return num(S.startYear)+Math.floor((y*12+(m||1)-1-s0)/12); }
function recYearI(S,i){ const ym=num(S.startYear)*12+(num(S.startMonth)||1)-1+i; return recYearYM(S,Math.floor(ym/12),ym%12+1); }
function recoveryBaseYear(S,value,start){
  const year=typeof value==="number"?String(value):String(value||"").trim();
  if(/^\d{4}$/.test(year)&&+year>=1000&&+year<=9999)return +year;
  const date=pD(value)||pD(start);return date?recYearYM(S,date.y,date.m):recYearI(S,0);
}
// Inflation steps on each anniversary of the analysis start (Fiscal Inflation)
// or each January (Calendar Inflation, only with calendar recovery). With a January start the two agree.
function infY(S,i){ i=Math.max(i,0); return S&&S.inflCal?Math.floor(((num(S.startMonth)||1)-1+i)/12):Math.floor(i/12); }
function seriesFactor(S,id,i){
  let sr=byId(S.infl,id);
  if(!sr){ const ix=S.indices?byId(S.indices,id):null; return ix?idxFactor(S,ix,i):1; }
  const y=infY(S,i), r=sr.rates||[];
  if(!r.length) return 1;
  const last=num(r[r.length-1]);
  let f=1;
  for(let k=1;k<=y;k++) f*=1+(k<r.length?num(r[k]):last);
  return f;
}
// a line's own numeric override wins; otherwise it follows its named series
/* "Use Inflation Begin Date": a category's amounts are stated as of its date and inflate
   from it, stepping on each anniversary. A date a year before the analysis begins puts
   year-1 amounts one year up the curve; a later date holds them flat until it. */
const LINE_IB=new WeakMap();
function ibOffset(S,key){ if(!S.useInflBegins) return 0; const p=/^(\d{4})-(\d{2})/.exec(String(S["ib_"+key]||"")); if(!p) return 0;
  return (+p[1]-num(S.startYear))*12+(+p[2]-(num(S.startMonth)||1)); }
function lineFactor(S,line,i,defId){
  const b=line?LINE_IB.get(line):0; if(b) i=i-b;
  if(line&&line.inflRef==="custom"){ const r=pctList(line.inflCustom); if(!r.length) return 1;     // custom rates by year
    let f=1; for(let k=1;k<=infY(S,i);k++) f*=1+(k-1<r.length?r[k-1]:r[r.length-1]); return f; }
  if(line&&typeof line.infl==="number") return Math.pow(1+num(line.infl),infY(S,i));
  return seriesFactor(S,(line&&line.inflRef)||defId,i);
}
function mkSeries(name,rate,years,firstZero){
  const r=[0]; for(let y=1;y<=years+2;y++) r.push(y===1&&firstZero?0:rate);
  return {id:uid(),name,rates:r};
}

/* Recovery structures that affect the calculation. Base Year Stop takes an offset (-n / +n) so the stop can be struck on a year
   other than the lease's own base year. Stop Amount fixes the stop in dollars rather
   than deriving it from a year. Fixed pays a flat amount regardless of the pool.
   Market defers to whatever the space's market leasing profile says. */
const REC_METHODS=[
  {v:"NNN",      t:"Net — pro rata of pool"},
  {v:"STOP",     t:"Base Year Stop"},
  {v:"STOPAMT",  t:"Stop Amount ($)"},
  {v:"STOPPSF",  t:"Stop Amount / Area"},
  {v:"FIXED",    t:"Fixed Amount / Area"},
  {v:"FIXEDAMT", t:"Fixed Amount ($)"},
  {v:"MARKET",   t:"Market — follow the MLA"},
  {v:"GROSS",    t:"None"}
];
const REC_BOUND=[{v:"none",t:"None"},{v:"amt",t:"Amount / Year"},{v:"psf",t:"Amount / SF / Year"}];

/* Operating expense bases. The percentage bases are driven by a revenue line, so the
   fixed-versus-variable split does not apply to them — their driver already moves with
   occupancy. They also have to be solved iteratively, because a recoverable % of EGR
   feeds the recovery pool, which feeds EGR. */
const EXP_BASES=[
  {v:"psf",     t:"$ / Area / Year"},
  {v:"psfmo",   t:"$ / Area / Month"},
  {v:"psfocc",  t:"$ / Occupied Area / Year"},
  {v:"amt",     t:"$ / Year"},
  {v:"amtmo",   t:"$ / Month"},
  {v:"pctEGR",  t:"% of Effective Gross Revenue"},
  {v:"pctPGR",  t:"% of Potential Gross Revenue"},
  {v:"pctRent", t:"% of Scheduled Base Rent"},
  {v:"pctRecov",t:"% of Expense Reimbursements"},
  {v:"pctOther",t:"% of Other Revenue"},
  {v:"pctLine", t:"% of another expense line"}
];
const PCT_BASES=new Set(["pctEGR","pctPGR","pctRent","pctRecov","pctOther","pctLine"]);
const isPctBasis=b=>PCT_BASES.has(b);
// recoverable is a PERCENTAGE of the line, not a flag; migrate the old boolean
const recovOf=o=>{
  if(o&&o.recovPct!==undefined&&o.recovPct!==null&&o.recovPct!=="") return clamp(num(o.recovPct),0,1);
  return (o&&o.recov)?1:0;
};

/* =========================== ENGINE =========================== */
function calc(S){
  if(typeof basisValidateModel==="function")basisValidateModel(S);
  for(const [arr,key] of [[S.ops,"op"],[S.nonops,"non"],[S.caps,"cap"],[S.misc,"misc"],[S.parks,"misc"],[S.stors,"misc"],[S.parking,"misc"],[S.storage,"misc"]])
    for(const o of (arr||[])){ if(!o||typeof o!=="object") continue; const b=ibOffset(S,key); if(b) LINE_IB.set(o,b); else LINE_IB.delete(o); }
  const nY=clamp(Math.round(S.years)||10,1,40), nM=(nY+1)*12, sf=rentableSF(S);
  const Z=()=>new Float64Array(nM);
  const infl=(r,i)=>Math.pow(1+(r||0),Math.floor(i/12));   // legacy scalar path
  const mIB=ibOffset(S,"mkt"), SF_=(id,i)=>seriesFactor(S,id,i-mIB);
  const recById=id=>byId(S.recs,id)||S.recs[0]||{method:"GROSS",denom:"rentable",adminFee:0,grossUp:1,fixed:0,pool:""};

  /* ---- per-space monthly build ---- */
  const spaces=[];
  /* A lease whose area changes at set dates is carried as horizontal bands of area. Each band
     is the full lease at that band's size, on the lease's own dates and anniversaries, masked
     to the months the tenant holds it: bands that run to expiry roll with the lease, bands
     given back before it vacate. Everything linear in area is exact by construction. */
  const areaLayers=t=>{
    const eS=eSer(leaseEnd(t)), sS=sSer(t.start); if(eS===null||sS===null) return [{t,a:-Infinity,b:Infinity,label:""}];
    const pts=[{d:sS,a:num(t.sf)}].concat((t.areaSched||[]).map(x=>({d:sSer(x.date),a:Math.max(0,num(x.sf))})).filter(x=>x.d!==null&&x.d>sS&&x.d<=eS)).sort((p,q)=>p.d-q.d);
    const segs=pts.map(p=>({s:serToIdx(p.d,S),a:p.a})); segs.forEach((g,k)=>{ g.e=k<segs.length-1?segs[k+1].s-1:Infinity; });
    const lv=[...new Set(segs.map(g=>g.a))].filter(a=>a>0).sort((a,b)=>a-b), out=[], base=num(t.sf)||1; let prev=0;
    // area in force on a date, and the rent steps the whole lease takes (with the amount carried to each change of area)
    const areaAt=d=>{ let a=pts[0].a; for(const p of pts) if(p.d<=d) a=p.a; return a; };
    const amtRows=(t.sched||[]).filter(r=>r&&r.mode==="date"&&/amt$/.test(r.basis||"")&&sSer(r.date)!==null);
    const steps=amtRows.slice(); for(const p of pts.slice(1)){ if(steps.some(r=>sSer(r.date)===p.d)) continue;
      let last=null; for(const r of amtRows) if(sSer(r.date)<=p.d&&(!last||sSer(r.date)>=sSer(last.date))) last=r;
      if(last) steps.push(Object.assign({},last,{id:(last.id||"r")+"@"+p.d,date:new Date(p.d).toISOString().slice(0,10)})); }
    for(const L of lv){ const band=L-prev; let run=null;
      const flush=roll=>{ const tt=Object.assign({},t,{sf:band,areaSched:[],expiry:roll?t.expiry:"Vacate"});
        // lump sums and a flat dollar rent belong to the premises at commencement; a later expansion band carries none
        const sh=run.k0>0?0:band/base;
        if(t.tiBasis==="amt") tt.tiAmt=num(t.tiAmt)*sh; if(t.lcBasis==="amt") tt.lcAmt=num(t.lcAmt)*sh; if(t.incBasis==="amt") tt.incAmt=num(t.incAmt)*sh;
        if(/amt$/.test(RENT_ALIAS[t.rentBasis]||t.rentBasis||"")) tt.rent=num(t.rent)*sh;
        // a schedule stated in dollars for the whole lease is shared by area among the bands in force on each step's date
        if(steps.length) tt.sched=(t.sched||[]).filter(r=>!amtRows.includes(r)).concat(steps.map(r=>{ const d=sSer(r.date), A=areaAt(Math.max(d,pts[0].d));
          return Object.assign({},r,{amt:A>=L?num(r.amt)*band/A:0}); }));
        if(out.length){ tt.prOn=false; }
        out.push({t:tt,a:run.k0>0?run.s:-Infinity,b:roll?Infinity:run.e,late:run.k0>0,label:out.length?" (area band "+Math.round(band).toLocaleString()+" SF)":""}); run=null; };
      segs.forEach((g,k)=>{ if(g.a>=L){ if(!run) run={s:g.s,k0:k}; run.e=g.e; } else if(run) flush(false); });
      if(run) flush(true);
      prev=L; }
    return out.length?out:[{t,a:-Infinity,b:Infinity,label:""}];
  };
  const bandsOf=tt=>{
    if(!(tt.areaSched||[]).some(a=>a&&a.date)){ const sp=buildSpace(tt); return sp?[{sp,a:-Infinity,b:Infinity}]:[]; }
    const out=[]; for(const L of areaLayers(tt)){ const sp=buildSpace(L.t); if(!sp) continue; maskSpace(sp,L.a,L.b); sp.bandLate=!!L.late;
      if(L.label) sp.name=(sp.name||tt.name||"")+L.label; out.push({sp,a:L.a,b:L.b}); }
    if(out.length>1&&prCatsOf(tt).length){          // percentage rent on the lease as a whole
      const b0=out[0].sp, tot=new Float64Array(nM), area=new Float64Array(nM);
      for(const B of out) for(let i=0;i<nM;i++){ tot[i]+=B.sp.rent[i]; if(i>=B.a&&i<=B.b) area[i]+=B.sp.sf; }
      prFill(S,tt,b0.pr,tot,b0.occ,i=>area[i],b0.prLastK,nM); }
    return out; };
  const maskSpace=(sp,a,b)=>{ for(let i=0;i<nM;i++){ if(i>=a&&i<=b) continue;
    sp.rent[i]=0; sp.cpiAdj[i]=0; sp.occ[i]=0; sp.abate[i]=0; sp.ti[i]=0; sp.lc[i]=0; if(sp.pr) sp.pr[i]=0; if(sp.inc) sp.inc[i]=0; if(sp.sl) sp.sl[i]=0; } };
  const buildSpace=(t)=>{
    const tsf=Math.max(num(t.sf),0); if(!tsf) return null;
    const tEnd=leaseEnd(t);
    const rawMla=byId(S.mlas,t.mla)||S.mlas[0]; if(!rawMla) return null;
    const M=resolveMLA(rawMla,S);
    const sp={name:t.name||"(unnamed)",srcName:t.name||"",suite:t.suite||"",sf:tsf,group:t.group||"",
      rent:Z(),cpiAdj:Z(),occ:Z(),abate:Z(),recAb:Z(),ti:Z(),lc:Z(),fee:Z(),pr:Z(),w:1,tid:t.id,
      status:t.status||"Contract",ltype:t.ltype||"",recId:new Array(nM).fill(null),
      baseY:new Array(nM).fill(null),rollovers:[],chain:[]};

    const startS=sSer(t.start), endS=eSer(tEnd);
    const s=mIdx(t.start,S), e=mIdx(tEnd,S);
    const hasLease=startS!==null&&endS!==null&&e!==null&&e>=0;
    let cursor;

    const cpi=byId(S.cpis,t.cpi);
      // "% of Market" needs the market rate at the review date; "Geared" is ground-lease only
      const mktAt=sr=>{ const mm=byId(S.mlas,t.mla); if(!mm) return 0;
        const MM=resolveMLA(mm,S), im=(serMo(sr)-(S.startYear*12+S.startMonth));   // serMo counts months 1-12 (Brickstone: a December start took January's rate)
        return MM.mktNew*(MM.growthRef?seriesFactor(S,MM.growthRef,Math.max(im,0))
                                      :Math.pow(1+MM.growth,Math.floor(Math.max(im,0)/12))); };
    let lastPSF=null;
    if(hasLease){
      const mRent=(t.rentBasis==="mkt");
      const res=resolveSched(t.sched,startS,tsf,mRent?mktAt(startS)*(t.rentPct===undefined||t.rentPct===""?1:num(t.rentPct)):num(t.rent),
                             mRent?"psfyr":(RENT_ALIAS[t.rentBasis]||t.rentBasis||"psfyr"),
                             num(t.step),endS,1,mktAt,null);
      const fMo=(t.freeBasis==="market")?Math.max(M.frNew,0):Math.max(num(t.free),0);
      const W=walkLease(S,nM,startS,endS,tsf,res,fMo,cpi,freeWins(t,startS,fMo));
      const by=recoveryBaseYear(S,t.baseYear,t.start);
      for(let i=0;i<nM;i++){
        if(W.occ[i]<=0) continue;
        sp.rent[i]=W.rent[i]; sp.cpiAdj[i]=W.cpiAdj[i]; sp.occ[i]=W.occ[i]; sp.abate[i]=W.abate[i];
        sp.recAb[i]=W.recAb[i];
        sp.recId[i]=t.rec; sp.baseY[i]=by;
      }
      sp.schedule=res; sp.inPlaceEnd=e;
      // straight-line rent (memo): the same walk over the lease's whole term, from its own start,
      // so the rent and free rent are exactly those charged; spread evenly over occupied months
      { const sy=Math.floor(startS/10000), sm=Math.floor(startS/100)%100, nT=(Math.floor(endS/10000)-sy)*12+(Math.floor(endS/100)%100-sm)+1;
        if(nT>0&&nT<=1200){ const W2=walkLease(Object.assign({},S,{startYear:sy,startMonth:sm}),nT,startS,endS,tsf,res,fMo,null,freeWins(t,startS,fMo));
          // Acquisition-date policy variant: from acquisition, and only to the earliest break;
          // months outside that window are recognised at cash, so they carry no adjustment
          let k0=0, k1=nT-1;
          if(S.slAcqBreak){ const aq=sSer(S.purchaseDate||"")||sSer(mKey(num(S.startYear),num(S.startMonth)||1));
            if(aq!==null) k0=Math.max(0,(Math.floor(aq/10000)-sy)*12+(Math.floor(aq/100)%100-sm));
            const bk=(t.breakOn&&t.breakDate)?eSer(t.breakDate):null; if(bk!==null) k1=Math.min(k1,(Math.floor(bk/10000)-sy)*12+(Math.floor(bk/100)%100-sm)); }
          let tot=0,oc=0; for(let k=k0;k<=k1;k++){ tot+=W2.rent[k]*W2.occ[k]-W2.abate[k]; oc+=W2.occ[k]; }
          const slm=oc>0?tot/oc:0, off=(sy*12+sm-1)-(num(S.startYear)*12+(num(S.startMonth)||1)-1);
          sp.slRate=slm; sp.slTerm=Math.max(0,k1-k0+1); sp.sl=Z();
          for(let i=0;i<nM&&i<=e;i++) if(sp.occ[i]>0){ const k=i-off; sp.sl[i]=(k>=k0&&k<=k1)?slm*sp.occ[i]:(sp.rent[i]*sp.occ[i]-sp.abate[i]); } } }
      // in-place lease entry for the Lease Summary, with its rate-change schedule
      const st=[];
      for(const rr of res){
        const y=Math.floor(rr.ser/10000), mo=Math.floor(rr.ser/100)%100;
        st.push({label:MON[mo-1]+" "+String(y).slice(2), psf:rr.monthly*12/tsf, ser:rr.ser});
      }
      const months=(Math.floor(endS/10000)*12+Math.floor(endS/100)%100)
                  -(Math.floor(startS/10000)*12+Math.floor(startS/100)%100)+1;
      lastPSF=(res.length?res[res.length-1].monthly:num(t.rent)*tsf/12)*cpiFactor(cpi,Math.max(months-1,0))*12/tsf;
      /* Rent-roll TI and LC, paid at commencement by default. A lease that commenced
         before the analysis carries none unless a payment month is given: per the
         training, in-place costs are normally the seller's. */
      let termRent=0;
      for(let q=0;q<months;q++){ const at=addMo(startS,q); let mm=res[0]?res[0].monthly:0;
        for(const rr of res){ if(rr.ser<=at) mm=rr.monthly; else break; } termRent+=mm; }
      const payAt=(dt)=>{ const k=dt?mIdx(dt,S):mIdx(t.start,S); return (k!==null&&k>=0&&k<nM)?k:null; };
      const kTI=payAt(t.tiDate), kLC=payAt(t.lcDate);
      const infAt=k=>M.tiInflRef?SF_(M.tiInflRef,k):(M.growthRef?SF_(M.growthRef,k):Math.pow(1+M.growth,infY(S,k)));
      const tiB=t.tiBasis||"none", lcB=t.lcBasis||"none";
      const tiV=kTI===null?0: tiB==="psf"?num(t.tiAmt)*tsf : tiB==="amt"?num(t.tiAmt)
               : tiB==="market"?M.tiNew*tsf*infAt(kTI) : 0;
      const firstMo=res[0]?res[0].monthly:0;
      const lcV=kLC===null?0: lcB==="pct"?num(t.lcAmt)*termRent : lcB==="psf"?num(t.lcAmt)*tsf
               : lcB==="amt"?num(t.lcAmt) : lcB==="months"?num(t.lcAmt)*firstMo
               : lcB==="market"?((M.lcBasis==="psf")?M.lcNew*tsf*infAt(kLC):M.lcNew*termRent) : 0;
      if(kTI!==null) payInto(S,sp.ti,kTI,tiV,t.tiTiming);
      if(kLC!==null) payInto(S,sp.lc,kLC,lcV,t.lcTiming);
      // tenant incentives: cash beyond TI, paid on a date, optionally timed
      if(t.incBasis&&t.incBasis!=="none"&&num(t.incAmt)>0){ const iS=sSer(t.incDate||t.start), kI=iS!==null?serToIdx(iS,S):null;
        const r1=sp.schedule&&sp.schedule[0]?sp.schedule[0].monthly:0;
        const amt=t.incBasis==="amt"?num(t.incAmt):t.incBasis==="psf"?num(t.incAmt)*tsf:t.incBasis==="months"?num(t.incAmt)*r1:0;
        if(kI!==null&&amt>0) payInto(S,sp.inc||(sp.inc=Z()),kI,amt,t.incTiming); }
      sp.chain.push({kind:"Base",status:t.status||"Contract",start:t.start,end:tEnd,termM:months,
        ratePSF:st.length?st[0].psf:num(t.rent),amtYr:(st.length?st[0].psf:num(t.rent))*tsf,
        steps:st.slice(1),freeMo:num(t.free),downEff:null,pp:null,
        profile:(byId(S.mlas,t.mla)||{}).name||"",
        recName:(byId(S.recs,t.rec)||{}).name||"",ti:tiV,lc:lcV});
      cursor=curAfter(eSer(tEnd),e);
    } else cursor=0;

    let xp=t.expiry||"Market";
    if(xp==="ContractRenewal"&&(S.tenants||[]).some(x=>x&&x.crOf===t.id)) xp="Vacate";   // its renewal is its own row on the rent roll
    let segEnd=hasLease?endS:null;
    // a segment shares its first month with the lease before it, so occupancy adds and
    // the potential rate is the occupancy-weighted blend of the two
    const mergeSeg=(W2,recId,byY)=>{
      for(let i=0;i<nM;i++){
        const o2=W2.occ[i]; if(o2<=0) continue;
        const o1=sp.occ[i], ot=o1+o2;
        sp.rent[i]=(sp.rent[i]*o1+W2.rent[i]*o2)/ot;
        sp.cpiAdj[i]=(sp.cpiAdj[i]*o1+W2.cpiAdj[i]*o2)/ot;
        sp.occ[i]=Math.min(ot,1); sp.abate[i]+=W2.abate[i]; sp.recAb[i]+=W2.recAb[i];
        if(sp.recId[i]===null||o2>=o1){ sp.recId[i]=recId; sp.baseY[i]=byY; }
      }
    };
    const inBY=recoveryBaseYear(S,t.baseYear,t.start);
    /* Option: the tenant renews on defined terms with certainty and no downtime. The
       training's example is the common 95%-of-FMV option, carried as % of market, which
       assumes 100% renewal and so belongs only where renewal is close to certain. */
    if(hasLease&&(xp==="Option"||xp==="ContractRenewal")){
      const oS=serAddDays(endS,1);
      const n=Math.max(Math.round(num(t.optTermYears)*12+num(t.optTermMonths)),1);
      const oE=serAddDays(addMo(oS,n),-1);
      const ob=t.optRentBasis||"pctMkt";
      const oa=(t.optRentAmt===undefined||t.optRentAmt===null||t.optRentAmt==="")?(ob==="pctMkt"?0.95:0):num(t.optRentAmt);
      const r0=ob==="psf"?oa:(ob==="pctLast"?(lastPSF||0)*(1+oa):mktAt(oS)*oa);
      const res2=[]; for(let yy=0;yy*12<n;yy++)
        res2.push({ser:addMo(oS,yy*12),monthly:r0*Math.pow(1+num(t.optStep),yy)*tsf/12});
      const oF=Math.max(num(t.optFree),0);
      const W2=walkLease(S,nM,oS,oE,tsf,res2,0,t.optCpi?byId(S.cpis,t.optCpi):null,
        oF>0?[{from:oS,to:addMo(oS,Math.round(oF)),pct:1,gross:false}]:[]);
      const oRec=t.optRec||t.rec, oBY=t.optResetBase?recYearYM(S,Math.floor(oS/10000),Math.floor(oS/100)%100):inBY;
      mergeSeg(W2,oRec,oBY);
      let oRent=0; res2.forEach((r,q)=>{ oRent+=r.monthly*Math.min(12,n-12*q); });
      const oi=serToIdx(oS,S);
      const oTI=num(t.optTI)*tsf, oLC=num(t.optLC)*oRent;
      if(oi>=0&&oi<nM){ payInto(S,sp.ti,oi,oTI,t.tiTiming); payInto(S,sp.lc,oi,oLC,t.lcTiming); }
      sp.chain.push({kind:"Option",status:"Contract",start:serISO(oS),end:serISO(oE),termM:n,
        ratePSF:r0,amtYr:r0*tsf,steps:res2.slice(1).map(r=>({label:labelSer(r.ser),psf:r.monthly*12/tsf,ser:r.ser})),
        freeMo:oF,downEff:0,pp:1,profile:(xp==="ContractRenewal"?"Contract renewal (":"Option (")+(ob==="pctMkt"?pc(oa,0)+" of market":ob==="psf"?"$"+oa.toFixed(2)+"/SF":pc(oa,1)+" over last")+")",
        recName:(byId(S.recs,oRec)||{}).name||"",ti:oTI,lc:oLC});
      lastPSF=res2[res2.length-1].monthly*12/tsf;
      segEnd=oE; xp=t.optThen||"Market";
    }
    /* Hold over and month to month: the tenant stays past expiry on the final rate,
       a hold over usually at a premium for a set period, month to month open-ended. */
    if(hasLease&&(xp==="HoldOver"||xp==="MTM")){
      const hS=serAddDays(segEnd,1);
      const hE=(xp==="HoldOver")
        ? serAddDays(addMo(hS,Math.max(Math.round(num(t.hoMonths)||6),1)),-1)
        : (t.mtmEnd?eSer(t.mtmEnd):eSer(idxToM(nM-1,S)));
      if(hE>=hS){
        const ph=(t.hoPct===undefined||t.hoPct===null||t.hoPct==="")?(xp==="HoldOver"?1.5:1):num(t.hoPct);
        const rate=(lastPSF||0)*ph;
        const W3=walkLease(S,nM,hS,hE,tsf,[{ser:hS,monthly:rate*tsf/12}],0,null,[]);
        mergeSeg(W3,t.rec,inBY);
        sp.chain.push({kind:xp==="HoldOver"?"Hold Over":"Month-to-Month",status:"Contract",
          start:serISO(hS),end:serISO(hE),termM:serMo(hE)-serMo(hS)+1,ratePSF:rate,amtYr:rate*tsf,
          steps:[],freeMo:0,downEff:0,pp:1,profile:(xp==="HoldOver"?"Hold over at ":"Month to month at ")+pc(ph,0)+" of final rent",
          recName:(byId(S.recs,t.rec)||{}).name||"",ti:0,lc:0});
        segEnd=hE;
      }
      xp=t.hoThen||"Market";
    }
    /* Percentage rent on the contract term: the tenant pays a share of sales above a
       breakpoint. Natural breakpoint is annual base rent over the rate. Computed on an
       annualised monthly basis; the reference models settle it by lease year. */
    const lastKpr=segEnd!==null?Math.min(serToIdx(segEnd,S),nM-1):-1; sp.prLastK=lastKpr;
    prFill(S,t,sp.pr,sp.rent,sp.occ,()=>tsf,lastKpr,nM);
    if(xp==="Vacate"||xp==="Reabsorb") return sp;   // Reabsorb space passes to Space Absorption; without a plan it stays vacant (confirmed by the Applied lease reference case)
    if(segEnd!==null&&segEnd!==endS) cursor=curAfter(segEnd,serToIdx(segEnd,S));

    /* rollover chain. A space vacant at t0 has no incumbent, so its FIRST lease is
       new-only (pp=0): full downtime, new rent/TI/LC/free rent. Later links blend. */
    /* Weighted-average market leasing: on expiry the space takes ONE blended
       lease carrying probability-weighted terms. Downtime is weighted with everything
       else -- 75% renewal against 12 months vacant is 3 months of real downtime, shown
       as three FULLY vacant months -- and the blended lease COMMENCES after it. That
       shift is the part that matters: it moves the rent steps, the expiry (and so every
       later rollover in the chain), the free rent window, and the month TI and LC are
       paid, which in turn sets their inflation factor. */
    let guard=0, first=true, cur=cursor;              // cur is fractional months
    let forceRenew=false, forceNew=false;
    while(cur<nM && guard++<80){
      const pp = ((first&&!hasLease)||forceNew) ? 0 : ((t.expiry==="Renew"||forceRenew) ? 1 : M.renewProb); forceNew=false;
      const termM=Math.max(Math.round(M.termYears*12)+Math.round(num(rawMla.termMonths)),1);
      // the profile's rent unit: market rates are carried as $/SF/year
      const uF=rawMla.rentUnit==="psfmo"?12:rawMla.rentUnit==="yramt"?(tsf>0?1/tsf:0):rawMla.rentUnit==="moamt"?(tsf>0?12/tsf:0):1, mkNew=M.mktNew*uF;
      const downEff=(1-pp)*M.downtime;                // weighted months vacant
      const gap0=Math.max(Math.ceil(cur-1e-9),0);
      const tailM=(cur%1>1e-9)?Math.floor(cur):-1, tailO=tailM>=0&&tailM<nM?sp.occ[tailM]:0;
      let cStart=Math.max(cur,0)+downEff;
      // "Round Market Leases to start on the first day of the month": a fractional
      // weighted downtime otherwise commences the blended lease mid-month.
      if(S.roundMktLeases) cStart = Math.max(Math.ceil(cur-1e-9),(S.roundMktMode==="floor")?Math.floor(cStart)
                                  : (S.roundMktMode==="ceil")?Math.ceil(cStart)
                                  : Math.round(cStart));
      const cInt=Math.floor(cStart), frac=cStart-cInt;
      const beyond=cInt>=nM;          // the next lease starts after the analysis; its downtime is still vacancy
      // "Inflate Market Rates": annual step on the anniversary, or monthly compounding.
      // Year one is uninflated either way when inflYearOne is off.
      // market rate grows on its named series; a 0% early column shows up here naturally
      // "% of Prior Rent": the renewal leg is struck off the expiring rate, not the market
      const priorPSF=(cur>0&&sp.rent[Math.max(Math.floor(cur)-1,0)]>0)
        ? sp.rent[Math.max(Math.floor(cur)-1,0)]*12/tsf : mkNew;
      const renewRate=(M.mktRenew===null)?priorPSF*M.pctPrior:M.mktRenew*uF;
      // "Inflate Market Rates: Monthly" compounds each year's own rate month by month from
      // the analysis start, so a lease commencing in March carries two months of that year's
      // growth. Reference-model tie-out: Ballardvale's nine market leases, every rate to the cent.
      // Only market rent inflates this way; TI and LC stay on annual steps.
      const c0=Math.floor(cStart);
      const mGrow=S.mktInflMonthly
        ? (M.growthRef ? (()=>{ const Y=Math.floor(c0/12), a=SF_(M.growthRef,12*Y), b=SF_(M.growthRef,12*(Y+1));
              return a>0 ? a*Math.pow(b/a,(c0-12*Y)/12) : a; })()
                       : Math.pow(1+M.growth,c0/12))
        : (M.growthRef ? SF_(M.growthRef,c0) : Math.pow(1+M.growth,Math.floor(cStart/12)));
      const mrPSF=(pp*renewRate+(1-pp)*mkNew)*mGrow;
      // rent steps: % compounding, a $ amount per SF each year, or none
      const stepPSF=y=>rawMla.stepType==="amt"?mrPSF+num(rawMla.stepPct)*uF*y:rawMla.stepType==="none"?mrPSF:mrPSF*Math.pow(1+M.stepPct,y);
      const freeMo=pp*Math.max(M.frRenew,0)+(1-pp)*Math.max(M.frNew,0);
      const tiPSF=pp*M.tiRenew+(1-pp)*M.tiNew;
      const lcVal=pp*M.lcRenew+(1-pp)*M.lcNew;

      // the weighted downtime window: potential rent stands at each month's market rate, occupancy
      // zero. A market lease's base year (for a base year stop) is the year it commences.
      const gK=k=>M.growthRef?SF_(M.growthRef,k):Math.pow(1+M.growth,infY(S,k)), gC=gK(Math.floor(cStart));
      const mBY=recYearI(S,Math.min(Math.max(cInt,0),nM-1));
      // with market rates inflating monthly, each vacant month stands at its own month's rate, interpolated
      // within the year as the commencement rate is (reference-model tie-out: Ballardvale downtime months)
      const mG=k=>{ if(M.growthRef){ const Y=Math.floor(k/12), a=SF_(M.growthRef,12*Y), b=SF_(M.growthRef,12*(Y+1)); return a>0?a*Math.pow(b/a,(k-12*Y)/12):a; } return Math.pow(1+M.growth,k/12); };
      const mG0=S.mktInflMonthly?mG(c0):0;
      for(let i=gap0;i<Math.min(cInt,nM);i++){
        sp.rent[i]=mrPSF*(S.mktInflMonthly?(mG0?mG(i)/mG0:1):(gC?gK(i)/gC:1))*tsf/12; sp.cpiAdj[i]=0; sp.occ[i]=0; sp.abate[i]=0;
        sp.recId[i]=(byId(S.recs,M.rec)||{}).method==="PRIOR"?(t.rec||M.rec):M.rec; sp.baseY[i]=mBY;   // a "Continue Prior" profile keeps the lease's own structure
      }
      if(beyond) break;
      // the blended lease, from its shifted commencement
      let gross=0;
      for(let k=0;;k++){
        const i=cInt+k;
        const lm=k-frac;                              // months since commencement
        if(lm>=termM) break;
        const occW=Math.max(0,Math.min(lm+1,termM)-Math.max(lm,0));
        const base=stepPSF(Math.floor(Math.max(lm,0)/12))*tsf/12;
        const withCpi=base*cpiFactor(M.cpi,Math.max(lm,0));
        const ovl=Math.max(0,Math.min(lm+1,freeMo)-Math.max(lm,0));   // free-rent overlap
        const ab=withCpi*Math.min(ovl,occW);
        // the commission is on the whole term's rent, including months past the analysis
        gross+=withCpi*occW-(S.lcNetFree===false?0:ab);
        if(i>=nM) continue;
        if(i===tailM&&tailO>0){ const o=tailO+occW;
          sp.rent[i]=(sp.rent[i]*tailO+base*occW)/o; sp.cpiAdj[i]=(sp.cpiAdj[i]*tailO+(withCpi-base)*occW)/o;
          sp.occ[i]=o; sp.abate[i]+=ab; }
        else { sp.rent[i]=base; sp.cpiAdj[i]=withCpi-base; sp.occ[i]=occW; sp.abate[i]=ab; }
        sp.recId[i]=(byId(S.recs,M.rec)||{}).method==="PRIOR"?(t.rec||M.rec):M.rec; sp.baseY[i]=mBY;   // a "Continue Prior" profile keeps the lease's own structure
      }
      const inf=M.tiInflRef?SF_(M.tiInflRef,Math.floor(cStart))
              :(M.growthRef?SF_(M.growthRef,Math.floor(cStart)):Math.pow(1+M.growth,Math.floor(cStart/12)));
      const sideInf=r=>r?SF_(r,Math.floor(cStart)):inf;
      const tiAmt=(M.tiNewInflRef||M.tiRenewInflRef)?pp*M.tiRenew*sideInf(M.tiRenewInflRef)+(1-pp)*M.tiNew*sideInf(M.tiNewInflRef):tiPSF*inf;
      const lcAmt=(M.lcNewInflRef||M.lcRenewInflRef)?pp*M.lcRenew*sideInf(M.lcRenewInflRef)+(1-pp)*M.lcNew*sideInf(M.lcNewInflRef):lcVal*inf;
      payInto(S,sp.ti,cInt,tiAmt*tsf,rawMla.tiTiming);
      payInto(S,sp.lc,cInt,(M.lcBasis==="psf")?lcAmt*tsf:lcVal*gross,rawMla.lcTiming);
      // the profile's security deposit (months of the lease's first rent) and incentives ($/SF)
      if(num(rawMla.secDep)>0) (sp.mktDep||(sp.mktDep=[])).push({s:cInt,e:Math.min(cInt+termM-1,nM-1),D:num(rawMla.secDep)*mrPSF*tsf/12});
      if(num(rawMla.incentives)>0) (sp.inc||(sp.inc=new Float64Array(nM)))[cInt]+=num(rawMla.incentives)*inf*tsf;
      const stepList=[];
      for(let y=1;y*12<termM;y++){
        const im=cInt+y*12; if(im>=nM) break;
        stepList.push({label:labelM(im,S),psf:stepPSF(y)});
      }
      void 0;
      const endI=Math.min(cInt+termM-1,nM-1);
      sp.rollovers.push({month:cInt,label:labelM(cInt,S),rentPSF:mrPSF,termM,pp,
        downEff, freeMo, ti:tiPSF*inf*tsf,
        lc:(M.lcBasis==="psf")?lcVal*inf*tsf:lcVal*gross, profile:rawMla.name});
      sp.chain.push({kind:"Market",status:"Speculative",start:labelM(cInt,S),
        end:labelM(endI,S),startIdx:cInt,endIdx:endI,termM,ratePSF:mrPSF,amtYr:mrPSF*tsf,steps:stepList,
        freeMo,downEff,pp,profile:rawMla.name,
        recName:(byId(S.recs,M.rec)||{}).name||"",ti:tiPSF*inf*tsf,
        lc:(M.lcBasis==="psf")?lcVal*inf*tsf:lcVal*gross});
      cur=cStart+termM; first=false;
      if(rawMla.uponExp==="vacate"||rawMla.uponExp==="reabsorb") break;   // the chain ends; the space stays vacant without an absorption plan
      if(rawMla.uponExp==="renew") forceRenew=true;                        // later market leases renew with certainty
    }
    { const mp=byId(S.mlas,t.mla);
      if(mp&&mp.prOn&&num(mp.prRate)>0){
        const lk=segEnd!==null?Math.min(serToIdx(segEnd,S),nM-1):-1, r=num(mp.prRate);
        for(let i=Math.max(lk+1,0);i<nM;i++){ if(sp.occ[i]<=0) continue;
          const sales=num(mp.prSalesPSF)*tsf*seriesFactor(S,mp.prGrowthRef||"gen",i);
          sp.pr[i]+=Math.max(0,sales-(sp.rent[i]*12)/r)*r/12*sp.occ[i]; } } }
    return sp;
  };
  /* A termination option is two futures weighted by the probability of exercise: the
     lease runs its full term, or it stops at the break date, pays its termination fee
     and rolls to market. Both are carried as weighted spaces, so every downstream sum
     is an exact probability blend rather than an approximation of one. */
  const ABS=absorbLeases(S), ABSM=new Map(ABS.map(t=>[t.id,t]));
  for(const t of [...(S.tenants||[]),...ABS]){
    const p=t.breakOn?clamp(num(t.breakProb),0,1):0;
    const bE=(t.breakOn&&t.breakDate)?eSer(t.breakDate):null, tE=eSer(leaseEnd(t)), tS=sSer(t.start);
    if(p>0&&bE!==null&&tE!==null&&tS!==null&&bE>=tS&&bE<tE){
      const kb=serToIdx(bE,S), fb=t.breakFeeBasis||"months";
      bandsOf(Object.assign({},t,{termMode:"date",end:serISO(bE),expiry:t.breakThen||"Market",breakOn:false,prOn:t.prOn})).forEach((B,j)=>{ const brk=B.sp;
        if(kb>=0&&kb<nM&&kb>=B.a&&kb<=B.b){
          const mRent=brk.rent[kb]+brk.cpiAdj[kb];
          brk.fee[kb]+=fb==="months"?num(t.breakFee)*mRent:fb==="psf"?num(t.breakFee)*brk.sf:(j===0?num(t.breakFee):0);
        }
        brk.w=p; brk.breakP=p; brk.name+=" (break exercised)";
        spaces.push(brk); });
      if(p<1) bandsOf(t).forEach(B=>{ const stay=B.sp; stay.w=1-p; stay.breakP=p; stay.name+=" (runs full term)"; spaces.push(stay); });
    } else if((t.areaSched||[]).some(a=>a&&a.date)){ for(const B of bandsOf(t)) spaces.push(B.sp);
    } else { const sp=buildSpace(t); if(sp) spaces.push(sp); }
  }
  // security deposits: received at commencement, refunded at
  // expiry, credited to the buyer at sale if still held; interest on the balance held is
  // operating revenue
  const sdNet=new Float64Array(nM), sdIntM=new Float64Array(nM);
  { const hold=nY*12, ir=num(S.sdIntRate)/12;
    for(const t of (S.tenants||[])){ if(!t.sdOn) continue;
      const sp=spaces.find(x=>x.tid===t.id); const s0=sSer(t.start), e0=eSer(leaseEnd(t)); if(!sp||s0===null||e0===null) continue;
      const si=serToIdx(s0,S), ei=serToIdx(e0,S), kk=Math.min(Math.max(si,0),nM-1);
      const first=(t.areaSched||[]).some(a=>a&&a.date)?spaces.reduce((q,z)=>z.tid===t.id?q+(z.w===undefined?1:z.w)*(z.rent[kk]||0):q,0):(sp.rent[kk]||0);
      const D=t.sdBasis==="amt"?num(t.sdAmt):t.sdBasis==="psf"?num(t.sdAmt)*num(t.sf):num(t.sdAmt)*first;
      if(!(D>0)||ei<0) continue;
      if(si>=0&&si<hold) sdNet[si]+=D;
      const out=Math.min(ei,hold-1); if(out>=Math.max(si,0)){ sdNet[out]-=D; for(let i=Math.max(si,0);i<=out;i++) sdIntM[i]+=D*ir; } }
    for(const sp of spaces){ const w=(sp.w===undefined)?1:sp.w;
      for(const d of (sp.mktDep||[])){ const Dw=d.D*w; if(d.s<hold) sdNet[d.s]+=Dw; const out=Math.min(d.e,hold-1);
        if(out>=d.s){ sdNet[out]-=Dw; for(let i=d.s;i<=out;i++) sdIntM[i]+=Dw*ir; } } } }
  // absorption space is vacant until its lease begins: potential rent at market, with equal
  // absorption vacancy for unleased absorption space
  // the market rate in the profile's own unit, carried as $/SF/year
  const mktPSF=(mm,MM,sf)=>MM.mktNew*(mm.rentUnit==="psfmo"?12:mm.rentUnit==="yramt"?(sf>0?1/sf:0):mm.rentUnit==="moamt"?(sf>0?12/sf:0):1);
  const preLease=(sp,from,mm,MM)=>{ const g=i=>MM.growthRef?SF_(MM.growthRef,i):Math.pow(1+num(MM.growth),Math.floor(i/12));
    for(let i=Math.max(from,0);i<nM;i++){ if(sp.occ[i]>0) break;
      if(sp.rent[i]===0){ sp.rent[i]=mktPSF(mm,MM,sp.sf)*g(i)*sp.sf/12; sp.recId[i]=MM.rec; } } };
  for(const sp of spaces){ const a=ABSM.get(sp.tid); if(!a) continue;
    const mm=byId(S.mlas,a.mla), MM=mm?resolveMLA(mm,S):null; if(!MM) continue; preLease(sp,a.absorbFrom,mm,MM); }
  // a rent roll lease with an available date is vacant space until it starts
  for(const t of (S.tenants||[])){ if(!t.availDate||ABSM.has(t.id)) continue; const av=sSer(t.availDate); if(av===null) continue;
    const mm=byId(S.mlas,t.mla), MM=mm?resolveMLA(mm,S):null; if(!MM) continue;
    for(const sp of spaces) if(sp.tid===t.id&&!sp.bandLate) preLease(sp,serToIdx(av,S),mm,MM); }   // an expansion band is not this lease's space before it starts

  /* ---- occupancy & rent aggregation ---- */
  const occSF=Z(),gpr=Z(),cpiRev=Z(),abate=Z(),turnover=Z(),tiM=Z(),lcM=Z(),feeM=Z(),prM=Z(),incM=Z(),slM=Z(),slAdjM=Z();
  for(const sp of spaces){ const w=(sp.w===undefined)?1:sp.w;
    for(let i=0;i<nM;i++){
      if(sp.noOcc===undefined){ const tt=sp.tid?(S.tenants||[]).find(x=>x.id===sp.tid):null; sp.noOcc=!!(tt&&tt.noOcc); }
      if(!sp.noOcc) occSF[i]+=sp.sf*sp.occ[i]*w;     // a lease excluded from occupancy (such as amenity and permanently vacant suites) stays out of occupied area
      gpr[i]+=sp.rent[i]*w; cpiRev[i]+=sp.cpiAdj[i]*sp.occ[i]*w;
      // absorption & turnover is the loss on potential BASE rent. CPI is already carried
      // net of occupancy on its own line; charging it here as well removed it twice in
      // any partially occupied month.
      turnover[i]+=sp.rent[i]*(1-sp.occ[i])*w;
      abate[i]+=sp.abate[i]*w; tiM[i]+=sp.ti[i]*w; lcM[i]+=sp.lc[i]*w; if(sp.inc) incM[i]+=sp.inc[i]*w;
      if(sp.sl&&sp.sl[i]){ slM[i]+=sp.sl[i]*w; slAdjM[i]+=(sp.sl[i]-(sp.rent[i]*sp.occ[i]-sp.abate[i]))*w; }
      feeM[i]+=(sp.fee?sp.fee[i]:0)*w; prM[i]+=(sp.pr?sp.pr[i]:0)*w;
    }}
  const occRate=Z(); for(let i=0;i<nM;i++) occRate[i]=clamp(occSF[i]/sf,0,1);

  /* ---- revenues: parking / storage / misc ---- */
  const revLine=(arr,kind)=>(arr||[]).map(o=>{
    const m=Z();
    // a revenue line can start and stop, and can be tied to a lease so it dies with it
    const s0=o.start?mIdx(o.start,S):null, e0=o.end?mIdx(o.end,S):null;
    let tEnd=null;
    if(o.tenant){ const tt=(S.tenants||[]).find(x=>x.id===o.tenant), te=tt?leaseEnd(tt):"";
      if(te){ const k=mIdx(te,S); if(k!==null) tEnd=k; } }
    for(let i=0;i<nM;i++){
      if(s0!==null&&i<s0) continue;
      if(e0!==null&&i>e0) continue;
      if(tEnd!==null&&i>tEnd) continue;
      const f=lineFactor(S,o,i,"gen");
      let v=0;
      if(kind==="count"){ const oc=(o.occ===null||o.occ===""||o.occ===undefined)?1:clamp(num(o.occ),0,1);
        v=num(o.spaces||o.units)*num(o.rate)*oc*f; }
      else v=(o.basis==="psf"?num(o.amt)*sf:num(o.amt))*f/12;
      m[i]=v;
    }
    return {name:o.name,m};
  });
  const parkL=revLine(S.parking,"count"), storL=revLine(S.storage,"count"), miscL=revLine(S.misc,"amt");
  // miscellaneous rents on leases: paid while the lease is occupied
  for(const t of (S.tenants||[])) for(const r of (t.miscRents||[])){
    const sp=spaces.find(x=>x.tid===t.id), s0=sSer(r.start||t.start), e0=eSer(r.end||leaseEnd(t)); if(!sp||s0===null||e0===null) continue;
    const a=Math.max(serToIdx(s0,S),0), b=Math.min(serToIdx(e0,S),nM-1), m=new Float64Array(nM);
    const per=r.basis==="year"?num(r.amt)/12:r.basis==="psf"?num(r.amt)*num(t.sf)/12:num(r.amt);
    const banded=r.basis==="psf"&&(t.areaSched||[]).some(x=>x&&x.date), TS=banded?spaces.filter(z=>z.tid===t.id):null;
    for(let i=a;i<=b;i++) m[i]=banded?TS.reduce((q,z)=>q+num(r.amt)*z.sf/12*(z.w===undefined?1:z.w)*z.occ[i],0)*seriesFactor(S,r.growthRef||"",i)
                                      :per*seriesFactor(S,r.growthRef||"",i)*sp.occ[i];
    miscL.push({name:(t.name||"Tenant")+": "+(r.name||"Miscellaneous rent"),m});
  }
  const sumL=(L,src)=>{const z=Z(); L.forEach((x,k)=>{ if((x.def||(src||[])[k]||{}).refOnly) return; for(let i=0;i<nM;i++) z[i]+=x.m[i]; }); return z;};   // reference-only lines stay out
  const parkT=sumL(parkL,S.parking), storT=sumL(storL,S.storage), miscT=sumL(miscL,S.misc);
  if(sdIntM.some(v=>v)) for(let i=0;i<nM;i++) miscT[i]+=sdIntM[i];     // deposit interest is operating revenue

  /* ---- ground leases ---- */
  const glOp=Z(), glNon=Z();
  for(const g of (S.groundLeases||[])){
    const s=mIdx(g.start,S)??0, termM=num(g.termYears)*12||nM;
    for(let i=Math.max(s,0);i<Math.min(s+termM,nM);i++){
      const k=i-s;
      const v=(g.rentBasis==="psf"?num(g.rent)*sf:num(g.rent))*Math.pow(1+num(g.escal),Math.floor(k/12))/12;
      if(g.treatment==="nonop") glNon[i]+=v; else glOp[i]+=v;
    }
  }

  /* ---- operating expenses ---- */
  const opLines=(S.ops||[]).map(o=>({def:o,m:Z(),rec:recovOf(o)>0}));
  const expBase=(o,i)=>{
    // "Use Amount 2": a second amount takes over from its own start date
    if(o.amt2Start){
      const k=mIdx(o.amt2Start,S);
      if(k!==null && i>=k){
        const f2=lineFactor(S,{infl:o.infl2,inflRef:o.inflRef2||o.inflRef},i,"exp");
        const b2=o.basis2||o.basis, a2=num(o.amt2);
        if(b2==="psf")    return a2*sf*f2/12;
        if(b2==="psfmo")  return a2*sf*f2;
        if(b2==="psfocc") return a2*occSF[i]*f2/12;
        if(b2==="amt")    return a2*f2/12;
        if(b2==="amtmo")  return a2*f2;
      }
    }
    if(o.basis==="prop13"){ let f=1; for(let k=1;k<=Math.floor(i/12);k++) f*=1+Math.min(lineFactor(S,o,12*k,"exp")/lineFactor(S,o,12*(k-1),"exp")-1,0.02);
      return num(o.amt)*num(S.prop13Base)*f/12; }
    // amounts by year: an explicit schedule in the line's own units replaces Amount 1 x inflation
    const AY=yrList(o.amtYears), f=(AY&&!o.inflAY)?1:lineFactor(S,o,i,"exp"), A1=AY?yrAt(AY,Math.floor(i/12)):num(o.amt);
    if(o.basis==="psf")    return A1*sf*f/12;
    if(o.basis==="psfmo")  return A1*sf*f;
    if(o.basis==="psfocc") return A1*occSF[i]*f/12;
    if(o.basis==="amt")    return A1*f/12;
    if(o.basis==="amtmo")  return A1*f;
    return 0;                                   // percentage bases resolved by iteration
  };
  for(const L of opLines){
    if(isPctBasis(L.def.basis)) continue;        // no fixed/variable split on a % basis
    for(let i=0;i<nM;i++){
      const b=expBase(L.def,i), fx=clamp(num(L.def.fixedPct),0,1);
      L.m[i]=S.fixedGrossOnly?b:b*fx+b*(1-fx)*occRate[i];
    }
  }
  // grossed-up recoverable pool, per recovery structure's pool selection
  const occAYc=[], occAY=y=>{ if(occAYc[y]===undefined){ let q=0,n=0; for(let i=y*12;i<Math.min(y*12+12,nM);i++){ q+=occRate[i]; n++; } occAYc[y]=n?q/n:0; } return occAYc[y]; };
  // A pool is its fixed lines, whose amounts never change during a run (cached by pool, month and gross-up), plus its
  // % of revenue lines (the management fee), which the fixed-point loop below resolves pass by pass.
  const poolFix=new Map(), poolPct=new Map();
  const inPool=(d,poolId)=>!poolId||d.id===poolId||d.group===poolId||(Array.isArray(d.groups)&&d.groups.includes(poolId));   // a line can sit in several pools
  const poolFor=(poolId,i,gu)=>{
    const pk=poolId||""; let pl=poolPct.get(pk);
    if(!pl){ pl=[]; for(const L of opLines){ const d=L.def, rp=recovOf(d); if(rp>0&&inPool(d,poolId)&&isPctBasis(d.basis)) pl.push([L,rp]); } poolPct.set(pk,pl); }
    const k=pk+"|"+i+"|"+gu; let p=poolFix.get(k);
    if(p===undefined){ p=0;
      for(const L of opLines){
        const d=L.def, rp=recovOf(d);
        if(rp<=0||!inPool(d,poolId)||isPctBasis(d.basis)) continue;    // recoverable share of this line; % lines are added below
        const b=expBase(d,i), fx=clamp(num(d.fixedPct),0,1);
        // "Use Monthly Occupancy for Gross Up" (Basis default on; turning it off uses the year's average).
        // A gross-up lifts the variable expense to the stated occupancy; it never reduces an actual one.
        const oc=(S.guMonthly===false)?occAY(Math.floor(i/12)):occRate[i];
        const guF=oc>0?Math.max(1,Math.min(gu/oc,1/oc)):1;
        // Do not substitute 10% occupancy: that understates the selected gross-up
        // during early lease-up. Ratio-first arithmetic also handles tiny shares.
        const variable=Number.isFinite(guF)?b*(1-fx)*occRate[i]*guF
          :b*(1-fx)*(occRate[i]/oc)*Math.min(gu,1);
        p+=(b*fx + variable)*rp;
      }
      poolFix.set(k,p); }
    for(const [L,rp] of pl) p+=L.m[i]*rp;
    return p;
  };
  // base-year stop reference: grossed-up pool per SF by calendar year, per pool
  const stopCache={}, stopSeg=new Map();
  // contributions taken off a pool before it is shared (an anchor's fixed CAM contribution), $ a year with its own inflation
  const dedAt=(L,i)=>(L&&L.poolDeduct&&num(L.poolDeduct))?num(L.poolDeduct)*seriesFactor(S,L.poolDeductInfl||"exp",i)/12:0;
  const RYc=new Array(nM); for(let i=0;i<nM;i++) RYc[i]=recYearI(S,i);   // each month's recovery year, worked out once per run
  function stopPSF(poolId,year,gu,L){
    { const y0=RYc[0]; if(year<y0) year=y0; }   // a base year before the analysis is its first year (reference case: Brickstone's Seventy2, 2025 lease, 2026 stop)
    const key=poolId+"|"+year+"|"+gu+"|"+(L&&L.poolDeduct&&num(L.poolDeduct)?num(L.poolDeduct)+":"+(L.poolDeductInfl||""):"");
    if(stopCache[key]!==undefined) return stopCache[key];
    let tot=0,n=0;
    for(let i=0;i<nM;i++) if(RYc[i]===year){ tot+=Math.max(0,poolFor(poolId,i,gu)-dedAt(L,i)); n++; }
    const v = n? (tot/n)/sf : 0;                      // monthly $/SF
    stopCache[key]=v; return v;
  }

  /* ---- recoveries + revenue: solved together ----------------------------------
     A recoverable management fee struck as a % of EGR is circular: the fee is in the
     recovery pool, recoveries lift EGR, EGR lifts the fee. Iterate to a fixed point.
     Per-tenant general vacancy overrides need each tenant's own share of PGR, so
     reimbursements are tracked per space as well as in total. ------------------- */
  const reimb=Z(), sched=Z(), tpgr=Z(), genVac=Z(), credit=Z(), egr=Z();
  // what each percentage basis is a percentage OF
  const pctDriver=(d,i,lines)=>
      d.basis==="pctEGR"   ? egr[i]
    : d.basis==="pctPGR"   ? tpgr[i]
    : d.basis==="pctRent"  ? sched[i]
    : d.basis==="pctRecov" ? reimb[i]
    : d.basis==="pctOther" ? (parkT[i]+storT[i]+miscT[i])
    : d.basis==="pctLine"  ? ((lines.find(x=>x.def.id===d.ofLine)||{m:Z()}).m[i]||0)
    : 0;
  const spReimb=spaces.map(()=>Z());
  // tenants flagged out of the credit loss calculation (ExcludeFromCreditLossCalc)
  const clExIdx=spaces.map((sp,si)=>{const t=(S.tenants||[]).find(x=>x.id===sp.tid);
    return (t&&t.noCredit)?si:-1;}).filter(si=>si>=0);
  const gvRateFor=(t,sp,i)=>{
    const o=(t&&t.gvOv!==undefined&&t.gvOv!==null&&t.gvOv!=="")?num(t.gvOv):null;
    if(o===null) return num(S.gvRate);
    // "After Expiration: Standard Rate" — the override covers the in-place lease only,
    // not the market leases that follow it
    if(S.gvOvLapses && sp && sp.inPlaceEnd!==undefined && i>sp.inPlaceEnd) return num(S.gvRate);
    return o;
  };
  // is the space on its own override this month? Standard-rate tenants are one pool, reduced by their own absorption
  // & turnover vacancy; an overridden tenant stands alone, reduced only by its own (Ballardvale 2025: LeafFilter at
  // 0% before it starts offsets nothing, so general vacancy stays 3% of the other tenants)
  const gvIsOv=(t,sp,i)=>{ if(!(t&&t.gvOv!==undefined&&t.gvOv!==null&&t.gvOv!=="")) return false;
    return !(S.gvOvLapses && sp && sp.inPlaceEnd!==undefined && i>sp.inPlaceEnd); };
  // by id: tenants often share a name (several "Vacant" suites, one company on two leases)
  const tenantOf=sp=>(sp.tid&&(S.tenants||[]).find(t=>t.id===sp.tid))||(S.tenants||[]).find(t=>(t.name||"")===sp.srcName)||null;
  for(let i=0;i<nM;i++) sched[i]=gpr[i]-turnover[i]-abate[i];

  /* general vacancy calculated annually rather than month by month. It runs inside the solve, so a % of EGR
     line (a recoverable management fee) is struck on the same EGR the cash flow reports, and the recoveries
     billed on it match the fee expensed. */
  const GVB=(()=>{ const c=Math.round(num(S.gvCalcMonth)), out=[];
    if(!(c>=1&&c<=12)){ for(let y=0;y*12<nM;y++) out.push([y*12,Math.min(y*12+11,nM-1)]); return out; }
    const m0=(num(S.startMonth)||1)-1; let b0=0; for(let i=1;i<nM;i++) if((m0+i)%12===c-1){ out.push([b0,i-1]); b0=i; } out.push([b0,nM-1]); return out; })();
  /* The base differs by calculation frequency with "Gross-up revenue by absorption &
     turnover" and "Reduce general vacancy by absorption & turnover" both on: month by month, each tenant's potential
     revenue (vacant months included) less that month's absorption & turnover vacancy (JFK, to the dollar); annually,
     the year's scheduled revenue less the year's absorption & turnover vacancy (Ballardvale, to the dollar). */
  const annualGV=()=>{
    for(const [gb0,gb1] of GVB){
      let rawY=0,turnY=0,n=0; const own=new Map();          // overridden spaces: their own [vacancy, absorption & turnover]
      for(let i=gb0;i<=gb1;i++){ n++;
        if(S.gvPerTenant){
          spaces.forEach((sp,si)=>{ const t=tenantOf(sp), w=(sp.w===undefined)?1:sp.w, r=gvRateFor(t,sp,i), tv=sp.rent[i]*(1-sp.occ[i])*w;
            const v=((sp.rent[i]+sp.cpiAdj[i])*sp.occ[i]-sp.abate[i]+(sp.pr?sp.pr[i]:0))*w+spReimb[si][i];
            if(gvIsOv(t,sp,i)){ const a=own.get(si)||[0,0]; a[0]+=r*v; a[1]+=tv; own.set(si,a); } else { rawY+=r*v; turnY+=tv; } });
          rawY+=num(S.gvRate)*(parkT[i]+storT[i]+miscT[i]);
        } else { rawY+=num(S.gvRate)*tpgr[i]; turnY+=turnover[i]; }
      }
      let gvY=S.gvCredit?Math.max(0,rawY-turnY):rawY; for(const [,a] of own) gvY+=S.gvCredit?Math.max(0,a[0]-a[1]):a[0];
      for(let i=gb0;i<=gb1;i++){ genVac[i]=gvY/n; egr[i]=tpgr[i]-genVac[i]-credit[i]+feeM[i]; }
    }
  };
  for(let iter=0; iter<60; iter++){
    // base-year stops are re-struck each pass: the first pass has no % of EGR fee yet, and a stop cached then
    // left the management fee out of the base (Brickstone: ALKU's 2034 market lease recovered in its own base year)
    for(const k of Object.keys(stopCache)) delete stopCache[k]; stopSeg.clear();
    // recoveries at the current expense pool
    for(let i=0;i<nM;i++) reimb[i]=0;
    const capSt=new Map(), calY=i=>RYc[i];
    // a recovery line's numbers are fixed for the run: parse each line's once per pass, not every month of every space
    const LCN=new Map(), lcN=L=>{ let c=LCN.get(L); if(!c){ c={sharePct:num(L.sharePct),denomSF:num(L.denomSF),
        gu:clamp((L.grossUp===undefined||L.grossUp===null||L.grossUp==="")?1:num(L.grossUp),0,1.2),
        by:L.baseYear?Math.round(num(L.baseYear)):null,byOff:Math.round(num(L.baseYearOffset)||0),
        stopAmt:num(L.stopAmt),fixed:num(L.fixed),adminFee:num(L.adminFee),capPct:num(L.capPct)}; LCN.set(L,c); } return c; };
    spaces.forEach((sp,si)=>{
      const acc=spReimb[si];
      for(let i=0;i<nM;i++){
        acc[i]=0;
        if(sp.occ[i]<=0) continue;
        let R=recById(sp.recId[i]); if(!R) continue; let viaMla=false;
        if(R.method==="MARKET"&&!(R.lines&&R.lines.length)){   // defer to the space's own MLA
          const t0=tenantOf(sp);
          const mm=t0?byId(S.mlas,t0.mla):null;
          if(mm){ R=recById(resolveMLA(mm,S).rec)||R; viaMla=true; }
          if(!R||(R.method==="MARKET"&&!(R.lines&&R.lines.length))) continue;
        }
        if(R.method==="GROSS"&&!(R.lines&&R.lines.length)) continue;
        if(R.payDuringFree===false && sp.abate[i]>0) continue;   // stop during abatement
        // A structure is a list of lines, each with its own pool, method, share, gross-up,
        // base year, admin fee, bounds and cap: net on CAM, base year on taxes,
        // fixed on insurance. A structure with no lines is its own single line, and on the
        // rentable and occupied shares every line computes exactly as before.
        const LINES=(R.lines&&R.lines.length)?R.lines:[R];
        // a stock structure takes the lease's own amount (Stop Amount, Stop Amount / Area, Fixed Amount, Fixed Amount / Area):
        // the rent roll's during the lease, the market profile's once the space has rolled to market
        let LAMT=null, LINF="";
        if(R.leaseAmt){ const t0=tenantOf(sp), mm=t0?byId(S.mlas,t0.mla):null, le=t0?leaseEnd(t0):"", ei=le?mIdx(le,S):null;
          const own=!viaMla&&t0&&sp.recId[i]===t0.rec&&(ei===null||i<=ei), src=own?t0:mm; LAMT=num(src&&src.recAmt); LINF=(src&&src.recInfl)||""; }
        let amtAll=0;
        for(let li=0;li<LINES.length;li++){
          const L=LAMT===null?LINES[li]:{...LINES[li],stopAmt:LAMT,fixed:LAMT,stopInfl:LINF||LINES[li].stopInfl,inflRef:LINF||LINES[li].inflRef}, m=L.method||"NNN";
          if(m==="GROSS"||m==="MARKET") continue;
          const dn=L.denom||"rentable", legacy=(dn==="rentable"||dn==="occupied");
          const share=(dn==="fixedpct")?lcN(L).sharePct
            :sp.sf/((dn==="occupied")?Math.max(occSF[i],1)
              :(dn==="occfloor")?Math.max(occSF[i],lcN(L).sharePct*sf,1)
              :(dn==="custom")?Math.max(lcN(L).denomSF,1):sf);
          const gu=lcN(L).gu;   // 0% is none (reference case: Bright Horizons, Tax NNN); blank keeps the 100% default
          const pool=Math.max(0,poolFor(L.pool,i,gu)-dedAt(L,i));
          const adminOnPool=(L.adminBasis!=="recovery");
          const stopF=(L.stopInfl&&L.stopInfl!=="none")?seriesFactor(S,L.stopInfl,i):1;
          let amt=0;
          if(m==="NNN")          amt=share*pool;
          else if(m==="STOP"){                           // base year: the lease's, offset, or a stated year
            const by=(lcN(L).by!==null?lcN(L).by:(sp.baseY[i]||S.startYear)+lcN(L).byOff);
            amt=legacy?Math.max(0,pool/sf-stopPSF(L.pool,by,gu,L))*sp.sf
                      :Math.max(0,share*(pool-stopPSF(L.pool,by,gu,L)*sf));
          }
          else if(m==="STOPAMT")  amt=Math.max(0,share*pool-lcN(L).stopAmt*stopF*share/12);
          else if(m==="STOPPSF")  amt=legacy?Math.max(0,pool/sf-lcN(L).stopAmt*stopF/12)*sp.sf
                                            :Math.max(0,share*pool-lcN(L).stopAmt*stopF*sp.sf/12);
          else if(m==="FIXED")    amt=lcN(L).fixed*sp.sf*lineFactor(S,L,i,"exp")/12;
          else if(m==="FIXEDAMT") amt=lcN(L).fixed*share*lineFactor(S,L,i,"exp")/12;
          // Net a stop over the recovery year rather than month by month: the pool for the period's occupied months less the
          // stop for those months, floored at nothing, then billed evenly (Brickstone: ALKU a flat $7,653 a month)
          if(S.stopAnnual!==false&&(m==="STOP"||m==="STOPAMT"||m==="STOPPSF")){
            const yI=calY(i), bY=sp.baseY[i]||0, key=si+":"+li+":"+yI+":"+sp.recId[i]+":"+bY+":"+(LAMT===null?"":LAMT);
            let sg=stopSeg.get(key);
            if(!sg){ let tot=0,ws=0;
              // Prorate the recovery year's pool by the occupied months (ALKU's January-June 2033: half the year's pool)
              let pY=0,nY=0; for(let j=Math.max(0,i-11);j<=Math.min(nM-1,i+11);j++) if(calY(j)===yI){ pY+=Math.max(0,poolFor(L.pool,j,gu)-dedAt(L,j)); nY++; } const pAvg=nY?pY/nY:0;
              for(let j=Math.max(0,i-11);j<=Math.min(nM-1,i+11);j++){
                if(calY(j)!==yI||sp.recId[j]!==sp.recId[i]||(sp.baseY[j]||0)!==bY) continue;
                const w=Math.max(sp.occ[j]-(sp.recAb?sp.recAb[j]:0),0); if(w<=0) continue;
                if(R.payDuringFree===false&&sp.abate[j]>0) continue;
                const pj=pAvg, shj=(dn==="fixedpct")?lcN(L).sharePct:sp.sf/((dn==="occupied")?Math.max(occSF[j],1)
                  :(dn==="occfloor")?Math.max(occSF[j],lcN(L).sharePct*sf,1):(dn==="custom")?Math.max(lcN(L).denomSF,1):sf);
                const fj=(L.stopInfl&&L.stopInfl!=="none")?seriesFactor(S,L.stopInfl,j):1; let r;
                if(m==="STOP"){ const by=(lcN(L).by!==null?lcN(L).by:(sp.baseY[j]||S.startYear)+lcN(L).byOff);
                  r=legacy?(pj/sf-stopPSF(L.pool,by,gu,L))*sp.sf:shj*(pj-stopPSF(L.pool,by,gu,L)*sf); }
                else if(m==="STOPAMT") r=shj*pj-lcN(L).stopAmt*fj*shj/12;
                else r=legacy?(pj/sf-lcN(L).stopAmt*fj/12)*sp.sf:shj*pj-lcN(L).stopAmt*fj*sp.sf/12;
                tot+=r*w; ws+=w; }
              sg={amt:ws>0?Math.max(0,tot)/ws:0}; stopSeg.set(key,sg); }
            amt=sg.amt;
          }
          if(adminOnPool) amt*=(1+lcN(L).adminFee);
          // floor and ceiling on the recovery itself, each with its own indexation
          const bnd=(k,a,ir)=>(!k||k==="none")?null
            :(k==="psf"?num(a)*sp.sf:num(a))*seriesFactor(S,ir||"none",i)/12;
          const lo=bnd(L.minBasis,L.minAmt,L.minInfl), hi=bnd(L.maxBasis,L.maxAmt,L.maxInfl);
          if(lo!==null) amt=Math.max(amt,lo);
          if(hi!==null) amt=Math.min(amt,hi);
          // cap on increases (controllable expenses): compounding from the lease's first
          // recovery year, or non-cumulative over the prior year's capped recovery
          const cp=lcN(L).capPct;
          if(cp>0){ const key=si+":"+li+":"+(sp.baseY[i]||0); let st=capSt.get(key); if(!st){ st={}; capSt.set(key,st); }
            const y=calY(i); let lim=Infinity;
            if(L.capType==="noncum"){ const p=st[y-1]; if(p&&p.n) lim=p.c/p.n*(1+cp); }
            else if(st.b&&st.b.y<y&&st.b.n) lim=st.b.u/st.b.n*Math.pow(1+cp,y-st.b.y);
            const c=Math.min(amt,lim), e=st[y]||(st[y]={c:0,n:0}); e.c+=c; e.n++;
            if(!st.b) st.b={y,u:0,n:0}; if(st.b.y===y){ st.b.u+=amt; st.b.n++; }
            amt=c; }
          if(!adminOnPool) amt*=(1+lcN(L).adminFee);
          amtAll+=amt;
        }
        acc[i]=amtAll*Math.max(sp.occ[i]-(sp.recAb?sp.recAb[i]:0),0)*((sp.w===undefined)?1:sp.w);
        reimb[i]+=acc[i];
      }
    });
    // revenue, general vacancy (per-tenant rates), credit loss, EGR
    for(let i=0;i<nM;i++){
      tpgr[i]=sched[i]+cpiRev[i]+prM[i]+reimb[i]+parkT[i]+storT[i]+miscT[i];
      if(S.gvPerTenant){
        let rawS=num(S.gvRate)*(parkT[i]+storT[i]+miscT[i]), turnS=0, gvO=0;
        spaces.forEach((sp,si)=>{ const t=tenantOf(sp), w=(sp.w===undefined)?1:sp.w, r=gvRateFor(t,sp,i), tv=sp.rent[i]*(1-sp.occ[i])*w;
          const v=(sp.rent[i]-sp.abate[i]+sp.cpiAdj[i]+(sp.pr?sp.pr[i]:0))*w+spReimb[si][i];
          if(gvIsOv(t,sp,i)) gvO+=S.gvCredit?Math.max(0,r*v-tv):r*v; else { rawS+=r*v; turnS+=tv; } });
        genVac[i]=(S.gvCredit?Math.max(0,rawS-turnS):rawS)+gvO;
      } else { const raw=num(S.gvRate)*tpgr[i]; genVac[i]=S.gvCredit?Math.max(0,raw-turnover[i]):raw; }
      let clx=0;
      for(const si of clExIdx){ const sp=spaces[si], w=(sp.w===undefined)?1:sp.w;
        clx+=((sp.rent[i]+sp.cpiAdj[i])*sp.occ[i]-sp.abate[i]+(sp.pr?sp.pr[i]:0))*w+spReimb[si][i]; }
      credit[i]=num(S.clRate)*Math.max(tpgr[i]-clx,0);
      // a termination fee is a one-off receipt: below vacancy and credit loss
      egr[i]=tpgr[i]-genVac[i]-credit[i]+feeM[i];
    }
    if(S.gvAnnual) annualGV();
    // re-strike % of EGR expense lines; stop when they stop moving
    let delta=0;
    for(const L of opLines){
      const d=L.def; if(!isPctBasis(d.basis)) continue;
      for(let i=0;i<nM;i++){
        const v=num(d.amt)*pctDriver(d,i,opLines);
        delta+=Math.abs(v-L.m[i]); L.m[i]=v;
      }
    }
    if(delta<1e-6) break;          // percentage lines that feed each other (fees on recoveries) solve to a millionth of a dollar
  }
  const opTot=Z(); for(const L of opLines){ if(L.def.refOnly) continue; for(let i=0;i<nM;i++) opTot[i]+=L.m[i]; }   // reference-only lines feed recoveries only
  for(let i=0;i<nM;i++) opTot[i]+=glOp[i];
  // payment schedules move a line's cash between months within each analysis year; annual
  // totals, and the recoveries already settled on them, are unchanged
  for(const x of opLines){ const nv=paySpreadLine(S,x.m,x.def); if(!nv) continue; if(!x.def.refOnly) for(let i=0;i<nM;i++) opTot[i]+=nv[i]-x.m[i]; x.m.set(nv); }
  [[miscL,miscT,S.misc],[parkL,parkT,S.parking],[storL,storT,S.storage]].forEach(([LL,T,src])=>LL.forEach((x,k)=>{
    const nv=paySpreadLine(S,x.m,(x.def||(src||[])[k]||{})); if(!nv) return;
    if(!(x.def||(src||[])[k]||{}).refOnly) for(let i=0;i<nM;i++){ const d=nv[i]-x.m[i]; T[i]+=d; tpgr[i]+=d; egr[i]+=d; } x.m.set(nv); }));
  // actuals: through the actual values end month a line's actual amounts
  // replace its forecast; with revenue actuals, those months carry no general vacancy or credit loss
  const mK=s=>{ const x=/^(\d{4})-(\d{2})/.exec(String(s||"")); return x?(+x[1]-num(S.startYear))*12+(+x[2]-(num(S.startMonth)||1)):-1; };
  // budgets follow the actuals: after the actual values end, through the budget values end, a line's
  // budget replaces its forecast. The data configuration selects the cash flow source (default Actual + Budget + Forecast).
  const DC=S.dataCfg||"abf", actK=(DC==="abf"||DC==="af")?mK(S.actEnd):-1, budK=(DC==="abf"||DC==="bf")?mK(S.budEnd):-1;
  const ACT=new Map(), BUD=new Map(), aBase=num(S.startYear)*12+(num(S.startMonth)||1)-1;
  if(actK>=0) for(const a of (S.actuals||[])) if(a&&a.line){ const mp=atlParse(a.data); if(mp.size) ACT.set(a.line,mp); }
  if(budK>actK) for(const b of (S.budgets||[])) if(b&&b.line){ const mp=atlParse(b.data); if(mp.size) BUD.set(b.line,mp); }
  const applyAct=(key,arr,also)=>{ for(const [MP,lo,hi] of [[ACT,0,actK],[BUD,actK+1,budK]]){ const mp=MP.get(key); if(!mp) continue;
    for(let i=Math.max(lo,0);i<=Math.min(hi,nM-1);i++){ const v=mp.get(aBase+i); if(v===undefined) continue; const d=v-arr[i]; arr[i]=v; for(const b of also) b[i]+=d; } } };
  if(ACT.size||BUD.size){
    applyAct("rent",sched,[gpr,tpgr,egr]); applyAct("reimb",reimb,[tpgr,egr]); applyAct("cpi",cpiRev,[tpgr,egr]); applyAct("pr",prM,[tpgr,egr]);
    [[miscL,miscT,S.misc,"misc"],[parkL,parkT,S.parking,"park"],[storL,storT,S.storage,"stor"]].forEach(([LL,T,src,k])=>LL.forEach((x,j)=>{
      const d=x.def||(src||[])[j]; if(d&&d.id) applyAct(k+":"+d.id,x.m,d.refOnly?[]:[T,tpgr,egr]); }));
    for(const x of opLines) if(x.def.id) applyAct("op:"+x.def.id,x.m,x.def.refOnly?[]:[opTot]);
    const revK=/^(rent|reimb|cpi|pr|misc|park|stor)/;   // months carried by revenue actuals or budgets have no general vacancy or credit loss
    for(const [MP,lo,hi] of [[ACT,0,actK],[BUD,actK+1,budK]]) if(S.actNoVac!==false&&[...MP.keys()].some(k=>revK.test(k)))
      for(let i=Math.max(lo,0);i<=Math.min(hi,nM-1);i++){ egr[i]+=genVac[i]+credit[i]; genVac[i]=0; credit[i]=0; }
  }
  const noi=Z(); for(let i=0;i<nM;i++) noi[i]=egr[i]-opTot[i];

  /* ---- non-operating, capital ---- */
  const nonLines=(S.nonops||[]).map(o=>({def:o,m:Z()}));
  for(const L of nonLines) for(let i=0;i<nM;i++) L.m[i]=expBase(L.def,i);   // absolute bases only
  const nonTot=Z(); for(const L of nonLines){ if(L.def&&L.def.refOnly) continue; for(let i=0;i<nM;i++) nonTot[i]+=L.m[i]; }
  for(let i=0;i<nM;i++) nonTot[i]+=glNon[i];

  const capLines=(S.caps||[]).map(c=>({def:c,m:Z()}));
  for(const L of capLines){ const c=L.def, fF=k=>lineFactor(S,c,k,"exp");
    if(num(c.year)>0){ const i=(Math.round(num(c.year))-1)*12;
      if(i>=0&&i<nM) L.m[i]=(c.basis==="psf"?num(c.amt)*sf:num(c.amt))*fF(i); }
    else { const AY=yrList(c.amtYears);
      for(let i=0;i<nM;i++) L.m[i]=AY?(c.basis==="psf"?yrAt(AY,Math.floor(i/12))*sf:yrAt(AY,Math.floor(i/12)))/12*(c.inflAY?fF(i):1):(c.basis==="psf"?num(c.amt)*sf:num(c.amt))*fF(i)/12; } }
  const capTot=Z(); for(const L of capLines){ if(L.def&&L.def.refOnly) continue; for(let i=0;i<nM;i++) capTot[i]+=L.m[i]; }

  const leasing=Z(),cfbds=Z();
  for(const [LL,T] of [[capLines,capTot],[nonLines,nonTot]]) for(const x of LL){ const nv=paySpreadLine(S,x.m,x.def); if(!nv) continue;
    if(!(x.def&&x.def.refOnly)) for(let i=0;i<nM;i++) T[i]+=nv[i]-x.m[i]; x.m.set(nv); }
  if(ACT.size){ applyAct("ti",tiM,[]); applyAct("lc",lcM,[]);
    capLines.forEach(x=>{ if(x.def.id) applyAct("cap:"+x.def.id,x.m,x.def.refOnly?[]:[capTot]); }); nonLines.forEach(x=>{ if(x.def.id) applyAct("non:"+x.def.id,x.m,x.def.refOnly?[]:[nonTot]); }); }
  const LINEM={rent:sched,reimb,cpi:cpiRev,pr:prM,ti:tiM,lc:lcM};
  for(const [LL,k] of [[opLines,"op"],[capLines,"cap"],[nonLines,"non"]]) LL.forEach(x=>{ if(x.def.id) LINEM[k+":"+x.def.id]=x.m; });
  [[miscL,S.misc,"misc"],[parkL,S.parking,"park"],[storL,S.storage,"stor"]].forEach(([LL,src,k])=>LL.forEach((x,j)=>{ const d=x.def||(src||[])[j]; if(d&&d.id) LINEM[k+":"+d.id]=x.m; }));
  for(let i=0;i<nM;i++){ leasing[i]=tiM[i]+lcM[i]+capTot[i]+incM[i]; cfbds[i]=noi[i]-nonTot[i]-leasing[i]+sdNet[i]; }

  /* ---- annual rollup ---- */
  const A=a=>{const o=new Array(nY+1).fill(0);
    for(let y=0;y<=nY;y++) for(let k=0;k<12;k++){const i=y*12+k; if(i<nM)o[y]+=a[i];} return o;};
  const ann={gpr:A(gpr),cpi:A(cpiRev),fee:A(feeM),pr:A(prM),turnover:A(turnover),abate:A(abate),sched:A(sched),reimb:A(reimb),
    park:A(parkT),stor:A(storT),misc:A(miscT),tpgr:A(tpgr),genVac:A(genVac),credit:A(credit),egr:A(egr),
    op:A(opTot),noi:A(noi),non:A(nonTot),ti:A(tiM),lc:A(lcM),cap:A(capTot),leasing:A(leasing),inc:A(incM),sl:A(slM),slAdj:A(slAdjM),sdNet:A(sdNet),sdInt:A(sdIntM),cfbds:A(cfbds),
    ops:opLines.map(L=>({name:L.def.name,v:A(L.m),m:L.m,ref:!!L.def.refOnly})),
    nons:nonLines.map(L=>({name:L.def.name,v:A(L.m),m:L.m,ref:!!L.def.refOnly})),
    caps:capLines.map(L=>({name:L.def.name,v:A(L.m),m:L.m,ref:!!L.def.refOnly})),
    parks:parkL.map(x=>({name:x.name,v:A(x.m),m:x.m})),
    stors:storL.map(x=>({name:x.name,v:A(x.m),m:x.m})),
    miscs:miscL.map(x=>({name:x.name,v:A(x.m),m:x.m})),
    glOp:A(glOp),glNon:A(glNon),
    occ:(()=>{const o=new Array(nY+1).fill(0);
      for(let y=0;y<=nY;y++){let s2=0,n=0;for(let k=0;k<12;k++){const i=y*12+k;if(i<nM){s2+=occRate[i];n++;}}o[y]=n?s2/n:0;}
      return o;})()};

  /* ---- valuation ---- */
  const noiY1=ann.noi[0], noiFwd=(S.resaleNoi==="trailing")?ann.noi[nY-1]:ann.noi[nY], cap=num(S.goingInCap)||0;
  const price=(S.priceMode==="cap")?(cap>0?noiY1/cap:0):num(S.price);
  const exitCap=num(S.exitCap)||0;
  const grossRev=exitCap>0?noiFwd/exitCap:0, RSN=resaleNet(S,grossRev), netRev=RSN.net;
  const r=num(S.discount), rm=(S.pvMode==="effective")?Math.pow(1+r,1/12)-1:r/12;
  // "Include Non-Operating Expenses in PV/IRR": when off they still reduce reported
  // cash flow but are added back before the stream is valued
  const pvM=Z(), pvA=new Array(nY+1).fill(0);
  for(let i=0;i<nM;i++) pvM[i]=cfbds[i]+(S.nonOpInPV?0:nonTot[i]);
  for(let y=0;y<=nY;y++) pvA[y]=ann.cfbds[y]+(S.nonOpInPV?0:ann.non[y]);
  const PVr=pvFrom(S,pvM,pvA,netRev,nY,r), pvCF=PVr.pvCF, pvRev=PVr.pvRev, pv=PVr.pv;

  /* ---- debt ---- */
  const basis=price||pv, closing=closingFor(S,basis);
  // debt: any number of loans; the old single-loan fields are one loan
  const D=buildDebt(S,nM,nY,basis,leasing);
  const intM=D.intM,prinM=D.prinM,balM=D.balM,dsM=D.dsM;
  let loan=D.initLoan,balEnd=0,dsTot=new Array(nY+1).fill(0),avgDSCR=null,debtYield=null,feeAmt=D.initFee,equity=null,mult=null;
  if(S.loanOn&&D.loans.length){
    balEnd=D.payoff(nY*12-1);
    dsTot=A(dsM);
    let acc=0,n=0; for(let y=0;y<nY;y++) if(dsTot[y]>0){acc+=ann.noi[y]/dsTot[y];n++;}
    avgDSCR=n?acc/n:null; debtYield=loan>0?noiY1/loan:null;
  }
  const drawY=A(D.drawM), balloonY=A(D.balloonM), fundY=A(D.fundM);
  const cfads=new Array(nY+1).fill(0);
  for(let y=0;y<=nY;y++) cfads[y]=ann.cfbds[y]-(dsTot[y]||0)+drawY[y]-balloonY[y]+fundY[y];

  /* ---- IRR, annualized on the SAME convention the PV uses ---- */
  const irrM=irrMonthlyF, annu=m=>annuF(S,m), irrAnnual=irrAnnualF;   // the levered IRR below uses the same three
  let irrU=irrFrom(S,pvM,pvA,netRev,nY,basis,closing);
  let irrL=null;
  if(S.loanOn&&D.loans.length&&(loan>0||D.fundM.some((v,i)=>i<nY*12&&v)||D.drawM.some((v,i)=>i<nY*12&&v))){
    equity=basis+closing-loan+feeAmt;
    const lf=[-equity]; for(let i=0;i<nY*12;i++) lf.push(cfbds[i]-dsM[i]+D.drawM[i]-D.balloonM[i]+D.fundM[i]);
    lf[lf.length-1]+=netRev-balEnd;
    irrL=annu(irrM(lf));
    const dist=lf.slice(1).reduce((a,v)=>a+v,0);
    mult=equity>0?dist/equity:null;
  }
  return {nY,nM,sf,spaces,ann,cfbds,occRate,dsM,dsTot,cfads,price,pv,pvCF,pvRev,pvM,pvA,
    glOpM:glOp,glNonM:glNon,noiM:noi,spReimb,pvA,pvM,intM,prinM,balM,
    lineM:LINEM,netRev,grossRev,adjRev:RSN.adj,saleA:RSN.A,saleD:RSN.D,noiY1,noiFwd,loan,equity,balEnd,feeAmt,irrU,irrL,mult,avgDSCR,debtYield,
    closing,loans:D.loans,drawM:D.drawM,balloonM:D.balloonM,fundM:D.fundM,payoff:D.payoff,leasingM:leasing,
    goingIn:basis>0?noiY1/basis:null,
    monthly:{sl:slM,slAdj:slAdjM,inc:incM,sdNet,sdInt:sdIntM,gpr,cpiRev,turnover,abate,sched,reimb,park:parkT,stor:storT,misc:miscT,pr:prM,fee:feeM,
      tpgr,genVac,credit,egr,opTot,noi,non:nonTot,ti:tiM,lc:lcM,cap:capTot,leasing,cfbds}};
}

/* Leased fee / leasehold positions, per the CBRE analyst training (slides 85-92).
   Ownership is either fee simple, or split into a leased fee (the dirt) and a leasehold
   (the bricks). The two positions are valued on different rates: the leasehold carries a
   return premium and an exit cap 25-50bp wide of fee simple, while the leased fee is a
   bond-like stream capped at its own rate. The deck's warning that "A + B does not always
   equal C" is the point of the comparison, not a rounding error to be reconciled away. */
function calcPositions(S,R){
  if(!R) return null;
  const P=S.pos||{}, nM=R.nM, nY=R.nY, sf=R.sf||1, A=R.ann;
  const Z=()=>new Array(nM).fill(0);
  // the ground rent already in the cash flow, before any reset or catch-up
  const gr=Z();
  for(let i=0;i<nM;i++) gr[i]=(R.glOpM?R.glOpM[i]:0)+(R.glNonM?R.glNonM[i]:0);
  const baseGR=gr.slice();
  // NOI before ground rent — what both positions are really carved out of
  const noiPre=Z();
  for(let i=0;i<nM;i++) noiPre[i]=(R.noiM?R.noiM[i]:0)+gr[i];

  /* FMV reset: ground rent is re-struck as a percentage of land value, usually with a
     cap, because an uncapped reset is the clause that cost Lever House its leasehold. */
  const resetYrs=[];
  if(P.resetOn&&num(P.resetEvery)>0)
    for(let y=num(P.resetFirst)||10;y<nY;y+=num(P.resetEvery)) resetYrs.push(y);
  /* CPI catch-up: periodically the lesser of the index move over the period and a
     compounded ceiling. */
  const cpiYrs=[];
  if(P.cpiOn&&num(P.cpiEvery)>0)
    for(let y=num(P.cpiEvery);y<nY;y+=num(P.cpiEvery)) cpiYrs.push(y);

  const events=[];
  let cur=null;
  for(let y=0;y<nY;y++){
    const i0=y*12;
    if(cur===null) cur=gr[i0];
    let note=null;
    if(resetYrs.includes(y)){
      const land=num(P.landValue)*Math.pow(1+num(P.landGrowth),y);
      let want=land*num(P.resetRate)/12;
      const prior=cur;
      // caps: a ceiling on the step, and a ceiling as a share of pre-ground-rent NOI
      let capNote=[];
      if(num(P.resetCapStep)>0){
        const lim=prior*(1+num(P.resetCapStep));
        if(want>lim){ want=lim; capNote.push("step capped at "+pc(num(P.resetCapStep),0)); }
      }
      if(num(P.resetCapNOI)>0){
        let n12=0; for(let k=0;k<12;k++) n12+=noiPre[i0+k]||0;
        const lim=n12*num(P.resetCapNOI)/12;
        if(want>lim){ want=lim; capNote.push("capped at "+pc(num(P.resetCapNOI),0)+" of pre-rent NOI"); }
      }
      cur=want;
      note="FMV reset to "+pc(num(P.resetRate),2)+" of land"+(capNote.length?" ("+capNote.join("; ")+")":"");
    }
    if(cpiYrs.includes(y)){
      const per=num(P.cpiEvery);
      const idx=seriesFactor(S,P.cpiSeries||"cpi",y*12)/Math.max(seriesFactor(S,P.cpiSeries||"cpi",(y-per)*12),1e-9)-1;
      const cap=Math.pow(1+num(P.cpiCap),per)-1;
      const up=Math.min(idx,cap);
      cur=cur*(1+up);
      note=(note?note+"; ":"")+"CPI catch-up "+pc(up,2)+" (lesser of index and "+pc(num(P.cpiCap),2)+" compounded)";
    }
    if(P.resetOn||P.cpiOn) for(let k=0;k<12;k++) if(i0+k<nM) gr[i0+k]=cur;
    else cur=gr[Math.min(i0+11,nM-1)];
    if(note) events.push({yr:S.startYear+y,note,rent:cur*12});
  }

  /* Participation: the leased fee owner takes a share of NOI once the leasehold has
     cleared a yield on all dollars invested. */
  const part=Z();
  if(P.partOn&&num(P.partShare)>0){
    const hurdleM=num(P.partBasis)*num(P.partYield)/12;
    for(let i=0;i<nM;i++){
      const lhNOI=noiPre[i]-gr[i];
      const over=lhNOI-hurdleM;
      if(over>0) part[i]=over*num(P.partShare);
    }
  }
  const grTot=Z(); for(let i=0;i<nM;i++) grTot[i]=gr[i]+part[i];

  /* ---- the three values ---- */
  const annOf=a=>{const o=new Array(nY).fill(0);
    for(let y=0;y<nY;y++) for(let k=0;k<12;k++){const i=y*12+k; if(i<nM) o[y]+=a[i];} return o;};
  const aGR=annOf(grTot), aNoiPre=annOf(noiPre);
  const aLH=new Array(nY).fill(0);
  for(let y=0;y<nY;y++) aLH[y]=(A.cfbds[y]||0)+annOf(baseGR)[y]-aGR[y];

  const rFS=num(S.discount), capFS=num(S.exitCap);
  const rLH=rFS+num(P.lhRatePrem||0), capLH=capFS+num(P.lhCapPrem||0);
  const capLF=num(P.lfCap)||0.03;
  const pvAt=(arr,rate)=>{let v=0;for(let y=0;y<nY;y++) v+=arr[y]/Math.pow(1+rate,y+1);return v;};
  // reversion on the forward NOI in the exit year
  const noiFwdPre=aNoiPre[nY-1]*(1+num(S.exitGrowth||0.02));
  const noiFwdLH=(aNoiPre[nY-1]-aGR[nY-1])*(1+num(S.exitGrowth||0.02));
  const revFS=capFS>0?noiFwdPre/capFS*(1-num(S.costSale)):0;
  const revLH=capLH>0?noiFwdLH/capLH*(1-num(S.costSale)):0;

  const feeSimple=pvAt(aNoiPre.map((v,y)=>v-(A.leasing[y]||0)-(A.cap?A.cap[y]:0)||v),rFS)
                  +revFS/Math.pow(1+rFS,nY);
  const leasehold=pvAt(aLH,rLH)+revLH/Math.pow(1+rLH,nY);
  // the leased fee is the ground rent stream: capped, or run to an NPV when the
  // leasehold holds a purchase option at a set price
  let leasedFee, lfBasis;
  if(P.optOn&&num(P.optYear)>0){
    const oy=Math.min(num(P.optYear),nY);
    let v=0; for(let y=0;y<oy;y++) v+=aGR[y]/Math.pow(1+capLF,y+1);
    v+=num(P.optPrice)/Math.pow(1+capLF,oy);
    leasedFee=v; lfBasis="NPV to a purchase option in year "+oy;
  } else {
    leasedFee=capLF>0?aGR[0]/capLF:0; lfBasis="ground rent capped at "+pc(capLF,2);
  }
  const rows=[];
  for(let y=0;y<nY;y++) rows.push({yr:S.startYear+y,noiPre:aNoiPre[y],gr:aGR[y],
    lh:aLH[y],ratio:aNoiPre[y]?aGR[y]/aNoiPre[y]:0});
  return {rows,events,feeSimple,leasehold,leasedFee,lfBasis,
    sum:leasedFee+leasehold, gap:(leasedFee+leasehold)-feeSimple,
    grNoi:rows[0]?rows[0].ratio:0, maxRatio:rows.reduce((a,r)=>Math.max(a,r.ratio),0),
    lfFs:feeSimple?leasedFee/feeSimple:0,
    rFS,rLH,capFS,capLH,capLF,sf,part:annOf(part)};
}

/* Macro-scrub metrics, per the CBRE analyst training: what rent PSF the cash flow is
   producing once it stabilises, the same for recoveries, opex PSF, and what share of
   EGI the real estate taxes settle at. Stabilised is the first year at or above 95%
   occupancy that is not the last. */
function scrubMetrics(S,R){
  if(!R) return null;
  const sf=R.sf||1, A=R.ann, nY=R.nY;
  const retIdx=(S.ops||[]).map((o,i)=>/tax/i.test(o.name||"")?i:-1).filter(i=>i>=0);
  const ret=y=>retIdx.reduce((a,i)=>a+((A.ops[i]&&A.ops[i].v[y])||0),0);
  let stab=null;
  for(let y=0;y<nY-1;y++) if(A.occ[y]>=0.95){ stab=y; break; }
  const rows=[];
  for(let y=0;y<nY;y++) rows.push({yr:S.startYear+y,occ:A.occ[y],
    rentPSF:A.sched[y]/sf, recovPSF:A.reimb[y]/sf, opexPSF:A.op[y]/sf,
    retPSF:ret(y)/sf, retPctEGI:A.egr[y]?ret(y)/A.egr[y]:0,
    opexPctEGI:A.egr[y]?A.op[y]/A.egr[y]:0, noiPSF:A.noi[y]/sf});
  let retJump=0;
  for(let y=1;y<nY;y++) retJump=Math.max(retJump,rows[y].retPSF-rows[y-1].retPSF);
  return {rows,stab,retJump,retTot:rows[nY-1].retPSF-rows[0].retPSF,
          hasRET:retIdx.length>0,sf};
}

/* ---------- model validation ----------
   Checks derived from four real external underwriting models. The Belmont draft is the reason this
   exists: zero building area, zero inflation, no expenses, a market leasing profile
   re-letting at $0.00/SF, NOI going to zero mid-hold and a reversion of $0 — a model
   that produces a number the pipeline would happily carry into a BOV. Severity is
   about whether the output can be trusted, not about tidiness. */
function validateModel(S,R,onIssue){
  // Optional UI metadata: the original findings and all financial calculations stay unchanged.
  const F=[],add=(sev,area,msg,detail,target)=>{const issue={sev,area,msg,detail:detail||""};F.push(issue);if(onIssue)onIssue(issue,target||null);};
  const E=(a,m,d,t)=>add("error",a,m,d,t),W=(a,m,d,t)=>add("warn",a,m,d,t),I=(a,m,d,t)=>add("info",a,m,d,t);
  const T=(collection,record,field)=>({collection,record:record?.id||null,field});
  if(!R){ E("Engine","The model does not calculate","Fix the inputs before reading any output."); return F; }
  const sf=R.sf, nY=R.nY, A=R.ann,spacesByTenant=new Map(),spacesByName=new Map();
  for(const space of R.spaces){if(!spacesByTenant.has(space.tid))spacesByTenant.set(space.tid,space);if(!spacesByName.has(space.srcName))spacesByName.set(space.srcName,space);}
  if(num(S.years)>40)E("Analysis","Analysis length exceeds the supported 40-year projection", "The model retains "+S.years+" entered years, but cash flows and valuation use 40 years. Set a supported hold before relying on results.",T("property",S,"years"));
  const valuationDate=pD(S.valDate);
  if(S.valDays&&valuationDate&&(valuationDate.y!==num(S.startYear)||valuationDate.m!==(num(S.startMonth)||1)))
    E("Valuation","Valuation date is outside the analysis start month","The day adjustment applies within the first analysis month; it does not move the cash flows to another month. Choose a date in "+mKey(num(S.startYear),num(S.startMonth)||1)+" or review the analysis start.",T("property",S,"valDate"));
  const rollSF=(S.tenants||[]).reduce((a,t)=>a+num(t.sf),0);

  /* --- area --- */
  const basis=(S.areas||[]).find(a=>a.basis)||(S.areas||[])[0];
  if(!basis||num(basis.sf)<=0)
    E("Area","Rentable area is zero","Every per-SF figure, pro-rata recovery share and gross-up is meaningless until this is set.", T("areas",basis,"sf"));
  else if(rollSF>0&&Math.abs(rollSF-sf)/sf>0.02){
    const reab=(S.tenants||[]).filter(t=>(t.expiry==="Reabsorb")).reduce((a,t)=>a+num(t.sf),0);
    const resid=rollSF-reab-sf;
    if(reab>0&&Math.abs(resid)/sf<=0.02)
      I("Area","Rent roll is "+f0.format(rollSF)+" SF, "+f0.format(reab)+" SF of it reabsorbed",
        "Expected: a reabsorbed lease and the lease that takes its space both sit on the roll, so the total exceeds rentable area by design.", T("areas",basis,"sf"));
    else
      W("Area","Rent roll is "+f0.format(rollSF)+" SF against "+f0.format(sf)+" SF rentable",
        "A gap of "+f0.format(resid)+" SF after allowing for "+f0.format(reab)+
        " SF of reabsorbed leases. Recovery shares use the rentable basis, so this moves reimbursements.", T("areas",basis,"sf"));
  }
  if((S.areas||[]).filter(a=>num(a.sf)>0).length===0&&(S.areas||[]).length>1)
    W("Area","No area measure carries a value","", T("areas",basis,"sf"));

  /* --- inflation --- */
  const live=(S.infl||[]).filter(x=>x.id!=="none");
  const anyInfl=live.some(x=>(x.rates||[]).some(r=>num(r)!==0));
  if(live.length&&!anyInfl)
    E("Inflation","Every inflation series is zero","Rents, expenses and market rates are flat for the whole hold. If that is deliberate, say so in the BOV; if not, the value is understated.");
  else {
    for(const x of live) if(!(x.rates||[]).some(r=>num(r)!==0))
      I("Inflation","Series \u201c"+x.name+"\u201d is zero throughout","", T("infl",x,"rates"));
  }

  /* --- expenses --- */
  if(!(S.ops||[]).length)
    E("Expenses","No operating expenses entered","NOI equals effective gross revenue, so the cap rate and every yield are overstated.");
  else {
    if(!(S.ops||[]).some(o=>num(o.amt)>0))
      E("Expenses","All operating expense lines are zero","");
    if(!(S.ops||[]).some(o=>recovOf(o)>0))
      W("Expenses","No expense line is marked recoverable","Reimbursement revenue will be zero for every NNN tenant.");
    if(!(S.caps||[]).length) I("Expenses","No capital reserve or capex","");
  }

  /* --- market leasing --- */
  const used=new Set((S.tenants||[]).map(t=>t.mla));
  for(const m of (S.mlas||[])){
    if(!used.has(m.id)) continue;
    const M=resolveMLA(m,S);
    if(M.mktNew<=0)
      E("Market leasing","Profile \u201c"+m.name+"\u201d re-lets at $0.00/SF",
        "Every space on this profile earns nothing after its lease expires.", T("mlas",m,"mrNewLocal"));
    if(M.renewProb>=1&&M.downtime===0)
      W("Market leasing","Profile \u201c"+m.name+"\u201d has 100% renewal and no downtime","No rollover friction is modelled.", T("mlas",m,"renewProb"));
    if(M.tiNew===0&&M.tiRenew===0&&M.lcNew===0&&M.lcRenew===0)
      W("Market leasing","Profile \u201c"+m.name+"\u201d carries no TI or leasing commissions","Rollover is free, which overstates cash flow.", T("mlas",m,"tiRef"));
    if(M.termYears*12+num(m.termMonths)<=0)
      E("Market leasing","Profile \u201c"+m.name+"\u201d has a zero term","", T("mlas",m,"termYears"));
  }
  if(!(S.mlas||[]).length) E("Market leasing","No market leasing profile","");

  /* --- rent roll --- */
  for(const t of (S.tenants||[])){
    const nm=(t.name||"(unnamed)")+(t.suite?" ("+t.suite+")":"");
    if(num(t.sf)<=0) W("Rent roll",nm+" has zero area","", T("tenants",t,"sf"));
    const a=sSer(t.start), b=eSer(leaseEnd(t));
    if(a&&b&&b<a) E("Rent roll",nm+" ends before it starts","", T("tenants",t,"end"));
    if(t.start&&t.rentBasis&&t.rentBasis!=="mkt"&&!RENT_ALIAS[t.rentBasis]&&!RENT_BASES.some(x=>x.v===t.rentBasis)) E("Rent roll",nm+": rent unit \""+t.rentBasis+"\" isn't recognized, so the lease earns no base rent","", T("tenants",t,"rentBasis"));
    if(t.start&&leaseEnd(t)){
      const sp=spacesByTenant.get(t.id)||spacesByName.get(t.name||"");
      if(sp){
        let r12=0; for(let k=0;k<Math.min(12,R.nM);k++) r12+=sp.rent[k]||0;
        let rAll=0; for(let k=0;k<R.nM;k++) rAll+=sp.rent[k]||0;
        if(rAll<=0) W("Rent roll",nm+" earns no rent across the whole hold",
          num(t.sf)>0?f0.format(num(t.sf))+" SF ("+(100*num(t.sf)/Math.max(rollSF,1)).toFixed(0)+"% of the roll)":"", T("tenants",t,"rent"));
        else if(r12<=0) I("Rent roll",nm+" earns no rent in year 1","", T("tenants",t,"rent"));
      }
    }
    const rec=byId(S.recs,t.rec);
    if(rec&&rec.method==="STOP"){
      const pool=(S.ops||[]).filter(o=>recovOf(o)>0&&(!rec.pool||o.group===rec.pool||(o.groups||[]).includes(rec.pool)));
      if(!pool.length||!pool.some(o=>num(o.amt)>0))
        W("Recoveries",nm+" is on a base year stop with nothing in the pool",
          "The stop has no expenses to measure against, so it recovers zero.", T("tenants",t,"rec"));
    }
    if(rec&&rec.method==="NNN"){
      const pool=(S.ops||[]).filter(o=>recovOf(o)>0&&(!rec.pool||o.group===rec.pool||(o.groups||[]).includes(rec.pool)));
      if(!pool.length) W("Recoveries",nm+" is NNN pro-rata with an empty pool","", T("tenants",t,"rec"));
    }
  }
  if(!(S.tenants||[]).length) E("Rent roll","No tenants or vacant space entered","");

  /* --- micro scrub, from the CBRE analyst training --- */
  const reab=(S.tenants||[]).filter(t=>t.expiry==="Reabsorb");
  if(reab.length){
    const net=rollSF-reab.reduce((a,t)=>a+num(t.sf),0)-sf;
    if(Math.abs(net)>Math.max(sf*0.005,1))
      W("Area","Reabsorbed area does not net to zero",
        f0.format(net)+" SF out. The suites being combined or distributed should sum to the area of the suites they replace.");
  }
  for(const t of (S.tenants||[])){
    const nm=(t.name||"(unnamed)")+(t.suite?" ("+t.suite+")":"");
    if(!byId(S.mlas,t.mla))
      E("Rent roll",nm+" has no market leasing profile","Nothing governs what happens when the lease rolls.", T("tenants",t,"mla"));
    if(t.expiry==="Renew")
      I("Rent roll",nm+" is set to contract renewal",
        "A contract option runs at 100% renewal probability, so use it only where renewal is close to certain.", T("tenants",t,"expiry"));
  }
  // only spec leases entered with dates: undated vacant space rolls on its MLA and
  // picks up the new-deal TI and LC through the rollover automatically
  const specNoCost=(S.tenants||[]).filter(t=>(t.status==="Speculative"||/^spec/i.test(t.name||""))
    &&t.start&&leaseEnd(t)&&(!t.tiBasis||t.tiBasis==="none")&&(!t.lcBasis||t.lcBasis==="none"));
  if(specNoCost.length)
    W("Rent roll",specNoCost.length+" speculative lease"+(specNoCost.length>1?"s carry":" carries")+
      " no TI or leasing commission",
      specNoCost.map(t=>t.name).join(", ")+". Spec space normally picks up the profile's new-deal TI and LC.", T("tenants",specNoCost[0],"tiBasis"));
  for(const o of (S.ops||[]))
    if(/tenant\s*elec/i.test(o.name||"")&&num(o.fixedPct)>0&&!isPctBasis(o.basis))
      W("Expenses","Tenant electric is "+pc(num(o.fixedPct),0)+" fixed",
        "It moves entirely with occupancy, so it is normally fixed at 0%. Recovered net, it should wash to roughly zero.", T("ops",o,"fixedPct"));
  const sc=scrubMetrics(S,R);
  if(sc&&sc.hasRET){
    if(sc.retJump>2.5)
      W("Expenses","Real estate taxes jump "+money(sc.retJump)+"/SF in a single year",
        "The training benchmark is roughly $1/SF a year. Check for a reassessment or a stale growth rate.");
    if(sc.retTot>10)
      W("Expenses","Real estate taxes rise "+money(sc.retTot)+"/SF across the hold",
        "More than $10/SF by the end of the term is worth defending explicitly.");
  }
  if(sc&&sc.stab===null&&nY>2)
    I("Occupancy","The model never reaches 95% occupancy","Nothing stabilises, so a stabilised per-SF read is not meaningful.");

  /* --- lease structures --- */
  for(const t of (S.tenants||[])){
    const nm=(t.name||"(unnamed)")+(t.suite?" ("+t.suite+")":"");
    if((t.expiry==="Option"||t.expiry==="ContractRenewal"))
      I("Rent roll",nm+" renews on an option at 100% probability",
        "Appropriate for a below-market right the tenant will almost certainly exercise; otherwise the blended MLA is the safer assumption.", T("tenants",t,"expiry"));
    if(t.expiry==="MTM"&&!t.mtmEnd)
      I("Rent roll",nm+" is month to month through the whole analysis","It never rolls to market, so its rent never resets.", T("tenants",t,"mtmEnd"));
    if(t.breakOn){
      const bE=t.breakDate?eSer(t.breakDate):null, tE=eSer(leaseEnd(t));
      if(bE===null) W("Rent roll",nm+" has a termination option with no effective date","It is being ignored.", T("tenants",t,"breakDate"));
      else if(tE!==null&&bE>=tE) W("Rent roll",nm+"'s termination date is on or after expiry","It has no effect.", T("tenants",t,"breakDate"));
      if(!num(t.breakProb)) I("Rent roll",nm+" has a termination option at 0% probability","It is recorded but does not change the cash flow.", T("tenants",t,"breakProb"));
    }
    if(t.prOn&&!num(t.prRate)) W("Rent roll",nm+" has percentage rent switched on with no rate","", T("tenants",t,"prRate"));
    if(t.termMode==="term"&&!(num(t.termYears)||num(t.termMonths)))
      E("Rent roll",nm+" is set to a term length of zero","The lease has no expiry.", T("tenants",t,"termYears"));
  }

  /* --- leased fee / leasehold --- */
  if((S.groundLeases||[]).length){
    const X=calcPositions(S,R);
    if(X){
      if(X.maxRatio>0.40)
        W("Ground lease","Ground rent peaks at "+pc(X.maxRatio,1)+" of NOI",
          "Most leasehold investors will not consider an asset above 40% in a good market, and less in a bad one.");
      else if(X.grNoi>0.25)
        I("Ground lease","Ground rent is "+pc(X.grNoi,1)+" of NOI",
          "Above the sub-25% the training quotes as supporting a tight leased fee cap.");
      if(X.lfFs>0.40)
        I("Ground lease","Leased fee is "+pc(X.lfFs,1)+" of fee simple value","Benchmark is under 40%.");
      const P=S.pos||{};
      if(P.resetOn&&!num(P.resetCapStep)&&!num(P.resetCapNOI))
        W("Ground lease","The FMV reset is uncapped",
          "An unprotected reset is the clause that cost Lever House its leasehold. Model the cap, or show the exposure deliberately.", T("position",S.pos,"resetCapStep"));
      if(P.resetOn&&num(P.resetEvery)>0){
        const nxt=X.events.find(e=>e.yr>S.startYear+nY-1);
        const last=X.events.length?X.events[X.events.length-1].yr:null;
        if(last!==null&&last<S.startYear+nY-2)
          I("Ground lease","The exit year does not sit just after a reset",
            "The training asks that the exit capture the next reset or significant bump; the last modelled event is "+last+".");
      }
      if(num((S.pos||{}).lhCapPrem)<=0)
        I("Ground lease","The leasehold exit cap carries no premium",
          "The training expects 25 to 50 basis points wide of fee simple for the added risk.", T("position",S.pos,"lhCapPrem"));
    }
  }

  /* --- output sanity --- */
  const zero=[]; for(let y=0;y<nY;y++) if(Math.abs(A.noi[y])<1) zero.push(S.startYear+y);
  if(zero.length)
    E("Cash flow","NOI is zero in "+zero.length+" of "+nY+" years",
      "Years "+zero.slice(0,6).join(", ")+(zero.length>6?"…":"")+". Usually a market rent of zero or space that never re-lets.");
  else if(A.noi[nY-1]<A.noi[0]*0.6)
    W("Cash flow","NOI falls "+(100*(1-A.noi[nY-1]/A.noi[0])).toFixed(0)+"% from year 1 to year "+nY,"");
  if(Math.abs(R.netRev)<1)
    E("Valuation","Reversion is zero","The exit cap is applied to a forward NOI of zero, so the DCF carries no terminal value at all.");
  const dc=num(S.goingInCap)>0?A.noi[0]/num(S.goingInCap):0;
  if(dc>0&&R.pv>0){
    const gap=(R.pv-dc)/dc;
    // a wide spread between the direct cap rate and the discount rate makes some
    // divergence expected; only an implausible gap is worth stopping for
    if(Math.abs(gap)>0.60)
      E("Valuation","DCF value is "+(gap<0?"":"+")+(100*gap).toFixed(0)+"% against direct cap",
        "DCF "+money(R.pv)+" vs "+money(dc)+" at a "+pc(num(S.goingInCap),2)+
        " cap. A gap this wide is the cash flow, not the cap rate.");
  }
  if(R.goingIn!==null&&R.goingIn>0.20)
    E("Valuation","Implied going-in cap is "+pc(R.goingIn,2),"Year 1 NOI against the valuation basis. Check the basis and the cash flow.");
  else if(R.goingIn!==null&&(R.goingIn<0.02||R.goingIn>0.14))
    W("Valuation","Implied going-in cap is "+pc(R.goingIn,2),"Outside the range you would normally defend.");
  for(let y=0;y<nY;y++) if(A.occ[y]<0.001){
    W("Occupancy","Occupancy is zero in "+(S.startYear+y),"The building is entirely dark that year."); break; }
  if(R.pv<=0) E("Valuation","Present value is zero or negative","");
  if(num(S.discount)<=0) W("Valuation","Discount rate is zero","", T("property",S,"discount"));
  if(num(S.exitCap)<=0) W("Valuation","Exit cap is zero","No reversion can be struck.", T("property",S,"exitCap"));
  return F;
}

/* ---------- portfolio roll-up ----------
   Actual operating cash is aligned by month; report years start at the earliest
   member's analysis month. Valuation retains annual member-year-end payments,
   discounted at their exact month offsets. See docs/PORTFOLIO_MATH.md. */
function calcPortfolio(S){
  const members=(S.portfolio||[]).filter(m=>m&&m.include!==false);
  if(!members.length) return null;
  const r=Number(S.portDisc??0), single=!!S.portSingleExit, cap=Number(S.portCap??0);
  if(!Number.isFinite(r)||r<=-1) throw Error("Portfolio discount rate must be finite and greater than -100%.");
  if(single&&(!Number.isFinite(cap)||cap<=0)) throw Error("A single portfolio exit requires a positive exit cap rate.");
  const issues=[], runs=[];
  const fail=()=>{ const e=Error("Portfolio could not be valued:\n"+issues.join("\n")); e.issues=issues; throw e; };
  for(const member of members){
    const model=member.model, name=member.name||(model&&model.name)||"(unnamed)";
    if(!model||typeof model!=="object"||Array.isArray(model)){ issues.push(name+": missing or invalid property model."); continue; }
    const y=Number(model.startYear), m=Number(model.startMonth);
    if(!Number.isInteger(y)||y<1||y>9999||!Number.isInteger(m)||m<1||m>12){ issues.push(name+": invalid analysis start year or month."); continue; }
    try{ const run=calc(model);
      if(!run||!Number.isInteger(run.nY)||!run.monthly||!run.pvM||!Number.isFinite(run.pv)) throw Error("invalid financial result");
      runs.push({model,name,start:y*12+m-1,run,ownHold:run.nY*12});
    }catch(e){ issues.push(name+": failed to calculate ("+(e.message||String(e))+")."); }
  }
  if(issues.length) fail();
  const y0=Math.min(...runs.map(x=>x.start));
  const nM=Math.max(...runs.map(x=>x.start-y0+x.ownHold)), nY=Math.ceil(nM/12);
  const monthDate=k=>mKey(Math.floor(k/12),k%12+1), startDate=monthDate(y0), endDate=monthDate(y0+nM-1);
  const periods=Array.from({length:nY},(_,y)=>({start:monthDate(y0+12*y),end:monthDate(y0+Math.min(12*y+11,nM-1)),months:Math.min(12,nM-12*y)}));
  const sources={gpr:"gpr",turnover:"turnover",abate:"abate",sched:"sched",cpi:"cpiRev",reimb:"reimb",park:"park",stor:"stor",misc:"misc",
    tpgr:"tpgr",genVac:"genVac",credit:"credit",fee:"fee",pr:"pr",egr:"egr",op:"opTot",noi:"noi",non:"non",ti:"ti",lc:"lc",cap:"cap",
    leasing:"leasing",inc:"inc",sdNet:"sdNet",sdInt:"sdInt",sl:"sl",slAdj:"slAdj",cfbds:"cfbds"};
  const monthly={}; for(const key of [...Object.keys(sources),"valuation"]) monthly[key]=new Array(nM).fill(0);
  const cashFlowPaymentsM=new Array(nM).fill(0), revM=new Array(nM).fill(0), rows=[], comparisonReasons=new Set();
  let sf=0, fwd=0, singleGrossRev=0, singleRev=0;
  const resaleNoi=S.portResaleNoi==="trailing"?"trailing":"forward";
  for(const x of runs){
    const {model,name,run}=x, offMonths=x.start-y0, holdMonths=single?nM-offMonths:x.ownHold;
    let projected=run;
    if(single&&holdMonths>x.ownHold){
      if(holdMonths>480){ issues.push(name+": common sale requires more than the supported 40-year property projection."); continue; }
      try{ const copy=JSON.parse(JSON.stringify(model)); copy.years=Math.ceil(holdMonths/12); projected=calc(copy); }
      catch(e){ issues.push(name+": failed to calculate the common-exit projection ("+(e.message||String(e))+")."); continue; }
    }
    const total=(arr,a,b)=>{ let v=0; for(let i=a;i<b;i++){ const q=arr&&arr[i]; if(!Number.isFinite(q)) throw Error(name+": non-finite or missing monthly cash flow."); v+=q; } return v; };
    for(const [key,source] of Object.entries(sources)) for(let i=0;i<holdMonths;i++){
      const q=projected.monthly[source]&&projected.monthly[source][i];
      if(!Number.isFinite(q)) throw Error(name+": non-finite or missing "+key+" cash flow.");
      monthly[key][offMonths+i]+=q;
    }
    for(let i=0;i<holdMonths;i++){
      const q=projected.pvM[i]; if(!Number.isFinite(q)) throw Error(name+": non-finite valuation cash flow.");
      monthly.valuation[offMonths+i]+=q;
    }
    // Keep the established member-year-end annual convention. A final partial
    // member year, possible at a joint sale, is paid at that actual sale month.
    for(let a=0;a<holdMonths;a+=12){ const b=Math.min(a+12,holdMonths);
      cashFlowPaymentsM[offMonths+b-1]+=(b-a===12)?projected.pvA[a/12]:total(projected.pvM,a,b);
    }
    const forward=total(projected.noiM,holdMonths,holdMonths+12), trailing=total(projected.noiM,holdMonths-12,holdMonths);
    if(single||offMonths+holdMonths===nM) fwd+=forward;
    const terminalNoi=resaleNoi==="trailing"?trailing:forward;
    const gross=single?terminalNoi/cap:run.grossRev, net=single?resaleNet(model,gross).net:run.netRev;
    if(!Number.isFinite(gross)||!Number.isFinite(net)) throw Error(name+": non-finite sale proceeds.");
    revM[offMonths+holdMonths-1]+=net;
    if(single){ singleGrossRev+=gross; singleRev+=net; }
    sf+=run.sf;
    rows.push({name,sf:run.sf,off:offMonths/12,offMonths,nY:holdMonths/12,holdMonths,originalHoldMonths:x.ownHold,
      startDate:monthDate(x.start),exitDate:monthDate(x.start+holdMonths-1),ownExitDate:monthDate(x.start+x.ownHold-1),
      noi1:run.ann.noi[0],pv:run.pv,psf:run.sf?run.pv/run.sf:0,cap:run.goingIn,irr:run.irrU,
      exitYear:Math.floor((x.start+holdMonths-1)/12),netRev:net,standaloneNetRev:run.netRev,terminalNoi:single?terminalNoi:run.noiFwd});
    if(model.pvMode!=="annual") comparisonReasons.add("Standalone properties use a monthly PV convention.");
    if(num(model.discount)!==r) comparisonReasons.add("Standalone discount rates differ from the portfolio rate.");
    if(model.valDays) comparisonReasons.add("Standalone properties apply day-based valuation adjustments.");
  }
  if(issues.length) fail();
  if(single) comparisonReasons.add("The common sale changes member hold dates, terminal cap or terminal NOI policy.");
  const annual=arr=>{ const a=new Array(nY+1).fill(0); for(let i=0;i<nM;i++) a[Math.floor(i/12)]+=arr[i]; return a; };
  const agg={}; for(const [key,arr] of Object.entries(monthly)) agg[key]=annual(arr);
  const rev=annual(revM), trailingNoi=monthly.noi.slice(Math.max(0,nM-12)).reduce((a,v)=>a+v,0), terminalNoi=single?(resaleNoi==="trailing"?trailingNoi:fwd):null;
  let pvCF=0, pvRev=0;
  for(let i=0;i<nM;i++){ const d=Math.pow(1+r,(i+1)/12);
    pvCF+=cashFlowPaymentsM[i]/d; pvRev+=revM[i]/d;
  }
  if(!Number.isFinite(pvCF)||!Number.isFinite(pvRev)) throw Error("Portfolio discount rate and dates produce a non-finite present value.");
  const flows=[-(pvCF+pvRev),...cashFlowPaymentsM.map((v,i)=>v+revM[i])], irrM=irrMonthlyF(flows), irr=irrM===null?null:Math.pow(1+irrM,12)-1;
  return {nY,nM,sf,ann:agg,monthly,cashFlowPaymentsM,revM,rev,rows,periods,pvCF,pvRev,pv:pvCF+pvRev,
    singleRev,singleGrossRev,fwd,trailingNoi,terminalNoi,resaleNoi,single,startYear:Math.floor(y0/12),startMonth:y0%12+1,startDate,endDate,irr,
    valuationTiming:"annual-member-year-end",comparisonComparable:comparisonReasons.size===0,comparisonReasons:[...comparisonReasons],
    sumPV:rows.reduce((a,x)=>a+(x.pv||0),0),
    sumPVatPortDate:rows.reduce((a,x)=>a+x.pv/Math.pow(1+r,x.offMonths/12),0)};
}

/* =========================== INVESTMENT: PURCHASE, DEBT, RESALE ===========================
   Investment assumptions in three parts. Property Purchase: the price plus closing costs,
   which enter the IRR basis. Debt Financing: any number of loans, each sized by LTV or
   amount, funding at acquisition or later, fixed or floating (an index curve plus spread,
   with a floor and cap), interest only then amortizing, with a term and a balloon at
   maturity, origination and exit fees, and future funding drawn against leasing and capital
   costs. A model with the old single-loan fields is one loan computed exactly as before. */
/* Space absorption: a vacant block leased up as a run of
   speculative leases, each on the market profile's new-lease terms, commencing at an interval.
   They are generated here and then run through exactly the machinery of a speculative lease
   typed into the rent roll, so the two ways of underwriting vacant space agree. */
function absorbLeases(S){
  const out=[];
  for(const b of (S.absorb||[])){ if(b.on===false) continue;
    const p=/^(\d{4})-(\d{2})/.exec(String(b.start||"")), tot=num(b.sf); if(!p||tot<=0) continue;
    const m=byId(S.mlas,b.mla), M=m?resolveMLA(m,S):null;
    const termM=M?Math.max(Math.round(M.termYears*12)+Math.round(num(m.termMonths)),1):60;
    const per=num(b.sfPer), bySF=b.sizeBy==="sf"&&per>0;
    const n=bySF?Math.max(1,Math.ceil(tot/per-1e-9)):Math.max(1,Math.round(num(b.leases)||1));
    const every=Math.max(0,Math.round(num(b.every)||0));
    const av=/^(\d{4})-(\d{2})/.exec(String(b.avail||""));
    const from=av?Math.max(0,(+av[1]-num(S.startYear))*12+(+av[2]-(num(S.startMonth)||1))):0;
    for(let k=0;k<n;k++){
      const t0=(+p[1])*12+(+p[2]-1)+k*every, t1=t0+termM-1;
      const sfk=bySF?(k<n-1?per:tot-per*(n-1)):tot/n;
      out.push({id:b.id+"#"+(k+1),name:(b.name||"Absorption")+" "+(k+1),suite:b.suite||"",sf:sfk,
        start:mKey(Math.floor(t0/12),t0%12+1),end:mKey(Math.floor(t1/12),t1%12+1),status:"Speculative",
        rentBasis:b.rentBasis==="amt"?"":"mkt",rent:num(b.rent),rentPct:b.rentPct===undefined||b.rentPct===""?1:num(b.rentPct),
        mla:b.mla,expiry:b.expiry||"Market",rec:M?M.rec:"",freeBasis:"market",tiBasis:"market",lcBasis:"market",
        ltype:b.ltype||"",absorbFrom:from,absorbBlock:b.id,tiTiming:m?m.tiTiming:"",lcTiming:m?m.lcTiming:""}); }
    // space reabsorbed from expiring leases joins the lease-up once free, on the block's cadence
    const g0=(+p[1])*12+(+p[2]-1), a0=num(S.startYear)*12+(num(S.startMonth)||1)-1, size=bySF?per:tot/n;
    let next=g0+n*every, r=0;
    const evs=(S.tenants||[]).filter(t=>t.expiry==="Reabsorb"&&t.reabsorbTo===b.id).map(t=>{ const e=eSer(leaseEnd(t)); if(e===null) return null;
      const ch=(t.areaSched||[]).filter(x=>x&&x.date).sort((x,y)=>String(x.date)<String(y.date)?-1:1).pop();
      return {k:Math.floor(e/10000)*12+Math.floor(e/100)%100, sf:ch?num(ch.sf):num(t.sf), t}; }).filter(x=>x&&x.sf>0).sort((x,y)=>x.k-y.k);
    for(const ev of evs){ let left=ev.sf;
      while(left>1e-9){ let d=Math.max(ev.k,next); if(every>0) d=g0+Math.ceil((d-g0)/every)*every;
        const sfk=Math.min(size>0?size:left,left), e1=d+termM-1; left-=sfk; r++;
        out.push({id:b.id+"#r"+r,name:(b.name||"Absorption")+" (reabsorbed "+(ev.t.name||"lease")+")",suite:ev.t.suite||"",sf:sfk,
          start:mKey(Math.floor(d/12),d%12+1),end:mKey(Math.floor(e1/12),e1%12+1),status:"Speculative",
          rentBasis:b.rentBasis==="amt"?"":"mkt",rent:num(b.rent),rentPct:b.rentPct===undefined||b.rentPct===""?1:num(b.rentPct),
          mla:b.mla,expiry:b.expiry||"Market",rec:M?M.rec:"",freeBasis:"market",tiBasis:"market",lcBasis:"market",
          ltype:b.ltype||"",absorbFrom:Math.max(0,ev.k-a0),absorbBlock:b.id,tiTiming:m?m.tiTiming:"",lcTiming:m?m.lcTiming:""});
        next=d+every; } } }
  return out;
}
/* Percentage rent on the contract term, on top of the rent schedule: a share of sales above a
   breakpoint, by sales category, with an optional second tier, accrued monthly on annualised
   sales or settled by lease year. The natural breakpoint is base rent over the rate, so it
   follows the rent schedule; area-changing leases pass the whole lease's rent and area. */
function prFill(S,t,pr,rent,occ,areaAt,lastK,nM){
  const PRC=prCatsOf(t); if(!PRC.length) return;
  for(let i=0;i<=Math.min(lastK,nM-1);i++) pr[i]=0;
  const salesAt=(c,i)=>(c.basis==="psf"?c.sales*areaAt(i):c.sales)*seriesFactor(S,c.g,i);
  const bpAt=(c,i)=>c.bt==="amt"?c.bp:c.bt==="psf"?c.bp*areaAt(i):(rent[i]*12)/c.rate;
  if(t.prSettle==="leaseyear"){
    const s0=sSer(t.start), ls=s0!==null?serToIdx(s0,S):0;
    for(let y0=ls-Math.ceil(Math.max(ls,0)/12)*12;y0<=lastK;y0+=12){
      const a=Math.max(y0,0), b=Math.min(y0+11,lastK); if(b<a) continue;
      let tot=0, last=-1;
      for(const c of PRC){ let sl=0, bp=0;
        for(let i=a;i<=b;i++){ if(occ[i]<=0) continue; sl+=salesAt(c,i)/12*occ[i]; bp+=bpAt(c,i)/12; last=i; }
        tot+=prOver(c,sl,bp,areaAt(b),(b-a+1)/12); }
      if(last>=0) pr[last]+=tot;
    }
  } else for(let i=0;i<=lastK;i++){
    if(occ[i]<=0) continue;
    let acc=0; for(const c of PRC) acc+=prOver(c,salesAt(c,i),bpAt(c,i),areaAt(i))/12*occ[i];
    pr[i]=acc;
  }
}
/* Percentage rent sales categories. A lease without categories is
   one category built from its own fields, so existing leases compute exactly as before. */
function prCatsOf(t){
  if(!t||!t.prOn) return [];
  if(t.prCats&&t.prCats.length) return t.prCats.filter(c=>num(c.rate)>0).map(c=>({sales:num(c.sales),basis:c.salesBasis||"amt",g:c.growthRef||"gen",
    rate:num(c.rate),bt:c.breakType||"natural",bp:num(c.breakpoint),rate2:num(c.rate2),bp2:num(c.break2),bt2:c.break2Basis||"amt"}));
  return num(t.prRate)>0?[{sales:num(t.prSales),basis:t.prSalesBasis||"amt",g:t.prGrowthRef||"gen",rate:num(t.prRate),bt:t.prBreakType||"natural",
    bp:num(t.prBreak),rate2:num(t.prRate2),bp2:num(t.prBreak2),bt2:t.prBreak2Basis||"amt"}]:[];
}
// overage on annual sales over an annual breakpoint, with an optional second tier above bp2
function prOver(c,sales,bp,tsf,frac){
  if(!(c.rate2>0&&c.bp2>0)) return Math.max(0,sales-bp)*c.rate;
  const b2=Math.max((c.bt2==="psf"?c.bp2*tsf:c.bp2)*(frac===undefined?1:frac),bp);   // a partial lease year prorates both tiers
  return Math.max(0,Math.min(sales,b2)-bp)*c.rate+Math.max(0,sales-b2)*c.rate2;
}
/* Ranges: bands with a rate, applied marginally (each band's rate on
   the slice of value inside it) or whole (the band the value falls in sets one rate). */
function rangeAmt(S,id,v){ const r=byId(S.ranges,id); if(!r) return 0;
  const E=(r.entries||[]).map(e=>({f:num(e.from),t:(e.to===""||e.to===null||e.to===undefined||num(e.to)<=0)?Infinity:num(e.to),r:num(e.rate)})).sort((a,b)=>a.f-b.f);
  if(!E.length) return 0;
  if(r.mode==="whole"){ const e=E.find(e=>v>=e.f&&v<e.t)||E[E.length-1]; return e.r*v; }
  return E.reduce((a,e)=>a+e.r*Math.max(0,Math.min(v,e.t)-e.f),0); }
/* Resale adjustments and deductions: adjustments move
   the gross sale price to an adjusted price, cost of sale applies to that, deductions come off
   after. With none the reversion is exactly gross x (1 - cost of sale). */
function resaleNet(S,gross){
  let adj=gross; const A=[], D=[];
  for(const a of (S.saleAdj||[])){ const v=(a.basis==="pct"?num(a.pct)*gross:num(a.amt))*(a.dir==="add"?1:-1); A.push(v); adj+=v; }
  let net=adj*(1-num(S.costSale));
  for(const d of (S.saleDed||[])){ const v=d.basis==="pct"?num(d.pct)*adj:num(d.amt); D.push(v); net-=v; }
  return {adj,net,A,D};
}
/* Direct capitalization: a year's NOI over a cap rate,
   less (or plus) adjustments, optionally rounded. */
function dcCalc(S,ann,nY){
  const y=Math.min(Math.max(1,Math.round(num(S.dcYear)||1)),nY+1)-1, noi=ann.noi[y]||0;
  const rate=num(S.dcRate)||num(S.goingInCap), gross=rate>0?noi/rate:0;
  const adj=(S.dcAdj||[]).map(a=>{ let v=0;
    if(a.basis==="leasing") for(let k=0;k<y;k++) v+=ann.leasing[k]||0;
    else if(a.basis==="shortfall") for(let k=0;k<y;k++) v+=Math.max(0,noi-(ann.noi[k]||0));
    else v=num(a.amt);
    return {name:a.name||"Adjustment",v:(a.dir==="add"?1:-1)*v}; });
  let value=gross+adj.reduce((t,x)=>t+x.v,0); const rd=num(S.dcRound); if(rd>0) value=Math.round(value/rd)*rd;
  return {year:y+1,noi,rate,gross,adj,value};
}
/* Payment timing. A profile splits a payment around its event month
   (month:% pairs, or an even spread over N months), or, for revenue and expense lines, weights
   calendar months so each analysis year's total is paid in those months. With none, payments
   fall exactly where they did. */
function payPts(S,ref){ const P=ref?byId(S.payTimes,ref):null; if(!P||P.mode==="calendar") return null;
  if(P.mode==="spread"){ const n=Math.max(1,Math.round(num(P.months)||1)); return Array.from({length:n},(_,k)=>({m:k,p:1/n})); }
  const L=String(P.points||"").split(/[;,\n]+/).map(x=>/(-?\d+)\s*[:=]\s*(-?[\d.]+)/.exec(x)).filter(Boolean).map(x=>({m:+x[1],p:+x[2]}));
  const T=L.reduce((a,q)=>a+q.p,0); return T>0?L.map(q=>({m:q.m,p:q.p/T})):null; }
function payInto(S,arr,k,amt,ref){ const P=payPts(S,ref); if(!P){ arr[k]+=amt; return; }
  for(const q of P){ const j=k+q.m; if(j>=0&&j<arr.length) arr[j]+=amt*q.p; } }
/* Payment months written as months: "Feb May Aug Nov", "Apr 60, Oct 40", "Mar"; or twelve
   weights January first. Blank means even monthly. */
const MON3=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
function timingWeights(str){ const x=String(str||"").trim().toLowerCase(); if(!x) return null;
  const toks=x.match(/[a-z]+|\d+(?:\.\d+)?/g)||[], w=new Array(12).fill(0); let named=false;
  for(let k=0;k<toks.length;k++){ if(!/^[a-z]+$/.test(toks[k])) continue; const m=MON3.indexOf(toks[k].slice(0,3)); if(m<0) continue; named=true;
    const nx=toks[k+1]; w[m]+=(nx&&/^\d/.test(nx))?parseFloat(nx):1; }
  if(!named){ const n=toks.filter(t=>/^\d/.test(t)).map(Number); if(n.length!==12) return null; n.forEach((v,k)=>w[k]=v); }
  return w.some(v=>v>0)?w:null; }
/* Rates by year as percents ("3, 5, 2"), and amounts by year ("50000; 0; 75000", last "P" carries on). */
function pctList(str){ return (String(str||"").match(/-?\d+(?:\.\d+)?/g)||[]).map(v=>Number(v)/100); }
function yrList(str){ const x=String(str||"").trim(); if(!x) return null;
  const parts=/[;\n]/.test(x)?x.split(/[;\n]+/).map(p=>p.replace(/,/g,"")):x.split(/[,\s]+/);
  const v=[]; let perp=false; parts.map(p=>p.trim()).filter(p=>p!=="").forEach(p=>{ if(/p$/i.test(p)) perp=true; const n=parseFloat(p); v.push(isFinite(n)?n:0); });
  if(!v.length) return null; v.perp=perp; return v; }
function yrAt(v,y){ return y<v.length?v[y]:(v.perp?v[v.length-1]:0); }
function calWeights(P){ if(/[a-z]/i.test(String(P.weights||""))){ const tw=timingWeights(P.weights); if(tw) return tw; } const w=String(P.weights||"").split(/[;,\s]+/).filter(x=>x!=="").map(Number).slice(0,12).map(v=>isFinite(v)&&v>0?v:0); while(w.length<12) w.push(0); return w; }
function paySpread(S,arr,ref){ const P=ref?byId(S.payTimes,ref):null; if(!P||P.mode!=="calendar") return null;
  const w=calWeights(P); if(!(w.reduce((a,b)=>a+b,0)>0)) return null;
  return paySpreadW(S,arr,w); }
function paySpreadLine(S,arr,def){ if(def&&def.timing){ const w=timingWeights(def.timing); if(w) return paySpreadW(S,arr,w); } return paySpread(S,arr,def&&def.paySched); }
function paySpreadW(S,arr,w){
  const m0=(num(S.startMonth)||1)-1, out=new Float64Array(arr.length);
  for(let y=0;y*12<arr.length;y++){ let T=0,W=0; const n=Math.min(12,arr.length-y*12);
    for(let k=0;k<n;k++){ T+=arr[y*12+k]; W+=w[(m0+k)%12]; }
    for(let k=0;k<n;k++) out[y*12+k]=W>0?T*w[(m0+k)%12]/W:arr[y*12+k]; }
  return out; }
/* Amounts by month in XL4ADW's _ATL format (2025/01|63945.98;) or pasted as two columns. */
function atlParse(str){ const m=new Map();
  for(const part of String(str||"").split(/[;\n]+/)){ const u=/^(\d{1,2})\/(?:\d{1,2}\/)?(\d{4})\s*[|\t,:]?\s*(-?[\d.,]+)/.exec(part.trim());
    if(u){ m.set((+u[2])*12+(+u[1]-1),parseFloat(u[3].replace(/,/g,""))); continue; }
    const x=/(\d{4})\D(\d{1,2})\s*[|\t,:]\s*(-?[\d.,]+)/.exec(part.trim()); if(x) m.set((+x[1])*12+(+x[2]-1),parseFloat(x[3].replace(/,/g,""))); }
  return m; }
function valDayF(S,r,rm){ if(!S.valDays) return 1; const d=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(S.valDate||"")); if(!d) return 1;
  const day=+d[3], dim=new Date(+d[1],+d[2],0).getDate(); if(day<=1) return 1; const fr=(day-1)/dim;
  return S.pvMode==="annual"?Math.pow(1+r,fr/12):Math.pow(1+rm,fr); }
function closingLine(S,c,price){ return c.basis==="amt"?num(c.amt):c.basis==="range"?rangeAmt(S,c.range,price):num(c.pct)*price; }
// Present value of a run's cash flows at a discount rate; a run's own value is this at S.discount. The flows do not
// depend on the rate, and the unlevered IRR's only depend on the price through the basis, so value and IRR grids
// re-discount one run per exit cap instead of re-running the model for every cell.
function pvFrom(S,pvM,pvA,netRev,nY,rate){ const r=rate===undefined?num(S.discount):rate, rm=(S.pvMode==="effective")?Math.pow(1+r,1/12)-1:r/12;
  let pvCF=0, pvRev=0;
  if(S.pvMode==="annual"){
    for(let y=0;y<nY;y++) pvCF+=pvA[y]/Math.pow(1+r,y+1);
    pvRev=netRev/Math.pow(1+r,nY);
  } else {
    for(let i=0;i<nY*12;i++) pvCF+=pvM[i]/Math.pow(1+rm,i+1);
    pvRev=netRev/Math.pow(1+rm,nY*12);
  }
  { const dF=valDayF(S,r,rm); if(dF!==1){ pvCF*=dF; pvRev*=dF; } }
  return {pvCF,pvRev,pv:pvCF+pvRev}; }
/* ---- IRR, annualized on the SAME convention the PV uses ---- */
// Retain the established bracket when it contains a root; expand it for high
// returns or deep losses. Multiple-sign-change streams can have several roots:
// this solver returns one bracketed root and does not establish uniqueness.
function irrPeriodicF(fl,lo,hi){
  if(!fl||fl.length<2) return null;
  let values=Array.from(fl);
  if(!values.every(Number.isFinite)||!values.some(v=>v<0)||!values.some(v=>v>0)) return null;
  // Empty periods before the investment or after the final payment do not
  // change roots. Remove their common factors before evaluation can underflow.
  while(values[values.length-1]===0) values.pop();
  const first=values.findIndex(v=>v!==0); if(first>0) values=values.slice(first);
  const scale=Math.max(...values.map(Math.abs)), a=values.map(v=>v/scale);
  // Equivalent NPV sign, evaluated as future value below zero and present
  // value above zero. Normalization avoids overflow near -100% on long holds.
  const f=r=>{ const q=1+r; let v=0;
    if(q<=1){ for(const x of a) v=v*q+x; }
    else { for(let i=a.length-1;i>=0;i--) v=v/q+a[i]; }
    return v; };
  let flo=f(lo), fhi=f(hi);
  for(let k=0;k<40&&flo!==0&&fhi!==0&&Math.sign(flo)===Math.sign(fhi);k++){
    lo=(lo-1)/2; hi=hi*2+1; flo=f(lo); fhi=f(hi);
  }
  if(flo===0) return lo; if(fhi===0) return hi;
  if(Math.sign(flo)===Math.sign(fhi)) return null;
  for(let k=0;k<200;k++){
    const mid=(lo+hi)/2; if(mid===lo||mid===hi) break;
    const fm=f(mid); if(fm===0) return mid;
    if(Math.sign(flo)!==Math.sign(fm)) hi=mid;
    else { lo=mid; flo=fm; }
  }
  return (lo+hi)/2;
}
function irrMonthlyF(fl){ return irrPeriodicF(fl,-0.9/12,1.0); }
const annuF=(S,m)=>m===null?null:(S.pvMode==="effective"?Math.pow(1+m,12)-1:m*12);
function irrAnnualF(fl){ return irrPeriodicF(fl,-0.9,5); }
// unlevered IRR of a run's cash flows bought at a basis (the price, or the value) plus closing costs
function irrFrom(S,pvM,pvA,netRev,nY,basis,closing){
  if(S.pvMode==="annual"){ const ua=[-(basis+closing)]; for(let y=0;y<nY;y++) ua.push(pvA[y]); ua[ua.length-1]+=netRev; return irrAnnualF(ua); }
  const uf=[-(basis+closing)]; for(let i=0;i<nY*12;i++) uf.push(pvM[i]); uf[uf.length-1]+=netRev; return annuF(S,irrMonthlyF(uf)); }
function closingFor(S,price){ return (S.acqCosts||[]).reduce((a,c)=>a+closingLine(S,c,price),0); }
/* Inflation indices: index levels by month, used wherever an
   inflation series is. The factor for analysis year y is the level twelve y months in over
   the level at the start; past the data the last year's growth carries on, monthly. */
const IDX_CACHE=new WeakMap();
function idxParse(sr){ const c=IDX_CACHE.get(sr); if(c&&c.src===sr.data&&c.after===sr.after) return c;
  const m=new Map();
  for(const part of String(sr.data||"").split(/[;\n]+/)){ const u=/^(\d{1,2})\/(?:\d{1,2}\/)?(\d{4})\s*[|\t,:]?\s*(-?[\d.,]+)/.exec(part.trim());
    if(u){ m.set((+u[2])*12+(+u[1]-1),parseFloat(u[3].replace(/,/g,""))); continue; }
    const x=/(\d{4})\D(\d{1,2})\D+(-?[\d.,]+)/.exec(part.trim()); if(x) m.set((+x[1])*12+(+x[2]-1),parseFloat(x[3].replace(/,/g,""))); }
  const ks=[...m.keys()].sort((a,b)=>a-b), o={src:sr.data,after:sr.after,m,first:ks[0],last:ks[ks.length-1]};
  const lv=m.get(o.last), pv=m.get(o.last-12);
  o.g=(sr.after!==undefined&&sr.after!==""&&sr.after!==null)?num(sr.after):(pv?lv/pv-1:0);
  IDX_CACHE.set(sr,o); return o; }
function idxLevel(o,k){ if(!o.m.size) return null; if(o.m.has(k)) return o.m.get(k);
  if(k>o.last) return o.m.get(o.last)*Math.pow(1+o.g,(k-o.last)/12);
  if(k<o.first) return o.m.get(o.first);
  for(let j=k;j>=o.first;j--) if(o.m.has(j)) return o.m.get(j); return null; }
function idxFactor(S,sr,i){ const o=idxParse(sr), k0=num(S.startYear)*12+(num(S.startMonth)||1)-1, y=Math.floor(i/12);
  const a=idxLevel(o,k0), b=idxLevel(o,k0+12*y); return (a&&b)?b/a:1; }
function legacyLoan(S){ return {name:"Loan",sizing:"ltv",ltv:num(S.ltv),rateType:"fixed",rate:num(S.rate),amortYears:num(S.amortYears),
  ioAll:!!S.ioOnly,ioMonths:0,feePct:num(S.loanFee),exitFeePct:0,start:"",termMonths:0,ffMax:0,ffPct:1,legacy:true}; }
function debtLoans(S){ if(!S.loanOn) return []; return (S.loans&&S.loans.length)?S.loans.filter(l=>l.on!==false):[legacyLoan(S)]; }
function debtPayoffAt(loans,i){ return loans.reduce((a,x)=>a+((i<x.start||i>x.maturity)?0:x.bal[i]*(1+x.xf)),0); }
function buildDebt(S,nM,nY,basis,leaseCostM){
  const Z=()=>new Float64Array(nM);
  const out={loans:[],dsM:Z(),intM:Z(),prinM:Z(),balM:Z(),drawM:Z(),balloonM:Z(),fundM:Z(),initLoan:0,initFee:0};
  const hold=nY*12;
  for(const L of debtLoans(S)){
    const amt=(L.sizing==="amount")?num(L.amount):num(L.ltv)*basis;
    const p=/^(\d{4})-(\d{2})/.exec(String(L.start||""));
    const s0=p?Math.max(0,(+p[1]-num(S.startYear))*12+(+p[2]-(num(S.startMonth)||1))):0;
    const tm=Math.round(num(L.termMonths)||0), mat=tm>0?s0+tm-1:Infinity;
    const fee=amt*num(L.feePct), xf=num(L.exitFeePct);
    const x={name:L.name||"Loan",amount:amt,fee,start:s0,maturity:mat,xf,int:Z(),prin:Z(),ds:Z(),bal:Z(),draw:Z(),balloon:Z(),rate:Z(),
      rateType:L.rateType||"fixed",ioMonths:Math.round(num(L.ioMonths)||0),ioAll:!!L.ioAll,amortYears:num(L.amortYears),pmt0:null};
    const curve=String(L.curve||"").split(/[,;\s]+/).filter(Boolean).map(v=>{ const n=parseFloat(v); return isFinite(n)?(Math.abs(n)>=1?n/100:n):0; });
    const rateAt=i=>{ if(L.rateType!=="floating") return num(L.rate);
      const y=Math.floor(i/12), ix=curve.length?curve[Math.min(y,curve.length-1)]:0;
      let r=ix+num(L.spread); if(num(L.floor)>0) r=Math.max(r,num(L.floor)); if(num(L.cap)>0) r=Math.min(r,num(L.cap)); return r; };
    const nAm=Math.max(Math.round(num(L.amortYears)*12),1), amort=!L.ioAll&&(L.legacy||num(L.amortYears)>0);
    const ioEnd=s0+x.ioMonths;
    let bal=0, pmt=0, pmtRate=null, amStart=null, ffLeft=num(L.ffMax);
    for(let i=s0;i<nM;i++){
      if(i===s0){ bal=amt; if(s0===0){ out.initLoan+=amt; out.initFee+=fee; } else out.fundM[i]+=amt-fee; }
      const r=rateAt(i), ir=r/12;
      // future funding: the lender funds a share of leasing and capital costs until the commitment is used
      if(ffLeft>0&&i<=mat&&i<hold){ const d=Math.min(ffLeft,num(L.ffPct===undefined?1:L.ffPct)*(leaseCostM?leaseCostM[i]||0:0));
        if(d>0){ x.draw[i]=d; out.drawM[i]+=d; bal+=d; ffLeft-=d; pmtRate=null; } }
      const int=bal*ir;
      let prin=0;
      if(amort&&i>=ioEnd){
        // the payment is struck when amortization starts, and re-struck only when a draw or a reset changes it
        if(pmtRate!==ir){ if(amStart===null) amStart=i; const left=Math.max(nAm-(i-amStart),1);
          pmt=(ir===0)?bal/left:bal*ir/(1-Math.pow(1+ir,-left)); pmtRate=ir; if(x.pmt0===null) x.pmt0=pmt; }
        prin=Math.min(bal,Math.max(0,pmt-int));
      }
      const ds=int+prin; bal=Math.max(0,bal-prin);
      x.int[i]=int; x.prin[i]=Math.min(prin,int+prin); x.ds[i]=ds; x.rate[i]=r;
      out.dsM[i]+=ds; out.intM[i]+=int; out.prinM[i]+=x.prin[i];
      if(i===mat&&mat<hold){ x.balloon[i]=bal*(1+xf); out.balloonM[i]+=bal*(1+xf); bal=0; x.bal[i]=0; break; }
      x.bal[i]=bal; out.balM[i]+=bal;
    }
    out.loans.push(x);
  }
  out.payoff=i=>debtPayoffAt(out.loans,i);
  return out;
}

/* One valuation at any discount rate, exit cap, hold and price, on exactly the engine's
   conventions: reversion struck on the forward year's NOI, PV annual or monthly by
   pvMode, the unlevered IRR on the PV convention, the levered IRR monthly, and the loan
   sized off the price. With no overrides it returns the engine's own PV, IRR and levered
   IRR, which is what makes the value, IRR and resale matrices trustworthy. */
function valAt(R,S,o){
  o=o||{};
  const nY=R.nY, h=Math.max(1,Math.min(Math.round(o.hold===undefined?nY:o.hold),nY));
  const r=(o.rate===undefined)?num(S.discount):o.rate;
  const ec=(o.exitCap===undefined)?num(S.exitCap):o.exitCap;
  const rm=(S.pvMode==="effective")?Math.pow(1+r,1/12)-1:r/12;
  const noiF=(S.resaleNoi==="trailing")?R.ann.noi[h-1]:R.ann.noi[h], gross=ec>0?noiF/ec:0, RSN=resaleNet(S,gross), net=RSN.net;
  let pvCF=0,pvRev=0;
  if(S.pvMode==="annual"){ for(let y=0;y<h;y++) pvCF+=R.pvA[y]/Math.pow(1+r,y+1); pvRev=net/Math.pow(1+r,h); }
  else { for(let i=0;i<h*12;i++) pvCF+=R.pvM[i]/Math.pow(1+rm,i+1); pvRev=net/Math.pow(1+rm,h*12); }
  { const dF=valDayF(S,r,rm); if(dF!==1){ pvCF*=dF; pvRev*=dF; } }
  const basis=(o.price===undefined)?(R.price||R.pv):o.price, cost=basis+closingFor(S,basis);
  if(o.pvOnly) return {hold:h,rate:r,exitCap:ec,noiFwd:noiF,gross,net,adj:RSN.adj,saleA:RSN.A,saleD:RSN.D,pvCF,pvRev,pv:pvCF+pvRev,basis};
  const irrA=irrAnnualF, irrMo=irrMonthlyF;
  const annu=m=>m===null?null:(S.pvMode==="effective"?Math.pow(1+m,12)-1:m*12);
  let irrU, inflow=net;
  if(S.pvMode==="annual"){ const ua=[-cost]; for(let y=0;y<h;y++){ ua.push(R.pvA[y]); inflow+=R.pvA[y]; }
    ua[ua.length-1]+=net; irrU=irrA(ua); }
  else { const uf=[-cost]; for(let i=0;i<h*12;i++){ uf.push(R.pvM[i]); inflow+=R.pvM[i]; }
    uf[uf.length-1]+=net; irrU=annu(irrMo(uf)); }
  let irrL=null,multL=null,loan=0,equity=null,bal=0,dsY=null;
  if(S.loanOn){
    // the engine's own schedule when the price is the model's; re-sized when the price is flexed
    const D=(o.price===undefined&&R.loans)?{initLoan:R.loan,initFee:R.feeAmt,dsM:R.dsM,drawM:R.drawM,balloonM:R.balloonM,fundM:R.fundM,loans:R.loans,payoff:R.payoff}
      :buildDebt(S,R.nM,R.nY,basis,R.leasingM);
    loan=D.initLoan;
    if(D.loans.length&&(loan>0||D.fundM.some((v,i)=>i<h*12&&v)||D.drawM.some((v,i)=>i<h*12&&v))){ equity=cost-loan+D.initFee;
      const lf=[-equity]; for(let i=0;i<h*12;i++) lf.push(R.cfbds[i]-D.dsM[i]+D.drawM[i]-D.balloonM[i]+D.fundM[i]);
      bal=D.payoff(h*12-1); lf[lf.length-1]+=net-bal; irrL=annu(irrMo(lf));
      const dist=lf.slice(1).reduce((a,v)=>a+v,0); multL=equity>0?dist/equity:null; }
  }
  return {hold:h,rate:r,exitCap:ec,noiFwd:noiF,gross,net,adj:RSN.adj,saleA:RSN.A,saleD:RSN.D,pvCF,pvRev,pv:pvCF+pvRev,basis,
    irrU,multU:cost>0?inflow/cost:null,irrL,multL,loan,equity,balance:bal,closing:cost-basis};
}

/* END BASIS FINANCIAL ENGINE */
