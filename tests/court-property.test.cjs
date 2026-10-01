const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Court:C,Property:P,Civic,Brain,Agreements:A,Finance,Housing,Government,Labour}=require('../sim.js');
const {at,clock,hearing,enforce}=require('./helpers/court.cjs');
const clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s))),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const money=s=>s.treasury+s.people.reduce((n,p)=>n+p.coins,0)+s.buildings.reduce((n,b)=>n+b.cash,0)+s.guilds.groups.reduce((n,g)=>n+g.cash,0)+(s.properties?.escrow||0);
function crime(){const s=new Simulation(),p=s.person(1),q=s.person(5),w=s.person(9);for(const x of[p,q,w]){at(s,x,'market');Object.assign(x,{age:30,health:90,hunger:90,energy:90,coins:200});}Object.assign(p.mind.personality,{ambition:.95,empathy:.1,caution:.1});s.random=()=>0;Civic.execute(s,p,{kind:'civicOffence',target:'market',personId:q.id,offence:'theft',motive:'greed'});delete s.random;const x=s.civic.cases[0],c=C.fromCrime(s,x);return{s,p,q,w,x,c};}
function sale(type='home'){const s=new Simulation(),b=s.building(type==='home'?'h0':'bakery'),seller=P.owner(s,b),buyer=s.person(13);seller.coins=40;buyer.coins=3000;at(s,seller,b.id);const l=P.list(s,seller,b,P.appraisal(s,b)).listing;at(s,buyer);const o=P.propose(s,buyer,l,l.ask*.9).offer;at(s,seller);return{s,b,seller,buyer,l,o};}
test('Суд: сообщение не наказывает; очное заседание и пристав сохраняют деньги и исключают повтор',()=>{
 const {s,p,q,w,x,c}=crime(),before=money(s),treasury=s.treasury;assert.equal(Civic.sentence(s,x),false);assert.equal(x.fine,0);at(s,q);assert.ok(C.file(s,q,c).ok);const judge=s.person(c.judgeId);at(s,judge);clock(s,c.hearingAt);assert.equal(C.adjudicate(s,c,judge),false);assert.equal(c.verdict,null);
 at(s,p);at(s,w);Object.assign(judge.character.values,{justice:.5,honesty:.9});judge.relationships={};assert.equal(C.adjudicate(s,c,judge),false);clock(s,s.now+30);assert.ok(C.adjudicate(s,c,judge));assert.equal(c.verdict.kind,'fine');assert.equal(p.civic.service,0);assert.ok(enforce(s,c).ok);close(money(s),before);close(x.recovered,x.amount);close(s.treasury-treasury,8);const paid=money(s);assert.equal(enforce(s,c).ok,false);close(money(s),paid);assert.deepEqual(clone(s).court,s.court);
});
test('Суд: родство требует отвода, смерть судьи меняет назначение без приговора',()=>{
 const {s,p,q,c}=crime();s.government.offices.judge.personId=q.spouseId;at(s,q);C.file(s,q,c);assert.notEqual(c.judgeId,q.spouseId);assert.ok(c.recusals.some(r=>r.personId===q.spouseId));assert.equal(c.judgeId,null);s.government.offices.judge.personId=13;C.tick(s);const old=s.person(c.judgeId);assert.ok(old);s.die(old,'умер от болезни');C.tick(s);assert.notEqual(c.judgeId,old.id);assert.equal(c.verdict,null);
});
test('Суд: недостаток свидетельств допускает оправдание; характер судьи меняет санкцию',()=>{
 const {s,c,x}=crime();x.witnesses=[];hearing(s,c);assert.equal(c.verdict.kind,'acquittal');assert.equal(c.status,'closed');
 const other=crime();hearing(other.s,other.c);const j=other.s.person(other.c.judgeId);j.character.values.justice=.95;assert.equal(C.decide(other.s,other.c,j).kind,'service');
});
test('Суд: нужды прерывают явку; план ведёт в ратушу по дороге, повторные неявки имеют процедуру',()=>{
 const {s,q,c}=crime();at(s,q);C.file(s,q,c);clock(s,c.hearingAt-120);at(s,q,q.homeId);Object.assign(q,{hunger:90,energy:90,social:90,faith:90,health:100});const choice=Brain.options(s,q).find(x=>x.goal==='courtAttend');assert.ok(choice);s.travel(q,'hall');assert.ok(q.path.length);q.hunger=5;assert.equal(Brain.choose(s,q).goal,'eat');
 const d=new Simulation(),a=d.person(5),b=d.person(9);const debt={id:1,kind:'loan',status:'overdue',borrowerId:b.id,lenderId:a.id,amount:20,paid:0,remaining:20,at:0,due:0,interest:0,notified:true};d.agreements.items.push(debt);d.agreements.nextId=2;const civil=C.offer(d,'loan',1,a.id,b.id);at(d,a);C.file(d,a,civil);civil.postponed=2;C.schedule(d,civil);const judge=d.person(civil.judgeId);at(d,judge);at(d,a);at(d,b,b.homeId);clock(d,civil.hearingAt);C.adjudicate(d,civil,judge);clock(d,d.now+30);assert.ok(C.adjudicate(d,civil,judge));assert.match(civil.verdict.procedure,/Заочное/);
});
test('Суд: взыскание займа учитывает добровольный возврат после решения и жизненный минимум',()=>{
 const s=new Simulation(),p=s.person(5),q=s.person(9);p.coins=200;q.coins=80;at(s,p,'market');at(s,q,'market');p.relationships[q.id]=q.relationships[p.id]=60;const a=A.propose(s,p,q,'loan',20,'market').agreement;assert.ok(A.resolve(s,a).ok);a.status='overdue';const c=C.offer(s,'loan',a.id,q.id,p.id);hearing(s,c);const before=money(s);assert.ok(A.repay(s,p,a).ok);assert.ok(enforce(s,c).ok);close(money(s),before);close(c.paid,0);assert.equal(c.status,'closed');
});
test('Суд: удержанная за выполненный труд зарплата остаётся обязательством предприятия',()=>{
 const s=new Simulation(),b=s.building('bakery'),worker=s.person(5),boss=s.person(b.ownerId);boss.character.values.honesty=.05;boss.mind.personality.ambition=.95;worker.jobId=b.id;at(s,worker,b.id);worker.plan={goal:'work',index:0,steps:[{kind:'work',target:b.id,duration:90,elapsed:0}]};const before=money(s);s.execute(worker,5);close(money(s),before);const w=s.court.wages[0];assert.ok(w.remaining>0);const c=C.offer(s,'wage',w.id,worker.id,boss.id,b.id);hearing(s,c);const cash=money(s);assert.ok(enforce(s,c).ok);close(money(s),cash);close(w.remaining,0);assert.ok(worker.fiscalToday.gross>0);
});
test('Суд: просроченная поставка возвращает остаток из кассы продавца, сохраняя заказ',()=>{
 const s=new Simulation(),buyer=s.building('bakery'),seller=s.building('mill');seller.cash=200;const order={buyer:buyer.id,seller:seller.id,good:'flour',amount:8,paid:8,unitPrice:1};s.commerce.orders.push(order);const a=A.supply(s,order);a.status='overdue';const c=C.offer(s,'supply',a.id,buyer.ownerId,seller.ownerId,seller.id);hearing(s,c);A.delivered(s,order,3);order.amount-=3;const before=money(s);assert.ok(enforce(s,c).ok);close(c.paid,5);close(money(s),before);close(a.remaining,0);assert.ok(!s.commerce.orders.includes(order));
});
test('Суд: пристрастность даёт личную жалобу и другого судью',()=>{
 const {s,c,q,p}=crime();hearing(s,c);const j=s.person(c.judgeId);j.character.values.honesty=.05;j.relationships[p.id]=100;j.relationships[q.id]=-80;c.verdict=C.decide(s,c,j);at(s,q);assert.ok(C.appeal(s,q,c).ok);assert.notEqual(c.judgeId,j.id);assert.ok(c.complaint);assert.equal(c.verdict,null);assert.equal(C.appeal(s,q,c).ok,false);
});
test('Собственность: миграция регистрирует все дворы и участки без платежей',()=>{
 const s=new Simulation(),raw=JSON.parse(JSON.stringify(s)),before=money(s);delete raw.state.properties;delete raw.state.court;const r=Simulation.fromJSON(raw);close(money(r),before);assert.equal(r.properties.escrow,0);assert.ok(r.buildings.every(b=>P.entry(r,b)));assert.ok(Object.values(r.properties.records).some(r=>r.land));assert.deepEqual(clone(r).properties,r.properties);
});
test('Собственность: оба участника подписывают сделку, жильцы и товары сохраняются',()=>{
 const {s,b,seller,buyer,l,o}=sale(),before=money(s),members=s.people.map(p=>p.homeId),stock={...b.stock},cash=b.cash;at(s,seller,b.id);assert.equal(P.sign(s,buyer,o).ok,false);at(s,seller);assert.ok(P.sign(s,seller,o).ok);assert.equal(P.owner(s,b).id,buyer.id);close(money(s),before);assert.deepEqual(s.people.map(p=>p.homeId),members);assert.deepEqual(b.stock,stock);close(b.cash,cash);close(l.soldFor,o.bid);assert.ok(l.soldFor<l.ask);assert.equal(P.sign(s,seller,o).ok,false);assert.ok(s.properties.leases.some(l=>l.buildingId===b.id));assert.deepEqual(clone(s).properties,s.properties);
});
test('Собственность: продажа мастерской сохраняет оператора, грузы и обязательства',()=>{
 const {s,b,seller,buyer,o}=sale('workshop'),before=money(s),operator=b.ownerId,cash=b.cash,goods={...b.stock};s.person(7).cargo={good:'flour',amount:2,from:'mill',to:b.id,paid:2};const cargo=JSON.stringify(s.person(7).cargo);assert.ok(P.sign(s,seller,o).ok);assert.equal(b.ownerId,operator);assert.equal(P.owner(s,b).id,buyer.id);close(b.cash,cash);assert.deepEqual(b.stock,goods);assert.equal(JSON.stringify(s.person(7).cargo),cargo);close(money(s),before);assert.ok(s.properties.leases.some(l=>l.buildingId===b.id&&l.use==='workshop'));
});
test('Аренда: залог хранится отдельно, платежи идут владельцу, выход возвращает остаток',()=>{
 const s=new Simulation(),b=s.building('h0'),tenant=s.person(9),landlord=P.owner(s,b);tenant.coins=200;const before=money(s),r=P.lease(s,tenant,b);assert.ok(r.ok);assert.ok(r.lease.deposit>0);close(money(s),before);tenant.homeId=b.id;const purse=landlord.coins;s.day++;P.daily(s);assert.ok(r.lease.paid>0);assert.ok(landlord.coins>purse-2);close(money(s),before);const escrow=s.properties.escrow;P.closeLease(s,r.lease);close(s.properties.escrow,escrow-r.lease.rate*2);close(money(s),before);const after=money(s);P.closeLease(s,r.lease);close(money(s),after);
});
test('Аренда: долг после продажи двора сохраняется, срок и залог не сбрасываются',()=>{
 const {s,b,seller,buyer,o}=sale(),tenant=s.person(9);tenant.coins=200;const l=P.lease(s,tenant,b).lease;tenant.homeId=b.id;l.arrears=5;const terms=[l.until,l.deposit],before=money(s);assert.ok(P.sign(s,seller,o).ok);assert.deepEqual([l.until,l.deposit],terms);assert.equal(l.landlordId,buyer.id);close(l.arrears,5);close(money(s),before);
});
test('Собственность: смерть владельца передаёт существующий двор наследнику, переезд не отбирает его',()=>{
 const s=new Simulation(),b=s.building('h0'),owner=P.owner(s,b),heir=s.person(owner.spouseId);owner.homeId='h2';s.day++;s.initializeDevelopment();assert.equal(P.owner(s,b).id,owner.id);const before=money(s);s.die(owner,'умер от болезни');assert.equal(P.owner(s,b).id,heir.id);close(money(s),before);assert.equal(s.properties.records[b.id].shares.length,1);
});
test('Сохранения: повестки, аренда и сделки продолжаются; повреждённые права и залоги отклоняются',()=>{
 const {s,c}=crime();hearing(s,c);const r=clone(s);assert.deepEqual(r.court,s.court);r.advance(60);s.advance(60);assert.deepEqual(r.toJSON(),s.toJSON());
 for(const change of [s=>s.properties.escrow=9,s=>s.properties.records.h0.holderId=99999,s=>s.court.cases[0].plaintiffId=99999,s=>s.properties.leases.push({})]){const {s}=crime();change(s);assert.throws(()=>clone(s));}
});
test('Общий сценарий: жители сами продают двор, подают иск и исполняют решение по дорогам',()=>{
 const s=new Simulation(),b=s.building('h0'),seller=P.owner(s,b),buyer=s.person(13);seller.coins=35;buyer.coins=2000;buyer.mind.personality.ambition=1;seller.homeId='h2';seller.jobId=null;seller.plan=null;buyer.plan=null;
 const shop=s.building('bakery'),worker=s.person(5);C.wage(s,worker,shop,12);shop.cash=350;
 let travelled=false;for(let i=0;i<18*24;i++){s.advance(60);travelled ||= s.living.some(p=>p.path.length&&p.plan?.steps.some(x=>x.kind.startsWith('court')||x.kind.startsWith('property')));}
 assert.ok(travelled,'юридические действия требуют перемещения');assert.ok(s.properties.totals.sales>=1,'самостоятельная сделка');assert.equal(s.properties.listings.find(l=>l.buildingId===b.id).status,'sold');assert.ok(s.court.totals.hearings>0);assert.ok(s.court.cases.some(c=>c.kind==='wage'&&c.paid>0),'пристав взыскал заработанное');assert.ok(s.court.totals.recovered>0);assert.deepEqual(clone(s).toJSON(),s.toJSON());
});
test('Суд: неудачный визит откладывает дело и освобождает пристава для других обязательств',()=>{
 const {s,c,p}=crime();hearing(s,c);clock(s,c.nextEnforcement*1440+600);const guard=C.officer(s,c);at(s,guard,'market');at(s,p,p.homeId);assert.equal(C.enforce(s,guard,c).ok,false);assert.equal(c.nextEnforcement,s.day+1);assert.equal(C.enforce(s,guard,c).ok,false);
});
test('Аренда: смерть арендатора возвращает залог наследнику, а не умершему',()=>{
 const s=new Simulation(),p=s.person(9),heir=s.person(p.spouseId),b=s.building('h0');p.coins=200;const l=P.lease(s,p,b).lease,before=money(s),coins=heir.coins,deposit=l.deposit;p.alive=false;P.inheritance(s);assert.equal(l.status,'ended');close(heir.coins,coins+deposit);close(money(s),before);
});
test('Аренда: покупка своего помещения прекращает платежи самому себе и возвращает залог',()=>{
 const {s,b,seller,buyer,o}=sale();buyer.homeId=b.id;const l=P.lease(s,buyer,b).lease;assert.ok(l);assert.ok(P.sign(s,seller,o).ok);const before=money(s),rent=l.paid;s.day++;P.daily(s);assert.equal(l.status,'ended');close(l.paid,rent);close(l.deposit,0);close(money(s),before);
});
