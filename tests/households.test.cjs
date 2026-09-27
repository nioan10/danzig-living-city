const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Households:H,Finance,Brain,Housing}=require('../sim.js');
const {EnterprisePolicy}=require('../sim.js');
const copy=s=>JSON.parse(JSON.stringify(s)),clone=s=>Simulation.fromJSON(copy(s));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const money=s=>s.treasury+s.people.reduce((n,p)=>n+p.coins,0)+s.buildings.reduce((n,b)=>n+b.cash,0)+s.guilds.groups.reduce((n,g)=>n+g.cash,0);
function fixture(){const s=new Simulation(),p=s.person(2);s.minute=600;for(const q of H.family(s,p)){q.coins=q.age>=16?120:0;q.clothing=90;}p.hunger=p.energy=95;s.building(p.homeId).stock.bread=30;return {s,p,seller:s.building('tailor')};}
function action(s,p,seller,good='clothes'){const need=H.needs(s,p).find(n=>n.good===good);return {kind:'buyHousehold',target:seller.id,good,amount:1,recipient:need?.recipient||null,quotedPrice:s.price(seller,good),homeId:p.homeId,duration:15,elapsed:0};}
function settle(s,p,id){Object.assign(p,{location:id,goal:id,navNode:'b:'+id,path:[],x:s.building(id).door.x,y:s.building(id).door.y});}

test('общий бюджет объединяет родных, но не чужие семьи в одном доме',()=>{
 const {s,p}=fixture(),outsider=s.person(5);outsider.homeId=p.homeId;outsider.coins=10000;H.invalidate(s);
 assert.deepEqual(H.family(s,p).map(q=>q.id),[1,2,3,4]);assert.equal(H.budget(s,p).coins,240);
 s.person(1).homeId='h1';H.invalidate(s);assert.equal(H.budget(s,p).coins,120);assert.ok(!H.family(s,p).includes(s.person(1)));
});

test('еда оплачивается семейными кошельками с сохранением денег и торгового налога',()=>{
 const {s,p}=fixture(),seller=s.building('bakery');p.coins=0;const before=money(s),wallet=s.person(1).coins,cost=s.price(seller,'bread')*3,goods=s.goods.bread;
 assert.ok(H.foodPurchase(s,p,seller,'bread',3,Finance.sale));close(s.person(1).coins,wallet-cost);close(money(s),before);close(s.goods.bread,goods);
 close(s.households.days.at(-1).spending.bread,cost);assert.equal(s.households.days.at(-1).bought.bread,3);assert.equal(p.bag.bread,3);
});

test('бытовая покупка защищает семейный резерв и откладывается при нехватке еды',()=>{
 const {s,p,seller}=fixture();p.clothing=10;for(const q of H.family(s,p))q.coins=0;p.coins=H.budget(s,p).reserve;
 const before=money(s);assert.equal(H.execute(s,p,seller,action(s,p,seller),Finance.sale).ok,false);close(money(s),before);
 p.coins=100;s.building(p.homeId).stock.bread=s.building(p.homeId).stock.fish=0;
 assert.equal(H.execute(s,p,seller,action(s,p,seller),Finance.sale).ok,false);assert.equal(p.householdParcel,undefined);
});

test('одна одежда доходит по дороге и восстанавливает одежду одного получателя',()=>{
 const {s,p,seller}=fixture(),child=s.person(4);child.clothing=10;const a=action(s,p,seller),before=money(s),goods=s.goods.clothes;
 p.plan={goal:'householdShopping',title:'Одежда ребёнку',index:0,steps:[a,{kind:'storeHousehold',target:p.homeId,duration:10,elapsed:0}]};
 s.execute(p,15);assert.equal(p.householdParcel,undefined,'Нельзя купить удалённо');settle(s,p,seller.id);s.execute(p,15);
 assert.equal(child.clothing,10);assert.equal(p.bag.clothes,1);close(s.goods.clothes,goods);close(money(s),before);
 s.execute(p,10);assert.equal(child.clothing,10,'Нельзя доставить из лавки');settle(s,p,p.homeId);s.execute(p,10);
 assert.equal(child.clothing,100);assert.equal(s.person(1).clothing,90);assert.equal(p.clothing,90);assert.equal(p.bag.clothes,0);assert.equal(p.householdParcel,null);close(s.goods.clothes,goods-1);
 assert.equal(s.statistics.consumption.clothes,1);
});

test('переоценка при приходе сохраняет деньги при скачке цены и предоплаченном запасе',()=>{
 const {s,p,seller}=fixture();p.clothing=10;const a=action(s,p,seller),before=money(s);seller.enterprise.priceFactor=5;
 assert.equal(H.execute(s,p,seller,a,Finance.sale).ok,false);close(money(s),before);seller.enterprise.priceFactor=1;
 s.commerce.orders=[{buyer:'market',seller:seller.id,good:'clothes',amount:seller.stock.clothes,paid:10,at:s.now}];
 assert.equal(H.execute(s,p,seller,a,Finance.sale).ok,false);close(money(s),before);
});

