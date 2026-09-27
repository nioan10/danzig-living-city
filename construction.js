(function(root){
  'use strict';
  const Finance=typeof module!=='undefined'&&module.exports?require('./finance.js'):root.DanzigFinance;
  const sum=o=>Object.values(o).reduce((a,b)=>a+b,0),finite=n=>Number.isFinite(n)&&n>=0;
  function ensure(s){return s.works??={version:1,nextId:1,sinceDay:s.day,spent:0,local:0,wages:0,completed:0,consumed:{}};}
  function contracts(s){return s.buildings.flatMap(b=>[b.construction,b.development?.project].filter(p=>p?.local).map(p=>({b,p,q:p.local})));}
  const find=(s,id)=>contracts(s).find(x=>x.q.id===id);
  function start(s,b,p,payers,capital=0){
    const money=Math.max(0,p.cost-capital),weights={wood:.15,planks:.25,beams:.2,nails:.15,tiles:.25},needs={};
    for(const [g,w]of Object.entries(weights))needs[g]=Math.max(1,Math.floor(money*.32*w/s.commerce.prices[g]));
    p.local={version:1,id:ensure(s).nextId++,cash:p.cost,capital,budget:p.cost,needs,stock:{},work:0,required:Math.max(180,(p.days||Math.max(1,(p.until-s.now)/1440))*180),wage:1.65,materialSpent:0,wages:0,payers,reason:'Ищем местных поставщиков и работников'};
    return p.local;
  }
  function incoming(s,id,g){return s.alive.filter(p=>p.constructionCargo?.jobId===id&&p.constructionCargo.good===g).reduce((n,p)=>n+p.constructionCargo.amount,0);}
  function available(s,q){const shipping=s.alive.filter(p=>p.constructionCargo?.jobId===q.id).reduce((n,p)=>n+p.constructionCargo.minutes*q.wage/60,0);return Math.max(0,q.cash-q.capital-(q.required-q.work)/60*q.wage-shipping-4);}
  function missing(s,q){return Object.entries(q.needs).map(([good,n])=>({good,amount:Math.max(0,n-(q.stock[good]||0)-incoming(s,q.id,good))})).filter(x=>x.amount>.001);}
  const ready=q=>Object.entries(q.needs).every(([g,n])=>(q.stock[g]||0)+1e-7>=n);
  function demand(s){const d={};for(const {q}of contracts(s))for(const x of missing(s,q))d[x.good]=(d[x.good]||0)+x.amount/4;return d;}
  function candidates(s,p,add,step){
    if(p.constructionCargo){const c=p.constructionCargo;add('constructionDelivery','Доставить груз на стройку',97,'Оплаченные материалы ждут на строительной площадке',[step('buildDeliver',c.siteId,'Передать материалы подрядчику',{duration:10,jobId:c.jobId})]);return;}
    if(s.works?.nextId===s.works?.completed+1)return;
    if(p.age<16||p.age>=65||p.absence||p.cargo||p.householdParcel||p.arriving||p.relocation||p.hunger<40||p.energy<35||s.hour<7||s.hour>=20)return;
    const sites=contracts(s).filter(({q,b})=>q.cash>q.capital+1&&!b.damaged).sort((a,b)=>s.travelMinutes(p,a.b.id)-s.travelMinutes(p,b.b.id));
    for(const {b,q}of sites.slice(0,3)){
      const opportunities=missing(s,q);
      for(const need of opportunities){
        if(s.alive.some(x=>x.id!==p.id&&x.plan?.steps.some(a=>a.kind==='buildPickup'&&a.jobId===q.id&&a.good===need.good)))continue;
        const offer=s.suppliers(p,need.good,1).filter(o=>!s.recentFailure(p,o.id,'empty')).sort((a,z)=>a.score-z.score)[0];if(!offer)continue;
        const amount=Math.min(12,Math.ceil(need.amount),Math.floor(available(s,q)/offer.price));if(amount<1)continue;
        const job=s.building(p.jobId),score=!job||!s.canProduce(job)||job.cash<job.wage?72:34+(p.work>=180?24:0);
        add('constructionSupply','Подработать на доставке стройматериалов',score,`${b.name}: нужны ${s.goodName(need.good).toLowerCase()}. Оплата доставки из денег подряда`,[step('buildPickup',offer.id,'Получить материалы',{duration:15,jobId:q.id,good:need.good,amount,siteId:b.id}),step('buildDeliver',b.id,'Доставить на стройку',{duration:10,jobId:q.id})]);break;
      }
      if(ready(q)&&q.work<q.required){const job=s.building(p.jobId);add('constructionWork','Заработать на строительстве',!job||!s.canProduce(job)||job.cash<job.wage?74:36+(p.work>=180?24:0),`${b.name}: материалы собраны; ${q.wage.toFixed(2)} тал. за час работы`,[step('buildWork',b.id,'Строить',{duration:90,jobId:q.id})]);}
    }
  }
  function pay(s,p,q,minutes){const gross=Math.min(q.cash-q.capital,Math.max(0,minutes)*q.wage/60);if(gross<=0)return 0;q.cash-=gross;q.wages+=gross;ensure(s).wages+=gross;Finance.wage(s,p,gross);p.work+=minutes;return gross;}
  function execute(s,p,action,dt){
    const item=find(s,action.jobId),q=item?.q,b=item?.b;
    if(action.kind==='buildDeliver'){
      const c=p.constructionCargo;if(!c)return {ok:false,message:'Материалы не получены'};
      if(p.location!==c.siteId)return {ok:false,message:'Нужно добраться до стройки'};
      if(q){q.stock[c.good]=(q.stock[c.good]||0)+c.amount;pay(s,p,q,c.minutes);}else{const home=s.building(c.siteId);home.stock[c.good]=(home.stock[c.good]||0)+c.amount;}
      p.constructionCargo=null;s.deliveries++;return {ok:true};
    }
    if(!q||b.damaged||p.age<16||p.absence)return {ok:false,message:'Подряд сейчас недоступен'};
    if(action.kind==='buildWork'){
      if(p.location!==b.id||!ready(q))return {ok:false,message:'Сначала нужно доставить материалы'};
      const minutes=Math.min(dt,q.required-q.work,Math.max(0,q.cash-q.capital)*60/q.wage);if(minutes<=0)return {ok:false,message:'Работы выполнены или бюджет исчерпан'};
      pay(s,p,q,minutes);q.work+=minutes;return {ok:true};
    }
    const seller=s.building(action.target);if(!seller||p.location!==seller.id||!s.isOpen(seller)||p.constructionCargo)return {ok:false,message:'Нет доступа к поставщику'};
    const reserved=s.commerce.orders.filter(o=>o.seller===seller.id&&o.good===action.good).reduce((n,o)=>n+o.amount,0),need=missing(s,q).find(x=>x.good===action.good),price=s.price(seller,action.good),amount=Math.min(action.amount,Math.ceil(need?.amount||0),Math.floor(Math.max(0,seller.stock[action.good]-reserved)),Math.floor(available(s,q)/price));
    if(amount<1)return {ok:false,message:'Материал, потребность или бюджет изменились'};
    const cost=amount*price;q.cash-=cost;q.materialSpent+=cost;ensure(s).local+=cost;seller.stock[action.good]-=amount;Finance.sale(s,seller,cost,false,{good:action.good,amount});
    p.constructionCargo={jobId:q.id,siteId:b.id,good:action.good,amount,minutes:Math.min(90,25+s.travelMinutes(p,b.id))};return {ok:true};
  }
  function finish(s,b,p){
    const q=p.local;if(!q)return true;
    if(!ready(q)||q.work+1e-7<q.required||s.alive.some(x=>x.constructionCargo?.jobId===q.id)){q.reason=!ready(q)?available(s,q)<1?'Не хватает денег в смете; новые закупки приостановлены':'Ждём местные материалы':q.work<q.required?'Материалы на месте; не хватает выполненной работы':'Ждём перевозчика';return false;}
    const w=ensure(s);for(const [g,n]of Object.entries(q.needs)){q.stock[g]-=n;w.consumed[g]=(w.consumed[g]||0)+n;s.statistics.consumption[g]=(s.statistics.consumption[g]||0)+n;}
    for(const [g,n]of Object.entries(q.stock))b.stock[g]=(b.stock[g]||0)+Math.max(0,n);
    const refund=Math.max(0,q.cash-q.capital),total=q.payers.reduce((n,x)=>n+x.amount,0);for(const x of q.payers){const amount=refund*x.amount/Math.max(.01,total);if(x.type==='city')s.changeTreasury(amount,'constructionRefund');else if(x.type==='person'){const target=s.person(x.id);if(target)target.coins+=amount;else s.changeTreasury(amount,'constructionRefund');}else if(x.type==='guild'){const target=s.guilds.groups.find(g=>g.id===x.id);if(target)target.cash+=amount;else s.changeTreasury(amount,'constructionRefund');}else s.building(x.id).cash+=amount;}
    b.cash+=q.capital;w.spent+=q.budget-refund;w.completed++;return true;
  }
  function recover(s,p){const c=p.constructionCargo;if(!c)return;const q=find(s,c.jobId)?.q;if(q)q.stock[c.good]=(q.stock[c.good]||0)+c.amount;else s.building(c.siteId).stock[c.good]+=c.amount;p.constructionCargo=null;}
  function load(s){const w=ensure(s);if(w.version!==1||!Number.isInteger(w.nextId)||w.nextId<1||!['sinceDay','spent','local','wages','completed'].every(k=>finite(w[k]))||!Object.values(w.consumed).every(finite))throw Error('Некорректный строительный учёт');const ids=new Set();for(const {q}of contracts(s)){if(q.version!==1||ids.has(q.id)||!Number.isInteger(q.id)||q.id<1||q.id>=w.nextId||!['cash','capital','budget','work','required','wage','materialSpent','wages'].every(k=>finite(q[k]))||q.required<=0||q.wage<=0||q.budget<q.capital||q.work>q.required+1e-7||q.cash<q.capital-1e-7||Math.abs(q.cash+q.materialSpent+q.wages-q.budget)>1e-5||!q.needs||!q.stock||!Object.entries({...q.needs,...q.stock}).every(([g,n])=>g in s.commerce.prices&&finite(n))||!Array.isArray(q.payers)||!q.payers.length||!q.payers.every(x=>finite(x.amount)&&(['city'].includes(x.type)||x.type==='person'&&s.person(x.id)||x.type==='guild'&&s.guilds.groups.some(g=>g.id===x.id)||x.type==='building'&&s.building(x.id))))throw Error('Некорректный местный подряд');ids.add(q.id);}for(const p of s.people){const c=p.constructionCargo;if(c&&(!ids.has(c.jobId)||find(s,c.jobId).b.id!==c.siteId||!(c.good in s.commerce.prices)||!finite(c.amount)||c.amount<=0||!finite(c.minutes)))throw Error('Некорректный строительный груз');}}
  const api={ensure,contracts,find,start,missing,ready,demand,candidates,execute,finish,recover,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigConstruction=api;
})(typeof window!=='undefined'?window:globalThis);
