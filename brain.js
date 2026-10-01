(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Mind=node?require('./citizen-mind.js'):root.DanzigMind,Labour=node?require('./labour.js'):root.DanzigLabour,Planner=node?require('./citizen-planner.js'):root.DanzigPlanner;
  const Intentions=node?require('./intentions.js'):root.DanzigIntentions,Agreements=node?require('./agreements.js'):root.DanzigAgreements;
  const EnterprisePolicy=node?require('./enterprise-policy.js'):root.DanzigEnterprisePolicy;
  const Households=node?require('./households.js'):root.DanzigHouseholds;
  const Construction=node?require('./construction.js'):root.DanzigConstruction;
  const Civic=node?require('./civic-life.js'):root.DanzigCivic;
  const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
  const step=(kind,target,label,extra={})=>({kind,target,label,duration:15,elapsed:0,...extra});
  function options(sim,p){
    const choices=[],has=t=>p.traits.includes(t),home=sim.building(p.homeId),job=sim.building(p.jobId);
    const hunger=100-p.hunger, tired=100-p.energy,daylight=sim.hour>=6&&sim.hour<21;
    const household=Mind.household(sim,p);Mind.review(sim,p,household);
    const walk=target=>sim.travelMinutes(p,target);
    const add=(goal,title,score,reason,steps)=>{
      if(!steps.length||steps.some(s=>!sim.building(s.target)))return;
      const travel=walk(steps[0].target);
      const learned=sim.learningBias?.(p,goal)||0;
      const personal=Mind.bias(sim,p,goal,steps,household);
      choices.push({goal,title,score:Math.round((score-travel*.12+learned+personal.score)*10)/10,reason,steps,learned,factors:personal.why});
    };
    const foodNeed=hunger*1.3+(p.hunger<25?65:0);
    if(sim.foodAmount(p.bag)>=2&&sim.foodAmount(home.stock)<4)add('provision','Отнести уже купленную еду семье',88,'Продукты уже со мной. Сначала пополню домашний запас',[step('storeFood',home.id,'Отнести припасы домой',{duration:5})]);
    if(job&&['bakery','fish'].includes(job.type)&&sim.canProduce(job)&&job.cash>2&&p.hunger<65){
      const good=sim.productionRecipe(job).out;
      add('makeMeal','Заработать и приготовить еду',foodNeed+18,'Моё ремесло даёт еду. Выполню работу и куплю порцию из свежей партии',[
        step('work',job.id,'Приготовить свежую партию',{duration:90}),step('buyFood',job.id,'Купить порцию',{good,amount:1}),step('eatBag',job.id,'Поесть',{duration:10})]);
    }
    if(sim.foodAmount(p.bag)>=1)add('eat','Поесть из дорожного запаса',foodNeed+8,'Еда уже с собой; можно поесть без новых расходов',[step('eatBag',p.location||p.goal,'Поесть',{duration:10})]);
    if(sim.foodAmount(home.stock)>=1)add('eat','Поесть дома',foodNeed+(has('Бережливый')?12:4),'Дома есть припасы. Семейная еда обойдётся дешевле покупки',[step('eatHome',home.id,'Вернуться домой и поесть',{duration:15})]);
    const foodOffers=sim.suppliers(p,'food',1).slice(0,3);
    for(const offer of foodOffers){
      const foodMoney=sim.householdFoodMoney(p),affordable=foodMoney>=offer.price,household=sim.foodAmount(home.stock);
      const trust=sim.trust(p,offer.id),score=foodNeed-4+(has('Бережливый')?-offer.price*4:0)+trust*.12;
      if(affordable&&daylight){
        const provisionPending=Mind.activeClaim(sim,p,'provision');
        if(provisionPending)add('eat','Купить одну порцию для себя',score,'Припасы для дома уже несёт другой житель. Куплю только порцию на сейчас',[
          step('buyFood',offer.id,'Купить одну порцию',{good:offer.good,amount:1}),step('eatBag',offer.id,'Поесть',{duration:10})]);
        else add('eat','Купить еду и вернуться домой',score,`${sim.building(offer.id).name}: ${offer.price.toFixed(1)} тал. за порцию; путь около ${Math.ceil(walk(offer.id))} мин.`,[
          step('buyFood',offer.id,'Купить продукты',{good:offer.good,amount:Math.min(4,Math.floor(foodMoney/offer.price))}),
          step('storeFood',home.id,'Отнести покупку семье',{duration:5}),step('eatHome',home.id,'Поесть',{duration:15})]);
        if(household<Math.max(3,Mind.ensure(sim,p).forecast.dailyFood) && p.age>=16)add('provision','Пополнить семейные припасы',45+Math.max(0,3-household)*9+(has('Бережливый')?12:0)+(has('Добрый')?9:0),`В доме осталось ${Math.floor(household)} порций. Нужно позаботиться о семье`,[
          step('buyFood',offer.id,'Купить продукты для семьи',{good:offer.good,amount:Math.min(6,Math.floor(foodMoney/offer.price))}),step('storeFood',home.id,'Доставить припасы домой',{duration:5})]);
      }
      if(!affordable&&job&&sim.isOpen(job)&&job.cash>3&&sim.canProduce(job)&&daylight)add('earnFood','Заработать на еду',foodNeed+3,'На покупку не хватает денег. Сначала выполню работу, затем зайду за едой',[
        step('work',job.id,'Заработать на покупку',{duration:90}),step('buyFood',offer.id,'Купить еду',{good:offer.good,amount:1}),step('eatBag',offer.id,'Поесть',{duration:10})]);
    }
    if(p.hunger<45 && !sim.recentFailure(p,'church','empty') && (p.coins<2 || !foodOffers.length || p.age<16))add('aid','Попросить еду при церкви',foodNeed+5,'Собственных припасов не хватает. При церкви можно получить помощь',[step('charity','church','Попросить еду',{duration:25})]);
    add('rest','Отдохнуть дома',tired*.85+(sim.hour>=21||sim.hour<6?43:0)+(p.energy<18?70:0)+(has('Ленивый')?10:0),'Усталость мешает делам. Дома можно восстановить силы',[step('rest',home.id,'Отдохнуть',{duration:90})]);
    if(p.sick||p.health<65)add('heal','Получить помощь лекаря',(100-p.health)*1.7+25,'Плохое самочувствие важнее обычных дел',[step('heal','clinic','Дождаться лекаря и пройти лечение',{duration:75})]);
    if(job?.id==='clinic'&&daylight&&p.hunger>25&&p.energy>22&&sim.alive.some(q=>q.id!==p.id&&(q.sick||q.health<65)))add('medicalDuty','Принять заболевших',125,'Горожанам нужна помощь. Вернусь в лечебницу',[step('work','clinic','Принимать заболевших',{duration:120})]);
    if(p.cargo)add('delivery','Закончить доставку',86,`Груз уже получен: ${sim.goodName(p.cargo.good)}. Его ждут в мастерской`,[step('deliver',p.cargo.to,'Передать груз',{duration:10})]);
    if(job&&daylight&&p.age>=16&&p.age<70&&!p.cargo){
      const debt=sim.recentFailure(p,job.id,'unpaid');
      const knownClosed=sim.recentFailure(p,job.id,'closed');
      const workNeed=37+(p.coins<20?24:0)+(has('Трудолюбивый')?18:0)+(has('Амбициозный')?10:0)-(has('Ленивый')?12:0)-tired*.12;
      if(!knownClosed&&!debt){
        const missing=sim.overstock(job)?null:sim.missingInput(job);
        if(missing){
          for(const offer of sim.suppliers(p,missing.good,1,job.id).slice(0,2)){
            const amount=sim.supplyAmount(job,sim.building(offer.id),missing.good,missing.amount);if(amount<1)continue;
            add('supply','Добыть сырьё для мастерской',workNeed+20,`${job.name}: заканчивается ${sim.goodName(missing.good).toLowerCase()}. Найден поставщик — ${sim.building(offer.id).name}`,[
              step('pickup',offer.id,'Получить сырьё',{good:missing.good,amount,to:job.id}),step('deliver',job.id,'Отвезти сырьё в мастерскую',{duration:10}),step('work',job.id,'Возобновить производство',{duration:90})]);
            if(job.type==='bakery'&&p.hunger<45)add('makeMeal','Добыть сырьё и испечь себе хлеб',foodNeed+23,'Хлеб закончился, но я могу его испечь. Сначала привезу недостающий материал',[
              step('pickup',offer.id,'Купить недостающий материал',{good:missing.good,amount,to:job.id}),step('deliver',job.id,'Доставить в пекарню',{duration:10}),step('work',job.id,'Испечь хлеб',{duration:90}),step('buyFood',job.id,'Купить порцию',{good:'bread',amount:1}),step('eatBag',job.id,'Поесть',{duration:10})]);
          }
        }
        if(sim.canProduce(job))add('work','Заработать своим ремеслом',workNeed,`Заработок ${job.wage.toFixed(2)} тал./ч. ${has('Трудолюбивый')?'Люблю доводить дело до конца.':p.coins<20?'Сбережений мало — работа особенно важна.':'Работа поддерживает достаток семьи.'}`,[step('work',job.id,'Работать',{duration:90})]);
      }
      if(job.damaged)add('repair','Восстановить свою мастерскую',workNeed+16,'Повреждённая мастерская лишает меня заработка. Возьмусь за ремонт',[step('repair',job.id,'Помочь мастерам с ремонтом',{duration:75})]);
    }
    Labour.candidates(sim,p,add,step,household);Planner.candidates(sim,p,add);
    Intentions.candidates(sim,p,add,step);Agreements.candidates(sim,p,add,step);
    EnterprisePolicy.candidates(sim,p,add,step);Households.candidates(sim,p,add,step);
    Construction.candidates(sim,p,add,step);
    if(p.age>=6&&p.age<16&&sim.hour>=8&&sim.hour<16)add('learn','Пойти учиться',45+(has('Амбициозный')?18:0),'Учёба пригодится, когда придёт время выбрать ремесло',[step('learn','school','Учиться чтению и счёту',{duration:100})]);
    const social=(100-p.social)*.85+(has('Общительный')?23:0)-(has('Замкнутый')?22:0);
    if(daylight){
      const target=p.age<16?'market':'tavern';
      add('social','Встретить знакомых',social,'Не хватает общения. Заодно можно узнать о товарах и работе',[step('social',target,'Поговорить с горожанами',{duration:65})]);
      const friend=sim.person(p.friendId);
      if(friend?.alive)add('friend','Навестить близкого человека',social+8,`Хочу увидеть ${friend.name} и узнать, как идут дела`,[step('social',friend.homeId,'Навестить друга',{duration:70,personId:friend.id})]);
      add('faith','Побыть на службе',(100-p.faith)*.65+(has('Набожный')?30:0),'Тишина церкви помогает разобраться в тревогах',[step('pray','church','Помолиться',{duration:60})]);
      const sick=sim.alive.find(q=>q.id!==p.id&&q.homeId===p.homeId&&q.sick);
      if(sick&&(has('Добрый')||p.spouseId===sick.id||household.carer===p.id))add('care','Позаботиться о близком',62+(has('Добрый')?20:0),`${sick.name} нездоровится. Принесу воды и побуду рядом`,[step('care',sick.homeId,'Ухаживать за близким',{duration:60,personId:sick.id})]);
      if(sim.festivalDay===sim.day)add('festival','Пойти на городской праздник',social+28,'На площади собираются соседи. Можно отдохнуть вместе',[step('social','market','Побыть на празднике',{duration:80})]);
      add('explore','Узнать городские новости',12+(has('Амбициозный')?8:0),'Посмотрю цены на рынке и поговорю с торговцами',[step('observe',p.id%2?'market':'market2','Осмотреть торговые ряды',{duration:35})]);
    }
    sim.politicalCandidates?.(p,add,step);sim.titleCandidate?.(p,add,step);Civic.candidates(sim,p,add,step);sim.housingCandidate?.(p,add,step);sim.guildCandidate?.(p,add,step);sim.developmentCandidate?.(p,add,step);
    sim.eventCandidates?.(p,add,step);
    if(p.age<6)return choices.filter(c=>['eat','rest','aid','shelter','heal'].includes(c.goal));
    return choices.sort((a,b)=>b.score-a.score);
  }
  function choose(sim,p){
    const candidates=options(sim,p).sort((a,b)=>b.score-a.score);
    const seen=new Set();p.considered=candidates.filter(c=>{if(seen.has(c.goal))return false;seen.add(c.goal);return true;}).slice(0,4).map(c=>({title:c.title,score:c.score,reason:c.reason,factors:c.factors}));
    const selected=candidates[0];if(!selected)return null;
    const m=Mind.ensure(sim,p);m.decisions++;m.explanation=selected.factors;
    return {...selected,index:0,createdAt:sim.now,commitUntil:sim.now+50,estimatedMinutes:Planner.estimate(sim,p,selected.steps)};
  }
  function shouldReplan(sim,p){
    if(!p.plan||p.plan.index>=p.plan.steps.length)return true;
    const invalid=Planner.invalid(sim,p);if(invalid){const m=Mind.ensure(sim,p);m.replans++;m.lastReplan=invalid;p.plan.invalidated=true;return true;}
    const goal=p.plan.goal;
    // Let an urgent task actually finish. Otherwise simultaneous hunger and
    // exhaustion restart the same meal every tick and the person never eats.
    if(p.hunger<15&&['eat','aid','earnFood','makeMeal'].includes(goal))return false;
    if(p.energy<9&&goal==='rest'&&p.hunger>=15)return false;
    if(p.health<30&&goal==='heal'&&p.hunger>=15&&p.energy>=9)return false;
    if(p.hunger<15&&!['eat','aid','earnFood','makeMeal'].includes(goal))return true;
    if(p.energy<9&&goal!=='rest')return true;
    if(p.health<30&&goal!=='heal')return true;
    return false;
  }
  const api={options,choose,shouldReplan,clamp};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigBrain=api;
})(typeof window!=='undefined'?window:globalThis);
