(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const H=node?require('./housing.js'):root.DanzigHousing,E=node?require('./expansion.js'):root.DanzigExpansion;
  const W=node?require('./world.js'):root.DanzigWorld,R=node?require('./residences.js'):root.DanzigResidences;
  const active=a=>['pending','building','ready'].includes(a.status);
  function ensure(s){return (s.housing||H.ensure(s)).projects??={nextId:1,applications:[]};}
  function current(s,group){const ids=new Set(group.map(p=>p.id));return ensure(s).applications.find(a=>active(a)&&a.members.some(id=>ids.has(id)));}
  function wallets(s,group){
    const adults=group.filter(p=>p.age>=18&&!p.absence),dependents=group.filter(p=>p.age<18).length;
    const foodPrice=Math.min(s.commerce.prices.bread,s.commerce.prices.fish);
    return adults.map(p=>({person:p,reserve:Math.max(12,(1+dependents/Math.max(1,adults.length))*1.15*foodPrice*(2+(p.mind?.personality?.caution??.5)*2))}));
  }
  function funds(s,group){return wallets(s,group).reduce((n,w)=>n+Math.max(0,w.person.coins-w.reserve),0);}
  function proposal(s,p){
    const group=H.movingFamily(s,p),origin=s.building(p.homeId),taken=new Set(ensure(s).applications.filter(active).map(a=>a.lotId));
    const choices=W.expansionLots.filter(l=>!s.building(l.id)&&!taken.has(l.id)).flatMap(l=>E.options(s,l).filter(o=>o.type==='home'&&o.capacity>=group.length&&R.eligible({...l,residence:o.residence},group)).map(o=>({...o,lotId:l.id,distance:Math.hypot(l.x-origin.x,l.y-origin.y)})));
    choices.sort((a,b)=>a.cost-b.cost||a.distance-b.distance||a.lotId.localeCompare(b.lotId));
    const choice=choices[0],available=funds(s,group);
    if(!choice)return {available,reason:'Нет свободного участка под дом нужной вместимости и сословия.'};
    const total=choice.cost*(1+(s.guilds?.permitRate||0)/100);
    return {...choice,total,available,reason:available+1e-8>=total?'Деньги собраны: нужно отнести заявку в ратушу.':`Собираем на дом: ${available.toFixed(0)} из ${total.toFixed(0)} тал. сверх запаса на жизнь.`};
  }
  function sync(s){
    for(const a of ensure(s).applications.filter(active)){
      const p=s.person(a.personId),b=s.building(a.lotId);
      if(a.status==='pending'&&(!p?.alive||s.day-a.day>12)){a.status='cancelled';a.reason=p?.alive?'Заявку нужно обновить.':'Заявитель умер.';continue;}
      if(a.status==='building'&&b&&!b.construction){a.status='ready';a.readyDay=s.day;a.reason='Дом готов; семья собирается переехать.';}
      if(a.status==='ready'){
        const living=a.members.map(id=>s.person(id)).filter(p=>p?.alive);
        if(living.some(p=>p.homeId===a.lotId)){a.status='settled';a.reason='Семья заселилась.';}
        else if(!living.length||s.day-a.readyDay>24){a.status='released';a.reason='Срок ожидания семьи истёк; дом остаётся собственностью владельца.';}
      }
    }
  }
  function review(s){
    sync(s);for(const p of s.living){p.homeProject=null;const group=H.movingFamily(s,p),a=current(s,group);
      if(a){p.homeProject={applicationId:a.id,status:a.status,reason:a.reason,lotId:a.lotId};continue;}
      if(p.housingWish&&!p.housingWish.to)p.homeProject={status:'saving',...proposal(s,p)};
    }
  }
  function candidates(s,p,add,step){
    const wish=p.housingWish;if(!wish||wish.to||p.age<18||!H.available(H.movingFamily(s,p))||current(s,H.movingFamily(s,p))||s.hour<7||s.hour>=19||p.hunger<35||p.energy<25||p.health<30)return;
    const q=proposal(s,p);if(!q.lotId||q.available+1e-8<q.total)return;
    add('homeBuild','Построить дом для семьи',Math.min(110,62+wish.penalty*1.5),'Готового жилья нет. '+q.name+': '+q.total.toFixed(0)+' тал. с разрешением; запас на жизнь остаётся.',[step('homeApply','hall','Подать заявку на семейный дом',{duration:40,lotId:q.lotId,value:q.value})]);
  }
  function apply(s,p,action){
    if(p.location!=='hall'||p.age<18||p.absence||!p.alive)return {ok:false,message:'Заявитель должен прийти в ратушу.'};
    H.review(s);const group=H.movingFamily(s,p),q=proposal(s,p);
    if(current(s,group))return {ok:false,message:'У семьи уже есть заявка или стройка.'};
    if(!p.housingWish||p.housingWish.to||!H.available(group)||!q.lotId||q.lotId!==action.lotId||q.value!==action.value||q.available+1e-8<q.total)return {ok:false,message:'Условия изменились: нужно заново выбрать жильё или накопить средства.'};
    const v=ensure(s),a={id:v.nextId++,personId:p.id,members:group.map(q=>q.id),lotId:q.lotId,value:q.value,day:s.day,status:'pending',reason:'Заявка в ратуше; деньги пока у семьи.'};v.applications.push(a);
    s.log(`${p.name} просит разрешение на семейный дом: ${q.total.toFixed(0)} тал., ${group.length} жильцов.`,'family',p.id,{title:'Семья планирует дом',buildingId:'hall'});review(s);return {ok:true,message:a.reason};
  }
  function decide(s,id,allow=true){
    const a=ensure(s).applications.find(a=>a.id===Number(id)&&a.status==='pending');if(!a)return {ok:false,message:'Заявка уже рассмотрена.'};
    if(!allow){a.status='rejected';a.reason='Ратуша отказала в разрешении.';review(s);return {ok:true,message:a.reason};}
    const p=s.person(a.personId);H.review(s);const group=p?.alive?H.movingFamily(s,p):[];
    if(!p?.alive||!p.housingWish||p.housingWish.to||s.building(a.lotId)){a.status='cancelled';a.reason='Потребность в стройке или участок изменились.';return {ok:false,message:a.reason};}
    const result=E.build(s,a.lotId,a.value,null,{owner:p,members:group,wallets:wallets(s,group)});
    if(!result.ok){a.reason=result.message;return result;}
    a.status='building';a.members=group.map(q=>q.id);a.reason='Разрешение получено. Оплаченный подряд ждёт материалы и строителей.';
    const official=s.governmentOfficer?.('seneschal');s.recordGovernment?.('seneschal',official,`Разрешён дом семьи ${p.surname}. Стройку оплачивают владельцы.`,true);review(s);return {ok:true,message:a.reason};
  }
  function daily(s){
    sync(s);if(s.guilds?.permitMode==='auto'&&s.governmentOfficer?.('seneschal'))for(const a of ensure(s).applications.filter(a=>a.status==='pending'))decide(s,a.id);
    review(s);
  }
  function saving(s,members){
    // A goal, not a second wallet: food, fuel and worn clothes remain accessible.
    const plans=members.map(p=>p.homeProject).filter(q=>q?.status==='saving'&&q.total);
    const pending=ensure(s).applications.filter(a=>a.status==='pending'&&a.members.some(id=>members.some(p=>p.id===id))).map(a=>{const l=W.expansionLots.find(l=>l.id===a.lotId),q=E.options(s,l).find(q=>q.value===a.value);return q.cost*(1+(s.guilds?.permitRate||0)/100);});
    return Math.max(0,...plans.map(q=>q.total),...pending);
  }
  function describe(s,p){const a=current(s,H.movingFamily(s,p));if(a){const b=s.building(a.lotId);return a.status==='building'?`Строим свой дом: ${b?.construction?.local?.reason||a.reason}`:a.reason;}return p.homeProject?.reason||'';}
  function load(s){
    const v=ensure(s),ids=new Set();if(!Number.isInteger(v.nextId)||v.nextId<1||!Array.isArray(v.applications))throw Error('Некорректные жилищные проекты');
    for(const a of v.applications){const lot=W.expansionLots.find(l=>l.id===a.lotId),choice=lot&&E.options(s,lot).find(q=>q.value===a.value&&q.type==='home');
      if(!Number.isInteger(a.id)||a.id<1||a.id>=v.nextId||ids.has(a.id)||!s.person(a.personId)||!Array.isArray(a.members)||!a.members.length||!a.members.every(id=>s.person(id))||new Set(a.members).size!==a.members.length||!choice||!Number.isInteger(a.day)||a.day<0||a.day>s.day||!['pending','building','ready','settled','rejected','cancelled','released'].includes(a.status)||['building','ready','settled','released'].includes(a.status)&&s.building(a.lotId)?.type!=='home'||a.status==='ready'&&(!Number.isInteger(a.readyDay)||a.readyDay>s.day||a.readyDay<0))throw Error('Некорректная заявка на семейный дом');ids.add(a.id);
    }
    // Display-only proposals can be recomputed; do not mutate valid plans on load.
    for(const p of s.people)if(p.homeProject?.total!==undefined&&(!Number.isFinite(p.homeProject.total)||p.homeProject.total<0))throw Error('Некорректные накопления на дом');
  }
  const api={ensure,current,wallets,funds,proposal,sync,review,candidates,apply,decide,daily,saving,describe,load};if(node)module.exports=api;else root.DanzigHousingProjects=api;
})(typeof window!=='undefined'?window:globalThis);
