export const districts = [
  { name:'청운역 동편', type:'토지', icon:'◇', color:'#f3b858', npc:'한미라', role:'공인중개사', tip:'측량은 시작됐지만 출입구 위치는 아직 확정 전이에요. 시청에 노선 대안을 물어보세요.', x:26,y:31 },
  { name:'해온 업무지구', type:'오피스', icon:'▥', color:'#8eafff', npc:'이재현', role:'빌딩 관리소장', tip:'한 기업이 세 층을 비교 중입니다. 공실률과 임대수익을 먼저 비교해 보세요.', x:69,y:25 },
  { name:'무진항 산업단지', type:'공장', icon:'▤', color:'#6bd5bd', npc:'박수연', role:'공장장', tip:'냉동창고는 임차계약을 먼저 잡으면 은행 심사가 쉬워요. 대신 임대료는 낮아집니다.', x:24,y:74 },
  { name:'솔내 주거지', type:'아파트', icon:'⌂', color:'#c6a2fc', npc:'오민재', role:'세무사', tip:'종부세는 6월 1일의 공시가격과 소유자를 봅니다. 양도세는 실제로 얼마에 사고팔았는지부터 따져요.', x:76,y:68 }
];

const templates = [
  ['청운역 앞 대지',28500,0,.82,1.1], ['해온 센트럴빌딩',61500,780,.88,1],
  ['무진항 2호 공장',36000,475,.84,.93], ['솔내 그린뷰 84㎡',43500,340,.96,1.04],
  ['동편 철길 옆 필지',19500,0,.7,.8], ['해온 리버타워',52500,680,.82,.85],
  ['무진 물류 3호동',29500,370,.9,.86], ['솔내 힐사이드 59㎡',31500,245,.94,.93]
];

export const money = n => {
  const amount = Math.round(Math.abs(n));
  return (n < -0.5 ? '−' : '') + (amount >= 10000 ? Math.floor(amount/10000)+'억 '+(amount%10000 ? (amount%10000).toLocaleString('ko-KR')+'만 ' : '') : amount.toLocaleString('ko-KR')+(amount ? '만 ' : ' '))+'원';
};
export const pct = n => (n*100).toFixed(2)+'%';
const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
export const year = q => Math.ceil(q/4);
export const quarter = q => (q-1)%4+1;
const wave = (q, offset=0) => Math.sin(q*1.79 + offset);
export const election = q => q >= 6 && (q-6)%8 === 0;
export const event = q => q >= 3 && (q-3)%4 === 0;
export function makeGame(limit=20) {
  return {limit,q:1,cash:50000,started:false,done:false,items:[],log:[],record:[],policy:[0,0,0,0],taxDue:0,pendingPolicy:[],sales:{},pf:null,fx:1332.33,fxLabel:'11.18 공표값',base:.03,stats:{rent:0,interest:0,tax:0,pf:0},fixed:false,news:'청운시 거래소 개장 · 첫해 매물 8건 공개',deadline:0};
}
export function setup(limit) {
  const s=makeGame(limit);
  addMarket(s,8);
  return s;
}
function addMarket(s,count) {
  for(let i=0;i<count;i++){
    const j=count===8?i:(year(s.q)+i)%2*4+i;
    const [name,base,rent,occupancy,location]=templates[j];
    const phase=count===8?1:1+(year(s.q)-1)*.028+wave(s.q,i)*.045;
    s.items.push({id:s.q*10+i, district:i%4,name:count===8?name:name+' · '+year(s.q)+'년차',base:base*phase,rent:rent*phase,occupancy,location,added:s.q,owner:false,debt:0});
  }
}

