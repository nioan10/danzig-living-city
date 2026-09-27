(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const World=node?require('./world.js'):root.DanzigWorld;
  const Brain=node?require('./brain.js'):root.DanzigBrain;
  const Bridge=node?require('./decision-bridge.js'):root.DanzigDecisionBridge;
  const Events=node?require('./events.js'):root.DanzigEvents;
  const Systems=node?require('./city-systems.js'):root.DanzigSystems;
  const Learning=node?require('./learning.js'):root.DanzigLearning;
  const Mind=node?require('./citizen-mind.js'):root.DanzigMind;
  const Intentions=node?require('./intentions.js'):root.DanzigIntentions;
  const Social=node?require('./social-life.js'):root.DanzigSocial;
  const Civic=node?require('./civic-life.js'):root.DanzigCivic;
  const Residences=node?require('./residences.js'):root.DanzigResidences;
  const Agreements=node?require('./agreements.js'):root.DanzigAgreements;
  const EnterprisePolicy=node?require('./enterprise-policy.js'):root.DanzigEnterprisePolicy;
  const Labour=node?require('./labour.js'):root.DanzigLabour;
  const Planner=node?require('./citizen-planner.js'):root.DanzigPlanner;
  const Finance=node?require('./finance.js'):root.DanzigFinance;
  const Commerce=node?require('./commerce.js'):root.DanzigCommerce;
  const Expansion=node?require('./expansion.js'):root.DanzigExpansion;
  const Housing=node?require('./housing.js'):root.DanzigHousing;
  const Titles=node?require('./titles.js'):root.DanzigTitles;
  const Guilds=node?require('./guilds.js'):root.DanzigGuilds;
  const Report=node?require('./report.js'):root.DanzigReport;
  const Analytics=node?require('./analytics.js'):root.DanzigAnalytics;
  const Households=node?require('./households.js'):root.DanzigHouseholds;
  const Products=node?require('./products.js'):root.DanzigProducts,Accounts=node?require('./enterprise-accounts.js'):root.DanzigEnterpriseAccounts,Construction=node?require('./construction.js'):root.DanzigConstruction;
  const Development=node?require('./development.js'):root.DanzigDevelopment;
  const Government=node?require('./government.js'):root.DanzigGovernment;
  const YEAR=24,STEP=5,clamp=Brain.clamp;
  const recipe=(inputs,out,amount,time)=>({inputs,out,amount,time});
  const TYPES={
    home:{name:'Жилой дом',symbol:'⌂',color:'#946b4f',description:'Семейный двор с отдельными припасами. Жители приносят покупки домой и делятся едой.'},
    farm:{name:'Хутор',symbol:'♧',color:'#9a8857',job:'Земледелец',slots:2,recipe:recipe({},'grain',7,70),description:'Поля за Высокими воротами. Дорога от города занимает время; урожай зависит от сезона.'},
    mill:{name:'Мельница',symbol:'✣',color:'#9a7c5e',job:'Мельник',slots:2,recipe:recipe({grain:3},'flour',5,60),description:'Ветряная мельница за городской стеной. Зерно надо привезти с хутора, а муку доставить пекарям.'},
    bakery:{name:'Пекарня',symbol:'♨',color:'#aa6951',job:'Пекарь',slots:3,recipe:recipe({flour:2,wood:.3},'bread',7,50),description:'Пекари запасают муку и дрова, пекут хлеб и продают его жителям и торговцам.'},
    wood:{name:'Лесной промысел',symbol:'♠',color:'#788368',job:'Лесоруб',slots:2,recipe:recipe({},'wood',5,80),description:'Заготовка леса вне города. Отсюда возят древесину на пильный двор, к углежогу и в пекарню.'},
    fish:{name:'Рыбацкий двор',symbol:'≈',color:'#6d8580',job:'Рыбак',slots:2,recipe:recipe({},'fish',6,65),description:'Рыбаки живут у воды за портовыми воротами и продают улов на месте.'},
    pasture:{name:'Овечий двор',symbol:'♧',color:'#899064',job:'Овчар',slots:1,recipe:recipe({},'wool',4,100),description:'Пастбище за стенами. Шерсть покупают городские ткачи.'},
    weaver:{name:'Суконный двор',symbol:'▥',color:'#83758b',job:'Ткач',slots:1,recipe:recipe({wool:2},'cloth',3,100),description:'Ткачи покупают шерсть и делают ткань для портняжной мастерской.'},
    tailor:{name:'Портняжная',symbol:'✂',color:'#aa8069',job:'Портной',slots:1,recipe:recipe({cloth:2},'clothes',2,130),description:'Ткань превращается в одежду. Горожане заменяют изношенные вещи.'},
    sawmill:{name:'Пильный двор',symbol:'▤',color:'#8b795a',job:'Пильщик',slots:1,recipe:recipe({wood:3},'planks',5,100),description:'Распил брёвен в доски для столярных заказов и ремонта.'},
    carpenter:{name:'Столярный двор',symbol:'⚒',color:'#978364',job:'Столяр',slots:1,recipe:recipe({planks:3},'furniture',2,150),description:'Из досок делают сундуки, столы и предметы домашнего обихода.'},
    charcoal:{name:'Углежог',symbol:'◒',color:'#716b58',job:'Углежог',slots:1,recipe:recipe({wood:3},'coal',5,110),description:'Древесный уголь нужен кузнечному горну. Производство расположено у леса.'},
    smith:{name:'Кузница',symbol:'⚒',color:'#77716c',job:'Кузнец',slots:1,recipe:recipe({iron:1,coal:2},'tools',3,130),description:'Привозное железо и древесный уголь превращаются в инструменты. Инструменты изнашиваются в работе.'},
    clay:{name:'Глиняный карьер',symbol:'◈',color:'#a28b63',job:'Землекоп',slots:1,recipe:recipe({},'clay',5,110),description:'Глину добывают за городом и доставляют гончару.'},
    potter:{name:'Гончарный двор',symbol:'♨',color:'#b27c59',job:'Гончар',slots:1,recipe:recipe({clay:2,wood:.5},'pottery',3,120),description:'Посуда из глины обжигается в печи. Горожане покупают её для дома.'},
    tavern:{name:'Трактир',symbol:'♜',color:'#9e6c4e',job:'Трактирщик',slots:1,description:'Место встреч и обмена сведениями. Знакомые рассказывают о поставщиках и работе.'},
    church:{name:'Церковь',symbol:'✝',color:'#966f61',job:'Священнослужитель',slots:1,description:'Молитва, помощь бедным и встречи прихожан. При церкви хранят небольшой запас хлеба.'},
    hall:{name:'Ратуша',symbol:'⚑',color:'#a57364',job:'Писарь',slots:1,description:'Совет собирает налоги и помогает городу. Выборы проходят каждые 12 дней.'},
    market:{name:'Торговая лавка',symbol:'◇',color:'#a78c59',job:'Торговец',slots:1,description:'У этой лавки собственные товары, цены и деньги. Продавец пополняет запасы у производителей.'},
    clinic:{name:'Лечебница',symbol:'+',color:'#8a9872',job:'Лекарь',slots:1,description:'Лекарь лечит посетителей, когда находится на месте. Близкие также могут ухаживать за заболевшими.'},
    school:{name:'Школа',symbol:'▤',color:'#99836b',job:'Учитель',slots:1,description:'Учёба конкурирует с усталостью, голодом и желанием пообщаться.'},
    dock:{name:'Пристань',symbol:'⚓',color:'#848578',job:'Портовый рабочий',slots:1,description:'Пристань импортирует железо и ограниченные запасы муки. Это запасной, более дорогой поставщик.'},
  };
  const GOODS={...Products.names,grain:'Зерно',flour:'Мука',bread:'Хлеб',fish:'Рыба',wood:'Древесина',tools:'Инструменты',wool:'Шерсть',cloth:'Ткань',clothes:'Одежда',planks:'Доски',furniture:'Мебель',coal:'Уголь',iron:'Железо',clay:'Глина',pottery:'Посуда'};
  const PRICES={...Products.prices,grain:.35,flour:.6,bread:1,fish:1,wood:.3,tools:3,wool:.7,cloth:1.3,clothes:4,planks:.65,furniture:5,coal:.4,iron:1.4,clay:.3,pottery:2};
  const TRAITS=['Трудолюбивый','Общительный','Набожный','Амбициозный','Добрый','Ленивый','Бережливый','Вспыльчивый','Замкнутый'];
  const FIRST={m:['Ганс','Мартин','Якоб','Петер','Никлас','Йоханн','Пауль','Георг','Лукас','Отто','Конрад','Матиас'],f:['Анна','Грета','Марта','Эльза','Клара','Хелена','Агнес','Доротея','Мария','Урсула','София','Катерина']};
  const LAST=['Фогель','Беккер','Крюгер','Вебер','Фишер','Шульц','Мюллер','Шнайдер','Бауэр','Кох','Вольф','Брандт'];
  const ACTION_LABELS={civicOffence:'Совершает правонарушение',civicService:'Выполняет общественные работы',title:'Получает титул в ратуше',buildPickup:'Получает стройматериалы',buildDeliver:'Доставляет на стройку',buildWork:'Строит',buyHousehold:'Покупает вещи для семьи',storeHousehold:'Несёт семейную покупку домой',useHousehold:'Обустраивает быт семьи',invest:'Вкладывает средства в свой двор',negotiate:'Обсуждает договорённость',answerDeal:'Отвечает на предложение',repay:'Возвращает долг',bargain:'Договаривается об оплате',seekWork:'Изучает вакансии',develop:'Развивает свой двор',charter:'Учреждает семейную гильдию',commission:'Оформляет предприятие',relocate:'Ищет просторный дом',eatBag:'Ест',eatHome:'Ест дома',buyFood:'Покупает продукты',storeFood:'Пополняет домашний запас',charity:'Просит помощи',rest:'Отдыхает',heal:'У лекаря',pickup:'Получает груз',deliver:'Доставляет сырьё',work:'Работает',repair:'Ремонтирует',hire:'Ищет работу',learn:'Учится',social:'Общается',pray:'На службе',care:'Ухаживает за близким',observe:'Узнаёт новости'};
  class Simulation{
    constructor(seed=1450){
      this.layoutVersion=World.Layout.version;this.seed=seed;this.day=0;this.minute=430;this.remainder=0;this.tax=12;this.treasury=320;
      this.people=[];this.buildings=World.buildings();this.events=[];this.nextId=1;this.weather='Ясно';this.festivalDay=-10;this.births=0;this.deaths=0;this.produced=0;
      this.deliveries=0;this.decisions=0;this.advisor={enabled:false,provider:null,lastRequests:[]};
      this.seedStocks();this.makePeople();this.mayorId=1;
      Object.assign(this.people[0],{role:'Бургомистр',jobId:'hall',reputation:78,traits:['Амбициозный','Общительный']});
      Systems.ensure(this);Finance.ensure(this);this.assignJobs(true);for(const p of this.people)this.initializeMind(p);
      Systems.ensure(this);Finance.ensure(this);Commerce.ensure(this,PRICES);Expansion.ensure(this);Housing.ensure(this);Report.ensure(this);Guilds.ensure(this);Development.ensure(this);Government.ensure(this);Agreements.ensure(this);for(const b of this.buildings)if(this.productionRecipe(b))EnterprisePolicy.ensure(this,b);Households.ensure(this);Titles.founders(this);Civic.ensure(this);Construction.ensure(this);for(const b of this.buildings)Accounts.ensure(this,b);Analytics.sample(this);this.log('Открылись Высокие ворота. По просёлку к городу идут земледельцы и ремесленники.','life');
    }
    random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
    pick(a){return a[Math.floor(this.random()*a.length)];}
    get now(){return this.day*1440+this.minute;}
    get living(){return this.people.filter(p=>p.alive);}
    get alive(){return this.people.filter(p=>p.alive&&p.absence?.status!=='away');}
    get goods(){const result=Object.fromEntries(Object.keys(GOODS).map(k=>[k,0]));for(const b of this.buildings)for(const k of Object.keys(result))result[k]+=b.stock[k]||0;for(const k of Object.keys(result))result[k]+=this.commerce?.stock[k]||0;for(const p of this.alive){for(const k of Object.keys(result))result[k]+=p.bag[k]||0;if(p.cargo)result[p.cargo.good]+=p.cargo.amount;if(p.constructionCargo)result[p.constructionCargo.good]+=p.constructionCargo.amount;}for(const {q}of Construction.contracts(this))for(const [g,n]of Object.entries(q.stock))result[g]+=n;return result;}
    get food(){const g=this.goods;return Math.floor(Products.food(g));}
    get happiness(){const p=this.alive;return p.length?Math.round(p.reduce((n,x)=>n+x.mood,0)/p.length):0;}
    get year(){return 1450+Math.floor(this.day/YEAR);}
    get season(){return ['Весна','Лето','Осень','Зима'][Math.floor(this.day%YEAR/6)];}
    get hour(){return Math.floor(this.minute/60);}
    person(id){return this.people.find(p=>p.id===Number(id));}
    building(id){return this.buildings.find(b=>b.id===id);}
    goodName(id){return GOODS[id]||id;}
    workers(id){return this.alive.filter(p=>p.jobId===id);}
    occupants(id){return this.alive.filter(p=>p.location===id&&!p.path.length);}
    entrance(b){return {...b.door};}
    log(text,type='life',personId=null,details={}){Events.ensure(this);const event=Events.decorate({day:this.day,minute:Math.floor(this.minute),text,type,personId,...details},++this.eventSerial);this.events.unshift(event);this.events=this.events.slice(0,300);Report.record(this,event);return event;}
    triggerEvent(type,targetId){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};return Events.trigger(this,type,targetId);}
    eventSummary(){return Events.summary(this);}
    eventCandidates(p,add,step){Events.candidates(this,p,add,step);}
    routeBetween(a,b){return World.route(a,b)||[];}
    buildingType(type){return TYPES[type].name;}
    startConstruction(id,type){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};return Expansion.build(this,id,type);}
    inviteFamily(){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};return Expansion.settlement(this);}
    titleCandidate(p,add,step){Titles.candidates(this,p,add,step);}
    setTitlePolicy(data){return Titles.configure(this,data);}
    housingCandidate(p,add,step){return Housing.candidate(this,p,add,step);}
    guildCandidate(p,add,step){Guilds.candidate(this,p,add,step);}
    initializeDevelopment(){Guilds.ensure(this);Development.ensure(this);}
    developmentCandidate(p,add,step){Development.candidate(this,p,add,step);}
    recordHouseholdIncome(p,amount){Households.income(this,p,amount);}
    householdDemand(){return Households.market(this);}
    householdFoodMoney(p){return Households.foodMoney(this,p);}
    invalidateHouseholds(){Households.invalidate(this);}
    governmentOfficer(key){return Government.officer(this,key);}
    recordGovernment(key,p,text){Government.record(this,key,p,text,false);}
    reviewDevelopment(){if(this.conclusion)return{ok:false,message:'История завершена'};return Development.review(this);}
    setDevelopmentAuto(enabled){if(this.conclusion)return{ok:false,message:'История завершена'};this.development.auto=!!enabled;Development.review(this);return{ok:true,message:enabled?'Владельцы снова принимают решения об улучшениях.':'Новые улучшения приостановлены; оплаченные работы завершатся.'};}
    setOfficeAutonomy(key,enabled){return Government.setAutonomy(this,key,enabled);}
    openedEnterprise(b){Guilds.ensure(this);Development.ensure(this);if(b.enterprise)b.enterprise.openingCash=b.cash;}
    payGuildDividend(p,n){Finance.wage(this,p,n);}
    setOutsidePolicy(data){if(this.conclusion)return{ok:false,message:'История завершена'};const r=Commerce.configureOutside(this,data);if(r.ok)Government.ensure(this).manual.port=true;return r;}
    decidePermit(id,approve){if(this.conclusion)return{ok:false,message:'История завершена'};return Guilds.decidePermit(this,id,approve);}
    setGuildPolicy(data){if(this.conclusion)return{ok:false,message:'История завершена'};const r=Guilds.configure(this,data);if(r.ok){const v=Government.ensure(this);v.manual.seneschal=true;v.manual.guildmaster=true;}return r;}
    guildCouncil(){if(this.conclusion)return{ok:false,message:'История завершена'};return Guilds.review(this);}
    get capacity(){return Expansion.capacity(this);}
    buildingCapacity(b){return Housing.room(b);}
    productionRecipe(b){return Development.recipe(b,Products.recipe(b,TYPES[b.type].recipe));}
    productRecipes(b){return Products.all(b,TYPES[b.type].recipe);}
    foodAmount(stock){return Products.food(stock);}
    constructionDemand(){return Construction.demand(this);}
    hiringSlots(b){return Math.min(this.jobSlots(b),b.management?.targetWorkers??this.jobSlots(b));}
    jobSlots(b){return b.construction?0:(TYPES[b.type].slots||0)+(TYPES[b.type].recipe?Development.level(b)-1+(Development.has(b,2)?1:0):0);}
    changeTreasury(amount,category){return Systems.money(this,amount,category);}
    triggerCrisis(type,options){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};return Systems.startCrisis(this,type,options);}
    saveCustomEvent(data){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};return Systems.saveCustom(this,data);}
    runCustomEvent(id){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};return Systems.runCustom(this,id);}
    regionBill(){return Systems.regionalBill(this);}
    setRegion(data){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};return Systems.configureRegion(this,data);}
    payRegionDebt(){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};return Systems.collect(this,true);}
    setCommerce(data){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};const reserve=this.commerce.reserveDays,r=Commerce.configure(this,data);if(r.ok&&this.commerce.reserveDays!==reserve)Government.ensure(this).manual.port=true;return r;}
    setTaxes(data){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};return Finance.configureTaxes(this,data);}
    setTithe(data){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};return Finance.configureTithe(this,data);}
    setFiscalAutonomy(enabled){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};return Finance.setAuto(this,enabled);}
    fiscalBudget(){return Finance.budget(this);}
    housingExpense(p){return Housing.rent(this,p);}
    recordHousingExpense(p,amount){Households.charge(this,p,'landRent',amount);}
    spendDevelopmentFund(amount){Finance.Budget.capitalSpent(this,amount);}
    setPropertyTax(data){if(this.conclusion)return{ok:false,message:'История завершена.'};return Finance.Property.configure(this,data);}
    learningBias(p,goal){return Learning.bias(this,p,goal);}
    seedStocks(){
      for(const b of this.buildings){b.stock=Object.fromEntries(Object.keys(GOODS).map(k=>[k,0]));const r=TYPES[b.type].recipe;
        if(r){for(const [good,n]of Object.entries(r.inputs))b.stock[good]=n*10;b.stock[r.out]=r.amount*4;b.stock.tools=b.type==='smith'?12:3;}
        if(b.type==='home'){b.stock.bread=5;b.stock.fish=1;}
      }
      Object.assign(this.building('market').stock,{bread:55,fish:20,clothes:8,pottery:8});
      Object.assign(this.building('market2').stock,{bread:30,fish:15,clothes:6,pottery:5});
      Object.assign(this.building('dock').stock,{iron:70,flour:65,grain:80,wood:40});
      this.building('church').stock.bread=35;
    }
    createPerson(name,surname,sex,age,homeId){
      const b=this.building(homeId),id=this.nextId++;
      const p={id,estate:Housing.district(b).estate,name:name+' '+surname,firstName:name,surname,sex,age,bornDay:Math.floor(this.random()*YEAR),homeId,
        traits:[...new Set([this.pick(TRAITS),this.pick(TRAITS)])],hunger:67+this.random()*26,energy:72+this.random()*26,social:45+this.random()*45,faith:45+this.random()*45,mood:72,health:100,
        coins:age<16?0:25+Math.floor(this.random()*70),reputation:30+Math.floor(this.random()*40),skill:1+this.random()*2,spouseId:null,parents:[],friendId:null,jobId:null,
        role:age<6?'Малыш':age<16?'Ученик':age>=65?'На покое':'Ищет ремесло',alive:true,x:b.door.x,y:b.door.y,goal:homeId,location:homeId,navNode:'b:'+homeId,
        path:[],action:'Дома',reason:'Обдумывает планы на день',work:0,earned:0,earnedToday:0,dailySocial:false,lastBirth:-100,sick:false,
        bag:{},cargo:null,plan:null,memories:[],knowledge:{},considered:[],relationships:{},failures:0,clothing:90,ambition:'Обеспечить семью',lastReview:-1};
      this.people.push(p);Civic.person(p);Titles.person(p);Households.person(p);Households.invalidate(this);return p;
    }
    makePeople(){LAST.forEach((surname,i)=>{const older=i>=10;
      const a=this.createPerson(FIRST.m[i],surname,'m',older?68+i%4:31+i%9,'h'+i),b=this.createPerson(FIRST.f[i],surname,'f',older?65+i%3:27+i%10,'h'+i);a.spouseId=b.id;b.spouseId=a.id;
      const c=this.createPerson(FIRST.m[(i+4)%12],surname,'m',older?23:11+i%9,'h'+i),d=this.createPerson(FIRST.f[(i+6)%12],surname,'f',older?20:4+i%7,'h'+i);c.parents=[a.id,b.id];d.parents=[a.id,b.id];});}
    assignJobs(initial=false){
      const priority=['bakery','farm','mill','fish','wood','clinic','church','market','pasture','weaver','tailor','sawmill','charcoal','smith','clay','potter','carpenter','tavern','school','dock','market2',...this.buildings.filter(b=>b.expansion&&TYPES[b.type].job&&!b.construction).map(b=>b.id)];
      for(const p of this.alive){if(p.absence)continue;if(p.age<16)p.role=p.age<6?'Малыш':'Ученик';if(p.age>=65&&p.id!==this.mayorId){p.jobId=null;p.role='На покое';}if(p.age<16||p.age>=65||p.jobId)continue;
        if(!initial){p.role='Ищет ремесло';continue;}
        const id=priority.find(id=>this.workers(id).length===0)||priority.find(id=>this.workers(id).length<this.jobSlots(this.building(id)));
        if(id){p.jobId=id;p.role=TYPES[this.building(id).type].job;if(!this.building(id).ownerId)this.building(id).ownerId=p.id;}else p.role='Свободный горожанин';
      }
    }
    initializeMind(p){p.patronage??=[];Learning.ensure(this,p);Mind.ensure(this,p);Labour.ensure(this,p);p.knowledge={};for(const b of this.buildings)if(b.type!=='home')p.knowledge[b.id]={stock:{...b.stock},seenAt:this.now,price:this.price(b,'bread'),prices:Object.fromEntries(Object.keys(GOODS).map(g=>[g,this.price(b,g)])),source:'town',confidence:.45,hops:0};if(p.jobId)Labour.observe(this,p,this.building(p.jobId));p.plan=null;p.considered=[];this.reviewLife(p,'settlement');}
    reviewLife(p,kind){
      const response=Bridge.request({kind,personId:p.id,needs:{money:p.coins,health:p.health},memories:p.memories.slice(0,3)});
      this.advisor.lastRequests.unshift({personId:p.id,kind,at:this.now,status:response.status});this.advisor.lastRequests=this.advisor.lastRequests.slice(0,8);
      Mind.review(this,p);p.lastReview=this.day;
    }
    remember(p,kind,subject,text,value=0){const old=p.memories.find(m=>m.kind===kind&&m.subject===subject);if(old&&this.now-old.at<180){old.at=this.now;old.text=text;return;}p.memories.unshift({kind,subject,text,value,at:this.now});p.memories=p.memories.slice(0,14);}
    trust(p,id){return clamp(p.memories.filter(m=>m.subject===id).reduce((n,m)=>n+m.value,0),-40,40);}
    recentFailure(p,id,kind){return p.memories.some(m=>m.subject===id&&m.kind===kind&&this.now-m.at<(kind==='unpaid'?1440:180));}
    observe(p,b){p.knowledge[b.id]={stock:{...b.stock},seenAt:this.now,price:this.price(b,'bread'),prices:Object.fromEntries(Object.keys(GOODS).map(g=>[g,this.price(b,g)])),source:'personal',confidence:1,hops:0};Labour.observe(this,p,b);}
    supplyCost(buyer,seller,good,amount){return (amount-Commerce.credit(this,buyer,seller,good,amount))*this.price(seller,good);}
    supplyAmount(buyer,seller,good,wanted){
      const r=this.productionRecipe(buyer),credit=Commerce.credit(this,buyer,seller,good,wanted);
      const other=r?Object.entries(r.inputs).reduce((n,[g,a])=>n+(g===good?0:Math.ceil(Math.max(0,a-buyer.stock[g]))*this.commerce.prices[g]),0):0;
      const reserve=buyer.wage*2+other,affordable=Math.floor((Math.max(0,buyer.cash-reserve)+1e-8)/this.price(seller,good)),amount=Math.min(wanted,credit+affordable);
      const minimum=r?.inputs[good]?Math.max(1,Math.ceil(r.inputs[good]-buyer.stock[good])):1;
      return amount>=minimum?amount:0;
    }
    price(b,good){return Commerce.price(this,b,good,PRICES);}
    suppliers(p,good,amount=1,exclude=null){const offers=[];for(const [id,known]of Object.entries(p.knowledge)){
      const b=this.building(id);if(!b||id===exclude||b.type==='home'||b.type==='church'||this.recentFailure(p,id,'empty')||this.recentFailure(p,id,'closed'))continue;
      for(const g of good==='food'?Products.foods:[good])if(((known.stock[g]||0)>=amount||this.now-known.seenAt>240)&&(this.productRecipes(b).some(r=>r.out===g)||b.type==='market'&&['bread','fish','biscuits','clothes','pottery'].includes(g)||b.type==='dock'&&['iron','grain','flour','wood'].includes(g)))offers.push({id,good:g,price:known.prices?.[g]??this.price(b,g),score:this.travelMinutes(p,id)*.08+(known.prices?.[g]??this.price(b,g))*3-this.trust(p,id)*.1-Social.supplierBias(this,p,b,known)+((known.stock[g]||0)<amount?5:0),seenAt:known.seenAt});
    }return offers.sort((a,b)=>a.score-b.score);}
    travelMinutes(p,id){const from=p.path[0]?.id||p.navNode;return World.distance(from,'b:'+id)/this.walkSpeed(p);}
    walkSpeed(p){return (p.cargo||p.constructionCargo?4:p.age>65?4.5:6)*(Events.active(this,'storm')?.7:1)*(.8+.2*this.fiscal.infrastructure.condition/100);}
    isOpen(b){return !!b&&!b.construction&&!b.damaged&&b.closedUntil<=this.now&&!Systems.closed(this,b);}
    missingInput(b){const r=this.productionRecipe(b);if(b.type==='church'&&b.stock.bread<8)return{good:'bread',amount:18};if(b.type==='market'){for(const good of ['bread','fish'])if(b.stock[good]<8)return{good,amount:18};return null;}if(!r)return null;for(const [good,n]of Object.entries(r.inputs))if(b.stock[good]<n*2)return{good,amount:Math.max(3,Math.ceil(n*8))};if(b.stock.tools<.5&&b.type!=='smith')return{good:'tools',amount:3};return null;}
    overstock(b){const r=this.productionRecipe(b);return !!r&&b.stock[r.out]>=(b.enterprise?.stockLimit??Infinity)*EnterprisePolicy.factor(b);}
    canProduce(b){if(!this.isOpen(b))return false;const r=this.productionRecipe(b);return !r||!this.overstock(b)&&Object.entries(r.inputs).every(([k,n])=>b.stock[k]>=n);}
    jobOffers(p){return Labour.offers(this,p).map(o=>({...this.building(o.id),offer:o}));}
    netWage(p,gross){return Finance.splitWage(this,gross,p).net;}
    travel(p,id){if(p.goal===id&&p.path.length||p.location===id&&!p.path.length)return;const next=p.path[0],start=next?.id||p.navNode,route=World.route(start,'b:'+id);if(!route)return false;p.path=next?[{...next},...route]:route;p.goal=id;p.location=null;return true;}
    move(p,dt){
      let distance=dt*this.walkSpeed(p);p.motionSegments=[];
      while(p.path.length&&distance>0){const n=p.path[0],from=World.nodes[p.navNode],total=Math.hypot(n.x-from.x,n.y-from.y),dx=n.x-p.x,dy=n.y-p.y,d=Math.hypot(dx,dy),travel=Math.min(d,distance),start=total?clamp(1-d/total,0,1):0;
        if(total)p.motionSegments.push({from:p.navNode,to:n.id,start,end:Math.min(1,start+travel/total),distance:travel});
        this.statistics.distance+=travel;
        if(d<=distance){p.x=n.x;p.y=n.y;p.navNode=n.id;distance-=d;p.path.shift();}else{p.x+=dx/d*distance;p.y+=dy/d*distance;distance=0;}
      }
      if(!p.path.length&&p.navNode==='b:'+p.goal){if(p.location!==p.goal)this.statistics.trips++;p.location=p.goal;}
    }

    fail(p,kind,subject,text){
      Intentions.fail(this,p,kind);
      const action=p.plan?.steps[p.plan.index],local=['unpaid','rejected','empty','expensive','closed','shortage','overstock','order'].includes(kind);
      if(local&&p.plan){p.plan.contextualFailure=true;Mind.record(this,p,subject,['unpaid','rejected'].includes(kind)||action?.kind==='work'?'employment':'trade',false,text);}
      const m=Mind.ensure(this,p);m.replans++;m.lastReplan=text;Learning.observe(this,p,p.plan,false,text);this.remember(p,kind,subject,text,-7);p.failures++;p.reason=text;p.plan=null;if(kind==='unpaid')this.reviewLife(p,'career');
    }
    decide(p){if(p.absence)return;if(Brain.shouldReplan(this,p)){const old=p.plan,candidate=Brain.choose(this,p);p.plan=old&&!old.invalidated&&candidate&&old.goal===candidate.goal&&old.steps.map(s=>s.target+s.kind).join('|')===candidate.steps.map(s=>s.target+s.kind).join('|')?old:candidate;if(p.plan){this.decisions++;p.plan.baseline??=Learning.baseline(p);p.reason=p.plan.reason;if(p.plan!==old)Mind.claim(this,p,p.plan);if(old&&old.goal!==p.plan.goal&&p.hunger<15){Mind.ensure(this,p).lastReplan='Отложил прежнее дело: нужно срочно поесть';this.remember(p,'replan',p.homeId,'Отложил прежнее дело: нужно срочно поесть');}}}const s=p.plan?.steps[p.plan.index];if(!s)return;p.action=ACTION_LABELS[s.kind]||s.label;this.travel(p,s.target);}
    eat(stock,p){if(Products.food(stock)<1-1e-8)return false;let left=1,nutrition=0;for(const good of Products.foods){const amount=Math.min(left,stock[good]||0);if(amount<=0)continue;stock[good]=Math.max(0,stock[good]-amount);this.statistics.consumption[good]=(this.statistics.consumption[good]||0)+amount;nutrition+=amount*(good==='biscuits'?50:58);left-=amount;}p.hunger=clamp(p.hunger+nutrition);return true;}
    execute(p,dt,housing){
      const plan=p.plan,s=plan?.steps[plan.index];if(!s||p.path.length||p.location!==s.target)return;const b=this.building(s.target);this.observe(p,b);s.elapsed+=dt;
      if(!this.isOpen(b)&&!['repair','rest','eatHome','storeFood','care','buildDeliver','buildWork'].includes(s.kind)){this.fail(p,'closed',b.id,b.name+': работа приостановлена. Нужно выбрать другой план.');return;}
      if(s.kind==='buildWork'){const result=Construction.execute(this,p,s,dt);if(!result.ok){this.fail(p,'shortage',b.id,result.message);return;}}
      if(s.kind==='work'){
        if(!this.canProduce(b)){this.fail(p,this.overstock(b)?'overstock':'shortage',b.id,this.overstock(b)?'Склад готовой продукции заполнен. Ждём покупателей.':'В мастерской закончились материалы. Нужно найти поставщика.');return;}
        if(p.jobId!==b.id){this.fail(p,'rejected',b.id,'Сначала нужно договориться о работе.');return;}
        const gross=Labour.rate(this,p,b)*dt/60;if(b.cash+1e-8<gross){this.fail(p,'unpaid',b.id,b.name+' не смог выплатить заработок. Рассматриваю другую работу.');return;}
        b.cash-=gross;Finance.wage(this,p,gross,b);Labour.worked(this,p,b,dt);p.work+=dt;if(this.productionRecipe(b)){p.tradeExperience??={};p.tradeExperience[b.type]=(p.tradeExperience[b.type]||0)+dt;}p.skill=Math.min(10,p.skill+dt*.0001);
        const r=this.productionRecipe(b);if(r){const factor=(p.traits.includes('Трудолюбивый')?1.3:1)*(.65+p.energy/200)*(b.stock.tools>.05?1:.8)*(p.sick?.5:1)*(b.type==='farm'&&this.season==='Зима'?.35:1)*(b.type==='farm'&&this.weather==='Дождь'?.8:1)*(Events.active(this,'storm')&&['farm','fish','wood','pasture','clay'].includes(b.type)?.35:1);b.progress+=dt*factor*Systems.productionFactor(this,b)*Development.workFactor(b);
          while(b.progress>=r.time&&this.canProduce(b)){for(const [k,n]of Object.entries(r.inputs)){Analytics.used(this,k,Math.min(b.stock[k],n));b.stock[k]=Math.max(0,b.stock[k]-n);}Commerce.produce(this,b,r.out,r.amount);b.today+=r.amount;b.output+=r.amount;this.produced+=r.amount;this.statistics.production[r.out]=(this.statistics.production[r.out]||0)+r.amount;b.progress-=r.time;Analytics.used(this,'tools',Math.min(b.stock.tools,.015*(Development.has(b,3)?.7:1)));b.stock.tools=Math.max(0,b.stock.tools-.015*(Development.has(b,3)?.7:1));}
        }
      }
      if(s.kind==='rest')p.energy=clamp(p.energy+dt*.23*(b.type==='home'?(Development.has(b,1)?1.15:1)*((housing||Housing.census(this)).get(b.id)?.restFactor??1):1));
      if(s.kind==='social'){p.social=clamp(p.social+dt*(Events.active(this,'feast')&&p.location==='market'?.8:.5)*(['tavern','market'].includes(b.type)?Development.serviceFactor(b):1));if(s.elapsed===dt){if(b.type==='tavern'&&p.coins>20){p.coins-=1;Finance.sale(this,b,1);}this.socialize(p);}}
      if(s.kind==='pray'){p.faith=clamp(p.faith+dt*.65*Development.serviceFactor(b));p.social=clamp(p.social+dt*.12);}
      if(s.kind==='learn'){p.social=clamp(p.social+dt*.25);p.skill=Math.min(10,p.skill+dt*.0005*Development.serviceFactor(b));}
      if(s.kind==='heal'){const doctor=this.workers('clinic').find(d=>d.location==='clinic');if(doctor){p.health=clamp(p.health+dt*(doctor.id===p.id?.18:.4)*Development.serviceFactor(b));if(p.health>90)p.sick=false;}}
      if(s.kind==='care'){const q=this.person(s.personId);if(q?.alive){q.health=clamp(q.health+dt*.04);q.social=clamp(q.social+dt*.3);p.social=clamp(p.social+dt*.15);}}
      if(s.kind==='repair'&&b.damaged){b.repairWork+=dt;if(b.repairWork>=(Events.active(this,'fire')?.targetId===b.id?80:200)){b.damaged=false;b.repairWork=0;b.repairedDay=this.day;this.log(p.name+' помог восстановить '+b.name+'.','economy',p.id);}}
      if(s.elapsed<s.duration)return;
      if(['buildPickup','buildDeliver'].includes(s.kind)){const result=Construction.execute(this,p,s,dt);if(!result.ok){this.fail(p,'empty',b.id,result.message);return;}}
      if(['buyHousehold','storeHousehold','useHousehold'].includes(s.kind)){const result=Households.execute(this,p,b,s,Finance.sale);if(!result.ok){this.fail(p,'expensive',b.id,result.message);return;}}
      if(['negotiate','answerDeal','repay'].includes(s.kind)){const result=Agreements.execute(this,p,s);if(result.pending)return;if(!result.ok){this.fail(p,'deal',b.id,result.message);return;}}
      if(s.kind==='bargain'){const result=Labour.raise(this,p,b);if(!result.ok){this.fail(p,'deal',b.id,result.message);return;}}
      if(s.kind==='invest'){const result=EnterprisePolicy.invest(this,p,b);if(!result.ok){this.fail(p,'deal',b.id,result.message);return;}}
      if(s.kind==='eatHome'&&!this.eat(b.stock,p)){this.fail(p,'empty',b.id,'Домашний запас закончился. Нужно достать продукты.');return;}
      if(s.kind==='eatBag'&&!this.eat(p.bag,p)){this.fail(p,'empty',b.id,'Дорожный запас уже съеден.');return;}
      if(s.kind==='buyFood'){if(!Households.foodPurchase(this,p,b,s.good,s.amount,Finance.sale)){this.fail(p,b.stock[s.good]<1?'empty':'expensive',b.id,b.name+': покупка не состоялась. Воспоминание повлияет на следующий выбор.');return;}this.remember(p,'trade',b.id,'Удачная покупка в '+b.name,2);Social.bought(this,p,b);}
      if(s.kind==='storeFood'){for(const good of Products.foods){b.stock[good]+=p.bag[good]||0;p.bag[good]=0;}}
      if(s.kind==='charity'){if(!this.eat(b.stock,p)){this.fail(p,'empty',b.id,'При церкви пока нет свободных пайков.');return;}this.remember(p,'help',b.id,'В трудный момент церковь поделилась едой',5);}
      if(s.kind==='pickup'){const employer=this.building(s.to),amount=Math.min(this.supplyAmount(employer,b,s.good,s.amount),Math.floor(b.stock[s.good])),credit=Commerce.credit(this,employer,b,s.good,amount),cost=(amount-credit)*this.price(b,s.good),paidCost=cost+credit*(this.commerce.orders.find(o=>o.buyer===employer.id&&o.seller===b.id&&o.good===s.good)?.unitPrice||this.price(b,s.good));if(amount<1){const affordable=this.supplyAmount(employer,b,s.good,s.amount);if(affordable<1){this.fail(p,'unpaid',employer.id,'На минимальную партию и оплату труда пока не хватает денег.');return;}const ordered=Commerce.order(this,employer,b,s.good,affordable);this.fail(p,ordered?'order':'empty',b.id,b.name+(ordered?': заказ оплачен заранее. Жду выпуска сырья.':': нужного сырья нет. Буду искать другого поставщика.'));return;}if(employer.cash<cost){this.fail(p,'unpaid',employer.id,'У мастерской не хватает денег на закупку.');return;}employer.cash-=cost;Commerce.credit(this,employer,b,s.good,amount,true);Finance.sale(this,b,cost,false,{good:s.good,amount:amount-credit});b.stock[s.good]-=amount;p.cargo={good:s.good,amount,to:s.to,from:b.id,paid:paidCost};this.remember(p,'supplier',b.id,'Получил '+amount+' ед. '+GOODS[s.good].toLowerCase()+' у '+b.name,3);}
      if(s.kind==='deliver'&&p.cargo){Accounts.purchased(this,b,p.cargo.good,p.cargo.amount,p.cargo.paid??p.cargo.amount*this.commerce.prices[p.cargo.good]);b.stock[p.cargo.good]+=p.cargo.amount;this.deliveries++;this.remember(p,'delivery',b.id,'Доставил '+p.cargo.amount+' ед. '+GOODS[p.cargo.good].toLowerCase()+' в мастерскую',2);p.cargo=null;}
      if(s.kind==='seekWork')Labour.search(this,p);
      if(s.kind==='hire'){const old=this.building(p.jobId),result=Labour.hire(this,p,b);if(!result.ok){this.fail(p,'rejected',b.id,result.message);return;}p.role=TYPES[b.type].job;this.log(p.name+(result.apprentice?' поступил в ученики: ':' выбрал новую работу: ')+b.name+'.','career',p.id);this.remember(p,'career',b.id,'Сменил работу'+(old?' после службы в '+old.name:''),3);this.reviewLife(p,'career');}
      if(['civicOffence','civicService'].includes(s.kind)){const result=Civic.execute(this,p,s);if(!result.ok){this.fail(p,'civic',b.id,result.message);return;}}
      if(s.kind==='title'){const result=Titles.grant(this,p,s.titleRank);if(!result.ok){this.fail(p,'title','hall',result.message);return;}}
      if(s.kind==='develop'){const result=Development.start(this,p,s.buildingId,s.optionId);if(!result.ok){p.developmentWish=null;this.fail(p,'development',s.buildingId,result.message);return;}}
      if(s.kind==='charter'){const result=Guilds.found(this,p);if(!result.ok){p.enterpriseWish=null;this.fail(p,'enterprise',p.jobId,result.message);return;}}
      if(s.kind==='commission'){const result=Guilds.commission(this,p,s);if(!result.ok){p.enterpriseWish=null;this.fail(p,'enterprise',s.lotId,result.message);return;}}
      if(s.kind==='relocate'){const result=Housing.relocate(this,p,s.to,s.from);if(!result.ok){this.fail(p,'housing',s.to,result.message);return;}Learning.observe(this,p,plan,true);return;}
      if(['buyFood','pickup','buyHousehold'].includes(s.kind))Mind.record(this,p,b.id,'trade',true,'Покупка состоялась');
      if(s.kind==='observe'){if(b.type==='market')Labour.search(this,p);this.socialize(p);}plan.index++;if(plan.index>=plan.steps.length){Learning.observe(this,p,plan,true);p.plan=null;}
    }
    socialize(p){const q=this.pick(this.occupants(p.location).filter(q=>q.id!==p.id&&Math.abs(q.age-p.age)<30));if(!q)return;Mind.gossip(this,p,q);Labour.gossip(this,p,q);Social.share(this,p,q);if(p.dailySocial)return;p.dailySocial=true;Civic.encounter(this,p,q);
      const hostile=p.traits.includes('Вспыльчивый')&&p.mood<65;p.relationships[q.id]=clamp((p.relationships[q.id]||0)+(hostile?-12:8),-100,100);q.relationships[p.id]=clamp((q.relationships[p.id]||0)+(hostile?-9:5),-100,100);
      this.remember(p,hostile?'quarrel':'conversation',q.id,(hostile?'Поссорился с ':'Обменялся новостями с ')+q.name,hostile?-8:3);if(hostile){p.mood=clamp(p.mood-6);this.log(p.name+' и '+q.name+' разошлись после ссоры.','conflict',p.id);}else if(p.relationships[q.id]>=16){if(p.friendId!==q.id)this.log(p.name+' и '+q.name+' стали ближе после разговора.','friendship',p.id);p.friendId=q.id;q.friendId=p.id;}
    }
    tick(dt){if(this.conclusion)return;Expansion.tick(this);Development.tick(this);Systems.tick(this);Events.tick(this);const housing=Housing.census(this);for(const p of this.alive){if(p.arriving){this.move(p,dt);if(!p.path.length)p.arriving=false;continue;}if(p.absence){Systems.serviceStep(this,p,dt);continue;}p.hunger=clamp(p.hunger-dt*.046);p.energy=clamp(p.energy-dt*.028);p.social=clamp(p.social-dt*.018);p.faith=clamp(p.faith-dt*.014);if(p.relocation){Housing.travelStep(this,p,dt);}else{this.decide(p);const current=p.plan?.steps[p.plan.index],employer=this.building(p.jobId);if(employer&&((current?.kind==='pickup'&&current.to===employer.id)||(current?.kind==='deliver'&&p.cargo?.to===employer.id))){const wage=Labour.rate(this,p,employer)*dt/60;if(employer.cash>=wage){employer.cash-=wage;Finance.wage(this,p,wage,employer);Labour.worked(this,p,employer,dt);p.work+=dt;}}this.move(p,dt);this.execute(p,dt,housing);}if(p.hunger<5)p.health=clamp(p.health-dt*.012);else if(!p.sick)p.health=clamp(p.health+dt*.012*(p.location===p.homeId&&Development.has(this.building(p.homeId),2)?1.2:1));else if(p.hunger>30&&p.energy>25){p.health=clamp(p.health+dt*.008*(p.location===p.homeId&&Development.has(this.building(p.homeId),2)?1.2:1));if(p.health>90)p.sick=false;}const mood=Households.comfort(p)+(Residences.spec(this.building(p.homeId))?.comfort||0)-(p.civic?.fear||0)*.08-(housing.get(p.homeId)?.penalty||0)+p.hunger*.26+p.energy*.23+p.social*.21+p.health*.2+p.faith*.1-this.tax*.3-(Finance.ensure(this).tithe.enabled?Finance.ensure(this).tithe.rate*.15:0)+(this.festivalDay===this.day?10:0)+(p.eventMood||[]).filter(e=>e.until>this.now).reduce((n,e)=>n+e.value,0);p.eventMood=(p.eventMood||[]).filter(e=>e.until>this.now);p.mood=clamp(p.mood+(mood-p.mood)*.025);if(p.health<=0)this.die(p,p.hunger<5?'умер от голода':'умер от болезни');}}
    advance(minutes){if(this.conclusion)return;if(!Number.isFinite(minutes)||minutes<0)throw Error('Некорректный интервал времени');this.remainder+=minutes;while(this.remainder>=STEP){this.remainder-=STEP;this.tick(STEP);this.minute+=STEP;if(this.minute>=1440){this.minute-=1440;this.day++;this.newDay();}Report.sample(this);Analytics.sample(this);}}
    nextMorning(){this.advance(1440-this.minute+360);}
    die(p,cause){if(!p.alive)return;Households.death(this,p);Construction.recover(this,p);p.alive=false;p.diedAt=this.now;p.deathCause=cause.includes('старости')?'oldAge':cause.includes('голода')?'hunger':cause.includes('болезни')?'illness':'other';p.path=[];p.plan=null;if(p.cargo){this.building(p.cargo.to).stock[p.cargo.good]+=p.cargo.amount;p.cargo=null;}this.deaths++;this.log(p.name+', '+p.age+' лет, '+cause+'.','death',p.id);const spouse=this.person(p.spouseId);if(spouse?.alive){spouse.spouseId=null;spouse.mood=clamp(spouse.mood-25);}if(p.id===this.mayorId)this.election();}
    newDay(){this.weather=Events.active(this,'storm')?'Гроза':this.pick(['Ясно','Ясно','Облачно','Дождь']);for(const b of this.buildings)b.today=0;
      for(const p of this.alive){p.earned=p.earnedToday;p.earnedToday=0;p.work=0;p.dailySocial=false;if(this.day%YEAR===p.bornDay){p.age++;if(p.age===16)this.log(p.name+' вступает во взрослую жизнь.','life',p.id);}if(!p.sick&&this.random()<.004){p.sick=true;p.health=Math.min(p.health,65);this.remember(p,'illness','self','Заболел; теперь здоровье важнее прежних дел');p.plan=null;}if(p.sick)p.health=clamp(p.health-1);if(p.age>70&&this.random()<(p.age-70)*.0005)this.die(p,'скончался от старости');if(this.day%3===0)this.reviewLife(p,'daily-reflection');}
      Products.spoil(this,Accounts.loss);Households.daily(this);Learning.teach(this);Commerce.daily(this,PRICES,TYPES);Government.daily(this);Housing.collectRent(this);Finance.daily(this);Systems.daily(this);Finance.prepareBudget(this);for(const p of this.living.filter(p=>p.absence?.status==='away'))if(this.day%YEAR===p.bornDay)p.age++;this.tradeWithOutside();this.householdPurchases();if(this.day%12===0)this.election();this.families();Households.invalidate(this);this.assignJobs();Housing.review(this);
      if(this.day%7===3&&this.random()<.55/(this.government.guard||1)){const b=this.pick(this.buildings.filter(b=>TYPES[b.type].recipe&&!b.damaged&&!b.construction));b.damaged=true;b.damageDay=this.day;this.log('Пожар повредил '+b.name+'. Работники решают, помочь ли с ремонтом.','fire');}
      Finance.Budget.repair(this);
      Finance.churchRelief(this);Finance.Budget.food(this);Finance.maintain(this);Guilds.daily(this);Agreements.daily(this);Development.daily(this);Civic.daily(this);
      if(this.day%6===0)this.log('Наступает '+this.season.toLowerCase()+'. Горожане пересматривают свои дела.','season');
    }
    tradeWithOutside(){const blocked=!!Systems.active(this,'blockade'),outside=this.commerce.outside,dock=this.building('dock');if(!blocked&&outside.importEnabled&&this.day%3===0){for(const [k,target]of [['iron',70],['flour',45],['grain',65]]){const price=this.commerce.prices[k],n=Math.min(Math.max(0,target*Development.serviceFactor(dock)-dock.stock[k]),Math.floor(Math.max(0,dock.cash-Finance.Budget.operatingReserve(this,dock))/price));dock.stock[k]+=n;dock.cash-=n*price;outside.totalImported+=n*price;}}
      for(const b of this.buildings){for(const r of this.productRecipes(b))if(r&&!b.construction&&!blocked&&outside.privateExport&&(!Products.foods.includes(r.out)||this.food>this.alive.length*this.commerce.reserveDays)){const limit=['bread','fish','flour','grain','wood'].includes(r.out)?65:18;const surplus=Math.max(0,b.stock[r.out]-limit),n=Products.foods.includes(r.out)?Math.min(surplus,Math.max(0,this.food-this.alive.length*this.commerce.reserveDays)):surplus;if(n){const deal=Commerce.sellOutside(this,r.out,n,Commerce.exportFloor(this,b,r.out));b.stock[r.out]-=deal.amount;Finance.sale(this,b,deal.revenue,true,{good:r.out,amount:deal.amount});}}}Finance.Budget.services(this);
    }
    householdPurchases(){Households.daily(this);}
    families(){const singles=this.alive.filter(p=>!p.absence&&p.age>=18&&p.age<45&&!p.spouseId);for(const a of singles){const b=singles.find(p=>p.id!==a.id&&!p.spouseId&&p.sex!==a.sex&&p.surname!==a.surname&&(a.relationships[p.id]||0)>=25&&!p.parents.some(id=>a.parents.includes(id))&&!p.parents.includes(a.id)&&!a.parents.includes(p.id));if(b){a.spouseId=b.id;b.spouseId=a.id;b.homeId=a.homeId;this.log(a.name+' и '+b.name+' создали семью после долгого знакомства.','family',a.id);break;}}
      if(this.food<this.alive.length)return;const mothers=this.alive.filter(p=>!p.absence&&p.sex==='f'&&p.age>=20&&p.age<43&&p.spouseId&&this.person(p.spouseId)?.alive&&!this.person(p.spouseId)?.absence&&this.day-p.lastBirth>=YEAR*2&&this.people.filter(c=>c.parents.includes(p.id)).length<4);if(mothers.length&&this.random()<.16){const m=this.pick(mothers),sex=this.pick(['m','f']),c=this.createPerson(this.pick(FIRST[sex]),m.surname,sex,0,m.homeId);c.parents=[m.id,m.spouseId];c.estate=m.estate;Titles.inherit(this,c);c.bornDay=this.day%YEAR;m.lastBirth=this.day;this.initializeMind(c);this.births++;this.log('В семье '+m.surname+' появился ребёнок — '+c.firstName+'.','family',c.id);}
    }
    election(){const candidates=this.alive.filter(p=>p.age>=25&&!p.absence);if(!candidates.length){this.mayorId=null;return;}const ranked=candidates.map(p=>({p,score:p.reputation+Social.politicalSupport(this,p)+(p.traits.includes('Амбициозный')?12:0)+(p.traits.includes('Общительный')?6:0)+this.random()*18})).sort((a,b)=>b.score-a.score);const old=this.person(this.mayorId);if(old?.alive){old.jobId=null;old.role='Ищет ремесло';old.plan=null;}const p=ranked[0].p;this.mayorId=p.id;p.role='Бургомистр';p.jobId='hall';p.plan=null;p.reputation=clamp(p.reputation+3);this.log('Совет избрал бургомистром '+p.name+'.','politics',p.id);if(this.government)Government.appoint(this);this.assignJobs();}
    act(action,buildingId=null){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};
      if(action==='disrupt'){const b=this.building(buildingId||'mill');if(!b||!TYPES[b.type].recipe)return{ok:false,message:'Выберите производство'};b.closedUntil=this.now+1440;this.log('Работа '+b.name+' остановлена на сутки. Поставщики и работники ищут выход.','experiment');return{ok:true,message:'Производство остановлено на сутки. Наблюдайте за планами работников.'};}
      if(action==='food'&&Systems.active(this,'blockade'))return{ok:false,message:'Блокада не позволяет закупить еду за пределами города'};
      if(action==='food'&&!this.commerce.outside.importEnabled)return{ok:false,message:'Регулярный импорт запрещён указом ратуши'};
      const prices={food:45,festival:65,repair:35};if(!(action in prices))return{ok:false,message:'Неизвестное решение'};if(action==='festival'&&this.festivalDay===this.day)return{ok:false,message:'Праздник уже объявлен'};const damaged=this.buildings.filter(b=>b.damaged);if(action==='repair'&&!damaged.length)return{ok:false,message:'Все здания в порядке'};if(this.treasury<prices[action])return{ok:false,message:'В казне не хватает талеров'};this.changeTreasury(-prices[action],action);
      if(action==='food'){this.building('market').stock.bread+=75;this.log('Совет доставил на рынок 75 порций хлеба за 45 талеров.','economy');}
      if(action==='festival'){this.festivalDay=this.day;for(const p of this.alive){p.mood=clamp(p.mood+10);if(!p.path.length)p.plan=null;}this.log('Совет объявил праздник на Длинном рынке. Каждый решает, может ли отложить дела.','festival');}
      if(action==='repair'){const b=damaged.find(b=>b.id===buildingId)||damaged[0];b.damaged=false;b.repairedDay=this.day;b.repairWork=0;this.log('Совет помог восстановить '+b.name+'.','economy');}return{ok:true,message:this.events[0].text};
    }
    setTax(v){if(this.conclusion)return{ok:false,message:'История завершена. Продолжите её из итогового отчёта.'};const next=Math.round(clamp(Number(v)||0,0,30)),f=Finance.ensure(this);f.taxes.income={enabled:next>0,rate:next};f.autoMayor=false;f.property.auto=false;if(next!==this.tax){this.tax=next;this.log('Совет установил налог '+next+'%.','politics');}}
    finish(){return Report.finish(this);}
    resume(){Report.resume(this);}
    toJSON(){return{version:2,state:{...this}};}
    static fromJSON(data){
      if(!data||![1,2].includes(data.version)||!data.state)throw Error('Несовместимое сохранение');const s=data.state,finite=(v,min=0,max=1e12)=>Number.isFinite(v)&&v>=min&&v<=max;
      if(!finite(s.day)||!finite(s.minute,0,1439.99)||!finite(s.seed,0,4294967295)||!finite(s.tax,0,30)||!finite(s.treasury)||!Array.isArray(s.people)||s.people.length>10000||!Array.isArray(s.buildings)||!Array.isArray(s.events))throw Error('Повреждённое сохранение');
      if(data.version===1){const sim=new Simulation(s.seed);for(const k of ['day','minute','remainder','tax','treasury','events','nextId','weather','festivalDay','births','deaths','produced','mayorId'])if(s[k]!==undefined)sim[k]=s[k];sim.people=[];
        for(const old of s.people){if(!sim.building(old.homeId)||!finite(old.age)||!finite(old.health))throw Error('Повреждённый житель');const p=sim.createPerson(old.firstName,old.surname,old.sex,old.age,old.homeId);const position={x:p.x,y:p.y,goal:p.goal,location:p.location,navNode:p.navNode};Object.assign(p,old,position,{path:[],bag:{},cargo:null,plan:null,memories:[],knowledge:{},considered:[],relationships:{},earnedToday:0,failures:0,clothing:90,lastReview:-1});if(!sim.building(p.jobId))p.jobId=null;sim.initializeMind(p);}
        sim.nextId=Math.max(s.nextId,...sim.people.map(p=>p.id+1));for(const b of sim.buildings){const workers=sim.workers(b.id).sort((a,b)=>(b.id===sim.mayorId?1:0)-(a.id===sim.mayorId?1:0));for(const p of workers.slice(TYPES[b.type].slots||0)){p.jobId=null;p.role='Ищет ремесло';}}sim.assignJobs();delete sim.region;delete sim.statistics;delete sim.accounts;delete sim.fiscal;delete sim.commerce;Systems.ensure(sim);Finance.load(sim);Commerce.load(sim,PRICES);Expansion.load(sim);Housing.load(sim);Housing.review(sim);delete sim.guilds;for(const b of sim.buildings){delete b.guildId;delete b.enterprise;}Guilds.load(sim);Development.load(sim);Government.load(sim);delete sim.reportArchive;Report.load(sim);delete sim.households;Households.load(sim);delete sim.titles;for(const p of sim.people)delete p.title;Titles.load(sim);delete sim.civic;for(const p of sim.people)delete p.civic;Civic.load(sim);Products.load(sim,TYPES);Accounts.load(sim);Construction.load(sim);delete sim.analytics;Analytics.load(sim);sim.log('Город перестроен: жители, семьи и казна сохранены. Маршруты и хозяйства начали новую главу.','life');return sim;
      }
      Products.migrate(s);const expected=World.buildings();if(s.buildings.length<expected.length||s.buildings.length>expected.length+World.expansionLots.length||new Set(s.buildings.map(b=>b.id)).size!==s.buildings.length||!expected.every(q=>s.buildings.some(b=>b.id===q.id&&b.type===q.type)))throw Error('Некорректные здания');for(const b of s.buildings)if(!(expected.some(q=>q.id===b.id&&q.type===b.type)||b.expansion&&World.expansionLots.some(q=>q.id===b.id&&q.types.includes(b.type)))||!finite(b.cash)||!Object.keys(GOODS).every(k=>finite(b.stock?.[k])))throw Error('Некорректные запасы');
      if(!finite(s.remainder,0,4.99999)||!finite(s.nextId,1,1e8)||!Array.isArray(s.advisor?.lastRequests))throw Error('Некорректное состояние');const ids=new Set(s.buildings.map(b=>b.id));
      for(const p of s.people){if(typeof p.name!=='string'||!ids.has(p.homeId)||!ids.has(p.goal)||!World.nodes[p.navNode]||!Array.isArray(p.path)||!p.path.every(n=>World.nodes[n.id]&&finite(n.x,0,World.WIDTH)&&finite(n.y,0,World.HEIGHT))||!Array.isArray(p.memories)||!Array.isArray(p.traits)||!Array.isArray(p.parents)||!p.knowledge||!p.relationships||!p.bag||!finite(p.x,0,World.WIDTH)||!finite(p.y,0,World.HEIGHT)||!['age','health','hunger','energy','social','faith','mood','coins','work'].every(k=>finite(p[k])))throw Error('Некорректный житель');if(p.tradeExperience&&!Object.values(p.tradeExperience).every(v=>finite(v)))throw Error('Некорректный опыт ремесленника');if(p.plan&&(!Array.isArray(p.plan.steps)||!p.plan.steps.every(q=>ids.has(q.target)&&ACTION_LABELS[q.kind]&&finite(q.elapsed)&&finite(q.duration,1))))throw Error('Некорректный план');}
      const sim=Object.create(Simulation.prototype);Object.assign(sim,s);World.migrate(sim);Events.ensure(sim);Systems.ensure(sim);Finance.load(sim);Commerce.load(sim,PRICES);Expansion.load(sim);Housing.load(sim);Guilds.load(sim);Development.load(sim);Government.load(sim);for(const p of sim.people)Learning.ensure(sim,p);Mind.load(sim);Intentions.load(sim);Social.load(sim);Civic.load(sim);Labour.load(sim);EnterprisePolicy.load(sim);Agreements.load(sim);Report.load(sim);Households.load(sim);Titles.load(sim);Products.load(sim,TYPES);Accounts.load(sim);Construction.load(sim);Analytics.load(sim);sim.events=sim.events.map((e,i)=>Events.decorate(e,e.id||++sim.eventSerial));sim.advisor.enabled=false;sim.advisor.provider=null;return sim;
    }
  }
  const api={Simulation,TYPES,GOODS,PRICES,YEAR,clamp,World,Brain,Bridge,Events,Systems,Learning,Mind,Intentions,Social,Civic,Residences,Agreements,EnterprisePolicy,Labour,Planner,Finance,Commerce,Expansion,Housing,Titles,Report,Analytics,Households,Products,Accounts,Construction,Guilds,Development,Government};if(node)module.exports=api;else root.Danzig=api;
})(typeof window!=='undefined'?window:globalThis);