test('семья не оплачивает одновременно две бытовые покупки',()=>{
 const {s,p,seller}=fixture(),q=s.person(1);p.clothing=q.clothing=10;
 assert.ok(H.execute(s,p,seller,action(s,p,seller),Finance.sale).ok);const before=money(s),stock=seller.stock.clothes;
 assert.equal(H.execute(s,q,seller,action(s,q,seller),Finance.sale).ok,false);close(money(s),before);assert.equal(seller.stock.clothes,stock);
});

test('прерванная доставка переживает сохранение и вновь становится целью',()=>{
 const {s,p,seller}=fixture();p.clothing=10;assert.ok(H.execute(s,p,seller,action(s,p,seller),Finance.sale).ok);p.plan=null;
 const r=clone(s),q=r.person(p.id);assert.deepEqual(q.householdParcel,p.householdParcel);
 const option=Brain.options(r,q).find(x=>x.goal==='householdDelivery');assert.ok(option);assert.equal(option.steps[0].target,q.homeId);
 r.advance(300);s.advance(300);assert.deepEqual(copy(r),copy(s));
});

test('покупка умершего возвращается в домашний запас и может быть использована',()=>{
 const {s,p,seller}=fixture(),q=s.person(1);q.clothing=10;assert.ok(H.execute(s,p,seller,action(s,p,seller),Finance.sale).ok);
 const goods=s.goods.clothes;s.die(p,'умер от болезни');close(s.goods.clothes,goods);assert.equal(s.building(q.homeId).stock.clothes,1);
 settle(s,q,q.homeId);assert.ok(H.execute(s,q,s.building(q.homeId),{kind:'useHousehold',good:'clothes'},Finance.sale).ok);assert.equal(q.clothing,100);assert.equal(s.building(q.homeId).stock.clothes,0);
});

test('переезд с оплаченной семейной посылкой откладывается до доставки',()=>{
 const {s,p,seller}=fixture();p.clothing=10;H.execute(s,p,seller,action(s,p,seller),Finance.sale);
 const owner=s.person(1);for(const q of s.people.slice(4,8))q.homeId=owner.homeId;for(const q of s.people.slice(8,12))q.homeId='h3';H.invalidate(s);
 const r=Housing.relocate(s,owner,'h2',owner.homeId);assert.equal(r.ok,false);assert.ok(p.householdParcel);
});

test('износ и топливо расходуются раз в сутки, календарь не списывает деньги за товары',()=>{
 const {s,p}=fixture(),home=s.building(p.homeId);home.stock.wood=10;p.domestic.pottery=1;p.domestic.furniture=1;
 const before=money(s),wear=p.clothing;s.day=5;H.daily(s);assert.ok(p.clothing<wear);assert.ok(home.stock.wood<10);assert.ok(p.domestic.pottery<1);close(money(s),before);
 const state=JSON.stringify(s);s.householdPurchases();assert.equal(JSON.stringify(s),state);
});

test('рождение и рост семьи увеличивают потребности без новых денег',()=>{
 const {s,p}=fixture(),before=H.budget(s,p),cash=money(s),c=s.createPerson('Ребёнок','Фогель','m',0,p.homeId);c.parents=[1,2];s.initializeMind(c);
 const after=H.budget(s,p);assert.equal(after.members.length,before.members.length+1);assert.ok(after.dailyFood>before.dailyFood);assert.ok(after.expense>before.expense);close(money(s),cash);
});

test('потребность отделяется от возможности оплатить и от реальных продаж',()=>{
 const {s,p}=fixture();for(const q of s.alive){q.coins=0;q.clothing=0;}s.day=1;H.daily(s);const poor=s.households.days.at(-1);
 assert.ok(poor.wanted.clothes>0);assert.equal(poor.funded.clothes,0);assert.equal(poor.bought.clothes,undefined);
 p.coins=500;s.day=2;H.daily(s);const richer=s.households.days.at(-1);assert.ok(richer.funded.clothes>0);assert.ok(s.householdDemand().clothes>0);assert.equal(richer.bought.clothes,undefined);
});

test('доход семьи учитывает полученные после налогов деньги без повторного начисления',()=>{
 const {s,p}=fixture(),employer=s.building(p.jobId),before=money(s);employer.cash-=8;const split=Finance.wage(s,p,8,employer);close(money(s),before);
 close(H.budget(s,p,true).received,split.net);close(s.households.days.at(-1).income,split.net);
});