export function occ(s,a) {return clamp(a.occupancy + wave(s.q,a.id)*.06 + (s.policy[a.district]||0)*.1+(a.improved?.07:0),.55,.99);}
export function value(s,a) {
  const age=s.q-a.added;
  const trend=1+age*.004+wave(s.q,a.district)*.022-wave(a.added,a.district)*.022;
  const policy=1+s.policy[a.district]*a.location;
  const rate=s.base+(s.q%9>=6?.004:0);
  const currency=s.fx/1332.33-1;
  if(a.district===0) return a.base*trend*policy*(1-(rate-.03)*4);
  if(a.district===1||a.district===2) {
    const initialCap=a.rent*a.occupancy*.82*4/a.base;
    return a.rent*occ(s,a)*.82*4*trend*policy/(initialCap+(rate-.03)*.7)*(1+currency*(a.district===2?.25:0));
  }
  return a.base*trend*policy*(1-(rate-.03)*5)*(1-(year(s.q)%3===0?.045:0));
}
export const loanRate = (s,a) => a?.fixed ? a.fixedRate : s.base+.019+(s.q%9>=6?.004:0);
export const purchase = (s,a) => {
  const price=Math.round(value(s,a)*.995);
  const houses=s.items.filter(x=>x.owner&&x.district===3).length;
  const tax=price*(a.district===3?(houses>=2?.084:price<=60000?.011:price>=90000?.033:((price/10000*2/3)-3)*.011):.046);
  const debt=s.items.reduce((total,x)=>total+x.debt,0);
  const loan=Math.round(Math.min(price*(a.district===3?.55:.6),Math.max(0,65000-debt)));
  return {price,tax,fee:price*.005,loan};
};
export function buy(s,a,useLoan,fixed=false) {
  if(!s.started||s.done||a.owner||a.sold) return;
  const p=purchase(s,a);
  const loan=useLoan?p.loan:0;
  const cost=p.price+p.tax+p.fee-loan;
  if(cost>s.cash) return '잔금에 필요한 현금이 부족합니다.';
  if(useLoan && !loan) return '현재 이용 가능한 담보대출 한도가 없습니다.';
  s.cash-=cost; s.stats.tax+=p.tax;
  Object.assign(a,{owner:true,paid:p.price+p.tax+p.fee,bought:s.q,debt:loan,fixed,fixedRate:s.base+.024,due:s.q+8,improved:false,home:false});
  note(s,a.name+' 매입 · '+money(cost)+' 지출');
}
const bracket = (n, bands) => bands.reduce((t,[ceiling,rate],i)=>t+Math.max(0,Math.min(n,ceiling)-(i?bands[i-1][0]:0))*rate,0);
const incomeBands=[[1400,.06],[5000,.15],[8800,.24],[15000,.35],[30000,.38],[50000,.4],[100000,.42],[Infinity,.45]];
function disposal(s,a,price,sales=s.sales) {
  const fee=price*.005;
  const gain=price-a.paid-fee;
  const quarters=s.q-a.bought;
  const only=a.district===3&&s.items.filter(x=>x.owner&&x.district===3).length===1;
  const eligible=only&&quarters>=8;
  const taxable=eligible?gain*Math.max(0,price-120000)/price:gain;
  const adjusted=Math.max(0,taxable)*(1-(quarters>=12?Math.min(.3,Math.floor(quarters/4)*.02):0));
  const ledger=sales[year(s.q)]||{used:0,normal:0};
  const used=Math.min(adjusted,Math.max(0,250-ledger.used));
  const net=adjusted-used;
  const normal=bracket(net+ledger.normal,incomeBands)-bracket(ledger.normal,incomeBands);
  const short=quarters<4?(a.district===3?.7:.5):quarters<8?(a.district===3?.6:.4):0;
  return {price,tax:Math.max(normal,net*short)*1.1,fee,used,net:short?0:net,cash:price-fee-Math.max(normal,net*short)*1.1-a.debt};
}
export function sale(s,a,urgent=false) {return disposal(s,a,value(s,a)*(urgent?.94:.99));}
export function sell(s,a,urgent=false) {
  if(!s.started||s.done||!a.owner) return;
  const p=sale(s,a,urgent);
  const ledger=s.sales[year(s.q)]??={used:0,normal:0};
  ledger.used+=p.used; ledger.normal+=p.net;
  s.cash+=p.cash; s.stats.tax+=p.tax;
  Object.assign(a,{owner:false,sold:true,debt:0});
  note(s,a.name+' 매도 · 정산 '+money(p.cash));
}
export function note(s,text) {
  s.log.unshift({q:s.q,text});
  if(s.log.length>80) s.log.pop();
}
export function holding(s) {
  const buckets=[0,0,0];
  let homes=0,propertyTax=0;
  for(const a of s.items.filter(x=>x.owner)){
    const official=a.base*.72*(1+(year(s.q)-year(a.added))*.028);
    if(a.district===3){buckets[0]+=official;homes++;}
    else if(a.district===0) buckets[1]+=official;
    else buckets[2]+=official*.42;
    propertyTax+=official*(a.district===3?.0016:.0024);
  }
  const homeTax=bracket(Math.max(0,buckets[0]-(homes===1?120000:90000))*.6,[[30000,.005],[60000,.007],[120000,.01],[Infinity,homes>=3?.02:.013]]);
  const landTax=Math.max(0,buckets[1]-50000)*.01+Math.max(0,buckets[2]-800000)*.005;
  return Math.round(propertyTax+Math.max(0,homeTax+landTax-propertyTax*.2)*1.2);
}
export function pfValue(s) {
  if(!s.pf) return 0;
  const p=s.pf;
  const salePrice=(p.contract?122000:129000)*(1+s.policy[2]*.6)*(1+wave(p.start,4)*(p.contract?.024:.15));
  const costs=Math.max(0,(s.fx/p.fx-1)*22000);
  const remaining=Math.max(0,4-p.progress);
  return Math.max(0,salePrice-70000-p.interest-costs-remaining*8500);
}
export function startPF(s,contract) {
  if(!s.started||s.done||s.pf) return;
  if(s.cash<30000) return '자기자본 3억 원이 필요합니다.';
  if(s.limit-s.q<3) return '준공에 필요한 분기가 부족합니다.';
  s.cash-=30000;
  s.pf={start:s.q,progress:0,borrowed:0,interest:0,contract,fx:s.fx};
  note(s,'무진항 냉동창고 PF 착공 · 자기자본 3억 원');
}
export function closePF(s) {
  if(!s.pf||s.done) return;
  const pay=pfValue(s);
  s.cash+=pay;s.stats.pf+=pay-30000;s.pf=null;
  note(s,'냉동창고 PF 회수 · '+money(pay));
}
export function resolveEvent(s) {
  if(!s.started||s.done||!event(s.q)||s.eventAt===s.q) return;
  if(s.cash<1800) return '입찰 준비금 1,800만 원이 필요합니다.';
  s.cash-=1800;s.eventAt=s.q;s.bid={due:s.q+1,amount:wave(s.q,2)>-.05?5200:0};
  note(s,'긴급 입찰 참여 · 1,800만 원 지출');
}
export function totals(s) {
  const held=s.items.filter(a=>a.owner);
  const sales=Object.fromEntries(Object.entries(s.sales).map(([k,v])=>[k,{...v}]));
  let gross=0,debt=0,tax=s.taxDue,fees=0;
  for(const a of held){
    const p=disposal(s,a,value(s,a)*.99,sales);
    const ledger=sales[year(s.q)]??={used:0,normal:0};
    ledger.used+=p.used;ledger.normal+=p.net;
    gross+=p.price;debt+=a.debt;tax+=p.tax;fees+=p.fee;
  }
  const project=pfValue(s);
  return {gross,debt,tax,fees,project,net:s.cash+gross+project-debt-tax-fees};
}
export function advance(s) {
  if(!s.started||s.done) return;
  let rent=0,interest=0;
  for(const a of s.items.filter(x=>x.owner)){
    if(!a.home) rent+=a.rent*occ(s,a)*.82;
    interest+=a.debt*loanRate(s,a)/4;
    if(a.debt && a.due===s.q){a.due+=8; a.fixed=false; note(s,a.name+' 대출 만기 · 변동금리로 자동 연장');}
  }
  s.cash+=rent-interest;
  s.stats.rent+=rent;s.stats.interest+=interest;
  if(rent||interest) note(s,'분기 손익 · 임대 '+money(rent)+' / 이자 '+money(interest));
  if(quarter(s.q)===2){s.taxDue=holding(s);if(s.taxDue) note(s,'6월 1일 보유세 예정액 '+money(s.taxDue));}
  if(quarter(s.q)===4){s.cash-=s.taxDue;s.stats.tax+=s.taxDue;s.taxDue=0;}
  if(s.pf&&s.pf.progress<4){
    const p=s.pf;p.progress++;p.borrowed+=17500;p.interest+=p.borrowed*(s.base+.039)/4;
    if(p.progress===4) note(s,'무진항 냉동창고 준공 · 지분 회수 가능');
  }
  if(s.bid?.due===s.q){s.cash+=s.bid.amount;note(s,s.bid.amount?'긴급 입찰 낙찰 · '+money(s.bid.amount)+' 수입':'긴급 입찰 탈락 · 준비금 손실');s.bid=null;}
  if(s.cash<0){
    const assets=s.items.filter(x=>x.owner).sort((a,b)=>sale(s,b,true).cash-sale(s,a,true).cash);
    for(const a of assets){
      if(s.cash>=0||sale(s,a,true).cash<=0) break;
      sell(s,a,true);
    }
  }
  s.record.push(Math.round(totals(s).net));
  if(s.q===s.limit){s.done=true;return;}
  s.q++;
  if(quarter(s.q)===1){addMarket(s,4);note(s,year(s.q)+'년차 신규 매물 4건 공개');}
  if(election(s.q)){
    const transit=(s.q-6)%16===0;
    const positive=wave(s.q,8)>-.72;
    const district=transit?0:2;
    const impact=positive?.13:-.07;
    s.policy[district]+=impact*.45;
    (s.pendingPolicy??=[]).push({due:s.q+1,district,nearby:transit?3:1,impact,positive});
    s.news=transit?(positive?'청운시장 선거 · 동편역 추진 후보 당선':'청운시장 선거 · 서편 노선 후보 당선'):(positive?'국회의원 선거 · 무진항 예산 지원 공약 승리':'국회의원 선거 · 항만 확장 예산 재검토');
    note(s,s.news);
  } else if(event(s.q)) s.news='긴급 입찰 · 한 분기 동안 특별 투자 기회';
  else if(election(s.q+1)) s.news='선거 D−1분기 · 후보별 개발 공약 공개';
  else if(quarter(s.q)===1) s.news=year(s.q)+'년차 · 새 매물 4건 공개';
  else if(s.q%9>=6) s.news='청운은행 · 신용 위험 가산금리 0.4%p 인상';
  else s.news='청운시보 · 최신 거래와 임대 시세 업데이트';
  for(const pending of (s.pendingPolicy||[]).filter(p=>p.due===s.q)){
    s.policy[pending.district]+=pending.impact*.55;
    s.policy[pending.nearby]+=pending.positive?.035:-.02;
    s.news=(pending.district===0?'동편역 건설':'무진항 확장')+(pending.positive?' · 사업 예산 의결':' · 사업 재검토 결정');
    note(s,s.news);
  }
  s.pendingPolicy=(s.pendingPolicy||[]).filter(p=>p.due>s.q);
}
