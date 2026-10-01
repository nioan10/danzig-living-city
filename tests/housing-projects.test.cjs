const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Housing:H,HousingProjects:P,Households,Brain,Construction,Expansion,Property}=require('../sim.js');
const restore=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s)));
function fixture(){
  const s=new Simulation(81);s.minute=600;s.guilds.auto=false;
  for(const q of s.people.filter(p=>p.homeId==='h1'))q.homeId='h0';
  for(const b of s.buildings.filter(b=>b.type==='home'))while(s.living.filter(p=>p.homeId===b.id).length<H.room(b))s.createPerson('Тест','Соседи','m',9,b.id);
  for(const p of [s.person(1),s.person(2)])Object.assign(p,{coins:220,hunger:100,energy:100,health:100,social:100,faith:100,sick:false});
  for(const p of s.people)if(!p.mind)s.initializeMind(p);H.review(s);return s;
}
function at(s,p,id){const b=s.building(id);Object.assign(p,{location:id,navNode:'b:'+id,x:b.door.x,y:b.door.y,path:[],goal:id});}
function apply(s){const p=s.person(1),q=P.proposal(s,p);at(s,p,'hall');const r=P.apply(s,p,{lotId:q.lotId,value:q.value});assert.ok(r.ok,r.message);return P.ensure(s).applications[0];}
const money=s=>s.treasury+s.people.reduce((n,p)=>n+p.coins,0)+s.buildings.reduce((n,b)=>n+b.cash,0)+s.guilds.groups.reduce((n,g)=>n+g.cash,0)+s.properties.escrow+Construction.contracts(s).reduce((n,x)=>n+x.q.cash,0);

test('за пять дней ИИ сам подаёт заявку, строит и заселяется без вмешательства игрока',()=>{
  const s=fixture();s.advance(5*1440);const a=P.ensure(s).applications.find(a=>a.personId===1);
  assert.ok(a,'семья должна подать заявку');assert.equal(a.status,'settled');assert.equal(s.person(1).homeId,a.lotId);assert.equal(s.building(a.lotId).construction,undefined);
  assert.ok(s.works.local>0);assert.ok(s.works.wages>0);assert.ok(s.housing.moves>0);assert.equal(H.census(s).get(a.lotId).penalty,0);
});

test('семья планирует собственный дом, приходит в ратушу и получает автоматическое разрешение',()=>{
  const s=fixture(),p=s.person(1),before=money(s),goods=s.goods,treasury=s.treasury;
  assert.equal(p.housingWish.to,null);const plan=Brain.choose(s,p);assert.equal(plan.goal,'homeBuild');assert.equal(plan.steps[0].target,'hall');
  assert.equal(P.apply(s,p,plan.steps[0]).ok,false);p.plan=plan;const pos=[p.x,p.y];s.travel(p,'hall');assert.deepEqual([p.x,p.y],pos);assert.ok(p.path.length);
  for(let i=0;i<150&&p.location!=='hall';i++)s.move(p,5);assert.equal(p.location,'hall');
  for(let i=0;i<8;i++)s.execute(p,5);const a=P.ensure(s).applications[0];assert.equal(a.status,'pending');assert.equal(money(s),before);assert.equal(s.building(a.lotId),undefined);
  P.daily(s);const b=s.building(a.lotId);assert.equal(a.status,'building');assert.ok(b.construction.local);assert.equal(Property.owner(s,b).id,p.id);assert.equal(b.guildId,undefined);
  assert.ok(s.treasury>treasury);assert.ok(P.wallets(s,H.movingFamily(s,p)).every(w=>w.person.coins>=w.reserve-1e-8));assert.ok(Math.abs(money(s)-before)<1e-7);assert.deepEqual(s.goods,goods);
  assert.equal(P.apply(s,p,plan.steps[0]).ok,false);assert.equal(P.ensure(s).applications.length,1);
  assert.equal(Construction.finish(s,b,b.construction),false,'таймер не создаёт материалы и выполненную работу');
});

