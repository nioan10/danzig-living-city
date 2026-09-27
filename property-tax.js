(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports,W=node?require('./world.js'):root.DanzigWorld,H=node?require('./housing.js'):root.DanzigHousing;
  const exempt=new Set(['hall','school','clinic','church','dock']);
  const round=n=>Math.round(n*100)/100;
  function ensure(s){const day=Number.isFinite(s.day)?s.day:0;s.fiscal.property??={sinceDay:day,lastDay:day,nextReview:day+1,enabled:true,auto:s.fiscal.autoMayor!==false,rate:1,assessed:0,paid:0,relief:0,records:{},lastReview:null};return s.fiscal.property;}
  function owner(s,b){const p=s.person(b.ownerId);return p?.alive&&p.age>=18&&p.homeId===b.id?p:s.living.filter(p=>p.age>=18&&p.homeId===b.id).sort((a,b)=>b.age-a.age||a.id-b.id)[0];}
  function wallets(s,b){
    if(b.type==='home'){const p=owner(s,b);return p?H.family(s,p).filter(p=>p.alive&&p.age>=18).map(p=>({target:p,key:'coins',reserve:60})):[];}
    const r=s.productionRecipe(b),inputs=r?Object.entries(r.inputs).reduce((n,[g,a])=>n+a*s.commerce.prices[g]*4,0):0;
    return[{target:b,key:'cash',reserve:Math.max(30,s.workers(b.id).length*b.wage*8+inputs)}];
  }
  function quote(s,b){
    const p=ensure(s),level=b.development?.level||1,inside=W.insideTown(b.x,b.y),area=Math.max(.75,Math.min(1.5,b.w*b.h/(54*42))),units=Math.round(area*4)/4;
    const exemption=exempt.has(b.type)?'Общественная служба: освобождена':b.construction?'Строительство ещё не завершено':!s.isOpen(b)?'Двор временно не работает':b.type==='home'&&!owner(s,b)?'Нет взрослого хозяина':'';
    const assessed=!p.enabled||exemption?0:round(p.rate*level*units*H.district(b).tax*(b.type==='home'?H.residenceSpec(b).tax:1));
    const available=wallets(s,b).reduce((n,w)=>n+Math.max(0,w.target[w.key]-w.reserve),0),paid=Math.min(assessed,Math.floor((available+1e-8)*100)/100);
    return{assessed,paid,relief:round(assessed-paid),level,units,inside,exemption:exemption||(!p.enabled?'Сбор отменён':paid<assessed?'Льгота: защищены деньги на жизнь и работу':'')};
  }
  function daily(s){
    const p=ensure(s);if(p.lastDay>=s.day||s.conclusion)return;p.lastDay=s.day;let assessed=0,paid=0,relief=0;
    for(const b of s.buildings){const q=quote(s,b);let left=q.paid;for(const w of wallets(s,b)){const amount=Math.min(left,Math.max(0,w.target[w.key]-w.reserve));w.target[w.key]-=amount;left-=amount;if(left<1e-8)break;}
      const actual=q.paid-left;if(actual)s.changeTreasury(actual,'property');
      const previous=p.records[b.id];p.records[b.id]={day:s.day,assessed:q.assessed,paid:actual,relief:q.relief,exemption:q.exemption,total:(previous?.total||0)+actual};assessed+=q.assessed;paid+=actual;relief+=q.relief;
    }
    p.assessed+=assessed;p.paid+=paid;p.relief+=relief;p.latest={day:s.day,assessed,paid,relief};
    if(p.enabled&&paid>0)s.log(`Дворы перечислили ${round(paid)} тал. за участки и недвижимость. Льготы для стеснённых хозяйств: ${round(relief)} тал.`,'economy',null,{title:'Городской сбор с дворов',buildingId:'hall'});
  }
  function review(s,budget){const p=ensure(s);if(!p.auto||s.day<p.nextReview)return;p.nextReview=s.day+3;const actor=s.governmentOfficer?.('treasurer')||s.person(s.mayorId);if(!actor?.alive||actor.absence)return;
    const before=p.rate,wasEnabled=p.enabled,distressed=p.latest?.assessed>0&&p.latest.relief/p.latest.assessed>.6;
    if(s.region.debt||s.treasury<budget.reserve||budget.days>=3&&budget.net<0){p.rate=Math.min(distressed?Math.max(1.25,p.rate):3,Math.max(.5,p.rate)+.25);p.enabled=true;}
    else if(budget.days>=6&&budget.sustainableNet>10&&s.fiscal.spending.capital.balance>=budget.capitalTarget&&s.treasury>budget.reserve+budget.capitalTarget+100&&!s.fiscal.infrastructure.arrears)p.rate=Math.max(.5,p.rate-.25);
    p.lastReview={day:s.day,reason:distressed?'Многие хозяйства нуждаются в льготах: не усиливаю нагрузку сверх текущего предела.':p.rate>before?'Повышаю сбор с обеспеченных дворов для покрытия обязательств.':p.rate<before?'Казна имеет запас: снижаю сбор.':'Сохраняю ставку сбора с дворов.'};
    if(before!==p.rate||wasEnabled!==p.enabled)s.log(`${actor.name}: сбор с дворов ${p.rate} тал. за единицу площади и уровень в день. ${p.lastReview.reason}`,'politics',actor.id,{title:'Ставка сбора за городской участок',buildingId:'hall'});
  }
  function configure(s,data){const value=Number(data.rate);if(!Number.isFinite(value)||value<0||value>5)return{ok:false,message:'Ставка должна быть от 0 до 5 талеров.'};const p=ensure(s);p.rate=value;p.enabled=data.enabled===true&&value>0;p.auto=data.auto===true;p.nextReview=s.day+1;s.log(`Сбор с дворов ${p.enabled?p.rate+' тал. за площадь и уровень в день':'отменён'}. ${p.auto?'Ставку пересматривает магистрат.':'Ставка закреплена указом.'}`,'politics',null,{title:'Правила налогообложения дворов',buildingId:'hall'});return{ok:true,message:'Правила применятся к следующему ежедневному сбору.'};}
  function load(s){const p=ensure(s),finite=n=>Number.isFinite(n)&&n>=0;if(!['sinceDay','lastDay','nextReview','rate','assessed','paid','relief'].every(k=>finite(p[k]))||p.rate>5||typeof p.enabled!=='boolean'||typeof p.auto!=='boolean'||!p.records||Array.isArray(p.records))throw Error('Некорректный сбор с дворов');if(p.latest&&!['day','assessed','paid','relief'].every(k=>finite(p.latest[k])))throw Error('Некорректный итог сбора с дворов');for(const[id,r]of Object.entries(p.records))if(!s.building(id)||!['day','assessed','paid','relief','total'].every(k=>finite(r[k])))throw Error('Некорректная ведомость дворов');}
  const api={ensure,quote,wallets,daily,review,configure,load};if(node)module.exports=api;else root.DanzigPropertyTax=api;
})(typeof window!=='undefined'?window:globalThis);
