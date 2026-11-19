import {districts, money, pct, setup, year, quarter, event, occ, value, purchase, loanRate, buy, sale, sell, startPF, closePF, pfValue, resolveEvent, totals, advance, note} from './engine.mjs';

const $=id=>document.getElementById(id);
const modes={12:'첫 투자',20:'표준 모드',40:'도시의 10년'};
const titles={market:'매물 거래',portfolio:'내 자산',bank:'청운은행',pf:'개발 사업',news:'도시 소식'};
const storageKey='cheongun-market-1';
let save;
try {save=JSON.parse(localStorage.getItem(storageKey));}catch {}
let s=save?.items?.length?save:setup(20);
let selected=s.limit, tab='market', district=-1, zoom=1, toastTimeout;
let live={fx:1332.33,fxLabel:'11.18 공표값'};
const duration=()=>s.limit===12?80:48;
const player=q=>year(q)+'년차 '+quarter(q)+'분기';
const groupLeft=()=>s.limit===40&&s.q%2===1?2:1;
let steps=groupLeft();
const f2=n=>n.toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2});
const sign=n=>(n>=0?'+':'')+(n*100).toFixed(1)+'%';
const moneyLine=(label,n)=>line(label,money(n));
const line=(label,text)=>'<div class="line"><span>'+label+'</span><b>'+text+'</b></div>';
const button=(t,a,id='',style='secondary',disabled=false)=>'<button class="'+style+'" data-act="'+a+'" data-id="'+id+'" '+(disabled?'disabled':'')+'>'+t+'</button>';
const body=()=>$('dialog-body');
const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(s));}catch{}};
function toast(msg){
  $('toast').textContent=msg; $('toast').classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),2900);
}
function currentFx(){
  $('fx').textContent=f2(live.fx);
  $('fx-date').textContent=live.fxLabel;
}
function loadFx(){
  const url='https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW';
  fetch(url,{signal:AbortSignal.timeout(6500)}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(d=>{
    if(d.rates?.KRW>0&&/^\d{4}-\d\d-\d\d$/.test(d.date)){
      live={fx:d.rates.KRW,fxLabel:d.date.slice(5).replace('-','.')+' 공표값'};currentFx();
    }
  }).catch(()=>{live.fxLabel='11.18 저장값';currentFx();});
}
function dialog(title,content){
  body().innerHTML='<div class="dialog-content"><div class="dialog-top"><h2>'+title+'</h2><button class="icon-btn" aria-label="닫기" data-act="close">×</button></div>'+content+'</div>';
  if(!$('dialog').open)$('dialog').showModal();
}
function renderTimer(){
  if(s.practice&&s.started&&!s.done){$('clock').textContent='연습';return;}
  const second=s.done?0:s.started?Math.max(0,Math.ceil((s.deadline-Date.now())/1000)):duration();
  $('clock').textContent=String(Math.floor(second/60)).padStart(2,'0')+':'+String(second%60).padStart(2,'0');
}
function render(){
  const prevTab=document.querySelector('.nav button.active')?.dataset.tab;
  const scroll=$('panel').scrollTop;
  const net=totals(s).net;
  $('quarter').innerHTML=year(s.q)+'년차 <em>'+quarter(s.q)+'분기</em>';
  $('length').textContent='총 '+s.limit+'분기 · '+modes[s.limit];
  $('cash').textContent=money(s.cash);$('wealth').textContent=money(net);
  $('return').textContent='시작 자본 대비 '+sign(net/50000-1);
  $('return').style.color=net>=50000?'var(--green)':'#ff9a85';
  $('clock-detail').textContent=s.done?'게임 종료':s.started?(s.practice?'타이머 없이 수동 정산':s.limit===40?'연속 분기 · 수동 진행 가능':'시간 종료 시 자동 정산'):'게임 시작 후 진행';
  $('headline').textContent=s.news;
  $('next').innerHTML=(s.done?'최종 결산':s.started?(s.q===s.limit?'게임 결산':'분기 정산'):'게임 시작')+' <span aria-hidden="true">▶</span>';
  $('turn-hint').textContent=s.done?'수익과 위험을 확인하세요':s.started?'현재 분기의 수입과 비용을 확정합니다':s.limit+'분기 · '+modes[s.limit];
  $('markers').innerHTML=districts.map((d,i)=>'<button class="marker '+(i===district?'active':'')+'" style="left:'+d.x+'%;top:'+d.y+'%;--color:'+d.color+'" data-act="district" data-id="'+i+'"><i>'+d.icon+'</i>'+d.name+'<small>'+s.items.filter(a=>a.district===i&&!a.owner&&!a.sold).length+'</small></button>').join('');
  for(const b of document.querySelectorAll('.nav button'))b.classList.toggle('active',b.dataset.tab===tab);
  const available=s.items.filter(a=>!a.owner&&!a.sold&&(district<0||a.district===district));
  const owned=s.items.filter(a=>a.owner);
  const subtitle={market:available.length+'건의 거래 가능 매물',portfolio:owned.length+'건의 보유 부동산',bank:'담보대출 · 금리 · 상환',pf:'사업 현금흐름으로 조달하는 개발 투자',news:'공약, 시장 변화, 긴급 입찰'};
  $('panel-head').innerHTML='<div class="side-head"><h2>'+(tab==='market'&&district>=0?districts[district].name:titles[tab])+'</h2><p>'+subtitle[tab]+'</p></div>';
  if(tab==='market'){
    $('panel').innerHTML='<div class="filters">'+['전체',...districts.map(d=>d.type)].map((name,i)=>'<button class="'+(district===i-1?'active':'')+'" data-act="filter" data-id="'+(i-1)+'">'+name+'</button>').join('')+'</div>'+(district>=0?'<button class="talk" data-act="npc" data-id="'+district+'"><span class="tile" style="--color:var(--gold)">♙</span><span><b>'+districts[district].npc+'</b><small>'+districts[district].role+' · 대화하기</small></span><span class="chev">›</span></button>':'')+(available.map(a=>asset(a)).join('')||'<p class="muted">매년 1분기에 새 매물이 공개됩니다.</p>');
  }else if(tab==='portfolio'){
    $('panel').innerHTML='<div class="card">'+moneyLine('예상 순자산',net)+moneyLine('누적 임대소득',s.stats.rent)+'</div>'+(owned.map(a=>asset(a)).join('')||'<p class="muted">매물을 매입하면 여기에 표시됩니다.</p>')+s.log.slice(0,5).map(row).join('');
  }else if(tab==='bank'){
    $('panel').innerHTML='<div class="card">'+line('한국은행 기준금리',pct(s.base))+line('청운은행 변동금리',pct(loanRate(s)))+line('고정금리',pct(s.base+.024))+moneyLine('대출 잔액',totals(s).debt)+'</div><p class="note">부동산을 매입할 때 담보대출을 선택할 수 있습니다. 만기는 8분기이며 별도 상환이 없으면 변동금리로 연장됩니다.</p>'+owned.filter(a=>a.debt).map(a=>'<div class="card"><h3>'+a.name+'</h3>'+moneyLine('잔액',a.debt)+line('다음 분기 예상 이자',money(a.debt*loanRate(s,a)/4))+line('만기',player(a.due))+button('원금 상환','repay',a.id,'secondary',!s.started||s.done)+'</div>').join('');
  }else if(tab==='pf'){
    const p=s.pf;
    $('panel').innerHTML='<div class="card"><h3>무진항 냉동창고</h3><p>수협과 냉동창고를 짓고 준공 후 사업 지분을 회수합니다.</p>'+moneyLine('자기자본',30000)+moneyLine('선순위 PF 한도',70000)+line('공사 기간','4분기')+(p?'<div class="progress"><span style="width:'+(p.progress*25)+'%"></span></div>'+line('공정률',p.progress*25+'%')+moneyLine('누적 대출 인출',p.borrowed)+moneyLine('미지급 이자',p.interest)+moneyLine('현재 회수 예상액',pfValue(s)):'')+'<div class="actions">'+(p?button(p.progress===4?'지분 매각 및 정산':'중도 정산 조건 보기','pf-close','', 'gold',s.done):button('사업 조건 검토','pf-open','','gold'))+'</div></div><p class="note">실제 공표 환율과 무진항 정책에 따라 최종 회수액이 달라집니다.</p>';
  }else{
    const eventName=s.q%8===3?'불 꺼진 빌딩의 마지막 입찰':'냉동선 열두 척';
    $('panel').innerHTML='<div class="card"><h3>'+s.news+'</h3><p>시장선거 6·22·38분기 / 국회의원 선거 14·30분기</p></div>'+(s.news.includes('공약 공개')?'<div class="card"><h3>후보별 공약</h3><p>'+(s.q%16===5?'동편역 출입구 신설과 기반시설 확충 / 서편 노선 확정과 기존 상권 정비':'무진항 확장과 냉동설비 국비 지원 / 노후 설비 교체 우선 및 확장 재검토')+'</p></div>':'')+(event(s.q)?'<div class="card event-card"><h3>'+eventName+'</h3><p>준비금 1,800만 원을 내고 입찰합니다. 낙찰 시 다음 분기 5,200만 원을 받습니다.</p>'+button(s.eventAt===s.q?'입찰 신청 완료':'입찰 조건 보기','bid','','secondary',s.eventAt===s.q||s.done)+'</div>':'')+s.log.map(row).join('');
  }
  if(prevTab===tab) $('panel').scrollTop=scroll; else $('panel').scrollTop=0;
  renderTimer();
}
function row(entry){return '<div class="card"><p class="muted">'+player(entry.q)+'</p><h3>'+entry.text+'</h3></div>';}
function asset(a){
  const d=districts[a.district];
  return '<button class="asset" style="--color:'+d.color+'" data-act="asset" data-id="'+a.id+'"><span class="tile">'+d.icon+'</span><span class="asset-info"><b>'+a.name+'</b><small>'+d.type+' · '+(a.owner?'보유 중':d.name)+'</small></span><em>'+money(value(s,a))+'</em></button>';
}
function showMode(){
  dialog('게임 기간 선택','<p>보유 현금 5억 원으로 시작합니다. 분기마다 도시와 자산을 살피고 매입·매각을 결정하세요.</p><div class="mode-row">'+[12,20,40].map(q=>button(q+'분기<small>'+modes[q]+'</small>','mode',q,'secondary '+(q===selected?'active':''))).join('')+'</div><label class="checkbox"><input id="practice" type="checkbox" '+(s.practice?'checked':'')+'> 연습 모드 · 타이머 없이 분기 정산</label>'+(s.started&&!s.done?'<p>새 게임을 시작하면 현재 세션이 교체됩니다.</p>':'')+'<div class="actions">'+button('청운시 입장','start','','gold')+'</div>','mode');
}
function showAsset(a){
  if(!a) return;
  if(a.owner){
    const d=sale(s,a);
    dialog(a.name,'<div class="lines">'+moneyLine('현재 평가액',value(s,a))+moneyLine('분기 순임대수익',a.home?0:a.rent*occ(s,a)*.82)+moneyLine('대출 잔액',a.debt)+moneyLine('예상 양도세 · 지방소득세',d.tax)+moneyLine('매각 후 수령액',d.cash)+'</div><div class="actions">'+button('매각 확인','sell-check',a.id,'gold',s.done)+button('급매 확인','urgent-check',a.id,'secondary',s.done)+'</div><div class="actions">'+(a.district===3?button(a.home?'임대 전환':'실거주 전환','home',a.id,'secondary',s.done):a.rent?button(a.improved?'임대 개선 완료':'임대 설비 개선 · 1,200만 원','improve',a.id,'secondary',s.done||a.improved):'')+'</div>','asset');
  }else{
    const p=purchase(s,a);
    dialog(a.name,'<div class="lines">'+moneyLine('매매대금',p.price)+moneyLine('취득 관련 세금',p.tax)+moneyLine('중개보수',p.fee)+line('예상 공실률',a.rent?pct(1-occ(s,a)):'해당 없음')+moneyLine('현금 매입 시 잔금',p.price+p.tax+p.fee)+moneyLine('대출 활용 시 잔금',p.price+p.tax+p.fee-p.loan)+'</div><label class="checkbox"><input id="fixed" type="checkbox"> 고정금리 '+pct(s.base+.024)+' 선택</label><div class="actions">'+button('현금 매입','buy',a.id,'gold',!s.started||s.done)+button('담보대출로 매입','borrow',a.id,'secondary',!s.started||s.done)+'</div>'+(!s.started?'<p>매입하려면 게임을 먼저 시작하세요.</p>':'')+'<p>세액은 수업용 모형 추정입니다.</p>','asset');
  }
}
function showResult(){
  const t=totals(s);
  const values=[50000,...s.record];
  const lo=Math.min(...values),hi=Math.max(...values,lo+1000);
  const points=values.map((v,i)=>(10+i/(values.length-1)*340)+','+(82-(v-lo)/(hi-lo)*64)).join(' ');
  dialog('최종 결산','<p>'+s.limit+'분기 완료 · 시작 자본 5억 원</p><div class="card"><h3 class="accent">'+money(t.net)+' <small class="'+(t.net>=50000?'gain':'loss')+'">'+sign(t.net/50000-1)+'</small></h3><svg class="chart" viewBox="0 0 360 100" role="img" aria-label="분기별 순자산 추이"><path d="M10 25H350M10 50H350M10 75H350" stroke="#333e31" stroke-width="1"/><polyline points="'+points+'" fill="none" stroke="#f3be65" stroke-width="3" stroke-linejoin="round"/></svg>'+moneyLine('보유 현금',s.cash)+moneyLine('부동산 처분 예상액',t.gross)+moneyLine('진행 중 PF 회수 예상액',t.project)+moneyLine('차감할 부채',t.debt)+moneyLine('차감할 세금·거래비용',t.tax+t.fees)+'</div><div class="card">'+moneyLine('누적 임대소득',s.stats.rent)+moneyLine('누적 이자',s.stats.interest)+moneyLine('누적 납부 세금',s.stats.tax)+'</div><p>어떤 거래가 현금을 가장 크게 바꿨나요? 그때 확인할 수 있었던 단서는 무엇이었나요?</p><div class="actions">'+button('다시 시작','new','','gold')+'</div>','result');
}
function step(automatic=false){
  if(s.done){showResult();return;}
  if(!s.started){selected=s.limit;showMode();return;}
  const open=$('dialog').open;
  if(open)$('dialog').close();
  const prev=s.q;
  Object.assign(s,{fx:live.fx,fxLabel:live.fxLabel});
  advance(s);
  steps--;
  if(automatic&&steps>0&&!s.done&&s.q===prev+1&&!event(s.q)&&!s.news.includes('선거 ·')){
    advance(s);
    toast('두 분기를 정산했습니다.');
  }else if(!s.done)toast(player(prev)+' 정산 완료');
  steps=groupLeft();
  s.deadline=Date.now()+duration()*1000;
  if(s.done)showResult();
  else if(event(s.q)||s.news.includes('선거'))tab='news';
  persist();render();
}
function tabTo(t){tab=t;if(t==='market')district=-1;render();}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b||b.disabled)return;
  if(b.dataset.tab){tabTo(b.dataset.tab);return;}
  const act=b.dataset.act;
  const id=Number(b.dataset.id);
  const a=s.items.find(item=>item.id===id);
  let message, changed=false;
  switch(act){
    case 'new': selected=s.limit;showMode();return;
    case 'mode': {const practice=$('practice').checked;selected=id;showMode();$('practice').checked=practice;return;}
    case 'start': {const practice=$('practice').checked;s=setup(selected);Object.assign(s,{practice,started:true,deadline:Date.now()+duration()*1000,...live});steps=groupLeft();tab='market';district=-1;$('dialog').close();persist();render();toast('청운시에 오신 것을 환영합니다.');return;}
    case 'next':step();return;
    case 'close':$('dialog').close();return;
    case 'zoom-in':
    case 'zoom-out':
      zoom=Math.min(1.35,Math.max(1,zoom+(act==='zoom-in'?.17:-.17)));$('map-content').style.transform='scale('+zoom+')';return;
    case 'filter':
    case 'district': district=id;tab='market';render();$('panel').scrollTop=0;return;
    case 'asset': showAsset(a);return;
    case 'npc': {
      const d=districts[id];
      dialog(d.npc+' · '+d.role,'<p>“'+d.tip+'”</p><div class="actions">'+button('관련 정보 묻기','npc-more',id,'gold')+button('대화 마치기','close')+'</div>','npc');return;
    }
    case 'npc-more': {
      const replies=['“공약 발표 뒤엔 이미 가격이 움직여요. 실제 착공은 시청 도시 소식에서 확인하세요.”','“비어 있는 층을 먼저 확인하세요. 임대료보다 실제 들어오는 돈이 중요합니다.”','“확정 임차계약을 맺으면 사업 매각가의 변동폭을 낮출 수 있어요.”','“유일한 아파트를 2년 이상 보유한 사례와 단기 매각을 비교해 보세요.”'];
      dialog(districts[id].npc,'<p>'+replies[id]+'</p><div class="actions">'+button('관련 화면 열기','npc-go',id,'gold')+'</div>','npc');return;
    }
    case 'npc-go':
      $('dialog').close();tabTo(['news','market','pf','portfolio'][id]);return;
    case 'about':
      dialog('게임 안내 · 데이터 출처','<p>지도에서 생활권을 선택한 뒤 매물이나 NPC를 클릭하세요. 한 분기의 수입과 비용은 분기 정산 버튼으로 확정합니다. 연습 모드에서는 시간이 자동으로 지나가지 않습니다.</p><p>환율은 Frankfurter의 최신 일별 공표값입니다. 한국은행 기준금리는 2026.10.22 결정값을 사용합니다. 실제 환율은 분기 정산 시 적용합니다.</p><p>청운시의 금리 가산, 공시가격, 거래비용과 재산세·양도세·종부세는 수업용 근사입니다. 개별 중과 예외와 공제는 축약했습니다.</p><p><a target="_blank" rel="noopener" href="https://www.bok.or.kr/portal/bbs/P0000559/view.do?menuNo=200690&nttId=11065823">한국은행 통화정책방향</a> · <a target="_blank" rel="noopener" href="https://frankfurter.dev/">Frankfurter 환율 API</a></p>');return;
    case 'buy':
    case 'borrow':
      message=buy(s,a,act==='borrow',$('fixed').checked);changed=true;break;
    case 'sell-check':
    case 'urgent-check': {
      const urgent=act==='urgent-check', d=sale(s,a,urgent);
      dialog(urgent?'급매 조건 확인':'매각 조건 확인','<p>'+a.name+'</p>'+moneyLine('매각가',d.price)+moneyLine('양도 관련 세금',d.tax)+moneyLine('부채 상환 후 현금',d.cash)+'<div class="actions">'+button('매도 확정',urgent?'urgent':'sell',a.id,'gold')+button('돌아가기','asset',a.id)+'</div>','asset');return;
    }
    case 'sell':
    case 'urgent': {
      if(s.cash+sale(s,a,act==='urgent').cash<0){toast('부채 상환에 필요한 현금이 부족합니다.');return;}
      sell(s,a,act==='urgent');changed=true;break;
    }
    case 'home': a.home=!a.home;note(s,a.name+(a.home?' 실거주 전환':' 임대 전환'));changed=true;break;
    case 'improve':
      if(s.cash<1200){toast('설비 개선비가 부족합니다.');return;}
      a.improved=true; s.cash-=1200; a.paid+=1200;note(s,a.name+' 임대 설비 개선');changed=true;break;
    case 'repay':
      dialog('담보대출 원금 상환',moneyLine('대출 잔액',a.debt)+moneyLine('상환 가능 현금',s.cash)+'<div class="actions">'+button('50% 상환','repay-half',a.id,'secondary',s.cash<a.debt/2)+button('전액 상환','repay-all',a.id,'gold',s.cash<a.debt)+'</div>');return;
    case 'repay-half':
    case 'repay-all': {const pay=a.debt*(act==='repay-half'?.5:1);if(s.cash<pay)return;s.cash-=pay;a.debt-=pay;note(s,a.name+' 대출 상환 · '+money(pay));changed=true;break;}
    case 'pf-open':
      dialog('무진항 냉동창고 PF','<p>게임 내 자기자본 3억 원을 내고 공사를 시작합니다. 선임대 확보 시 매각가는 낮아지지만 사업 수익을 안정시킵니다.</p>'+line('선순위 금리',pct(s.base+.039))+'<label class="checkbox"><input type="checkbox" id="tenant" checked> 선임대 계약 확보</label><div class="actions">'+button('출자 및 착공','pf-start','','gold',!s.started||s.done)+'</div>','pf');return;
    case 'pf-start': message=startPF(s,$('tenant').checked);changed=true;break;
    case 'pf-close':
      dialog('냉동창고 지분 회수','<p>대출 원금과 공사비 및 이자를 차감합니다. 중도 회수에는 남은 공사비에 따른 할인도 적용됩니다.</p>'+moneyLine('최종 회수액',pfValue(s))+'<div class="actions">'+button('회수 확정','pf-sell','','gold')+'</div>','pf');return;
    case 'pf-sell':closePF(s);changed=true;break;
    case 'bid':
      dialog('긴급 입찰','<p>입찰 준비금은 1,800만 원입니다. 낙찰 시 다음 분기 5,200만 원을 받고, 탈락하면 준비금을 잃습니다.</p><div class="actions">'+button('입찰 참여','bid-confirm','','gold',!s.started||s.done)+'</div>');return;
    case 'bid-confirm':message=resolveEvent(s);changed=true;break;
  }
  if(message){toast(message);return;}
  if(changed){$('dialog').close();persist();render();toast(s.log[0]?.text||'거래를 반영했습니다.');}
});
$('dialog').addEventListener('click',e=>{if(e.target===$('dialog'))$('dialog').close();});
setInterval(()=>{
  renderTimer();
  if(s.started&&!s.done&&!s.practice&&Date.now()>=s.deadline)step(true);
},300);
if(s.started&&!s.done&&s.deadline<Date.now()){s.deadline=Date.now()+duration()*1000;persist();}
render();currentFx();loadFx();
setInterval(loadFx,120000);
