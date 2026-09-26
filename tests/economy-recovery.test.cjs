const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Finance,Brain,Development:D}=require('../sim.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s)));
const total=s=>s.treasury+s.people.reduce((n,p)=>n+p.coins,0)+s.buildings.reduce((n,b)=>n+b.cash,0);

test('бедная мастерская планирует доступную партию вместо отказа от большого заказа',()=>{
 const s=new Simulation(),b=s.building('bakery'),seller=s.building('mill'),p=s.workers(b.id)[0];b.stock.flour=0;b.stock.wood=3;b.cash=8;seller.stock.flour=3;s.minute=600;s.observe(p,seller);p.coins=0;p.hunger=p.energy=90;
 const missing=s.missingInput(b);assert.equal(missing.amount,16);assert.ok(s.supplyCost(b,seller,'flour',16)>b.cash);const choice=Brain.options(s,p).find(q=>q.goal==='supply'&&q.steps[0].target===seller.id);assert.ok(choice);assert.ok(choice.steps[0].amount>=2&&choice.steps[0].amount<16);
 const before=total(s);Object.assign(p,{location:seller.id,goal:seller.id,navNode:'b:'+seller.id,path:[],plan:{...choice,index:0}});s.execute(p,15);assert.ok(p.cargo.amount>=2);assert.ok(b.cash>=b.wage*2);close(total(s),before);
});
test('изменение кассы во время пути уменьшает закупку, оплаченный груз не списывается повторно',()=>{
 const s=new Simulation(),b=s.building('bakery'),seller=s.building('mill'),p=s.workers(b.id)[0];b.stock.flour=0;b.stock.wood=3;b.cash=8;seller.stock.flour=30;
 Object.assign(p,{location:seller.id,goal:seller.id,navNode:'b:'+seller.id,path:[],plan:{goal:'supply',steps:[{kind:'pickup',target:seller.id,good:'flour',amount:16,to:b.id,duration:5,elapsed:0}],index:0}});const before=total(s);s.execute(p,5);assert.ok(p.cargo.amount<16);assert.ok(b.cash>=b.wage*2);close(total(s),before);
 b.cash=0;s.commerce.orders=[{buyer:b.id,seller:seller.id,good:'flour',amount:2,paid:2,at:s.now}];assert.equal(s.supplyAmount(b,seller,'flour',16),2);
});
test('закупка не отнимает деньги, необходимые для остальных входов и оплаты труда',()=>{
 const s=new Simulation(),b=s.building('bakery'),seller=s.building('mill');b.cash=1;b.stock.flour=0;b.stock.wood=0;assert.equal(s.supplyAmount(b,seller,'flour',16),0);b.cash=8;const amount=s.supplyAmount(b,seller,'flour',16);assert.ok(amount>=2);assert.ok(b.cash-s.supplyCost(b,seller,'flour',amount)>=b.wage*2+s.commerce.prices.wood);
});
test('необлагаемый запас защищает бедного работника, а обеспеченный платит ту же установленную ставку',()=>{
 const s=new Simulation(),p=s.person(2),b=s.building(p.jobId);p.coins=0;const before=total(s);b.cash-=5;const poor=Finance.wage(s,p,5,b);assert.equal(poor.tax,0);close(total(s),before);p.coins=100;b.cash-=5;const rich=Finance.wage(s,p,5,b);close(rich.tax,.6);p.coins=11;close(Finance.splitWage(s,5,p).tax,.48);s.setTax(0);assert.equal(Finance.splitWage(s,100,p).tax,0);
});
test('налоги возвращаются при дефиците даже при массовой бедности, личная льгота остаётся',()=>{
 const s=new Simulation();s.setTax(0);s.setFiscalAutonomy(true);s.treasury=0;for(const p of s.alive)p.coins=0;s.day=1;Finance.daily(s);assert.equal(s.tax,2);assert.equal(Finance.splitWage(s,2,s.alive[0]).tax,0);
});
test('содержание оплачивает настоящие местные материалы, сохраняет денежный баланс и предзаказы',()=>{
 const s=new Simulation();s.day=1;s.treasury=1000;const wood=s.building('wood');wood.stock.wood=10;s.commerce.orders=[{buyer:'bakery',seller:wood.id,good:'wood',amount:9.9,paid:1,at:s.now}];const before=total(s),goods=s.goods;Finance.maintain(s);const q=s.fiscal.infrastructure.procurement,spent=s.fiscal.infrastructure.paid;assert.ok(q.localSpent>0&&q.localSpent<=spent*.7+1e-8);close(total(s),before-spent+q.localSpent);for(const[g,n]of Object.entries(q.goods))close(goods[g]-s.goods[g],n);assert.ok(wood.stock.wood>=9.9-1e-8);const stable=total(s);Finance.maintain(s);close(total(s),stable);assert.deepEqual(clone(s).fiscal.infrastructure.procurement,q);
});
test('без местных запасов закупка не придумывает материалы или деньги',()=>{
 const s=new Simulation();for(const b of s.buildings)for(const g of ['tools','planks','wood','cloth','pottery'])b.stock[g]=0;s.day=1;s.treasury=1000;const before=total(s);Finance.maintain(s);assert.equal(s.fiscal.infrastructure.procurement.localSpent,0);close(before-total(s),s.fiscal.infrastructure.paid);
});
test('повышение цен и сроков нелинейно; богатство не отменяет освоение уровня',()=>{
 const s=new Simulation(),b=s.building('h0');for(const p of s.people.slice(0,10)){p.homeId=b.id;p.coins=100000;}D.review(s);const p=D.owner(s,b),second=D.options(s,b).find(q=>q.id==='level');assert.equal(second.cost,600);assert.equal(second.days,6);assert.match(D.assess(s,b,second).message,/Освоение/);s.day=6;assert.ok(D.start(s,p,b.id,'level').ok);const due=b.development.project.until;s.day=Math.floor(due/1440);s.minute=due%1440;D.tick(s);s.building('hall').development.level=2;for(const q of s.people.slice(0,10))q.homeId=b.id;const third=D.options(s,b).find(q=>q.id==='level');assert.equal(third.cost,2400);assert.equal(third.days,12);assert.equal(D.start(s,p,b.id,'level').ok,false);s.day+=23;assert.equal(D.start(s,p,b.id,'level').ok,false);s.day++;assert.ok(D.start(s,p,b.id,'level').ok);
});
test('деньги в кассе не разрешают убыточному предприятию расширяться; повторная оценка не создаёт историю',()=>{
 const s=new Simulation(),b=s.building('bakery');b.cash=100000;b.stock.bread=0;for(let day=1;day<=6;day++){s.day=day;b.enterprise.lastProfit=-5;D.review(s);}const q=D.options(s,b).find(q=>q.id==='level');assert.match(D.assess(s,b,q).message,/устойчивого дохода/);const count=b.development.progression.samples.length;for(let i=0;i<5;i++)D.review(s);assert.equal(b.development.progression.samples.length,count);for(let day=7;day<=12;day++){s.day=day;b.enterprise.lastProfit=20;D.review(s);}assert.equal(D.assess(s,b,q).ok,true);assert.deepEqual(clone(s).toJSON(),s.toJSON());
});
test('после дополнения нельзя сразу начать новый подряд',()=>{
 const s=new Simulation(),b=s.building('h0');for(const p of s.people.slice(0,7)){p.homeId=b.id;p.coins=5000;p.energy=20;}s.day=6;D.review(s);const p=D.owner(s,b);assert.ok(D.start(s,p,b.id,'extra1').ok);const due=b.development.project.until;s.day=Math.floor(due/1440);s.minute=due%1440;D.tick(s);assert.equal(D.start(s,p,b.id,'level').ok,false);s.day+=3;assert.ok(D.start(s,p,b.id,'level').ok);
});
test('миграция сохраняет оплаченный старый подряд, уровни и деньги; поддельная история отвергается',()=>{
 const s=new Simulation(),b=s.building('h0');b.development.project={id:'level',level:2,name:'Уровень 2',cost:110,days:2,startedAt:s.now,until:s.now+2880,personId:2,payments:[{source:'Семья',amount:110}],effect:'+3 места'};const raw=JSON.parse(JSON.stringify(s));for(const building of raw.state.buildings)delete building.development.progression;const r=Simulation.fromJSON(raw);assert.equal(r.building('h0').development.project.until,b.development.project.until);close(total(r),total(s));const due=b.development.project.until;r.day=Math.floor(due/1440);r.minute=due%1440;D.tick(r);assert.equal(r.building('h0').development.level,2);r.building('h0').development.progression.samples=[{day:r.day,net:1},{day:r.day,net:100}];assert.throws(()=>clone(r),/история развития/);
});
