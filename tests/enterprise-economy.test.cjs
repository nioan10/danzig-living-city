const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Products,Accounts,Construction,Finance,Commerce,EnterprisePolicy,TYPES,Expansion,Brain}=require('../sim.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s)));
const money=s=>s.treasury+s.people.reduce((n,p)=>n+p.coins,0)+s.buildings.reduce((n,b)=>n+b.cash,0)+s.guilds.groups.reduce((n,g)=>n+g.cash,0)+Construction.contracts(s).reduce((n,x)=>n+x.q.cash,0);
const settle=(s,p,b)=>Object.assign(p,{location:b.id,path:[],navNode:'b:'+b.id,goal:b.id,x:b.door.x,y:b.door.y});
test('основные рецепты остаются у всех ремёсел; переключение сохраняет незавершённую работу',()=>{
 const s=new Simulation();for(const b of s.buildings)if(TYPES[b.type].recipe)assert.equal(s.productionRecipe(b).out,TYPES[b.type].recipe.out);
 const b=s.building('sawmill');b.progress=25;Products.choose(s,b,TYPES.sawmill.recipe,{beams:100});s.day=1;Products.choose(s,b,TYPES.sawmill.recipe,{beams:100});assert.equal(s.productionRecipe(b).out,'beams');assert.equal(b.product.progress.planks,25);assert.equal(b.progress,0);
 b.progress=10;s.day=2;Products.choose(s,b,TYPES.sawmill.recipe,{planks:1000});assert.equal(b.product.selected,'planks');assert.equal(b.progress,25);
});
test('новый ассортимент действительно производится из сырья и оплаченного труда',()=>{
 const s=new Simulation(),b=s.building('smith'),p=s.workers(b.id)[0];b.product={selected:'nails',lastDay:s.day,progress:{},reason:'Заказ'};b.cash=1000;settle(s,p,b);p.hunger=p.energy=100;const before=money(s),iron=b.stock.iron;
 p.plan={goal:'work',index:0,steps:[{kind:'work',target:b.id,elapsed:0,duration:240}]};s.execute(p,200);
 assert.ok(b.stock.nails>0);assert.ok(b.stock.iron<iron);assert.ok(b.business.days.at(-1).wages>0);assert.ok(b.business.unitCost.nails>0);close(money(s),before);
});
test('закупка сырья учитывается как запас; выручка и стоимость продаж возникают при сделке',()=>{
 const s=new Simulation(),b=s.building('bakery'),p=s.person(2),home=s.building(p.homeId);home.stock.bread=0;const before=money(s);Accounts.purchased(s,b,'flour',5,10);b.stock.flour+=5;
 const d=b.business.days.at(-1);assert.equal(d.inputs,10);assert.equal(d.cost,0);assert.equal(d.revenue,0);close(money(s),before);
 const qty=2,cost=s.price(b,'bread')*qty;p.coins-=cost;b.stock.bread-=qty;Finance.sale(s,b,cost,false,{good:'bread',amount:qty});p.bag.bread=qty;
 assert.equal(d.sold.bread,qty);close(d.revenue,cost*(1-Finance.rate(s,'sales')/100));assert.ok(d.cost>0);close(money(s),before);
});
test('предоплаченная поставка признаётся в учёте при передаче товара один раз',()=>{
 const s=new Simulation(),buyer=s.building('bakery'),seller=s.building('wood'),p=s.person(2);seller.cash=0;seller.stock.wood=0;assert.ok(Commerce.order(s,buyer,seller,'wood',3));assert.equal(seller.business.days.at(-1)?.revenue||0,0);
 seller.stock.wood=3;settle(s,p,seller);p.plan={goal:'supply',index:0,steps:[{kind:'pickup',target:seller.id,to:buyer.id,good:'wood',amount:3,duration:5,elapsed:0}]};s.execute(p,5);
 const d=seller.business.days.at(-1);assert.equal(d.sold.wood,3);close(d.revenue,3*s.price(seller,'wood')*.95);assert.equal(s.commerce.orders.length,0);
});
test('прогноз различает прошлые продажи, ожидания и оплаченные заказы, новых денег не создаёт',()=>{
 const s=new Simulation(),b=s.building('bakery'),before=money(s);b.business.days=[{day:0,revenue:20,cost:8,wages:4,inputs:7,overhead:1,output:{bread:14},sold:{bread:10},local:20,export:0}];s.day=1;
 const f=Accounts.forecast(s,b,s.productionRecipe(b),{bread:40});assert.equal(f.sold,10);assert.equal(f.expected,40);assert.ok(f.unitCost>0);assert.ok(f.reserve>0);close(money(s),before);
 b.cash=0;EnterprisePolicy.review(s,b,{bread:40});assert.equal(s.hiringSlots(b),0);
});
test('возврат остатка подряда не становится прогнозом постоянных доходов ратуши',()=>{
 const s=new Simulation();s.day=2;s.accounts.days=[{day:1,income:{sales:20,constructionRefund:1000},expenses:{}}];s.fiscal.property.latest=null;const b=Finance.budget(s);assert.equal(b.income.constructionRefund,1000);const plan=Finance.Budget.prepare(s,b,10);assert.ok(s.fiscal.spending.plan.income<100);
});
test('галеты покупаются и насыщают, портятся медленнее хлеба без создания товара',()=>{
 const s=new Simulation(),p=s.person(2),b=s.building('bakery');b.stock.biscuits=10;s.observe(p,b);assert.ok(s.suppliers(p,'food').some(x=>x.good==='biscuits'));p.bag.biscuits=1;p.bag.bread=p.bag.fish=0;p.hunger=20;
 assert.ok(s.eat(p.bag,p));assert.equal(p.hunger,70);assert.equal(p.bag.biscuits,0);
 const h=s.building(p.homeId);h.stock.bread=h.stock.biscuits=100;Products.spoil(s,Accounts.loss);s.day=1;const before=s.goods.biscuits;Products.spoil(s,Accounts.loss);assert.ok(h.stock.biscuits>h.stock.bread);assert.ok(s.goods.biscuits<before);const state=JSON.stringify(s);Products.spoil(s,Accounts.loss);assert.equal(JSON.stringify(s),state);
});
test('дробные остатки разных продуктов составляют порцию и не запирают голодного в цикле еды',()=>{
 const s=new Simulation(),p=s.person(2),home=s.building(p.homeId);home.stock.bread=.3;home.stock.fish=.4;home.stock.biscuits=.6;p.hunger=0;
 const before=s.foodAmount(home.stock);assert.ok(s.eat(home.stock,p));close(s.foodAmount(home.stock),before-1);assert.ok(p.hunger>50);const state=JSON.stringify(home.stock);assert.equal(s.eat(home.stock,p),false);assert.equal(JSON.stringify(home.stock),state);
});
test('подряд сохраняет деньги в отдельном бюджете и создаёт настоящий спрос на материалы',()=>{
 const s=new Simulation(),before=money(s);s.startConstruction('new4','home');close(money(s),before);const b=s.building('new4'),q=b.construction.local;
 assert.equal(q.cash,180);assert.ok(Construction.demand(s).beams>0);s.day=10;Expansion.tick(s);assert.ok(b.construction);assert.equal(s.isOpen(b),false);assert.equal(q.work,0);
});
test('строительная доставка оплачивает реальные товары и перевозчика только на месте',()=>{
 const s=new Simulation();s.startConstruction('new4','home');const site=s.building('new4'),q=site.construction.local,p=s.person(2),seller=s.building('wood'),before=money(s),goods=s.goods.wood,coins=p.coins,a={kind:'buildPickup',jobId:q.id,target:seller.id,siteId:site.id,good:'wood',amount:4};
 assert.equal(Construction.execute(s,p,a,5).ok,false);settle(s,p,seller);assert.ok(Construction.execute(s,p,a,5).ok);assert.equal(q.stock.wood,undefined);close(s.goods.wood,goods);close(money(s),before);assert.equal(p.coins,coins);
 assert.equal(Construction.execute(s,p,{kind:'buildDeliver',jobId:q.id},5).ok,false);settle(s,p,site);assert.ok(Construction.execute(s,p,{kind:'buildDeliver',jobId:q.id},5).ok);assert.equal(q.stock.wood,4);assert.ok(p.coins>coins);close(money(s),before);close(s.goods.wood,goods);
});
test('строительный груз и цель доставки переживают сохранение и прерывание',()=>{
 const s=new Simulation();s.startConstruction('new4','home');const q=s.building('new4').construction.local,p=s.person(2),seller=s.building('wood');settle(s,p,seller);Construction.execute(s,p,{kind:'buildPickup',jobId:q.id,target:seller.id,good:'wood',amount:4},5);p.plan=null;
 const r=clone(s);assert.deepEqual(r.toJSON(),s.toJSON());assert.ok(Brain.options(r,r.person(p.id)).some(x=>x.goal==='constructionDelivery'));s.advance(500);r.advance(500);assert.deepEqual(r.toJSON(),s.toJSON());
});
test('стройка не получает предоплаченный другим товар; смерть перевозчика не уничтожает груз',()=>{
 const s=new Simulation();s.startConstruction('new4','home');const q=s.building('new4').construction.local,p=s.person(2),seller=s.building('wood');settle(s,p,seller);s.commerce.orders=[{buyer:'bakery',seller:seller.id,good:'wood',amount:seller.stock.wood,paid:2,at:s.now}];const cash=money(s),a={kind:'buildPickup',jobId:q.id,target:seller.id,good:'wood',amount:3};assert.equal(Construction.execute(s,p,a,5).ok,false);close(money(s),cash);
 s.commerce.orders=[];Construction.execute(s,p,a,5);const goods=s.goods.wood;s.die(p,'умер от болезни');assert.equal(q.stock.wood,3);close(s.goods.wood,goods);
});
test('завершение расходует материалы, возвращает остаток и не создаёт стартовое сырьё',()=>{
 const s=new Simulation();s.treasury=1000;s.startConstruction('new1','bakery');const b=s.building('new1'),q=b.construction.local;
 require('./helpers/construction.cjs').supply(s,b);const before=money(s),goods=s.goods.planks,used=q.needs.planks;s.day=4;Expansion.tick(s);assert.equal(b.construction,undefined);assert.equal(b.cash,120);assert.equal(b.stock.flour,0);assert.equal(s.canProduce(b),false);close(s.goods.planks,goods-used);close(money(s),before);Expansion.tick(s);close(money(s),before);
});
test('старые сохранения получают новые товары без их начисления, повреждённые подряды отвергаются',()=>{
 const s=new Simulation(),raw=JSON.parse(JSON.stringify(s));for(const b of raw.state.buildings){for(const g of Object.keys(Products.names))delete b.stock[g];delete b.business;}for(const g of Object.keys(Products.names)){delete raw.state.commerce.stock[g];delete raw.state.commerce.prices[g];delete raw.state.commerce.outside.base[g];}delete raw.state.works;
 const r=Simulation.fromJSON(raw);assert.equal(r.goods.nails,0);close(money(r),money(s));r.startConstruction('new4','home');const broken=JSON.parse(JSON.stringify(r));broken.state.buildings.find(b=>b.id==='new4').construction.local.cash=-1;assert.throws(()=>Simulation.fromJSON(broken),/подряд/);
});
