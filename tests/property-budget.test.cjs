const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Finance,Systems,Development}=require('../sim.js'),P=Finance.Property,B=Finance.Budget;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),sum=o=>Object.values(o).reduce((n,v)=>n+v,0);
const clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s)));
const wealth=s=>s.treasury+s.people.reduce((n,p)=>n+p.coins,0)+s.buildings.reduce((n,b)=>n+b.cash,0);
function plan(s,income=100){s.day=6;s.region.nextDay=12;s.accounts.days=Array.from({length:6},(_,day)=>({day,income:{sales:income},expenses:{}}));return Finance.prepareBudget(s);}

test('сбор с дворов переводит реальные деньги, учитывается отдельно и не повторяется',()=>{
 const s=new Simulation(),total=wealth(s),cash=s.treasury;s.day++;P.daily(s);const p=s.fiscal.property;assert.ok(p.paid>0);close(wealth(s),total);close(s.treasury-cash,p.paid);close(s.accounts.days.at(-1).income.property,p.paid);const collected=p.paid;P.daily(s);close(p.paid,collected);assert.deepEqual(clone(s).fiscal.property,p);
});
test('площадь, уровень и положение за стенами определяют сбор; службы и стройки освобождены',()=>{
 const s=new Simulation(),b=s.building('bakery');b.w=54;b.h=42;b.development.level=1;b.cash=1000;const q=P.quote(s,b);assert.equal(q.inside,true);close(q.assessed,1);b.development.level=2;close(P.quote(s,b).assessed,2);const field=s.buildings.find(b=>b.type==='farm');assert.equal(P.quote(s,field).inside,false);assert.equal(P.quote(s,s.building('hall')).assessed,0);b.construction={};assert.equal(P.quote(s,b).assessed,0);b.construction=null;b.damaged=true;assert.equal(P.quote(s,b).assessed,0);
});
test('бедным мастерским положена льгота: зарплатный и сырьевой запас не изымается',()=>{
 const s=new Simulation(),b=s.building('bakery'),reserve=P.wallets(s,b)[0].reserve;b.cash=reserve+.25;s.day++;P.daily(s);close(b.cash,reserve);close(s.fiscal.property.records[b.id].paid,.25);assert.ok(s.fiscal.property.records[b.id].relief>0);assert.equal(s.region.debt,0);
});
test('сбор с дома сохраняет семейный запас и не расходует деньги соседей',()=>{
 const s=new Simulation(),owner=s.alive.find(p=>p.age>=18),home=s.building(owner.homeId);assert.ok(owner);for(const p of s.people)p.coins=60;owner.coins=60.25;const q=P.quote(s,home);assert.equal(q.paid,.25);const before=new Map(s.people.map(p=>[p.id,p.coins]));s.day++;P.daily(s);close(owner.coins,60);for(const p of s.people.filter(p=>p.id!==owner.id))close(p.coins,before.get(p.id));
});
test('ручные ставки и отключение сбора сохраняются; автономию можно вернуть',()=>{
 const s=new Simulation();s.setPropertyTax({rate:2,enabled:false,auto:false});s.day=10;s.treasury=0;Finance.daily(s);assert.equal(s.fiscal.property.paid,0);assert.equal(s.fiscal.property.enabled,false);const saved=JSON.stringify(s.fiscal.property);assert.equal(s.setPropertyTax({rate:-1,enabled:true}).ok,false);assert.equal(JSON.stringify(s.fiscal.property),saved);s.setFiscalAutonomy(true);s.day++;Finance.daily(s);assert.equal(s.fiscal.property.enabled,true);assert.ok(s.fiscal.property.rate>2);const r=clone(s);assert.equal(r.fiscal.property.auto,true);
});
test('миграция старого города не списывает прошлые годы и не меняет ручное управление',()=>{
 const s=new Simulation();s.day=900;s.setFiscalAutonomy(false);const data=s.toJSON();delete data.state.fiscal.property;delete data.state.fiscal.spending;const cash=s.treasury,r=Simulation.fromJSON(JSON.parse(JSON.stringify(data)));assert.equal(r.treasury,cash);assert.equal(r.fiscal.property.lastDay,900);assert.equal(r.fiscal.property.auto,false);assert.equal(r.fiscal.spending.plan,null);P.daily(r);assert.equal(r.treasury,cash);
});
test('бюджет не распределяет больше реальных денег и оставляет региональный резерв',()=>{
 const s=new Simulation();s.treasury=80;s.region.debt=3000;for(const b of s.buildings)b.cash=0;const p=plan(s);assert.ok(sum(p.limits)<=p.envelope+1e-8);assert.ok(p.envelope<=80-p.reserve);assert.ok(p.envelope>0,'старый долг не блокирует все расходы');const total=wealth(s);B.services(s);close(wealth(s),total);assert.ok(s.treasury>=B.protectedCash(s));for(let i=0;i<10;i++)B.services(s);assert.ok(p.spent.services<=p.limits.services+1e-8);assert.ok(s.treasury>=B.protectedCash(s));
});
test('лимиты служб распределяются пропорционально заявкам, а не порядку зданий',()=>{
 const s=new Simulation();s.treasury=80;for(const b of s.buildings)b.cash=0;const p=plan(s,20);assert.ok(p.limits.services<sum(p.services.map(r=>r.wanted)));B.services(s);const ratios=p.services.filter(r=>r.wanted>0).map(r=>r.paid/r.wanted);for(const ratio of ratios)close(ratio,ratios[0]);
});
test('заявки опираются на настоящие зарплаты; порт не покупает сырьё на зарплатный резерв',()=>{
 const s=new Simulation(),dock=s.building('dock'),person=s.person(2);dock.cash-=24;Finance.wage(s,person,24,dock);s.day=1;close(B.wageNeed(s,dock),24);close(B.operatingReserve(s,dock),48);dock.cash=50;for(const k of ['iron','flour','grain'])dock.stock[k]=0;s.day=3;s.treasury=0;const reserve=B.operatingReserve(s,dock);s.tradeWithOutside();assert.ok(dock.cash>=reserve);const r=clone(s);assert.deepEqual(r.fiscal.spending.wages,s.fiscal.spending.wages);
});
test('субсидии не тратят накопленный сбор накануне его уплаты',()=>{
 const s=new Simulation();s.treasury=60;for(const b of s.buildings)b.cash=0;s.day=5;s.accounts.days=[{day:4,income:{sales:100},expenses:{}}];Finance.prepareBudget(s);B.services(s);assert.ok(s.treasury>=s.regionBill());s.day=6;Systems.daily(s);assert.equal(s.region.debt,0);
});
test('старый долг гасится частями, текущий сбор уплачивается; ручное погашение остаётся полным',()=>{
 const s=new Simulation();s.region.debt=3000;s.treasury=100;s.day=6;const due=s.regionBill();Systems.daily(s);close(s.region.history[0].paid,due*1.5);close(s.region.debt,3000-due*.5);assert.ok(s.treasury>0);s.payRegionDebt();assert.equal(s.treasury,0);
});
test('содержание начисляется целиком, выплата ограничена бюджетом, отложенное остаётся долгом',()=>{
 const s=new Simulation();s.treasury=60;for(const b of s.buildings)b.cash=0;const p=plan(s,18),due=sum(Finance.upkeep(s));Finance.maintain(s);close(s.fiscal.infrastructure.arrears,due-p.spent.infrastructure);assert.ok(p.spent.infrastructure<=p.limits.infrastructure);const cash=s.treasury;Finance.maintain(s);close(s.treasury,cash);
});
test('ремонт выполняется только при полном финансировании и оплачивается один раз',()=>{
 const s=new Simulation(),b=s.building('bakery');b.damaged=true;b.damageDay=0;s.treasury=1000;const p=plan(s);B.repair(s);assert.equal(b.damaged,false);close(p.spent.repair,20);const cash=s.treasury;B.repair(s);close(s.treasury,cash);
 const poor=new Simulation();poor.building('bakery').damaged=true;poor.building('bakery').damageDay=0;poor.treasury=2;plan(poor);B.repair(poor);assert.equal(poor.building('bakery').damaged,true);
});
test('частичная закупка еды соответствует расходу; софинансирование лавки не создаёт деньги',()=>{
 const s=new Simulation();s.treasury=80;for(const b of s.buildings){b.stock.bread=0;b.stock.fish=0;}const market=s.building('market');market.cash=128;const p=plan(s,25),limit=p.limits.food,total=wealth(s),bread=s.goods.bread;B.food(s);assert.ok(p.spent.food<=limit+1e-8);assert.ok(p.spent.food>0);const totalCost=total-wealth(s);close(s.goods.bread-bread,totalCost/60*100);assert.ok(s.treasury>=B.protectedCash(s));s.triggerCrisis('blockade');const cash=s.treasury;B.food(s);close(s.treasury,cash);
});
test('капитальный проект не забирает деньги уже выделенного дневного бюджета',()=>{
 const s=new Simulation();s.treasury=1000;const p=plan(s);p.limits.services=500;p.spent.services=0;const reserve=Development.wallets(s,s.building('hall'))[0].reserve;assert.ok(reserve>=p.reserve+500+80);
});
test('операционный прогноз включает начисленное содержание и исключает разовые улучшения',()=>{
 const s=new Simulation();s.day=6;s.accounts.days=[{day:5,income:{sales:600},expenses:{development:500,infrastructure:1}}];close(Finance.budget(s).net,100-s.regionBill()/6-sum(Finance.upkeep(s)));
});
test('план переживает сохранение, загрузка не выдаёт деньги повторно и отклоняет повреждения',()=>{
 const s=new Simulation();for(const b of s.buildings)b.cash=0;plan(s);B.services(s);const r=clone(s);assert.deepEqual(r.fiscal.spending,s.fiscal.spending);const cash=r.treasury;Finance.prepareBudget(r);B.services(r);close(r.treasury,cash);r.fiscal.spending.plan.limits.food=-1;assert.throws(()=>clone(r),/план расходов/);s.fiscal.property.latest={day:6,assessed:NaN,paid:0,relief:0};assert.throws(()=>clone(s),/итог сбора/);
});
