const test=require('node:test');
const assert=require('node:assert/strict');
const {Simulation,Systems,Learning,Brain,World}=require('../sim.js');
const Art=require('../map-art.js');
const clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s)));
const custom=(s,v={})=>s.saveCustomEvent({title:'Указ совета',hours:2,treasury:0,mood:0,stock:0,productivity:100,repeatDays:0,...v});

test('сбор наступает по расписанию один раз; нехватка денег становится долгом',()=>{
  const s=new Simulation();s.treasury=10;
  s.day=5;Systems.daily(s);assert.equal(s.treasury,10);
  s.day=6;Systems.daily(s);assert.equal(s.treasury,0);assert.equal(s.region.debt,34);
  assert.equal(s.region.totalAssessed,44);assert.equal(s.region.totalPaid,10);assert.equal(s.region.nextDay,12);
  Systems.daily(s);assert.equal(s.region.history.length,1);
  s.changeTreasury(20,'custom');s.payRegionDebt();assert.equal(s.region.debt,14);
  assert.equal(s.region.history[0].assessed,0);assert.equal(s.region.totalAssessed,44);
  s.day=12;Systems.daily(s);assert.equal(s.region.debt,58);assert.equal(s.region.history[0].assessed,44);
  s.changeTreasury(100,'custom');s.payRegionDebt();assert.equal(s.treasury,42);assert.equal(s.region.debt,0);
  assert.equal(s.region.totalPaid,88);assert.equal(s.accounts.days.flatMap(d=>[d.expenses.region||0]).reduce((a,b)=>a+b,0),88);
});

test('изменение сбора сохраняет ближайшую дату, а перенос старого города не начисляет прошлые годы',()=>{
  const s=new Simulation();assert.equal(s.setRegion({period:3,base:30,perResident:1}).ok,true);
  assert.equal(s.region.nextDay,6);s.day=6;Systems.daily(s);assert.equal(s.region.nextDay,9);assert.equal(s.region.totalPaid,78);
  assert.equal(s.setRegion({period:0,base:1,perResident:1}).ok,false);
  const data=JSON.parse(JSON.stringify(s));data.state.day=217;delete data.state.region;delete data.state.accounts;delete data.state.statistics;
  for(const p of data.state.people)delete p.learning;
  const m=Simulation.fromJSON(data);assert.equal(m.region.nextDay,223);assert.equal(m.region.debt,0);assert.equal(m.statistics.sinceDay,217);
  assert.equal(m.treasury,s.treasury);assert.equal(m.alive.length,48);assert.ok(m.people.every(p=>p.learning));
});

test('мобилизация сохраняет людей и товары, проходит через ворота и освобождает вакансии',()=>{
  const s=new Simulation(),before=s.goods,r=s.triggerCrisis('mobilization',{percent:25,days:1});
  assert.equal(r.ok,true);const ids=r.incident.affected;assert.ok(ids.length>0);assert.ok(!ids.includes(s.mayorId));
  assert.deepEqual(s.goods,before);assert.equal(s.living.length,48);
  for(const id of ids){const p=s.person(id);assert.equal(p.jobId,null);assert.equal(p.absence.status,'departing');assert.equal(p.path.at(-1).id,'southRoad');if(World.insideTown(p.x,p.y))assert.ok(p.path.some(n=>World.gates.includes(n.id)));assert.ok(p.path.every((n,i)=>World.edges.some(e=>e.a===(i?p.path[i-1].id:p.navNode)&&e.b===n.id||e.b===(i?p.path[i-1].id:p.navNode)&&e.a===n.id)));}
  s.advance(240);assert.ok(ids.every(id=>s.person(id).absence.status==='away'));assert.equal(s.alive.length,48-ids.length);
  const reserve=ids.map(id=>({id,hunger:s.person(id).hunger,coins:s.person(id).coins}));
  s.advance(120);for(const x of reserve){assert.equal(s.person(x.id).hunger,x.hunger);assert.equal(s.person(x.id).coins,x.coins);}
  assert.equal(s.triggerCrisis('mobilization').ok,false);
  const b=clone(s);s.advance(1400);b.advance(1400);assert.deepEqual(s.toJSON(),b.toJSON());
  for(const id of ids){assert.equal(s.person(id).absence,null);assert.ok(s.person(id).alive);}
  assert.equal(r.incident.status,'resolved');
  for(const b of s.buildings)assert.ok(s.workers(b.id).length<=s.jobSlots(b),b.id);
});

