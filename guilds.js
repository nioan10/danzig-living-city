(function(root){
  'use strict';
  const EnterprisePolicy=typeof module!=='undefined'&&module.exports?require('./enterprise-policy.js'):root.DanzigEnterprisePolicy;
  const Products=typeof module!=='undefined'&&module.exports?require('./products.js'):root.DanzigProducts;
  const node=typeof module!=='undefined'&&module.exports;
  const W=node?require('./world.js'):root.DanzigWorld,E=node?require('./expansion.js'):root.DanzigExpansion;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),round=n=>Math.round(n*100)/100;
  const colors=['#b77b36','#598b8b','#926883','#6d8949','#a65e49','#5d75a0'];
  // Kinship follows descendants and their spouses; a shared surname is not kinship.
  function family(s,p){let root=p,seen=new Set();while(root?.parents?.length&&!seen.has(root.id)){seen.add(root.id);const parent=s.person(root.parents[0]);if(!parent)break;root=parent;}const ids=new Set(root?[root.id]:[]);if(root?.spouseId)ids.add(root.spouseId);let changed=true;while(changed){changed=false;for(const q of s.people)if(q.parents?.some(id=>ids.has(id))&&!ids.has(q.id)){ids.add(q.id);changed=true;}}for(const id of [...ids]){const spouse=s.person(id)?.spouseId;if(spouse)ids.add(spouse);}return s.people.filter(q=>ids.has(q.id));}
  function migrate(s,v){
    // Return the old synthetic unions' capital without creating or destroying money.
    for(const g of v.groups||[]){if(!Number.isFinite(g.cash)||g.cash<0)throw Error('Некорректный капитал гильдии');const recipients=(g.members||[]).map(id=>s.person(id)).filter(p=>p?.alive);if(recipients.length)for(const p of recipients)p.coins+=g.cash/recipients.length;else{const b=s.buildings.find(b=>b.guildId===g.id);if(b){b.cash+=g.cash;if(b.enterprise)b.enterprise.openingCash+=g.cash;}else s.treasury+=g.cash;}}
    for(const r of Object.values(s.properties?.records||{}))if(r.holder==='guild'){const g=v.groups.find(g=>g.id===r.holderId),p=s.person(g?.leaderId)||s.person(g?.founderId);r.holder=p?'person':'city';r.holderId=p?.id||null;r.shares=[{holder:r.holder,id:r.holderId,part:1}];for(const l of s.properties.leases.filter(l=>l.buildingId===r.id)){l.landlord=r.holder;l.landlordId=r.holderId;}}
    for(const p of s.people){delete p.guildId;p.enterpriseWish=null;if(p.plan?.goal==='enterprise')p.plan=null;}
    for(const b of s.buildings){delete b.guildId;if(b.construction)b.construction.guildId=null;if(b.expansion&&b.name.includes(' · '))b.name=s.buildingType(b.type)+' · участок '+b.id.slice(3);}
    for(const b of s.buildings)for(const p of [b.construction,b.development?.project])for(const payer of p?.local?.payers||[])if(payer.type==='guild'){payer.type='building';payer.id=b.id;}v.groups=[];v.applications=[];v.version=2;v.nextId=1;v.history.unshift({day:s.day,text:'Прежние городские союзы распущены. Их капитал возвращён участникам, здания и стройки сохранены. Новые гильдии будут учреждать семьи.',guildId:null});
  }
  function ensure(s){
    const created=!s.guilds;
    if(created)s.guilds={version:2,nextId:1,sinceDay:s.day,auto:true,profitRate:8,permitRate:5,lastDay:s.day,history:[],taxPaid:0,permitsPaid:0,built:0,groups:[]};
    if(s.guilds.version!==2)migrate(s,s.guilds);
    for(const b of s.buildings)if(s.productionRecipe(b))b.enterprise??={baseWage:b.wage,priceFactor:1,openingCash:b.cash,lastProfit:0,revenue:0,totalRevenue:0,profitTax:0,profitTotal:0,daysIdle:0};
    for(const b of s.buildings)if(s.productionRecipe(b))EnterprisePolicy.ensure(s,b);
    // Older saves inherited manual review. Adopt the autonomous default once;
    // later explicit interventions must survive subsequent loads.
    if(s.guilds.permitPolicyVersion===undefined){s.guilds.permitMode='auto';s.guilds.permitPolicyVersion=1;}
    s.guilds.permitMode??='auto';s.guilds.applications??=[];s.guilds.nextApplication??=1;return s.guilds;
  }
  function enroll(s){
    for(const g of s.guilds.groups)for(const p of family(s,s.person(g.founderId)))if(p.alive&&p.age>=16&&!p.guildId){p.guildId=g.id;if(!g.members.includes(p.id))g.members.push(p.id);}
    for(const g of s.guilds.groups){if(!s.person(g.leaderId)?.alive||s.person(g.leaderId)?.absence)g.leaderId=members(s,g).sort((a,b)=>(b.reputation+b.skill*5+(b.traits.includes('Амбициозный')?15:0))-(a.reputation+a.skill*5+(a.traits.includes('Амбициозный')?15:0))||a.id-b.id)[0]?.id||null;}
    for(const b of s.buildings.filter(b=>s.productionRecipe(b)))if(b.ownerId&&!s.person(b.ownerId)?.alive){const g=owner(s,b),heir=g?s.person(g.leaderId):family(s,s.person(b.ownerId)).filter(p=>p.alive&&p.age>=16&&!p.absence).sort((a,b)=>b.skill-a.skill||a.id-b.id)[0];if(heir)b.ownerId=heir.id;}
  }
  const owner=(s,b)=>s.guilds?.groups.find(g=>g.id===b?.guildId);
  const members=(s,g)=>g.members.map(id=>s.person(id)).filter(p=>p?.alive&&p.age>=16&&!p.absence);
  const ownerName=(s,b)=>owner(s,b)?.name||(s.person(b?.ownerId)?'Мастер: '+s.person(b.ownerId).name:'Городской двор');
  function prospect(s,p){
    const b=s.buildings.find(b=>b.ownerId===p.id&&!b.guildId&&!b.construction&&s.productionRecipe(b)&&b.id===p.jobId);if(!b||p.guildId||!p.alive||p.absence||p.age<16)return null;
    const kin=family(s,p).filter(q=>q.alive&&q.age>=16&&!q.absence&&!q.guildId),experience=p.tradeExperience?.[b.type]||0;
    const capital=kin.reduce((n,q)=>n+Math.max(0,q.coins-60),0)+Math.max(0,b.cash-160);
    const ready=kin.length>=2&&experience>=240&&capital>=100;
    const reason=kin.length<2?'Нужен второй взрослый родственник':experience<240?'Нарабатывает опыт в ремесле':capital<100?'Семья копит 100 талеров сверх личного и оборотного резерва':'Семья готова учредить гильдию';
    return {personId:p.id,buildingId:b.id,type:b.type,kin:kin.map(q=>q.id),experience,capital:round(capital),ready,reason};
  }
  function found(s,p){ensure(s);const q=prospect(s,p);if(!s.guilds.auto||!q?.ready)return{ok:false,message:'Семья ещё не готова учредить гильдию'};
    const b=s.building(q.buildingId),id='family'+s.guilds.nextId++,g={id,name:'Дом '+p.surname+' · '+s.buildingType(q.type),familyName:p.surname,founderId:p.id,foundedDay:s.day,trade:q.type,focus:[q.type],color:colors[(s.guilds.nextId-2)%colors.length],cash:0,members:q.kin,leaderId:p.id,nextProjectDay:s.day+1,proposal:null,status:'Семья объединила капитал',invested:0,dividends:0};
    let left=100;for(const personId of q.kin){const m=s.person(personId),n=Math.min(left,Math.max(0,m.coins-60));m.coins-=n;g.cash+=n;left-=n;m.guildId=id;}
    b.cash-=left;b.enterprise.openingCash-=left;g.cash+=left;g.invested=100;b.guildId=id;s.guilds.groups.push(g);p.enterpriseWish=null;
    note(s,g,p.name+' учредил семейную гильдию. Ремесло: '+s.buildingType(q.type)+'. В общий капитал внесено 100 талеров из накоплений семьи и мастерской.',b.id);return{ok:true,message:'Учреждена семейная гильдия',guildId:id};
  }
  function note(s,g,text,buildingId=null){s.guilds.history.unshift({day:s.day,guildId:g.id,text,buildingId});s.guilds.history=s.guilds.history.slice(0,60);s.log(g.name+': '+text,'guild',g.leaderId,{title:'Решение гильдии',importance:'major',buildingId});}
  function demand(s){const d={bread:s.living.length*.85,fish:s.living.length*.3,clothes:s.living.length*.04,pottery:s.living.length*.03,furniture:s.living.length*.02,tools:s.living.length*.03,...s.householdDemand?.(),biscuits:s.living.length*.12};for(const b of s.buildings){const r=s.productionRecipe(b);if(!r||b.construction)continue;const batches=Math.max(1,s.workers(b.id).length)*180/r.time;for(const[k,v]of Object.entries(r.inputs))d[k]=(d[k]||0)+v*batches;}for(const [g,n]of Object.entries(s.constructionDemand?.()||{}))d[g]=(d[g]||0)+n;return d;}
  function assess(s,g,type,market=demand(s),stock=s.goods){
    const spec=E.specs[type],r=s.productionRecipe({type});if(!spec||!r||!g.focus.includes(type))return null;
    const labor=s.alive.filter(p=>p.age>=16&&p.age<65&&!p.absence&&!p.jobId).length;
    const peers=s.buildings.filter(b=>b.type===type&&!b.construction),days=(stock[r.out]||0)/Math.max(1,market[r.out]||0);
    const inputs=Object.entries(r.inputs).reduce((n,[k,v])=>n+s.commerce.prices[k]*v,0),cost=inputs+1.3*r.time/60;
    const gross=s.commerce.prices[r.out]*r.amount*(1-(s.commerce.levyEnabled?s.commerce.levyRate:0)/100)*(1-(s.fiscal.taxes.sales.enabled?s.fiscal.taxes.sales.rate:0)/100),margin=gross-cost;
    const total=spec.cost*(1+s.guilds.permitRate/100),idle=peers.filter(b=>!s.workers(b.id).length).length;
    const score=(3-days)*25+Math.min(15,margin/Math.max(1,cost)*8)+(g.focus.includes(type)?6:0)-idle*35;
    let reason='Спрос покрыт существующими мастерскими';if(labor<1)reason='Нет свободных работников';else if(idle)reason='У конкурентов уже простаивают рабочие места';else if(margin<=0)reason='Цена не покрывает сырьё, труд и сборы';else if(days<3&&score>14)reason='Запас на '+round(days)+' дн., ожидаемый остаток с партии '+round(margin)+' тал.';
    return {type,good:r.out,days:round(days),margin:round(margin),score:round(score),cost:round(total),labor,viable:labor>0&&!idle&&margin>0&&days<3&&score>14,reason};
  }
  function review(s){ensure(s);enroll(s);const state=s.guilds,market=demand(s),stock=s.goods;for(const p of s.people)p.enterpriseWish=null;
    if(state.auto){const reserved=new Set();for(const p of s.alive){const q=prospect(s,p);if(q?.ready&&!q.kin.some(id=>reserved.has(id))){p.enterpriseWish={founding:true,buildingId:q.buildingId,type:q.type};q.kin.forEach(id=>reserved.add(id));}}}
    for(const g of state.groups){g.proposal=null;const leader=s.person(g.leaderId);if(!state.auto){g.status='Самостоятельное строительство остановлено';continue;}if(s.incidents.some(e=>e.type==='blockade'&&e.status==='active')){g.status='Блокада: подрядчик не может привезти материалы';continue;}if(!leader?.alive||leader.absence){g.status='Нет доступного главы гильдии';continue;}if(state.applications.some(a=>a.guildId===g.id&&a.status==='pending')){g.status='Заявка ожидает решения ратуши';continue;}if(s.day<g.nextProjectDay||s.buildings.some(b=>b.guildId===g.id&&b.construction)){g.status='Завершают текущий проект';continue;}
      const choices=g.focus.map(t=>assess(s,g,t,market,stock)).filter(Boolean).sort((a,b)=>b.score-a.score||a.type.localeCompare(b.type));g.market=choices.slice(0,4);
      const viable=choices.filter(c=>c.viable),choice=viable.find(c=>g.cash>=c.cost+80&&W.expansionLots.some(l=>l.types.includes(c.type)&&!s.building(l.id)));
      if(!choice){g.status=!viable.length?'Нет оправданного проекта: '+(choices[0]?.reason||'нет спроса'):viable.every(c=>!W.expansionLots.some(l=>l.types.includes(c.type)&&!s.building(l.id)))?'Нет подходящей свободной земли':'Копят капитал: для проекта нужен резерв в 80 тал.';continue;}
      const destinations=W.expansionLots.filter(l=>l.types.includes(choice.type)&&!s.building(l.id));destinations.sort((a,b)=>s.travelMinutes(leader,a.id)-s.travelMinutes(leader,b.id)||a.id.localeCompare(b.id));const lot=destinations[0];
      g.proposal={...choice,lotId:lot.id,leaderId:leader.id};g.status=leader.name+' планирует: '+s.buildingType(choice.type);leader.enterpriseWish={guildId:g.id,lotId:lot.id,type:choice.type};
    }return{ok:true,message:'Гильдии оценили спрос, свободные руки и капитал. Главы сами выберут время для похода в ратушу.'};
  }
  function candidate(s,p,add,step){const wish=p.enterpriseWish;if(!wish||!s.guilds.auto||p.absence||p.cargo||s.hour<7||s.hour>=19)return;if(wish.founding){add('enterprise','Учредить семейную гильдию',60+(p.traits.includes('Амбициозный')?15:0),'Родственники накопили опыт и капитал для общего дела',[step('charter','hall','Зарегистрировать семейный устав',{duration:60})]);return;}const g=s.guilds.groups.find(g=>g.id===wish.guildId);if(!g?.proposal)return;add('enterprise','Открыть предприятие гильдии',58+(p.traits.includes('Амбициозный')?15:0),g.name+': '+g.proposal.reason,[step('commission','hall','Оформить подряд и разрешение',{duration:60,...wish})]);}
  function buildGranted(s,p,wish){ensure(s);const g=s.guilds.groups.find(g=>g.id===wish.guildId);if(!g||!p||!s.guilds.auto||g.leaderId!==p.id||!p.alive||p.absence||s.day<g.nextProjectDay||s.buildings.some(b=>b.guildId===g.id&&b.construction))return{ok:false,message:'Гильдия пока не готова к новому проекту'};const check=assess(s,g,wish.type);if(!check?.viable)return{ok:false,message:'Ситуация изменилась: '+(check?.reason||'неизвестный проект')};if(g.cash<check.cost+80)return{ok:false,message:'Не хватает капитала с учётом оборотного резерва'};
    const result=E.build(s,wish.lotId,wish.type,g);if(result.ok){g.nextProjectDay=s.day+6;g.proposal=null;p.enterpriseWish=null;const b=s.building(result.buildingId);ensure(s);b.enterprise.openingCash=0;s.guilds.built++;note(s,g,p.name+' заказал '+s.buildingType(b.type)+'. '+check.reason+' Подряд с разрешением: '+check.cost+' тал.',b.id);s.remember(p,'enterprise',b.id,'Учредил предприятие своей гильдии: '+b.name,6);}return result;
  }
  function commission(s,p,wish){ensure(s);const g=s.guilds.groups.find(g=>g.id===wish.guildId),check=g&&assess(s,g,wish.type);if(!g||!p||!s.guilds.auto||g.leaderId!==p.id||!p.alive||p.absence||s.day<g.nextProjectDay||!check?.viable||g.cash<check.cost+80||s.building(wish.lotId)||!W.expansionLots.some(l=>l.id===wish.lotId&&l.types.includes(wish.type))||s.guilds.applications.some(a=>a.guildId===g.id&&a.status==='pending')||s.buildings.some(b=>b.guildId===g.id&&b.construction)||s.incidents.some(e=>e.type==='blockade'&&e.status==='active'))return{ok:false,message:'Заявка не отвечает условиям строительства'};
    const a={id:s.guilds.nextApplication++,guildId:g.id,personId:p.id,lotId:wish.lotId,type:wish.type,day:s.day,status:'pending',cost:check.cost,reason:check.reason};s.guilds.applications.unshift(a);s.guilds.applications=s.guilds.applications.filter((a,i)=>a.status==='pending'||i<60);p.enterpriseWish=null;g.proposal=null;g.status='Заявка ожидает решения ратуши';note(s,g,'Подана заявка в ратушу: '+s.buildingType(wish.type)+' на участке '+wish.lotId.slice(3)+'. Деньги ещё не списаны.');return{ok:true,queued:true,applicationId:a.id,message:'Ратуша получила заявку. До разрешения стройка не начинается.'};
  }
  function decidePermit(s,id,approve){const a=s.guilds.applications.find(a=>a.id===Number(id));if(!a||a.status!=='pending')return{ok:false,message:'Заявка уже рассмотрена'};const g=s.guilds.groups.find(g=>g.id===a.guildId);if(!approve){a.status='rejected';a.decisionDay=s.day;a.decision='Отказ администрации';g.nextProjectDay=s.day+6;note(s,g,'Ратуша отказала в строительстве на участке '+a.lotId.slice(3));return{ok:true,message:'Заявка отклонена, средства остаются у семьи'};}
    const result=buildGranted(s,s.person(g.leaderId),a);a.decisionDay=s.day;a.status=result.ok?'approved':'expired';a.decision=result.message;if(!result.ok)note(s,g,'Заявка снята: '+result.message);return result;
  }
  function reviewPermits(s){for(const a of s.guilds.applications.filter(a=>a.status==='pending')){if(s.day-a.day>6){a.status='expired';a.decision='Срок заявки истёк';continue;}if(s.guilds.permitMode==='auto'&&(s.governmentOfficer?.('seneschal')||s.person(s.mayorId))?.alive&&!(s.governmentOfficer?.('seneschal')||s.person(s.mayorId))?.absence){const actor=s.governmentOfficer?.('seneschal')||s.person(s.mayorId),result=decidePermit(s,a.id,true);const text='Заявка на '+s.buildingType(a.type)+': '+(result.ok?'разрешена после проверки.':result.message);s.recordGovernment?.('seneschal',actor,text);s.log(actor.name+': '+text,'politics',actor.id,{title:'Ратуша рассмотрела проект',buildingId:result.ok?a.lotId:'hall'});}}}
  function daily(s){const state=ensure(s);if(state.lastDay===s.day)return;state.lastDay=s.day;const market=demand(s);
    for(const b of s.buildings){const e=b.enterprise,g=owner(s,b),r=s.productionRecipe(b);if(!e||!r||b.construction)continue;
      const ledger=b.business?.days.find(d=>d.day===s.day-1),profit=ledger?ledger.revenue-ledger.cost-ledger.overhead:b.cash-e.openingCash;e.lastProfit=round(profit);e.profitTotal+=profit;
      const tax=Math.min(b.cash,Math.max(0,profit)*state.profitRate/100);b.cash-=tax;s.changeTreasury(tax,'guildProfit');state.taxPaid+=tax;e.profitTax+=tax;
      if(g){
        const reserve=180+Object.entries(r.inputs).reduce((n,[k,v])=>n+s.commerce.prices[k]*v*4,0),surplus=Math.max(0,b.cash-reserve)*.18;b.cash-=surplus;g.cash+=surplus;
        if(b.cash<25&&g.cash>80){const aid=Math.min(60-b.cash,g.cash-80);b.cash+=aid;g.cash-=aid;}
      }
      Products.choose(s,b,s.productRecipes(b)[0],market);EnterprisePolicy.review(s,b,market);
      e.daysIdle=!s.workers(b.id).length?e.daysIdle+1:0;e.revenue=0;
    }
    for(const g of state.groups){const living=members(s,g);for(const p of living){if(p.hunger<35||p.health<50||p.coins<=100)continue;const contribution=Math.min(3,(p.coins-100)*(p.traits.includes('Амбициозный')?.06:.025));p.coins-=contribution;g.cash+=contribution;g.invested+=contribution;}
      if(s.day%6===0&&g.cash>800&&living.length){const dividend=(g.cash-800)*.1;g.cash-=dividend;g.dividends+=dividend;for(const p of living)s.payGuildDividend(p,dividend/living.length);}
    }
    for(const b of s.buildings)if(b.enterprise)b.enterprise.openingCash=b.cash;
    reviewPermits(s);review(s);
  }
  function configure(s,data){const rate=Number(data.profitRate),permit=Number(data.permitRate);if(!Number.isFinite(rate)||rate<0||rate>25||!Number.isFinite(permit)||permit<0||permit>20)return{ok:false,message:'Налог на прибыль: 0–25%, разрешение на стройку: 0–20%'};if(data.permitMode&&!['manual','auto'].includes(data.permitMode))return{ok:false,message:'Неизвестный режим разрешений'};Object.assign(ensure(s),{auto:data.auto===true,profitRate:rate,permitRate:permit,permitMode:data.permitMode||s.guilds.permitMode});review(s);s.log(`Гильдии: налог на положительный остаток за день ${rate}%, разрешение на стройку ${permit}%. Самостоятельное строительство ${s.guilds.auto?'разрешено':'приостановлено'}.`,'politics',null,{title:'Правила гильдейского хозяйства'});return{ok:true,message:'Правила применены к следующим расчётам и проектам'};}
  function load(s){const v=ensure(s),finite=n=>Number.isFinite(n)&&n>=0;if(!Array.isArray(v.groups)||!Array.isArray(v.history)||!Number.isInteger(v.nextId)||v.nextId<1||!finite(v.profitRate)||v.profitRate>25||!finite(v.permitRate)||v.permitRate>20||new Set(v.groups.map(g=>g.id)).size!==v.groups.length)throw Error('Некорректные гильдии');for(const g of v.groups)if(!finite(g.cash)||!s.person(g.founderId)||!E.specs[g.trade]||g.focus?.length!==1||g.focus[0]!==g.trade||!Array.isArray(g.members)||!g.members.every(id=>s.person(id)))throw Error('Некорректный капитал или семья гильдии');if(!['manual','auto'].includes(v.permitMode)||!Array.isArray(v.applications)||!Number.isInteger(v.nextApplication)||v.nextApplication<1||!v.applications.every(a=>v.groups.some(g=>g.id===a.guildId)&&W.expansionLots.some(l=>l.id===a.lotId&&l.types.includes(a.type))&&['pending','approved','rejected','expired'].includes(a.status)&&finite(a.day)))throw Error('Некорректные заявки');for(const b of s.buildings){if(b.guildId&&!owner(s,b))throw Error('Неизвестный владелец мастерской');if(b.enterprise&&(!finite(b.enterprise.priceFactor)||b.enterprise.priceFactor<.8||b.enterprise.priceFactor>1.2||!Number.isFinite(b.enterprise.openingCash)))throw Error('Некорректное предприятие');}}
  const api={ensure,owner,ownerName,family,prospect,found,members,demand,assess,review,candidate,commission,decidePermit,reviewPermits,daily,configure,load};if(node)module.exports=api;else root.DanzigGuilds=api;
})(typeof window!=='undefined'?window:globalThis);
