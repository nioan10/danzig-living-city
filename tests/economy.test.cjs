const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Finance,Commerce,Expansion,Brain,World,TYPES,GOODS,PRICES}=require('../sim.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),copy=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s)));
const policy=(extra={})=>({incomeEnabled:true,incomeRate:12,salesEnabled:true,salesRate:5,exportEnabled:true,exportRate:10,...extra});
const settle=(s,p,id)=>Object.assign(p,{x:s.building(id).door.x,y:s.building(id).door.y,location:id,goal:id,navNode:'b:'+id,path:[],plan:null});

test('зарплата распределяется один раз между человеком, церковью и казной',()=>{
 const s=new Simulation(),p=s.person(2),b=s.building(p.jobId),church=s.building('church');const before=[p.coins,b.cash,church.cash,s.treasury];b.cash-=100;Finance.wage(s,p,100);
 close(p.coins-before[0],79.2);close(s.treasury-before[3],14.64);close(church.cash-before[2],6.16);close(p.coins+b.cash+church.cash+s.treasury,before.reduce((a,b)=>a+b,0));close(p.fiscalToday.gross,100);
});
test('отмена, возврат налогов, ручной режим и отклонение некорректного указа',()=>{
 const s=new Simulation();assert.ok(s.setTaxes(policy({incomeEnabled:false})).ok);assert.equal(s.tax,0);assert.equal(s.fiscal.taxes.income.rate,12);assert.equal(s.fiscal.autoMayor,false);s.day=50;s.treasury=0;Finance.daily(s);assert.equal(s.tax,0);const before=JSON.stringify(s.fiscal);assert.equal(s.setTaxes(policy({exportRate:NaN})).ok,false);assert.equal(JSON.stringify(s.fiscal),before);s.setTaxes(policy());assert.equal(s.tax,12);
});
test('правительство может полностью передать десятину городу либо церкви',()=>{
 const s=new Simulation();s.setTax(0);s.setTithe({enabled:true,rate:20,cityShare:100});let w=Finance.splitWage(s,50);assert.equal(w.net,40);assert.equal(w.city,10);assert.equal(w.church,0);s.setTithe({enabled:true,rate:20,cityShare:0});w=Finance.splitWage(s,50);assert.equal(w.church,10);assert.equal(w.city,0);s.setTithe({enabled:false,rate:20,cityShare:30});assert.equal(Finance.splitWage(s,50).net,50);
});
test('налог с продажи — удержание из выручки, а не новые деньги',()=>{
 const s=new Simulation(),buyer=s.building('bakery'),seller=s.building('mill');for(const external of [false,true]){const total=buyer.cash+seller.cash+s.treasury,before=s.treasury;buyer.cash-=100;Finance.sale(s,seller,100,external);close(s.treasury-before,external?10:5);close(buyer.cash+seller.cash+s.treasury,total);}
});
test('церковь оплачивает помощь самостоятельно и соблюдает блокаду',()=>{
 const s=new Simulation(),b=s.building('church');b.stock.bread=0;b.cash=50;const t=s.treasury;assert.equal(Finance.churchRelief(s),15);assert.equal(b.cash,35);assert.equal(b.stock.bread,20);assert.equal(s.treasury,t);b.stock.bread=0;s.triggerCrisis('blockade');assert.equal(Finance.churchRelief(s),0);
});
test('бургомистр вводит сборы при дефиците, отменяет при избытке и бережёт бедных',()=>{
 const s=new Simulation();s.setTaxes(policy({incomeEnabled:false,salesEnabled:false,exportEnabled:false}));s.setFiscalAutonomy(true);for(const p of s.alive)p.coins=40;s.treasury=0;s.day=1;Finance.daily(s);assert.equal(s.tax,2);assert.equal(Finance.rate(s,'sales'),2);assert.equal(Finance.rate(s,'export'),3);const tithe={...s.fiscal.tithe};for(const p of s.alive)p.coins=0;s.day=4;Finance.daily(s);assert.equal(s.tax,4);assert.equal(Finance.splitWage(s,5,s.alive[0]).tax,0);assert.deepEqual(s.fiscal.tithe,tithe);
 s.setTaxes(policy({incomeRate:2}));s.setFiscalAutonomy(true);s.accounts.days=[{day:4,income:{cityExport:1000},expenses:{}}];s.day=7;s.treasury=5000;Finance.daily(s);assert.equal(s.tax,0);assert.equal(s.fiscal.taxes.income.enabled,false);
});
test('новые системы переносят старый город без начислений задним числом',()=>{
 const s=new Simulation();s.day=200;s.tax=19;const data=JSON.parse(JSON.stringify(s));delete data.state.fiscal;delete data.state.commerce;delete data.state.expansion;const r=Simulation.fromJSON(data);assert.equal(r.treasury,s.treasury);assert.equal(r.people[0].coins,s.people[0].coins);assert.equal(r.tax,19);assert.equal(r.fiscal.sinceDay,200);assert.equal(r.commerce.totalRevenue,0);assert.equal(r.fiscal.nextReview,201);
});
test('натуральный сбор делит выпуск и не меняет количество созданного товара',()=>{
 const s=new Simulation(),b=s.building('bakery'),before=s.goods.bread;Commerce.produce(s,b,'bread',20);close(s.goods.bread-before,20);assert.equal(s.commerce.stock.bread,3);assert.equal(b.cityLevy.bread,3);s.setCommerce({levyEnabled:false,levyRate:15,autoExport:true,reserveDays:2});Commerce.produce(s,b,'bread',20);assert.equal(s.commerce.stock.bread,3);close(s.goods.bread-before,40);
});
test('город получает полную выручку склада, экспорт уважает резерв и блокаду',()=>{
 const s=new Simulation();for(const b of s.buildings){b.stock.bread=0;b.stock.fish=0;}s.commerce.stock.bread=110;s.commerce.stock.tools=5;const cash=s.treasury,expected=s.commerce.outside.base.bread*.85*80*Math.log1p(14/80)+s.commerce.outside.base.tools*.85*8*Math.log1p(5/8);close(Commerce.exportGoods(s),expected);close(s.treasury-cash,expected);assert.equal(s.commerce.stock.bread,96);assert.equal(s.commerce.stock.tools,0);assert.equal(s.fiscal.days.length,0);s.triggerCrisis('blockade');s.commerce.stock.tools=10;assert.equal(Commerce.exportGoods(s),0);assert.equal(s.commerce.stock.tools,10);
});
test('склад передаёт еду голодной семье без создания новых порций',()=>{
 const s=new Simulation(),p=s.person(2),home=s.building(p.homeId);home.stock.bread=home.stock.fish=0;p.coins=0;s.commerce.stock.bread=20;const food=s.food;assert.ok(Commerce.relief(s)>0);assert.ok(home.stock.bread>0);assert.equal(s.food,food);
});
test('цены реагируют на дефицит и покрывают зарплату сырьевому производителю',()=>{
 const s=new Simulation();for(const b of s.buildings)b.stock.wood=0;Commerce.updatePrices(s,PRICES,TYPES);assert.ok(s.commerce.prices.wood>PRICES.wood);for(let i=0;i<20;i++)Commerce.updatePrices(s,PRICES,TYPES);const b=s.building('wood'),r=TYPES.wood.recipe;assert.ok(s.commerce.prices.wood*r.amount*(1-.15)*.85*(1-.1)>b.wage*r.time/60);const scarce=s.commerce.prices.bread;s.building('bakery').stock.bread=100000;Commerce.updatePrices(s,PRICES);assert.ok(s.commerce.prices.bread<scarce);assert.ok(Object.values(s.commerce.prices).every(p=>Number.isFinite(p)&&p>0));
});
test('предоплата возвращает поставщика к работе; оплаченный груз не покупают дважды',()=>{
 const s=new Simulation(),buyer=s.building('bakery'),seller=s.building('wood'),p=s.person(2);seller.cash=0;seller.stock.wood=0;const before=buyer.cash+seller.cash+s.treasury;assert.ok(Commerce.order(s,buyer,seller,'wood',3));close(buyer.cash+seller.cash+s.treasury,before);const paid=buyer.cash;Commerce.order(s,buyer,seller,'wood',3);assert.equal(buyer.cash,paid);seller.stock.wood=3;buyer.cash=0;assert.equal(s.supplyCost(buyer,seller,'wood',3),0);settle(s,p,'wood');p.plan={goal:'supply',steps:[{kind:'pickup',target:'wood',good:'wood',amount:3,to:'bakery',elapsed:0,duration:5}],index:0};s.execute(p,5);assert.equal(p.cargo.amount,3);assert.equal(buyer.cash,0);assert.equal(s.commerce.orders.length,0);assert.equal(seller.stock.wood,0);
});
test('доставка оплачивается из денег работодателя без создания денег',()=>{
 const s=new Simulation(),p=s.person(2),b=s.building('bakery');s.people=[p];settle(s,p,'bakery');p.hunger=p.energy=p.social=p.faith=100;p.cargo={good:'flour',amount:4,to:'bakery'};p.plan={goal:'delivery',title:'Доставка',created:s.now,steps:[{kind:'deliver',target:'bakery',duration:30,elapsed:0}],index:0};const total=p.coins+b.cash+s.treasury+s.building('church').cash;s.tick(5);close(p.coins+b.cash+s.treasury+s.building('church').cash,total);assert.ok(p.fiscalToday.gross>0);
});
test('младенец может лечиться, а больной лекарь способен лечить себя',()=>{
 const s=new Simulation(),child=s.createPerson('Тест','Детский','m',1,'h0');s.initializeMind(child);child.sick=true;child.health=30;assert.ok(Brain.options(s,child).some(p=>p.goal==='heal'));const doctor=s.workers('clinic')[0];settle(s,doctor,'clinic');doctor.sick=true;doctor.health=30;doctor.plan={goal:'heal',steps:[{kind:'heal',target:'clinic',duration:75,elapsed:0}],index:0};s.execute(doctor,10);assert.ok(doctor.health>30);
});
test('стройка списывает деньги один раз, открывается по сроку и сохраняется',()=>{
 const s=new Simulation(),cash=s.treasury;assert.ok(s.startConstruction('new1','home').ok);assert.equal(s.treasury,cash-180);assert.equal(s.capacity,72);assert.equal(s.isOpen(s.building('new1')),false);assert.equal(s.startConstruction('new1','home').ok,false);assert.equal(s.startConstruction('new5','smith').ok,false);const r=copy(s);assert.deepEqual(r.toJSON(),s.toJSON());s.advance(2*1440+5);r.advance(2*1440+5);assert.deepEqual(r.toJSON(),s.toJSON());assert.equal(s.capacity,78);assert.equal(s.building('new1').construction,undefined);
});
test('новая мастерская получает реальные вакансии и работает с общей логистикой',()=>{
 const s=new Simulation();s.treasury=500;assert.ok(s.startConstruction('new1','bakery').ok);const b=s.building('new1');assert.equal(s.jobSlots(b),0);s.day=4;Expansion.tick(s);assert.equal(s.jobSlots(b),3);assert.equal(b.cash,120);assert.ok(s.canProduce(b));assert.ok(s.alive.every(p=>p.knowledge.new1));const p=s.person(2);p.jobId=b.id;settle(s,p,b.id);p.plan={goal:'work',steps:[{kind:'work',target:b.id,duration:100,elapsed:0}],index:0};s.execute(p,100);assert.ok(b.output>0);assert.ok(b.cityLevy.bread>0);
});
test('переселенцы занимают свободное жильё и идут по дороге',()=>{
 const s=new Simulation();s.startConstruction('new1','home');s.day=3;Expansion.tick(s);for(const p of s.people.filter(p=>p.jobId==='farm'))p.jobId=null;const before=s.living.length;assert.ok(s.inviteFamily().ok);assert.equal(s.living.length,before+3);assert.equal(s.births,0);const newcomers=s.people.slice(-3);assert.ok(newcomers.every(p=>p.navNode==='southRoad'&&p.path.at(-1).id==='b:new1'));assert.equal(s.inviteFamily().ok,false);s.advance(240);assert.ok(newcomers.every(p=>!p.arriving));assert.deepEqual(copy(s).toJSON(),s.toJSON());
});
test('все участки расширения доступны по дорогам, промыслы за стеной',()=>{
 for(const l of World.expansionLots){assert.ok(World.route('b:market','b:'+l.id));assert.ok(World.distance('b:market','b:'+l.id)>0);if(l.types.some(t=>['farm','wood','pasture'].includes(t)))assert.equal(World.insideTown(l.x,l.y),false);}
});
test('[long] 360 дней: нет массового голода, деньги и ресурсы конечны, население восполняется',()=>{
 const s=new Simulation();for(let d=0;d<360;d++){s.nextMorning();for(const b of s.buildings){assert.ok(Number.isFinite(b.cash)&&b.cash>=-1e-7,b.id);for(const n of Object.values(b.stock))assert.ok(Number.isFinite(n)&&n>=-1e-7);}for(const p of s.living)assert.ok(Number.isFinite(p.coins)&&p.coins>=-1e-7,p.name);assert.ok(Number.isFinite(s.treasury)&&s.treasury>=0);for(const g of s.guilds.groups)assert.ok(Number.isFinite(g.cash)&&g.cash>=0); }
 assert.ok(s.living.length>=48);assert.ok(s.births>s.deaths);assert.equal(s.people.filter(p=>p.deathCause==='hunger').length,0);assert.equal(s.region.debt,0);assert.ok(s.commerce.totalRevenue>1000);console.log(JSON.stringify({day:s.day,population:s.living.length,births:s.births,deaths:s.deaths,treasury:Math.round(s.treasury),debt:s.region.debt,guildProjects:s.guilds.built,guildCapital:s.guilds.groups.map(g=>Math.round(g.cash)),guildStatus:s.guilds.groups.map(g=>g.status)}));
});

test('заселение пустующего дома внутри стен проходит через южные ворота',()=>{const s=new Simulation();for(const p of s.people.filter(p=>p.homeId==='h0'))s.die(p,'умер от болезни');assert.ok(s.inviteFamily().ok);assert.ok(s.people.slice(-3).every(p=>p.path.some(n=>n.id==='southGate')));});