test('блокада блокирует импорт, экспорт, обоз и покупку помощи; после срока торговля возвращается',()=>{
  const s=new Simulation(),dock=s.building('dock'),bakery=s.building('bakery');
  dock.stock.iron=0;bakery.stock.bread=100;s.day=3;s.triggerCrisis('blockade',{days:1});
  const cash=s.treasury;s.tradeWithOutside();assert.equal(dock.stock.iron,0);assert.equal(bakery.stock.bread,100);
  assert.equal(s.act('food').ok,false);assert.equal(s.triggerEvent('caravan').ok,false);assert.equal(s.treasury,cash);
  s.day=4;Systems.tick(s);s.day=6;s.tradeWithOutside();assert.ok(dock.stock.iron>0);assert.equal(bakery.stock.bread,65);
  assert.equal(s.act('food').ok,true);
});

test('неурожай меняет выпуск только сельских хозяйств и завершается',()=>{
  const s=new Simulation();const r=s.triggerCrisis('badHarvest',{days:1});
  assert.equal(Systems.productionFactor(s,s.building('farm')),.35);assert.equal(Systems.productionFactor(s,s.building('pasture')),.35);
  assert.equal(Systems.productionFactor(s,s.building('smith')),1);s.day++;Systems.tick(s);
  assert.equal(r.incident.status,'resolved');assert.equal(Systems.productionFactor(s,s.building('farm')),1);
});

test('своё событие меняет реальные запасы и казну один раз, временные эффекты истекают',()=>{
  const s=new Simulation(),mill=s.building('mill'),before=mill.stock.flour;
  const t=custom(s,{target:'mill',treasury:-30,stock:7,good:'flour',mood:-10,productivity:50,close:true}).template;
  const now=s.now,r=s.runCustomEvent(t.id);assert.equal(s.now,now);assert.equal(r.ok,true);
  assert.equal(s.treasury,290);assert.equal(mill.stock.flour,before+7);assert.equal(s.isOpen(mill),false);assert.equal(Systems.productionFactor(s,mill),.5);
  assert.ok(s.workers('mill').every(p=>p.eventMood.some(e=>e.value===-10)));
  assert.equal(s.runCustomEvent(t.id).ok,false);assert.equal(s.treasury,290);
  s.minute+=125;Systems.tick(s);assert.equal(s.isOpen(mill),true);assert.equal(Systems.productionFactor(s,mill),1);
  assert.equal(mill.stock.flour,before+7);assert.equal(s.treasury,290);
});

test('расписание своего события переживает сохранение, без дублирования и отрицательных запасов',()=>{
  const s=new Simulation(),t=custom(s,{repeatDays:1,treasury:-5000,stock:-1000}).template;
  s.runCustomEvent(t.id);assert.equal(s.treasury,0);assert.equal(s.building('market').stock.bread,0);
  s.day++;Systems.tick(s);assert.equal(t.runs,2);Systems.tick(s);assert.equal(t.runs,2);
  const b=clone(s);s.advance(1600);b.advance(1600);assert.deepEqual(s.toJSON(),b.toJSON());assert.equal(t.runs,3);
  t.enabled=false;s.day+=2;Systems.tick(s);assert.equal(t.runs,3);
  assert.equal(custom(s,{hours:NaN}).ok,false);assert.equal(custom(s,{close:true,target:'city'}).ok,false);
  assert.equal(custom(s,{target:'missing'}).ok,false);assert.equal(custom(s,{title:' '}).ok,false);
});

test('оценка целей меняется от результата и влияет на следующий выбор',()=>{
  const s=new Simulation(),p=s.person(2);s.minute=600;p.hunger=100;p.energy=100;p.social=100;
  const before=Brain.options(s,p).find(x=>x.goal==='work').score;
  const plan={goal:'work',title:'Работать',baseline:Learning.baseline(p)};p.coins+=20;
  for(let i=0;i<6;i++)Learning.observe(s,p,plan,true);
  assert.ok(Learning.bias(s,p,'work')>5);const score=Brain.options(s,p).find(x=>x.goal==='work').score;
  p.learning.values.work.value=0;const neutral=Brain.options(s,p).find(x=>x.goal==='work').score;assert.ok(score>neutral);
  for(let i=0;i<10;i++)Learning.observe(s,p,plan,false,'Нет оплаты');assert.ok(Learning.bias(s,p,'work')<0);
  assert.equal(p.learning.successes,6);assert.equal(p.learning.failures,10);assert.equal(p.learning.history.length,8);
  p.hunger=1;assert.ok(['eat','makeMeal'].includes(Brain.choose(s,p).goal),'Привычки не должны перебивать критические потребности');
  assert.ok(Number.isFinite(before));
});

