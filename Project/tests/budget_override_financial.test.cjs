const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

// Execute the canonical engine, with independent cash-flow amounts specified
// below. The normal build/parity checks separately verify its embedded copy.
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/financial_engine.js'),'utf8'),context);
const {blankState,calc}=vm.runInContext('({blankState,calc})',context);
const near=(actual,expected,label)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-7,
  `${label}: expected ${expected}, received ${actual}`);

function fixture(overrides={}){
  const s=blankState();
  Object.assign(s,{startYear:2026,startMonth:1,years:1,gvRate:0,clRate:0,
    inflRent:0,inflExp:0,inflCPI:0,loanOn:false,priceMode:'amount',price:120000,
    exitCap:.08,costSale:0,discount:.1,actuals:[],budgets:[],actEnd:'',budEnd:''},overrides);
  s.infl.forEach(series=>{series.rates=[0,0,0];});
  s.areas=[{id:'building',name:'Building',sf:1000,basis:true}];
  s.tenants=[{id:'tenant',name:'Tenant',sf:1000,start:'2026-01',end:'2035-12',
    rent:12,rentBasis:'psfyr',step:0,free:0,rec:s.recs[1].id,mla:s.mlas[0].id,expiry:'Vacate'}];
  s.ops=[];s.misc=[];s.parking=[];s.storage=[];
  s.nonops=[{id:'service',name:'Non-operating service',amt:1200,basis:'amt',infl:0}];
  s.caps=[{id:'roof',name:'Capital work',amt:0,basis:'amt',year:1,infl:0}];
  return s;
}

test('budget-only TI, commissions, capital and non-operating overrides reach cash flow',()=>{
  const s=fixture({dataCfg:'bf',budEnd:'2026-03'});
  s.budgets=[
    {line:'ti',data:'2026/01|1000'},
    {line:'lc',data:'2026/02|500'},
    {line:'cap:roof',data:'2026/03|2000'},
    {line:'non:service',data:'2026/01|1000'}
  ];
  const r=calc(s);
  near(r.monthly.ti[0],1000,'January TI');near(r.monthly.lc[1],500,'February commission');
  near(r.monthly.cap[2],2000,'March capital cost');near(r.monthly.non[0],1000,'January non-operating cost');
  near(r.ann.noi[0],12000,'unaffected operating NOI');near(r.ann.leasing[0],3500,'TI + LC + capital');
  near(r.ann.non[0],2100,'$1000 January plus eleven $100 forecast months');
  near(r.ann.cfbds[0],6400,'$12000 rent less $3500 leasing/capital and $2100 non-operating costs');
});

for(const [dataCfg,january,february]of [['f',0,0],['af',300,0],['bf',900,500],['abf',300,500]]){
  test(`data configuration ${dataCfg} selects the intended actual/budget TI periods`,()=>{
    const s=fixture({dataCfg,actEnd:'2026-01',budEnd:'2026-02'});
    s.actuals=[{line:'ti',data:'2026/01|300'}];
    s.budgets=[{line:'ti',data:'2026/01|900;2026/02|500'}];
    const r=calc(s);
    near(r.monthly.ti[0],january,'January TI');near(r.monthly.ti[1],february,'February TI');
    near(r.ann.cfbds[0],10800-january-february,'$12000 rent less $1200 forecast non-op and selected TI');
  });
}

test('actual zero wins over budget and overrides outside each selected end month are ignored',()=>{
  const s=fixture({actEnd:'2026-01',budEnd:'2026-03'}); // default Actual + Budget + Forecast
  s.actuals=[{line:'ti',data:'2026/01|0;2026/02|700'}];
  s.budgets=[{line:'ti',data:'2026/01|900;2026/02|500;2026/03|600;2026/04|800'}];
  const r=calc(s);
  for(const [i,expected]of [0,500,600,0].entries())near(r.monthly.ti[i],expected,`month ${i+1} TI`);
  near(r.ann.ti[0],1100,'selected TI total');near(r.ann.cfbds[0],9700,'cash flow after selected TI');
});