test('семейная стройка оплачивает поставщиков и труд; готовый дом занят заказчиком после дорожного переезда',()=>{
  const s=fixture(),p=s.person(1),a=apply(s);P.daily(s);const b=s.building(a.lotId),q=b.construction.local,wealth=money(s),goods=s.goods;
  const worker=s.person(9),seller=s.building('market');let cost=0;
  // Controlled existing stock: every unit is purchased, carried and consumed by the real contract.
  for(const [g,n]of Object.entries(q.needs)){
    const missing=Math.max(0,n-seller.stock[g]);seller.stock[g]+=missing;goods[g]+=missing;
    at(s,worker,seller.id);const before=seller.stock[g],r=Construction.execute(s,worker,{kind:'buildPickup',target:seller.id,jobId:q.id,good:g,amount:n},5);assert.ok(r.ok,r.message);cost+=before-seller.stock[g];assert.ok(worker.constructionCargo);
    s.travel(worker,b.id);for(let i=0;i<150&&worker.location!==b.id;i++)s.move(worker,5);assert.equal(worker.location,b.id);
    assert.ok(Construction.execute(s,worker,{kind:'buildDeliver',jobId:q.id},5).ok);
  }
  assert.ok(cost>0);assert.ok(q.materialSpent>0);while(q.work<q.required)assert.ok(Construction.execute(s,worker,{kind:'buildWork',jobId:q.id},5).ok);
  assert.ok(q.wages>0);s.day=Math.ceil(b.construction.until/1440);s.minute=600;Expansion.tick(s);
  assert.equal(b.construction,undefined);assert.equal(a.status,'ready');assert.equal(H.reservedFor(s,b),false);assert.notEqual(H.newcomerHome(s)?.id,b.id);assert.equal(p.housingWish.to,b.id);
  const group=H.movingFamily(s,p),positions=group.map(p=>[p.x,p.y]);assert.ok(H.relocate(s,p,b.id,p.homeId).ok);assert.deepEqual(group.map(p=>[p.x,p.y]),positions);
  for(let i=0;i<200;i++)for(const member of group)if(member.relocation)H.travelStep(s,member,5);
  assert.ok(group.every(p=>p.location===b.id&&!p.relocation));assert.equal(a.status,'settled');assert.equal(H.census(s).get('h0').members.length,4);assert.equal(H.census(s).get(b.id).penalty,0);
  assert.ok(Math.abs(money(s)-wealth)<1e-6);for(const [g,n]of Object.entries(q.needs))assert.ok(Math.abs(goods[g]-s.goods[g]-n)<1e-7,g);
});

test('заявка перепроверяет деньги и участок, ручной режим не тратит средства без решения',()=>{
  const s=fixture();s.guilds.permitMode='manual';const a=apply(s),cash=money(s);P.daily(s);assert.equal(a.status,'pending');assert.equal(money(s),cash);
  s.person(1).coins=s.person(2).coins=12;assert.equal(P.decide(s,a.id).ok,false);assert.equal(s.building(a.lotId),undefined);assert.equal(a.status,'pending');
  s.person(1).coins=500;assert.ok(P.decide(s,a.id).ok);const after=money(s);assert.equal(P.decide(s,a.id).ok,false);assert.equal(money(s),after);
  const t=fixture(),request=apply(t);t.treasury=1000;assert.ok(t.startConstruction(request.lotId,request.value).ok);const funds=t.person(1).coins;P.daily(t);assert.equal(request.status,'cancelled');assert.equal(t.person(1).coins,funds);
});

