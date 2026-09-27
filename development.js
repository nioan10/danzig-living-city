(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Housing=node?require('./housing.js'):root.DanzigHousing;
  const Construction=node?require('./construction.js'):root.DanzigConstruction;
  const COSTS={home:{second:600,third:2400,extra:180},production:{second:900,third:3600,extra:270},service:{second:750,third:3000,extra:225},hall:{second:1600,third:6400,extra:320}};
  const PACE={second:{settle:6,build:6},third:{settle:24,build:12},extra:{settle:3,build:[3,4,6]}};
  const HALL={1:{name:'Малая ратуша',population:0,cost:0},2:{name:'Городской магистрат',population:64,cost:COSTS.hall.second},3:{name:'Большая ратуша',population:96,cost:COSTS.hall.third}};
  const EXTRAS={
    home:[['Тёплая печь','Восстановление сил дома +15%'],['Колодец во дворе','Восстановление здоровья дома +20%'],['Жилая мансарда','Ещё 2 места без тесноты']],
    production:[['Новые инструменты','Скорость производства +12%'],['Место подмастерья','Ещё 1 рабочее место'],['Бережливое ремесло','Сырьё −10%, износ инструментов −30%']],
    service:[['Удобное помещение','Эффективность услуги +10%'],['Приёмная для посетителей','Эффективность услуги ещё +10%'],['Мастерская при службе','Эффективность услуги ещё +10%']],
    hall:[['Архив распоряжений','Содержание ратуши −10%'],['Счётная палата','Содержание ратуши ещё −10%'],['Зал городского совета','Содержание ратуши ещё −10%']]
  };
  const publicTypes=['hall','school','clinic','dock'];
  const kind=(s,b)=>b.type==='home'?'home':b.type==='hall'?'hall':s.productionRecipe(b)?'production':'service';
  const level=b=>b?.development?.level||1;
  const has=(b,n)=>!!b?.development?.extras.includes(n);
  function ensure(s){
    s.development??={sinceDay:s.day,auto:true,lastDay:s.day-1,started:0,completed:0,spent:0,history:[]};
    for(const b of s.buildings){b.development??={level:1,extras:[],project:null,assessment:'Владелец оценит потребность следующим утром.'};b.development.progression??={levelSince:s.now,nextAt:s.now,observedDay:s.day,lastCash:b.cash,wasConstructing:!!b.construction,samples:[]};}
    return s.development;
  }
  function owner(s,b){
    if(publicTypes.includes(b.type))return s.governmentOfficer?.(b.type==='dock'?'port':'mayor')||s.person(s.mayorId);
    const g=s.guilds?.groups.find(g=>g.id===b.guildId);if(g)return s.person(g.leaderId);
    return s.person(b.ownerId);
  }
  function inheritance(s){
    for(const b of s.buildings){
      if(publicTypes.includes(b.type)||b.guildId||b.construction)continue;
      const old=s.person(b.ownerId);if(old?.alive&&(b.type!=='home'||old.homeId===b.id))continue;
      const candidates=s.living.filter(p=>p.age>=18&&(b.type==='home'?p.homeId===b.id:p.jobId===b.id));
      candidates.sort((a,b)=>Number(b.parents.includes(old?.id))-Number(a.parents.includes(old?.id))||b.age-a.age||a.id-b.id);
      b.ownerId=candidates[0]?.id||null;
      if(old&&b.ownerId)s.log(`${s.person(b.ownerId).name} принимает заботу о дворе «${b.name}».`,'development',b.ownerId,{title:'Хозяйство перешло преемнику',buildingId:b.id});
    }
  }
  function wallets(s,b){
    if(publicTypes.includes(b.type))return[{target:s,key:'treasury',reserve:Math.max(100,s.regionBill()+s.region.debt+40,s.fiscal.spending?.plan? s.fiscal.spending.plan.reserve+Object.entries(s.fiscal.spending.plan.limits).reduce((n,[k,v])=>n+Math.max(0,v-s.fiscal.spending.plan.spent[k]),0)+80:0),label:'Городская казна'}];
    if(b.type==='home'){
      const p=owner(s,b);return p?Housing.family(s,p).filter(q=>q.alive&&q.age>=18).map(q=>({target:q,key:'coins',reserve:60,label:q.name})):[];
    }
    const g=s.guilds?.groups.find(g=>g.id===b.guildId);
    return[...(g?[{target:g,key:'cash',reserve:80,label:g.name}]:[]),{target:b,key:'cash',reserve:s.productionRecipe(b)?160:60,label:'Касса двора'}];
  }
  const funds=(s,b)=>wallets(s,b).reduce((n,w)=>n+Math.max(0,w.target[w.key]-w.reserve),0);
  function options(s,b){
    const l=level(b),k=kind(s,b),cost=Object.fromEntries(Object.entries(COSTS[k]).map(([key,n])=>[key,n*(k==='home'?Housing.residenceSpec(b).upgrade:1)])),result=[];
    if(l<3)result.push({id:'level',level:l+1,name:k==='hall'?HALL[l+1].name:'Уровень '+(l+1),cost:l===1?cost.second:cost.third,days:l===1?PACE.second.build:PACE.third.build,effect:k==='home'?'+3 места без тесноты':k==='production'?'+1 рабочее место, скорость +20%':k==='hall'?'Новые должности и полномочия':'Эффективность услуги +20%'});
    for(let n=1;n<=l;n++)if(!has(b,n))result.push({id:'extra'+n,level:n,name:EXTRAS[k][n-1][0],effect:EXTRAS[k][n-1][1],cost:cost.extra*2**(n-1),days:PACE.extra.build[n-1]});
    return result;
  }
  // One observation per real game day. Reopening the dashboard cannot age a project.
  function observe(s){
    let publicBalance;
    for(const b of s.buildings){const p=b.development.progression;if(p.observedDay>=s.day)continue;
      if(p.observedDay!==s.day-1)p.samples=[];
      if(b.construction||p.wasConstructing){p.levelSince=s.now;p.samples=[];p.wasConstructing=!!b.construction;}
      else if(!b.development.project&&b.type!=='home'){
        let net;if(publicTypes.includes(b.type)){publicBalance??=s.fiscalBudget();net=publicBalance.days>=6?publicBalance.net:0;}
        else net=b.enterprise?b.enterprise.lastProfit*(1-s.guilds.profitRate/100):b.cash-p.lastCash;
        p.samples.push({day:s.day,net});p.samples=p.samples.slice(-12);
      }
      p.observedDay=s.day;p.lastCash=b.cash;
    }
  }
  function readiness(s,b,option){
    const p=b.development.progression,major=option.id==='level',settle=major?(option.level===2?PACE.second.settle:PACE.third.settle):PACE.extra.settle;
    const remaining=Math.max(0,Math.max(p.levelSince+settle*1440,p.nextAt)-s.now);
    if(remaining>0)return `Освоение текущего уровня и перерыв между работами: ещё ${Math.ceil(remaining/1440)} дн.`;
    if(b.type==='home')return '';
    const window=major?(option.level===3?12:6):3,rows=p.samples.filter(r=>r.day>s.day-window&&r.day<=s.day);
    if(rows.length<window)return `Нужна история доходов: ${rows.length} / ${window} полных дн.`;
    const mean=rows.reduce((n,r)=>n+r.net,0)/window,positive=rows.filter(r=>r.net>0).length;
    if(mean<=0||positive<Math.ceil(window/2))return publicTypes.includes(b.type)?'Обычный бюджет не даёт устойчивого избытка: сначала покрыть текущие расходы.':'Нет устойчивого дохода: сначала наладить работу и продажи.';
    return '';
  }
  function need(s,b,option){
    const k=kind(s,b),r=s.productionRecipe(b);
    if(k==='hall'){
      if(option.id==='level')return s.alive.length>=HALL[option.level].population?{score:95,reason:'Город вырос: нужны новые должности и разделение полномочий.'}:{score:0,reason:'Нужно '+HALL[option.level].population+' жителей; сейчас '+s.alive.length+'.'};
      return{score:level(b)>1?35:0,reason:'Сократить постоянные расходы на работу магистрата.'};
    }
    if(k==='home'){
      const residents=s.alive.filter(p=>p.homeId===b.id),room=Housing.room(b),crowded=residents.length>=room;
      if(option.id==='level'||option.id==='extra3')return{score:crowded?85:0,reason:crowded?'Семье тесно: '+residents.length+' жильцов на '+room+' мест.':'В доме достаточно свободного места.'};
      const mean=residents.reduce((n,q)=>n+(option.id==='extra1'?q.energy:q.health),0)/Math.max(1,residents.length);
      return{score:residents.length&&mean<80?45:0,reason:option.id==='extra1'?'Хозяин хочет улучшить отдых семьи.':'Хозяин хочет улучшить условия восстановления здоровья.'};
    }
    if(r){
      const workers=s.workers(b.id).length,busy=workers>=s.jobSlots(b),scarce=b.stock[r.out]<r.amount*4;
      if(!workers)return{score:0,reason:'Сначала нужно найти работников.'};
      if(s.overstock(b))return{score:0,reason:'Склад заполнен: сначала нужны покупатели.'};
      if(option.id==='level'||option.id==='extra2')return{score:busy&&scarce?70:0,reason:busy&&scarce?'Мастерская загружена, готовый товар быстро расходится.':'Существующих рабочих мест пока хватает.'};
      return{score:scarce||b.enterprise?.lastProfit>2?55:0,reason:'Владелец рассчитывает повысить отдачу действующего производства.'};
    }
    const visitors=s.occupants(b.id).filter(q=>q.jobId!==b.id).length;
    const demand=b.type==='clinic'?s.alive.filter(q=>q.sick).length:b.type==='school'?s.alive.filter(q=>q.age>=6&&q.age<16).length:visitors;
    return{score:demand>=(option.id==='level'?6:2)?40:0,reason:'Посетителей, нуждающихся в услуге: '+demand+'.'};
  }
  function assess(s,b,option){
    const motive=need(s,b,option),p=owner(s,b),available=funds(s,b);let blocked='';
    if(b.construction||b.development.project)blocked='Работы уже идут.';
    else if(!p?.alive||p.absence)blocked='Нет доступного владельца, который примет решение.';
    else if(b.damaged||!s.isOpen(b))blocked='Сначала нужно восстановить работу двора.';

    else if(option.id==='level'&&b.type!=='hall'&&option.level>level(s.building('hall'))+1)blocked='Для третьего уровня нужна ратуша второго уровня.';
    else if(!motive.score)blocked=motive.reason;
    else if(available+1e-8<option.cost)blocked=`Свободно ${Math.floor(available)} из ${option.cost} тал.; семейные и оборотные резервы неприкосновенны.`;
    else blocked=readiness(s,b,option);
    return{...option,...motive,available,ok:!blocked,message:blocked||motive.reason,personId:p?.id||null};
  }
  function review(s){
    ensure(s);inheritance(s);observe(s);for(const p of s.people)p.developmentWish=null;
    for(const b of s.buildings){
      if(b.construction||b.development.project)continue;
      const choices=options(s,b).map(o=>assess(s,b,o)).sort((a,b)=>b.score-a.score||a.cost-b.cost),best=choices.find(o=>o.ok),shown=best||choices[0];
      b.development.assessment=shown?shown.name+': '+shown.message:'Все уровни и улучшения освоены.';
      if(!s.development.auto||!best)continue;
      const p=s.person(best.personId),ambition=p.traits.includes('Амбициозный')?8:0;
      if(!p.developmentWish||p.developmentWish.score<best.score+ambition)p.developmentWish={buildingId:b.id,optionId:best.id,score:best.score+ambition,reason:best.reason,day:s.day};
    }
    return{ok:true,message:'Владельцы оценили потребности, капитал и резервы. Подходящие проекты стали их личными целями.'};
  }
  function candidate(s,p,add,step){
    const w=p.developmentWish;if(!s.development?.auto||!w||s.hour<6||s.hour>=20)return;
    const b=s.building(w.buildingId);if(!b||b.development.project)return;
    const target=publicTypes.includes(b.type)?'hall':b.id;
    add('develop','Обсудить улучшение двора',Math.min(78,w.score),w.reason,[step('develop',target,'Заключить подряд на улучшение',{duration:30,buildingId:b.id,optionId:w.optionId})]);
  }
  function start(s,p,id,optionId){
    if(s.conclusion||!s.development.auto)return{ok:false,message:'Самостоятельное развитие приостановлено.'};
    const b=s.building(id),option=b&&options(s,b).find(o=>o.id===optionId);
    if(!option||owner(s,b)?.id!==p?.id)return{ok:false,message:'Проект или владелец изменились.'};
    const check=assess(s,b,option);if(!check.ok){p.developmentWish=null;b.development.assessment=check.message;return{ok:false,message:check.message};}
    let left=option.cost;const payments=[];
    for(const w of wallets(s,b)){const amount=Math.min(left,Math.max(0,w.target[w.key]-w.reserve));if(!amount)continue;
      if(w.key==='treasury'){s.changeTreasury(-amount,'development');s.spendDevelopmentFund?.(amount);}else w.target[w.key]-=amount;
      payments.push({source:w.label,amount,type:w.key==='treasury'?'city':w.key==='coins'?'person':s.buildings.includes(w.target)?'building':'guild',id:w.target.id??null});left-=amount;if(left<1e-8)break;
    }
    b.development.project={...option,startedAt:s.now,until:s.now+option.days*1440,personId:p.id,reason:check.reason,payments};
    Construction.start(s,b,b.development.project,payments);s.development.started++;s.development.spent+=option.cost;p.developmentWish=null;
    note(s,b,p,'Начато: '+option.name+'. '+check.reason+' Подряд '+option.cost+' тал.; срок '+option.days+' дн.','start');
    return{ok:true,message:'Владелец оплатил улучшение. Двор продолжает работать во время перестройки.'};
  }
  function note(s,b,p,text,phase){const row={at:s.now,buildingId:b.id,personId:p?.id||null,text,phase};s.development.history.unshift(row);s.development.history=s.development.history.slice(0,80);s.log((p?p.name+': ':'')+text,'development',p?.id,{title:phase==='start'?'Владелец развивает свой двор':'Улучшение завершено',buildingId:b.id,importance:'major'});}
  function tick(s){
    for(const b of s.buildings){const v=b.development,q=v?.project;if(!q||q.until>s.now||!Construction.finish(s,b,q))continue;
      if(q.id==='level')v.level=q.level;else v.extras.push(q.level);
      if(q.id==='level')v.progression.levelSince=s.now;
      Object.assign(v.progression,{nextAt:s.now+(q.id==='level'?6:3)*1440,observedDay:s.day,lastCash:b.cash,samples:[]});
      v.project=null;s.development.completed++;v.assessment='Работы завершены. Новую потребность владелец оценит утром.';
      note(s,b,s.person(q.personId),q.name+' в «'+b.name+'»: '+q.effect+'.','complete');
      s.assignJobs();Housing.review(s);
    }
  }
  function daily(s){const v=ensure(s);if(v.lastDay===s.day)return;v.lastDay=s.day;review(s);}
  const workFactor=b=>1+(level(b)-1)*.2+(has(b,1)?.12:0);
  const serviceFactor=b=>1+(level(b)-1)*.2+(b?.development?.extras.length||0)*.1;
  function recipe(b,base){if(!base||!has(b,3))return base;return{...base,inputs:Object.fromEntries(Object.entries(base.inputs).map(([g,n])=>[g,n*.9]))};}
  function load(s){
    ensure(s);const v=s.development,finite=n=>Number.isFinite(n)&&n>=0;
    if(typeof v.auto!=='boolean'||!['sinceDay','started','completed','spent'].every(k=>finite(v[k]))||!Number.isFinite(v.lastDay)||v.lastDay< -1||!Array.isArray(v.history))throw Error('Некорректное развитие города');
    for(const b of s.buildings){const d=b.development;if(!Number.isInteger(d.level)||d.level<1||d.level>3||!Array.isArray(d.extras)||new Set(d.extras).size!==d.extras.length||!d.extras.every(n=>Number.isInteger(n)&&n>=1&&n<=d.level))throw Error('Некорректные уровни здания');
      const a=d.progression;if(!['levelSince','nextAt','observedDay','lastCash'].every(k=>finite(a[k]))||typeof a.wasConstructing!=='boolean'||!Array.isArray(a.samples)||a.samples.length>12||!a.samples.every((r,i)=>Number.isInteger(r.day)&&r.day>=0&&r.day<=a.observedDay&&Number.isFinite(r.net)&&(!i||r.day===a.samples[i-1].day+1)))throw Error('Некорректная история развития здания');
      const p=d.project;if(p&&(!['level','extra1','extra2','extra3'].includes(p.id)||!finite(p.startedAt)||!finite(p.until)||p.until<=p.startedAt||!finite(p.cost)||!Number.isInteger(p.level)||p.level<1||p.level>3||!s.person(p.personId)||!Array.isArray(p.payments)||!p.payments.every(w=>finite(w.amount))||Math.abs(p.payments.reduce((n,w)=>n+w.amount,0)-p.cost)>1e-6||p.id==='level'&&p.level!==d.level+1||p.id!=='level'&&(p.id!=='extra'+p.level||p.level>d.level||d.extras.includes(p.level))))throw Error('Некорректный подряд на улучшение');
    }
  }
  const api={HALL,COSTS,PACE,EXTRAS,ensure,level,has,kind,owner,wallets,funds,options,need,assess,review,candidate,start,tick,daily,workFactor,serviceFactor,recipe,load};if(node)module.exports=api;else root.DanzigDevelopment=api;
})(typeof window!=='undefined'?window:globalThis);