test('signed budget expense credits increase cash flow without being dropped or clamped',()=>{
  const s=fixture({dataCfg:'bf',budEnd:'2026-01'});
  s.budgets=[{line:'ti',data:'2026/01|-100'},{line:'lc',data:'2026/01|-50'},
    {line:'cap:roof',data:'2026/01|-200'},{line:'non:service',data:'2026/01|-25'}];
  const r=calc(s);
  near(r.monthly.leasing[0],-350,'TI, LC and capital credits');near(r.monthly.non[0],-25,'non-operating credit');
  near(r.monthly.cfbds[0],1375,'$1000 rent plus $375 credits');
  near(r.ann.cfbds[0],11275,'forecast cash flow plus $475 improvement over original January costs');
});

for(const kind of ['actuals','budgets']){
  function revenueFixture(overrides={}){
    return fixture({dataCfg:kind==='actuals'?'af':'bf',
      [kind==='actuals'?'actEnd':'budEnd']:'2026-03',...overrides});
  }
  for(const [policy,values]of [['vacancy',{gvRate:.1,clRate:0}],['credit loss',{gvRate:0,clRate:.1}]]){
    test(`${kind}: sparse revenue values do not waive ${policy} on untouched forecast months`,()=>{
      const s=revenueFixture(values);s[kind]=[{line:'rent',data:'2026/01|900'}];
      const r=calc(s),loss=policy==='vacancy'?r.monthly.genVac:r.monthly.credit;
      near(r.monthly.egr[0],900,'net January revenue');near(loss[0],0,'no second loss charge on January actual/budget');
      for(const i of [1,2,3]){near(r.monthly.egr[i],900,`forecast month ${i+1} net revenue`);near(loss[i],100,`forecast month ${i+1} loss`);}
      near(r.ann.egr[0],10800,'one $900 supplied month plus eleven $900 forecast months');
    });
  }
  test(`${kind}: an explicit zero revenue is supplied data, not an absent month`,()=>{
    const s=revenueFixture({gvRate:.1});s[kind]=[{line:'rent',data:'2026/01|0'}];
    const r=calc(s);
    near(r.monthly.sched[0],0,'January supplied rent');near(r.monthly.egr[0],0,'January net revenue');
    near(r.monthly.genVac[0],0,'January loss is not charged twice');near(r.monthly.genVac[1],100,'February forecast vacancy remains');
    near(r.ann.egr[0],9900,'zero January plus eleven $900 forecast months');
  });
  test(`${kind}: unknown revenue keys do not remove forecast vacancy`,()=>{
    const s=revenueFixture({gvRate:.1});s[kind]=[{line:'rent:unknown',data:'2026/01|500'},{line:'misc:missing',data:'2026/02|700'}];
    const r=calc(s);
    for(const i of [0,1,2]){near(r.monthly.egr[i],900,`month ${i+1} net revenue`);near(r.monthly.genVac[i],100,`month ${i+1} vacancy`);}
    near(r.ann.egr[0],10800,'unchanged annual forecast');
  });
  test(`${kind}: reference-only revenue does not remove forecast vacancy`,()=>{
    const s=revenueFixture({gvRate:.1});
    s.misc=[{id:'reference',name:'Reference revenue',amt:1200,basis:'amt',infl:0,refOnly:true}];
    s[kind]=[{line:'misc:reference',data:'2026/01|500'}];
    const r=calc(s);
    near(r.lineM['misc:reference'][0],500,'reference line still receives its recorded amount');
    near(r.monthly.genVac[0],100,'reference-only data cannot waive cash-flow vacancy');
    near(r.ann.egr[0],10800,'unaffected annual operating revenue');
  });
  test(`${kind}: actNoVac false preserves the selected vacancy policy`,()=>{
    const s=revenueFixture({gvRate:.1,actNoVac:false});s[kind]=[{line:'rent',data:'2026/01|900'}];
    const r=calc(s);
    near(r.monthly.genVac[0],100,'January vacancy remains enabled');near(r.monthly.egr[0],800,'January supplied rent less enabled vacancy');
    near(r.monthly.egr[1],900,'February forecast unchanged');near(r.ann.egr[0],10700,'$800 January plus eleven $900 forecast months');
  });
}