test('накопления удерживают необязательные покупки, сохраняя деньги на еду и топливо',()=>{
  const s=fixture(),p=s.person(1);p.coins=s.person(2).coins=40;H.review(s);const b=Households.budget(s,p);
  assert.ok(b.housingReserve>=180);assert.equal(b.limit,0);assert.equal(Households.allowance(b,{good:'food'}),b.coins);assert.equal(Households.allowance(b,{good:'wood'}),b.free);
  assert.match(p.homeProject.reason,/Собираем/);assert.notEqual(Brain.choose(s,p).goal,'homeBuild');assert.equal(P.ensure(s).applications.length,0);
});

test('после свадьбы супруги не телепортируются и переселяются вместе с детьми из разных домов',()=>{
  const s=fixture(),a=s.person(1),b=s.person(6);s.person(2).spouseId=null;s.person(5).spouseId=null;a.spouseId=null;b.spouseId=null;b.homeId='h2';a.relationships[b.id]=80;
  for(const p of s.living)if(![a.id,b.id].includes(p.id)&&!p.spouseId)p.age=12;
  s.random=()=>.99;const homes=[a.homeId,b.homeId],coords=[a.x,a.y,b.x,b.y];s.families();assert.equal(a.spouseId,b.id);assert.deepEqual([a.homeId,b.homeId],homes);assert.deepEqual([a.x,a.y,b.x,b.y],coords);
  H.review(s);assert.equal(a.housingWish.split,true);assert.equal(H.canGrow(s,b),false);
  const empty=s.building('h3');for(const p of s.living.filter(p=>p.homeId===empty.id))p.homeId='h4';H.review(s);assert.equal(a.housingWish.to,empty.id);
  const goods=s.goods;assert.ok(H.relocate(s,a,empty.id,homes[0]).ok);assert.equal(a.homeId,b.homeId);assert.deepEqual(s.goods,goods);assert.equal(b.relocation.from,homes[1]);assert.deepEqual([a.x,a.y,b.x,b.y],coords);
});

test('планирование ребёнка не переполняет дом; свободное место позволяет рождение',()=>{
  const s=fixture(),m=s.person(2);for(const p of s.living)if(p.sex==='f'&&p.id!==m.id)p.lastBirth=100;s.day=100;m.lastBirth=0;s.building('market').stock.bread=1000;s.random=()=>0;
  const before=s.births;s.families();assert.equal(s.births,before);assert.equal(H.canGrow(s,m),false);
  for(const p of s.living.filter(p=>p.homeId==='h0'&&!H.family(s,m).includes(p)))p.homeId='h1';s.families();assert.equal(s.births,before+1);assert.equal(H.census(s).get('h0').members.length,5);
});

test('аренда учитывает переезжающую семью, а не всех взрослых родственников в прежнем доме',()=>{
  const s=fixture(),p=s.person(3);p.age=20;p.coins=100;
  for(let i=0;i<10;i++){const child=s.createPerson('Тест','Родственник','m',20,'h0');child.parents=[1,2];}
  const dest=s.building('h1');for(const q of s.living.filter(p=>p.homeId===dest.id))q.homeId='h2';s.invalidateHouseholds();H.review(s);
  assert.ok(Property.housingAccess(s,p,H.family(s,p),dest));assert.equal(H.relocate(s,p,dest.id,'h0').ok,true);
});

test('заявка и стройка сохраняются без повторного списания; неверный проект отклоняется',()=>{
  const s=fixture(),a=apply(s),saved=restore(s);P.daily(s);P.daily(saved);assert.deepEqual(s.toJSON(),saved.toJSON());
  const again=restore(s);s.advance(180);again.advance(180);assert.deepEqual(s.toJSON(),again.toJSON());
  const bad=JSON.parse(JSON.stringify(s));bad.state.housing.projects.applications[0].lotId='hall';assert.throws(()=>Simulation.fromJSON(bad),/заявка/);
  const legacy=JSON.parse(JSON.stringify(new Simulation()));delete legacy.state.housing.projects;const restored=Simulation.fromJSON(legacy);assert.equal(P.ensure(restored).applications.length,0);
});
