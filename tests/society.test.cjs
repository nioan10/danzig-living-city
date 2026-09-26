const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Intentions,Mind,Social,Agreements,EnterprisePolicy,Labour,Commerce,Guilds,Brain}=require('../sim.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const wealth=s=>s.treasury+s.people.reduce((n,p)=>n+p.coins,0)+s.buildings.reduce((n,b)=>n+b.cash,0)+s.guilds.groups.reduce((n,g)=>n+g.cash,0);
const clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s)));
const settle=(s,p,id)=>Object.assign(p,{location:id,goal:id,navNode:'b:'+id,x:s.building(id).door.x,y:s.building(id).door.y,path:[],plan:null});
function meeting(kind='loan'){const s=new Simulation(),p=s.person(2),q=s.person(1);p.coins=2;q.coins=150;settle(s,p,p.homeId);settle(s,q,p.homeId);const r=Agreements.propose(s,p,q,kind,20,p.homeId,kind==='venture'?'bakery':null);assert.ok(r.ok);return{s,p,q,a:r.agreement};}

test('намерение сохраняется при бытовом кризисе и меняет способ после неудач',()=>{
 const s=new Simulation(),p=s.person(2),h=Mind.household(s,p);p.intention.goal='mastery';p.intention.reviewAt=s.day+6;
 assert.equal(Intentions.review(s,p,{...h,coins:0},'security'),'security');assert.equal(p.intention.goal,'mastery');assert.equal(p.intention.paused,true);
 const tactic=p.intention.tactic;for(let i=0;i<3;i++)Intentions.fail(s,p,'unpaid');assert.notEqual(p.intention.tactic,tactic);
 assert.equal(Intentions.review(s,p,{...h,coins:1000},'standing'),'mastery');s.day=6;assert.equal(Intentions.review(s,p,{...h,coins:1000},'standing'),'standing');
});
test('заём требует личной встречи и согласия, деньги не создаются',()=>{
 const {s,p,q,a}=meeting(),before=wealth(s);q.location='hall';assert.equal(Agreements.resolve(s,a).pending,true);close(wealth(s),before);assert.equal(p.coins,2);
 q.location=p.homeId;assert.ok(Agreements.resolve(s,a).ok);close(wealth(s),before);assert.equal(p.coins,22);assert.equal(q.coins,130);assert.equal(a.remaining,20);
 Agreements.resolve(s,a);assert.equal(p.coins,22);assert.equal(q.coins,130);
});
test('кредитор бережёт резерв и вправе отказать родственнику',()=>{
 const {s,p,q,a}=meeting();q.coins=Agreements.reserve(s,q)+1;const before=wealth(s);assert.equal(Agreements.resolve(s,a).ok,false);assert.equal(a.status,'declined');close(wealth(s),before);
});
test('возврат займа укрепляет отношения и сохраняет общую сумму денег',()=>{
 const {s,p,q,a}=meeting();Agreements.resolve(s,a);p.coins=60;const before=wealth(s),trust=q.relationships[p.id]||0;assert.ok(Agreements.repay(s,p,a).ok);assert.equal(a.status,'fulfilled');close(wealth(s),before);assert.ok(q.relationships[p.id]>trust);
 assert.equal(Agreements.repay(s,p,a).ok,false);close(wealth(s),before);
});
test('просрочка не списывает остаток долга, последствия применяются один раз',()=>{
 const {s,p,q,a}=meeting();Agreements.resolve(s,a);p.coins=0;s.day=a.due+3;Agreements.daily(s);const trust=q.relationships[p.id],remaining=a.remaining;assert.equal(a.status,'overdue');assert.equal(s.agreements.defaults,1);
 s.day++;Agreements.daily(s);assert.equal(s.agreements.defaults,1);assert.equal(q.relationships[p.id],trust);assert.equal(a.remaining,remaining);
});
test('партнёрский вклад пополняет кассу и выплачивается из свободной прибыли',()=>{
 const {s,p,q,a}=meeting('venture'),b=s.building('bakery'),before=wealth(s),opening=b.enterprise.openingCash;assert.ok(Agreements.resolve(s,a).ok);close(wealth(s),before);assert.equal(b.enterprise.openingCash,opening+20);assert.equal(p.coins,2);
 b.cash=200;b.enterprise.lastProfit=10;const w=wealth(s),coins=q.coins;s.day++;Agreements.daily(s);close(wealth(s),w);close(q.coins-coins,2);assert.equal(a.paid,2);
});
test('неудачный вклад завершает срок без бесплатного возмещения',()=>{
 const {s,q,a}=meeting('venture');Agreements.resolve(s,a);const b=s.building('bakery');b.cash=0;b.enterprise.lastProfit=-10;const before=wealth(s),cash=q.coins;s.day=a.due;Agreements.daily(s);assert.equal(a.status,'closed');assert.equal(q.coins,cash);close(wealth(s),before);assert.equal(a.remaining,20);
});
test('два одновременных предложения не могут потратить одни деньги кредитора',()=>{
 const {s,p,q,a}=meeting();q.coins=Agreements.reserve(s,q)+20;const r=s.person(5);r.relationships[q.id]=q.relationships[r.id]=50;settle(s,r,p.homeId);const second=Agreements.propose(s,r,q,'loan',20,p.homeId).agreement;
 assert.ok(Agreements.resolve(s,a).ok);assert.equal(Agreements.resolve(s,second).ok,false);assert.ok(q.coins>=Agreements.reserve(s,q));
});
test('поставка исполняет обязательство только после физического получения груза',()=>{
 const s=new Simulation(),buyer=s.building('bakery'),seller=s.building('wood');seller.cash=0;seller.stock.wood=0;assert.ok(Commerce.order(s,buyer,seller,'wood',4));const order=s.commerce.orders[0],a=s.agreements.items[0];assert.equal(a.status,'active');seller.stock.wood=4;
 Commerce.credit(s,buyer,seller,'wood',4);assert.equal(a.status,'active');Commerce.credit(s,buyer,seller,'wood',4,true);assert.equal(a.status,'fulfilled');assert.equal(a.delivered,4);assert.equal(s.commerce.orders.length,0);
});
test('просроченная поставка возвращает только реальные деньги за недоставленную часть',()=>{
 const s=new Simulation(),buyer=s.building('bakery'),seller=s.building('wood');seller.cash=0;seller.stock.wood=0;Commerce.order(s,buyer,seller,'wood',4);const a=s.agreements.items[0];Commerce.credit(s,buyer,seller,'wood',1,true);seller.cash=50;
 const before=wealth(s),cash=buyer.cash,claim=a.remaining;s.day=a.due+1;Agreements.daily(s);close(wealth(s),before);close(buyer.cash-cash,claim);assert.equal(a.status,'closed');assert.equal(s.commerce.orders.length,0);assert.equal(a.delivered,1);
});
test('слух сохраняет возраст и теряет уверенность; личное наблюдение исправляет его',()=>{
 const s=new Simulation(),p=s.person(2),q=s.person(5),b=s.building('mill');s.observe(q,b);delete p.knowledge[b.id];const at=q.knowledge[b.id].seenAt;s.minute+=40;Social.share(s,p,q);assert.equal(p.knowledge[b.id].seenAt,at);assert.ok(p.knowledge[b.id].confidence<1);assert.equal(p.knowledge[b.id].source,q.id);
 s.observe(p,b);assert.equal(p.knowledge[b.id].source,'personal');assert.equal(p.knowledge[b.id].confidence,1);
});
test('житель выбирает поставщика по известной цене, затем обновляет сведения при визите',()=>{
 const s=new Simulation(),p=s.person(2),b=s.building('bakery');s.observe(p,b);const quote=p.knowledge.bakery.prices.bread;s.commerce.prices.bread*=2;const offer=s.suppliers(p,'bread').find(x=>x.id===b.id);close(offer.price,quote);s.observe(p,b);close(s.suppliers(p,'bread').find(x=>x.id===b.id).price,s.price(b,'bread'));
});
test('рекомендация знакомого влияет на выбор места работы',()=>{
 const s=new Simulation(),p=s.person(2),q=s.person(5),b=s.building(q.jobId);p.relationships[q.id]=50;s.observe(q,b);delete p.knowledge[b.id];Social.share(s,p,q);assert.equal(p.knowledge[b.id].recommendedBy.id,q.id);
 const score=Labour.evaluate(s,p,b).score;delete p.knowledge[b.id].recommendedBy;assert.ok(score>Labour.evaluate(s,p,b).score);
});
test('переговоры о ставке оплачиваются работодателем, обещание переживает снижение объявления',()=>{
 const s=new Simulation(),p=s.person(2),b=s.building(p.jobId);b.cash=500;const base=b.wage;assert.ok(Labour.raise(s,p,b).ok);b.wage=base*.95;assert.ok(Labour.rate(s,p,b)>base);s.day=p.career.termUntil;close(Labour.rate(s,p,b),b.wage);
});
test('хозяин отвечает на нехватку рабочих и залежавшийся товар',()=>{
 const s=new Simulation(),b=s.building('bakery');for(const p of s.workers(b.id))p.jobId=null;b.cash=300;b.stock.bread=0;const base=b.wage;s.day++;EnterprisePolicy.review(s,b,{bread:40});assert.ok(['retain','recruit'].includes(b.management.mode));assert.ok(b.wage>base);
 b.stock.bread=1000;b.enterprise.lastProfit=-10;for(let i=0;i<3;i++){s.day++;EnterprisePolicy.review(s,b,{bread:40});}assert.equal(b.management.mode,'pause');assert.ok(b.management.outputScale<1);assert.ok(b.enterprise.priceFactor<1);
});
test('миграция добавляет системы без изменения богатства, расписания и генератора случайности',()=>{
 const s=new Simulation(),data=JSON.parse(JSON.stringify(s));delete data.state.agreements;for(const p of data.state.people){delete p.intention;delete p.patronage;}for(const b of data.state.buildings)delete b.management;
 const r=Simulation.fromJSON(data);close(wealth(r),wealth(s));assert.equal(r.seed,s.seed);assert.equal(r.now,s.now);assert.deepEqual(r.people.map(p=>p.jobId),s.people.map(p=>p.jobId));
});
test('обсуждение и исполнение договорённостей воспроизводимы после сохранения',()=>{
 const {s,p,q,a}=meeting();const r=clone(s);Agreements.resolve(s,a);Agreements.resolve(r,r.agreements.items[0]);s.advance(500);r.advance(500);assert.deepEqual(clone(s).toJSON(),s.toJSON());assert.deepEqual(r.toJSON(),s.toJSON());
});
test('повреждённые денежные обязательства отклоняются при загрузке',()=>{
 const {s,a}=meeting();const data=JSON.parse(JSON.stringify(s));data.state.agreements.items[0].remaining=-1;assert.throws(()=>Simulation.fromJSON(data),/договор/);
});
test('договорённость заключается через планы и физическую встречу двух жителей',()=>{
 const s=new Simulation(),p=s.person(2),q=s.person(1);s.people=[p,q];p.coins=1;q.coins=180;
 for(const x of s.people)Object.assign(x,{hunger:100,energy:100,social:100,faith:100,health:100,sick:false});
 settle(s,p,p.homeId);settle(s,q,'hall');const r=Agreements.propose(s,p,q,'loan',12,p.homeId);assert.ok(r.ok);
 p.plan={goal:'negotiate',title:'Договориться',index:0,createdAt:s.now,steps:[{kind:'negotiate',target:p.homeId,duration:30,elapsed:0,agreementId:r.agreement.id}]};
 assert.ok(Brain.options(s,q).some(x=>x.steps[0].kind==='answerDeal'));
 for(let i=0;i<350&&r.agreement.status==='proposed';i+=5)s.advance(5);
 assert.equal(r.agreement.status,'active');assert.ok(q.career);assert.ok(p.coins>=12);assert.equal(q.location,p.homeId);
});
test('выбывший участник не оставляет вечного приглашения и не создаёт деньги',()=>{
 const {s,p,a}=meeting();s.die(p,'умер от болезни');const before=wealth(s);s.day++;Agreements.daily(s);assert.equal(a.status,'cancelled');close(wealth(s),before);
});
test('стратегия нового частного двора сохраняется ещё на этапе строительства',()=>{
 const s=new Simulation();s.treasury=1000;assert.ok(s.startConstruction('new1','bakery').ok);assert.ok(s.building('new1').management);assert.deepEqual(clone(s).toJSON(),s.toJSON());
});
test('после отказа житель ищет другого собеседника, а не повторяет ту же просьбу',()=>{
 const s=new Simulation(),p=s.person(2),q=s.person(1);p.coins=2;q.coins=0;s.building('bakery').cash=100;s.building(p.homeId).stock.bread=s.building(p.homeId).stock.fish=0;settle(s,p,p.homeId);settle(s,q,p.homeId);
 const a=Agreements.propose(s,p,q,'loan',10,p.homeId).agreement;assert.equal(Agreements.resolve(s,a).ok,false);s.day=4;
 const choices=Brain.options(s,p).filter(x=>x.steps.some(z=>z.kind==='negotiate'));assert.ok(choices.every(x=>x.steps[0].lenderId!==q.id));
});
test('состоятельный хозяин вкладывает собственные деньги с сохранением семейного резерва',()=>{
 const s=new Simulation(),p=s.person(2),b=s.building('bakery');p.coins=150;b.cash=0;const before=wealth(s),opening=b.enterprise.openingCash;assert.ok(EnterprisePolicy.invest(s,p,b).ok);close(wealth(s),before);assert.equal(b.cash,30);assert.equal(p.coins,120);assert.equal(b.enterprise.openingCash,opening+30);assert.equal(EnterprisePolicy.invest(s,p,b).ok,false);
});
