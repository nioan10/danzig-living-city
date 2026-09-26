const test=require('node:test');
const assert=require('node:assert/strict');
const {Simulation,Events,GOODS}=require('../sim.js');

test('пожар немедленно останавливает двор и меняет планы помощников без хода времени',()=>{
  const s=new Simulation();const now=s.now;
  const r=s.triggerEvent('fire','bakery');assert.equal(r.ok,true);assert.equal(s.now,now);
  assert.equal(s.canProduce(s.building('bakery')),false);
  assert.ok(s.alive.some(p=>p.plan?.goal==='helpFire'));
  assert.ok(r.incident.reactions.some(p=>p.goal==='helpFire'));
  assert.ok(r.incident.reactions.length<s.alive.length/2,'Обычные первые планы не должны считаться реакцией на пожар');
  assert.ok(s.events.some(e=>e.importance==='critical'&&e.buildingId==='bakery'));
  s.advance(200);assert.equal(s.building('bakery').damaged,false);
  assert.equal(r.incident.status,'resolved');
});
test('обоз пополняет настоящий склад; повторный вызов не создаёт лишние запасы',()=>{
  const s=new Simulation(),dock=s.building('dock'),before=dock.stock.flour;
  assert.equal(s.triggerEvent('caravan').ok,true);assert.equal(dock.stock.flour,before+50);
  assert.equal(s.triggerEvent('caravan').ok,false);assert.equal(dock.stock.flour,before+50);
  assert.ok(s.alive.every(p=>p.knowledge.dock.stock.flour===dock.stock.flour));
});
test('гроза замедляет ход, вызывает поиск укрытия и заканчивается',()=>{
  const s=new Simulation();s.advance(30);const p=s.workers('farm')[0],speed=s.walkSpeed(p);
  const r=s.triggerEvent('storm');assert.equal(s.weather,'Гроза');assert.equal(s.walkSpeed(p),speed*.7);
  assert.equal(p.plan.goal,'shelter');s.advance(185);assert.equal(r.incident.status,'resolved');
  assert.equal(s.walkSpeed(p),speed);assert.notEqual(s.weather,'Гроза');
});
test('болезнь приводит пациентов к лекарю, а лекаря в лечебницу',()=>{
  const s=new Simulation();const r=s.triggerEvent('illness');assert.equal(r.incident.affected.length,3);
  for(const id of r.incident.affected){assert.equal(s.person(id).sick,true);assert.equal(s.person(id).plan.goal,'heal');}
  assert.equal(s.workers('clinic')[0].plan.goal,'medicalDuty');
  s.advance(490);assert.equal(r.incident.status,'resolved');
  assert.ok(r.incident.affected.some(id=>!s.person(id).sick));
});
test('ярмарка привлекает жителей, а поломка предотвращает выбор закрытого поставщика',()=>{
  const s=new Simulation();s.advance(30);s.triggerEvent('feast');assert.ok(s.alive.filter(p=>p.plan?.goal==='fair').length>5);
  s.triggerEvent('breakdown');assert.equal(s.isOpen(s.building('mill')),false);
  for(const p of s.workers('bakery'))assert.ok(!s.suppliers(p,'flour').some(q=>q.id==='mill'));
  s.advance(370);assert.equal(s.isOpen(s.building('mill')),true);
  assert.equal(s.eventSummary().active.length,0);
});
test('события и реакция сохраняются, продолжение воспроизводимо, v2 без событий читается',()=>{
  const a=new Simulation();a.triggerEvent('storm');a.triggerEvent('illness');a.advance(25);
  const b=Simulation.fromJSON(JSON.parse(JSON.stringify(a)));assert.deepEqual(a.incidents,b.incidents);
  a.advance(600);b.advance(600);assert.deepEqual(a.toJSON(),b.toJSON());
  const old=JSON.parse(JSON.stringify(new Simulation()));delete old.state.incidents;delete old.state.eventSerial;delete old.state.incidentSerial;delete old.state.pulseState;for(const e of old.state.events){delete e.id;delete e.importance;delete e.label;}
  const migrated=Simulation.fromJSON(old);assert.equal(migrated.alive.length,48);assert.equal(migrated.eventSummary().minor,1);assert.equal(migrated.triggerEvent('caravan').ok,true);
});
test('все шесть вмешательств вместе завершаются без отрицательных ресурсов',()=>{
  const s=new Simulation();s.advance(30);for(const e of Events.CATALOG)assert.equal(s.triggerEvent(e.id).ok,true,e.id);
  for(let i=0;i<300;i++){s.advance(5);for(const b of s.buildings)for(const g of Object.keys(GOODS))assert.ok(Number.isFinite(b.stock[g])&&b.stock[g]>=0,g);}
  assert.equal(s.eventSummary().active.length,0);
  assert.equal(new Set(s.events.map(e=>e.id)).size,s.events.length);
  assert.equal(s.triggerEvent('unknown').ok,false);
});
