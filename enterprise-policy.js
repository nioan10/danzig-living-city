(function(root){
  'use strict';
  const Mind=typeof module!=='undefined'&&module.exports?require('./citizen-mind.js'):root.DanzigMind;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),round=n=>Math.round(n*100)/100;
  const LABELS={steady:'Обычная работа',recruit:'Привлечь работников',retain:'Удержать мастеров',clearance:'Распродать излишки',recover:'Восстановить оборот',pause:'Сократить выпуск',repair:'Восстановить двор'};
  function ensure(s,b){return b.management??={since:s.day,lastDay:s.day,mode:'steady',reason:'Наблюдает за хозяйством',history:[],samples:[],lastWorkers:s.workers(b.id).length,recruitUntil:0,outputScale:1,pausedUntil:0};}
  function review(s,b,market){
    const m=ensure(s,b),e=b.enterprise;if(m.lastDay===s.day)return;m.lastDay=s.day;
    const owner=s.person(b.ownerId),v=owner?.mind?.personality||{},workers=s.workers(b.id),r=s.productionRecipe(b),rivals=s.buildings.filter(q=>q.type===b.type&&!q.construction).length;
    if(!r)return;const share=Math.max(1,(market[r.out]||1)/rivals),days=b.stock[r.out]/share,loss=e.lastProfit<0;
    m.samples.push({day:s.day,profit:e.lastProfit,sales:e.revenue,workers:workers.length,stock:b.stock[r.out]});m.samples=m.samples.slice(-6);
    const losses=m.samples.filter(x=>x.profit<0).length,vacancies=s.jobSlots(b)-workers.length,departed=workers.length<m.lastWorkers;
    let mode='steady',reason='Доходы и штат позволяют продолжать работу',wage=e.baseWage,price=clamp(1+(1-days)*.045-(rivals-1)*.025,.86,1.14);m.outputScale=1;
    if(b.damaged){mode='repair';reason='Повреждение остановило продажи и работу';}
    else if(days>4){mode=losses>=3?'pause':'clearance';reason=`На складе запас примерно на ${Math.ceil(days)} дней; снижаю цену и выпуск`;price=.86;m.outputScale=mode==='pause'?.45:.75;}
    else if(departed&&b.cash>workers.length*b.wage*12+40){mode='retain';reason='Ушёл работник; повышаю ставку оставшимся и новым мастерам';wage=e.baseWage*(1.16+(v.loyalty||.5)*.12);m.recruitUntil=s.day+3;}
    else if(vacancies&&b.cash>Math.max(50,b.wage*(workers.length+1)*12)){mode='recruit';reason='Есть спрос, средства и незанятые рабочие места';wage=e.baseWage*(1.15+(v.ambition||.5)*.12);m.recruitUntil=s.day+3;}
    else if(b.cash<12&&losses>=2){mode='recover';reason='Не хватает оборотных средств; ищу вклад партнёра или предоплату';price=Math.min(price,.94);}
    else if(m.recruitUntil>s.day)wage=Math.max(b.wage,e.baseWage*1.12);
    b.wage=round(clamp(b.wage+clamp(wage-b.wage,-.025,.07),e.baseWage*.95,e.baseWage*1.4));
    e.priceFactor=round(clamp(e.priceFactor+clamp(price-e.priceFactor,-.035,.025),.86,1.14));
    if(mode!==m.mode){m.history.unshift({day:s.day,mode,reason,wage:b.wage,price:e.priceFactor});m.history=m.history.slice(0,8);if(s.day-m.since>=2&&mode!=='steady')s.log(`${b.name}: ${reason.toLowerCase()}.`,'economy',owner?.id||null,{title:'Решение владельца: '+LABELS[mode],buildingId:b.id});}
    m.mode=mode;m.reason=reason;m.lastWorkers=workers.length;
  }
  function factor(b){return b.management?.outputScale??1;}
  function candidates(s,p,add,step){
    if(p.age<16||p.absence||p.cargo||s.hour<6||s.hour>=21||s.day-(p.lastInvestmentDay??-100)<3)return;
    const reserve=Math.max(30,Mind.household(s,p).expense*4);if(p.coins-reserve<10)return;
    const b=s.buildings.find(b=>b.ownerId===p.id&&s.productionRecipe(b)&&!b.construction&&b.cash<18&&!s.overstock(b));if(!b)return;
    add('invest','Вернуть собственный двор к заработку',87,'У меня есть личный запас сверх семейного резерва. Внесу часть в оборот мастерской',[step('invest',b.id,'Внести собственные оборотные средства',{duration:30})]);
  }
  function invest(s,p,b){
    if(b.ownerId!==p.id||!s.productionRecipe(b)||b.construction||s.day-(p.lastInvestmentDay??-100)<3)return{ok:false,message:'Вложение сейчас недоступно.'};
    const reserve=Math.max(30,Mind.household(s,p).expense*4),amount=Math.max(0,Math.min(30,40-b.cash,p.coins-reserve));if(amount<1)return{ok:false,message:'Свободного личного капитала больше нет.'};
    p.coins-=amount;b.cash+=amount;p.lastInvestmentDay=s.day;if(b.enterprise)b.enterprise.openingCash+=amount;
    s.log(`${p.name} внёс ${amount.toFixed(1)} тал. собственных сбережений в ${b.name}, сохранив семейный резерв.`,'economy',p.id,{title:'Владелец поддержал свой двор',buildingId:b.id});return{ok:true};
  }
  function load(s){for(const b of s.buildings.filter(b=>s.productionRecipe(b))){const m=ensure(s,b);if(!Object.hasOwn(LABELS,m.mode)||!Array.isArray(m.history)||m.history.length>8||!Array.isArray(m.samples)||m.samples.length>6||!['since','lastDay','lastWorkers','recruitUntil','pausedUntil','outputScale'].every(k=>Number.isFinite(m[k])&&m[k]>=0)||m.outputScale<.4||m.outputScale>1)throw Error('Некорректная стратегия мастерской');}}
  const api={LABELS,ensure,review,factor,candidates,invest,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigEnterprisePolicy=api;
})(typeof window!=='undefined'?window:globalThis);