test('миграция не создаёт денег, имущества или выдуманной истории покупок',()=>{
 const {s}=fixture(),raw=copy(s);delete raw.state.households;for(const p of raw.state.people)delete p.domestic;
 const r=Simulation.fromJSON(raw);close(money(r),money(s));assert.equal(r.households.days.length,0);assert.equal(r.households.purchases.length,0);assert.equal(r.person(1).domestic.pottery,0);assert.equal(r.person(1).clothing,s.person(1).clothing);
 const broken=copy(r);broken.state.people[0].domestic.days=[{day:0,income:0,spending:{bread:-1},bought:{}}];assert.throws(()=>Simulation.fromJSON(broken),/сем/);
 const parcel=copy(r);parcel.state.people[0].householdParcel={good:'clothes',amount:100,recipient:1,ownerId:1};assert.throws(()=>Simulation.fromJSON(parcel),/сем/);
});

function riskyFixture(){
 const {s,p,seller}=fixture();for(const q of H.family(s,p)){q.hunger=90;q.coins=0;if(q.age<16)q.homeId='h3';}H.invalidate(s);
 const home=s.building(p.homeId);home.stock.bread=home.stock.fish=home.stock.wood=0;
 for(const q of H.family(s,p))Object.assign(q.mind.personality,{caution:.05,thrift:.05,ambition:.95,family:.2});
 return {s,p,seller,home};
}

test('характер, дети и запасы меняют желаемый резерв, доходы не начисляются из прогноза',()=>{
 const {s,p,home}=riskyFixture(),risk=H.budget(s,p);p.mind.personality.caution=p.mind.personality.thrift=.95;
 const careful=H.budget(s,p);assert.ok(careful.reserve>risk.reserve);assert.ok(careful.horizon>risk.horizon);
 home.stock.bread=20;assert.ok(H.budget(s,p).reserve<careful.reserve);home.stock.bread=0;
 s.person(4).homeId=p.homeId;H.invalidate(s);assert.ok(H.budget(s,p).reserve>careful.reserve);
 const before=money(s);H.income(s,p,8);assert.ok(H.budget(s,p).expectedIncome>0);close(money(s),before);
});

test('рискованный хозяин может вложить последний личный запас ради заработка, осторожный откажется',()=>{
 const {s,p}=riskyFixture(),b=s.building('bakery');b.cash=0;b.stock.bread=0;b.enterprise.totalRevenue=30;b.enterprise.lastProfit=4;
 p.coins=H.budget(s,p).reserve*.8;const risk=H.investment(s,p,b);assert.ok(risk.riskDays>1);assert.ok(risk.amount>0);
 const saved=H.family(s,p).map(q=>({...q.mind.personality}));for(const q of H.family(s,p))Object.assign(q.mind.personality,{caution:.95,thrift:.95,ambition:.05});
 assert.equal(H.investment(s,p,b).amount,0);assert.equal(EnterprisePolicy.invest(s,p,b).ok,false);
 H.family(s,p).forEach((q,i)=>Object.assign(q.mind.personality,saved[i]));const before=money(s),coins=p.coins;
 assert.ok(EnterprisePolicy.invest(s,p,b).ok);assert.ok(p.coins<coins);assert.ok(H.budget(s,p).coins<H.budget(s,p).reserve);close(money(s),before);assert.equal(b.enterprise.lastProfit,4,'Ожидание не становится прибылью');
});

test('риск вложения требует шанса на заработок и отступает при голоде или нуждах ребёнка',()=>{
 const {s,p}=riskyFixture(),b=s.building('bakery');p.coins=2;b.cash=0;b.stock.bread=0;
 assert.equal(H.investment(s,p,b).riskDays,0);b.enterprise.totalRevenue=20;b.enterprise.lastProfit=3;assert.ok(H.investment(s,p,b).riskDays>1);
 const child=s.person(4);child.homeId=p.homeId;child.hunger=90;H.invalidate(s);assert.ok(H.investment(s,p,b).riskDays<=.5);
 child.hunger=20;assert.equal(H.investment(s,p,b).amount,0);child.hunger=90;p.hunger=20;assert.equal(H.investment(s,p,b).amount,0);
});

test('пережитый голод повышает запас, память сохраняется и постепенно ослабевает',()=>{
 const {s,p}=riskyFixture(),before=H.budget(s,p).reserve;p.hunger=20;s.day=1;H.daily(s);
 assert.ok(p.domestic.foodStress>0);assert.ok(H.budget(s,p).reserve>before);const r=clone(s);close(r.person(p.id).domestic.foodStress,p.domestic.foodStress);
 const stress=p.domestic.foodStress;p.hunger=90;s.day=2;H.daily(s);assert.ok(p.domestic.foodStress<stress);
 const invalid=copy(s);invalid.state.people.find(q=>q.id===p.id).domestic.foodStress=2;assert.throws(()=>Simulation.fromJSON(invalid),/сем/);
});