test('дети наследуют ослабленный опыт, учатся в семье один раз в день и могут его переучить',()=>{
  const s=new Simulation(),father=s.person(1),mother=s.person(2);
  father.learning.values.work={value:10,trials:8,title:'Работать'};mother.learning.values.work={value:6,trials:5,title:'Работать'};
  const c=s.createPerson('Пётр','Тест','m',7,'h0');c.parents=[father.id,mother.id];s.initializeMind(c);
  assert.equal(c.learning.generation,1);assert.equal(c.learning.inherited,1);assert.equal(c.learning.values.work.value,4.4);
  Learning.teach(s);assert.equal(c.learning.lessons,1);assert.ok(c.learning.values.work.value>4.4);
  Learning.teach(s);assert.equal(c.learning.lessons,1);s.day++;Learning.teach(s);assert.equal(c.learning.lessons,2);
  father.absence={status:'away'};mother.absence={status:'away'};s.day++;Learning.teach(s);assert.equal(c.learning.lessons,2);
  for(let i=0;i<12;i++)Learning.observe(s,c,{goal:'work',title:'Работать'},false);assert.ok(Learning.bias(s,c,'work')<0);
  delete father.absence;delete mother.absence;assert.deepEqual(clone(s).person(c.id).learning,c.learning);
});

test('крупный шаг ускорения даёт тот же город, что последовательные малые шаги',()=>{
  const a=new Simulation(),b=new Simulation();a.triggerCrisis('mobilization',{days:1});b.triggerCrisis('mobilization',{days:1});
  a.advance(10800);for(let i=0;i<2160;i++)b.advance(5);assert.deepEqual(a.toJSON(),b.toJSON());
  assert.ok(a.region.totalPaid>0);assert.ok(a.statistics.snapshots.length>20);assert.ok(a.people.some(p=>p.learning.lessons>0));
  assert.ok(a.statistics.distance>0);assert.ok(a.statistics.trips>0);
});

test('движение учитывает все пройденные углы, отрисовка совпадает с текущим ребром',()=>{
  const s=new Simulation(),p=s.person(2),a=World.nodes.country,b=World.nodes.westGate,c=World.nodes.west;
  Object.assign(p,{x:a.x,y:a.y,navNode:'country',location:null,path:[{...b},{...c}],motionSegments:[]});
  const length=Math.hypot(b.x-a.x,b.y-a.y),next=Math.hypot(c.x-b.x,c.y-b.y);s.move(p,(length+next/2)/s.walkSpeed(p));
  assert.equal(p.motionSegments.length,2);assert.equal(p.navNode,'westGate');assert.deepEqual(Art.personPoint(p,0),Art.nodes.country);
  const corner=Art.personPoint(p,length/(length+next/2));assert.ok(Math.hypot(corner.x-Art.nodes.westGate.x,corner.y-Art.nodes.westGate.y)<1e-8);
  const end=Art.personPoint(p,1),expected=Art.onEdge('westGate','west',.5);assert.ok(Math.hypot(end.x-expected.x,end.y-expected.y)<1e-8);
  const path=Art.remainingPath(p);assert.ok(Math.hypot(path[0].x-end.x,path[0].y-end.y)<1e-8);assert.ok(path.slice(1).every(q=>q.x>=end.x));
  assert.ok(Math.abs(s.statistics.distance-(length+next/2))<1e-8);
});

test('все визуальные дороги имеют узлы и одинаковую геометрию в обоих направлениях',()=>{
  for(const e of World.edges){const ps=Art.edgePoints(e.a,e.b);assert.ok(ps.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),e.a+'>'+e.b);
    for(const t of [0,.2,.5,1]){const a=Art.onEdge(e.a,e.b,t),b=Art.onEdge(e.b,e.a,1-t);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-8);}}
});

test('очистка истории не отменяет длительный кризис среди многих законченных событий',()=>{
  const s=new Simulation(),crisis=s.triggerCrisis('blockade').incident;
  for(let i=0;i<120;i++)s.incidents.unshift({id:++s.incidentSerial,type:'custom',status:'resolved',until:s.now,endedAt:s.now});
  const template=custom(s).template;s.runCustomEvent(template.id);assert.equal(Systems.active(s,'blockade'),crisis);
  s.triggerEvent('feast');assert.equal(Systems.active(s,'blockade'),crisis);assert.equal(s.act('food').ok,false);
});

test('армия и численность выше нормы жилья не выключают рождения',()=>{
  const s=new Simulation();while(s.living.length<90)s.createPerson('Ребёнок','Горожанин','m',6,'h0');
  s.person(5).absence={status:'away'};assert.equal(s.alive.length,89);s.random=()=>0;s.families();
  assert.equal(s.living.length,91);assert.equal(s.births,1);
});
