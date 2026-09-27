const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Finance,World,Housing,Expansion}=require('../sim.js'),B=Finance.Budget;
const clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s))),sum=o=>Object.values(o||{}).reduce((n,v)=>n+v,0),wealth=s=>s.treasury+sum(s.people.map(p=>p.coins))+sum(s.buildings.map(b=>b.cash)),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function history(s,income,services=0){s.day=12;s.accounts.days=Array.from({length:12},(_,day)=>({day,income:{sales:income},expenses:{services}}));s.region.nextDay=18;}
test('богатая казна не оправдывает бездействие при хроническом дефиците',()=>{
 const s=new Simulation();history(s,5,50);s.treasury=5000;for(const t of Object.values(s.fiscal.taxes)){t.enabled=false;t.rate=0;}const before=s.treasury;Finance.daily(s);assert.ok(s.tax>0);assert.ok(s.fiscal.taxes.sales.enabled&&s.fiscal.taxes.export.enabled);assert.match(s.fiscal.lastReview.reason,/не дожидаясь/);assert.ok(s.treasury>=before);
});
test('недофинансированные службы и незаполненный фонд не позволяют снижать налоги',()=>{
 const s=new Simulation();history(s,30);s.treasury=6000;for(const b of s.buildings.filter(b=>['hall','school','clinic','church','dock'].includes(b.type)))B.recordWage(s,b,100);s.day++;const before=s.tax;Finance.daily(s);assert.ok(s.tax>=before);assert.equal(B.capitalHeld(s),0);
});
test('снижение при полном фонде умеренное, налоги не отменяются автоматически',()=>{
 const s=new Simulation();history(s,150);s.treasury=7000;s.fiscal.spending.capital.balance=1600;const before=s.tax;Finance.daily(s);assert.equal(s.tax,before-1);s.fiscal.taxes.income.rate=6;s.fiscal.nextReview=s.day;Finance.daily(s);assert.equal(s.tax,6);assert.ok(s.fiscal.taxes.income.enabled);
});
test('фонд развития резервирует реальные деньги, защищён от служб и оплачивает стройку',()=>{
 const s=new Simulation();history(s,150);s.treasury=2000;for(const b of s.buildings)b.cash=0;const before=wealth(s),plan=Finance.prepareBudget(s),held=B.capitalHeld(s);assert.ok(held>0);close(wealth(s),before);B.services(s);close(wealth(s),before);assert.ok(s.treasury>=held+B.protectedCash(s));const next=clone(s);Finance.prepareBudget(next);close(next.fiscal.spending.capital.balance,held);
 const start=s.treasury;assert.ok(Expansion.build(s,'new4','home').ok);close(start-s.treasury,180);close(s.fiscal.spending.capital.balance,Math.max(0,held-180));close(s.fiscal.spending.capital.spent,Math.min(180,held));
});
test('ручное отключение налогов и ставка десятилетнего сохранения сохраняются',()=>{
 const s=new Simulation();s.setTax(0);history(s,0,80);s.treasury=2;Finance.daily(s);assert.equal(s.tax,0);assert.equal(s.fiscal.autoMayor,false);assert.equal(clone(s).tax,0);
});
test('земельная аренда возвращает деньги городу, бережёт бедных и не начисляется дважды',()=>{
 const s=new Simulation(),p=s.person(1);for(const q of s.people)q.coins=12;p.coins=100;const before=wealth(s),cash=s.treasury,coins=p.coins;s.day++;Housing.collectRent(s);const paid=s.treasury-cash;assert.ok(paid>0);close(coins-p.coins,paid);close(wealth(s),before);assert.ok(s.housing.land.relief>0);Housing.collectRent(s);close(s.treasury,cash+paid);close(clone(s).housing.land.paid,paid);close(s.households.days.at(-1).spending.landRent,paid);
});
test('районы различаются арендой и налогами, большинство домов находится за стеной',()=>{
 const s=new Simulation(),home=s.building('h0'),noble=s.building('h10');assert.ok(Housing.district(noble).rent>Housing.district(home).rent);assert.ok(Finance.Property.quote(s,noble).assessed>Finance.Property.quote(s,home).assessed);assert.ok(s.buildings.filter(b=>b.type==='home'&&!World.insideTown(b.x,b.y)).length>6);for(const p of s.people)assert.ok(Housing.estates[p.estate]);
});
test('планировка старого сохранения переносит имущество, грузы и маршрут без повторных списаний',()=>{
 const s=new Simulation(),p=s.person(2);s.travel(p,'dock');s.move(p,5);p.bag.wood=3;const data=JSON.parse(JSON.stringify(s));delete data.state.layoutVersion;delete data.state.housing.land;for(const q of data.state.people)delete q.estate;const r=Simulation.fromJSON(data);close(wealth(r),wealth(s));assert.equal(r.person(2).bag.wood,3);assert.equal(r.layoutVersion,World.Layout.version);assert.ok(r.person(2).path.every((n,i)=>World.edges.some(e=>e.a===(i?r.person(2).path[i-1].id:r.person(2).navNode)&&e.b===n.id||e.b===(i?r.person(2).path[i-1].id:r.person(2).navNode)&&e.a===n.id)));assert.deepEqual(clone(r).toJSON(),r.toJSON());
});
test('дороги имеют ненулевую длину, свободные участки не накладываются на здания',()=>{
 for(const e of World.edges)assert.ok(Math.hypot(World.nodes[e.a].x-World.nodes[e.b].x,World.nodes[e.a].y-World.nodes[e.b].y)>0,e.a+' > '+e.b);
 for(const l of World.expansionLots)for(const b of World.buildings())assert.ok(Math.abs(l.x-b.x)>(b.w+54)/2||Math.abs(l.y-b.y)>(b.h+42)/2,l.id+' overlaps '+b.id);
});
test('свободные накопления наполняют фонд без создания денег и без блокировки рабочего запаса',()=>{
 const s=new Simulation();history(s,150);s.treasury=5000;const before=wealth(s),p=Finance.prepareBudget(s);assert.equal(B.capitalHeld(s),B.strategy(s).target);close(wealth(s),before);assert.ok(p.envelope>0);assert.ok(s.treasury-B.capitalHeld(s)-B.protectedCash(s)>=B.strategy(s).operatingTarget);
});
test('недавний избыток не скрывает предшествующий дефицит при снижении налогов',()=>{
 const s=new Simulation();history(s,150);for(const r of s.accounts.days.slice(0,6))r.expenses.services=180;s.treasury=7000;s.fiscal.spending.capital.balance=1600;assert.equal(Finance.canReduce(s,Finance.budget(s)),false);
});
test('семья выбирает более дешёвый район и переезжает, сохраняя сословие и деньги',()=>{
 const s=new Simulation(),family=s.people.filter(p=>p.homeId==='h10'),leader=family.find(p=>p.age>=18);for(const p of family)p.coins=13;
 Housing.review(s);assert.ok(leader.housingWish?.to);const target=s.building(leader.housingWish.to);assert.ok(Housing.district(target).rent<Housing.district(s.building('h10')).rent);const before=wealth(s),estate=leader.estate;assert.ok(Housing.relocate(s,leader,target.id,'h10').ok);close(wealth(s),before);assert.equal(leader.estate,estate);assert.equal(leader.path.at(-1).id,'b:'+target.id);
});
