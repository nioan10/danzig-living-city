const test = require('node:test');
const assert = require('node:assert/strict');
const { Simulation, World, Brain, Bridge, GOODS, TYPES } = require('../sim.js');

function settle(sim, p, id) {
  const b = sim.building(id);
  Object.assign(p, { x: b.door.x, y: b.door.y, navNode: 'b:' + id, location: id, goal: id, path: [], plan: null });
}
function comfortable(p) { Object.assign(p, { hunger: 100, energy: 100, social: 100, faith: 100, health: 100, sick: false, coins: 50 }); }
function until(sim, predicate, limit = 1000) { for (let n = 0; n < limit && !predicate(); n += 5) sim.advance(5); assert.ok(predicate(), 'Событие не произошло за отведённое время'); }

test('48 жителей, 34 двора; новые ремёсла заселены', () => {
  const s = new Simulation();
  assert.equal(s.alive.length, 48); assert.equal(s.buildings.length, 34);
  for (const id of ['bakery', 'mill', 'weaver', 'tailor', 'carpenter', 'potter', 'smith']) assert.ok(s.workers(id).length, id);
  for (const p of s.alive) if (p.spouseId) assert.equal(s.person(p.spouseId).spouseId, p.id);
});

test('поля, мельница, пастбище, лес и карьер находятся за стеной', () => {
  const s = new Simulation();
  for (const id of ['farm', 'mill', 'pasture', 'wood', 'clay', 'sawmill', 'charcoal']) {
    const b = s.building(id); assert.equal(World.insideTown(b.x, b.y), false, id);
  }
  assert.ok(World.insideTown(s.building('market').x, s.building('market').y));
  const route = World.route('b:h0', 'b:farm');
  assert.ok(route.some(n => n.id === 'westGate'));
  assert.equal(route.at(-1).id, 'b:farm');
  assert.ok(World.distance('b:h0', 'b:farm') > World.distance('b:h0', 'b:bakery'));
});

test('ни одна дорога не пересекает стену вне ворот; все дворы связаны', () => {
  const cross = (a,b,c,d) => {
    const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
    if(Math.abs(den)<1e-9)return null;
    const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den;
    return t>1e-5&&t<1-1e-5&&u>=0&&u<=1?{x:a.x+t*rx,y:a.y+t*ry}:null;
  };
  for(const e of World.edges)for(let i=1;i<World.wall.length;i++){
    const p=cross(World.nodes[e.a],World.nodes[e.b],{x:World.wall[i-1][0],y:World.wall[i-1][1]},{x:World.wall[i][0],y:World.wall[i][1]});
    if(p)assert.ok(World.gates.some(id=>Math.hypot(p.x-World.nodes[id].x,p.y-World.nodes[id].y)<23), e.a+' → '+e.b);
  }
  for(const b of World.buildings())assert.ok(World.route('b:market','b:'+b.id));
});

test('при одинаковом времени разные потребности дают разные планы', () => {
  const s = new Simulation(); s.minute = 600;
  const p = s.person(2); comfortable(p);
  p.hunger = 10;
  assert.ok(['eat', 'makeMeal'].includes(Brain.choose(s,p).goal));
  p.hunger = 100; p.energy = 5;
  assert.equal(Brain.choose(s,p).goal, 'rest');
  p.energy = 100; p.social = 0; p.traits = ['Общительный'];
  assert.equal(Brain.choose(s,p).goal, 'social');
});

test('одновременные голод и усталость не перезапускают еду каждый такт', () => {
  const s = new Simulation(); const p = s.person(3); s.people = [p];
  settle(s,p,p.homeId); comfortable(p); p.hunger = 3; p.energy = 0;
  s.advance(25);
  assert.ok(p.hunger > 40);
  assert.ok(s.building(p.homeId).stock.bread < 5);
});

test('сырьё физически перевозится; получение груза не увеличивает общий запас', () => {
  const s = new Simulation(); const p = s.person(2); s.people = [p]; comfortable(p); s.minute = 600;
  settle(s,p,'bakery'); const bakery=s.building('bakery'); bakery.stock.flour=0; bakery.stock.wood=20;
  s.building('mill').stock.flour=80; s.observe(p,s.building('mill'));
  const before=s.goods.flour;
  until(s,()=>Boolean(p.cargo));
  assert.equal(p.cargo.good,'flour'); assert.equal(p.cargo.to,'bakery');
  assert.equal(s.goods.flour,before);
  const amount=p.cargo.amount;
  until(s,()=>!p.cargo);
  assert.equal(bakery.stock.flour,amount);
  assert.equal(s.goods.flour,before); assert.equal(s.deliveries,1);
});

test('закрытая мельница запоминается, пекарь выбирает запасного поставщика', () => {
  const s=new Simulation();const p=s.person(2);s.people=[p];comfortable(p);s.minute=600;
  settle(s,p,'bakery');s.building('bakery').stock.flour=0;s.building('bakery').stock.wood=20;
  s.act('disrupt','mill');
  until(s,()=>p.memories.some(m=>m.subject==='mill'&&m.kind==='closed'));
  s.advance(5);
  assert.equal(p.plan.goal,'supply');
  assert.equal(p.plan.steps[0].target,'dock');
  assert.ok(p.memories.some(m=>m.subject==='mill'&&m.value<0));
});

test('при смене цели в дороге житель сначала доходит до следующего узла', () => {
  const s=new Simulation(),p=s.person(2);settle(s,p,'h0');s.travel(p,'farm');s.move(p,3);
  const next={...p.path[0]},before={x:p.x,y:p.y};s.travel(p,'church');
  assert.deepEqual(p.path[0],next);assert.deepEqual({x:p.x,y:p.y},before);
});

test('без сырья и при остановке пекарня не создаёт хлеб', () => {
  const s=new Simulation();const p=s.person(2);s.people=[p];comfortable(p);settle(s,p,'bakery');
  const b=s.building('bakery');b.stock.flour=0;
  p.plan={goal:'work',steps:[{kind:'work',target:'bakery',duration:90,elapsed:0}],index:0};s.execute(p,80);assert.equal(b.output,0);
  b.stock.flour=50;b.closedUntil=s.now+1440;p.plan={goal:'work',steps:[{kind:'work',target:'bakery',duration:90,elapsed:0}],index:0};s.execute(p,80);assert.equal(b.output,0);
});

test('решения совета, отсутствие денег, адресный ремонт и выборы', () => {
  const s=new Simulation(),food=s.food;
  assert.equal(s.act('food').ok,true);assert.equal(s.food,food+75);assert.equal(s.treasury,275);
  assert.equal(s.act('festival').ok,true);assert.equal(s.act('festival').ok,false);
  s.building('mill').damaged=true;s.building('bakery').damaged=true;s.act('repair','bakery');
  assert.equal(s.building('bakery').damaged,false);assert.equal(s.building('mill').damaged,true);
  s.treasury=0;assert.equal(s.act('food').ok,false);
  s.setTax(100);assert.equal(s.tax,30);s.setTax(-4);assert.equal(s.tax,0);
  const old=s.person(s.mayorId);s.die(old,'скончался');assert.notEqual(s.mayorId,old.id);assert.ok(s.person(s.mayorId).alive);
});

test('мелкие шаги и сохранённый план дают воспроизводимое продолжение', () => {
  const a=new Simulation(99),b=new Simulation(99);
  for(let i=0;i<600;i++)a.advance(.5);b.advance(300);assert.deepEqual(a.toJSON(),b.toJSON());
  const restored=Simulation.fromJSON(JSON.parse(JSON.stringify(a)));a.advance(2000);restored.advance(2000);assert.deepEqual(a.toJSON(),restored.toJSON());
  const bad=JSON.parse(JSON.stringify(a));bad.state.buildings[0].stock.bread=-1;assert.throws(()=>Simulation.fromJSON(bad));
  assert.throws(()=>a.advance(-1));
});

test('старое сохранение переносит людей, семьи и деньги, пересоздавая географию', () => {
  const Legacy=require('../backup-v1/sim.js').Simulation;
  const old=new Legacy();old.advance(1560);const data=JSON.parse(JSON.stringify(old));
  const s=Simulation.fromJSON(data);
  assert.equal(s.day,old.day);assert.equal(s.treasury,old.treasury);assert.equal(s.alive.length,old.alive.length);
  assert.equal(s.person(2).coins,old.person(2).coins);assert.equal(s.person(2).spouseId,old.person(2).spouseId);
  assert.equal(s.buildings.length,34);assert.equal(s.toJSON().version,2);
  for(const p of s.alive)assert.equal(p.navNode,'b:'+p.homeId);
  s.advance(60);assert.ok(s.decisions>0);
});

test('интерфейс больших решений отключён и не делает сетевых вызовов', () => {
  assert.equal(Bridge.enabled,false);assert.equal(Bridge.request({kind:'career'}).status,'disabled');
  assert.equal(Bridge.request({kind:'career'}).proposal,null);
  assert.equal(Bridge.validateProposal({action:'invent-money'},['hire','rest']),false);
  const s=new Simulation();assert.equal(s.advisor.enabled,false);assert.ok(s.advisor.lastRequests.every(r=>r.status==='disabled'));
});

test('[long] 120 суток автономной жизни: продолжаются производство и перевозки, нет NaN и отрицательных ресурсов', () => {
  const s=new Simulation();
  for(let day=0;day<120;day++){
    s.nextMorning();
    for(const b of s.buildings){assert.ok(b.cash>=-1e-7&&Number.isFinite(b.cash));for(const k of Object.keys(GOODS))assert.ok(b.stock[k]>=0&&Number.isFinite(b.stock[k]), b.id+':'+k);}
    for(const p of s.alive)for(const k of ['hunger','energy','health','mood','social','faith'])assert.ok(p[k]>=0&&p[k]<=100,k);
  }
  assert.ok(s.alive.length>=35);assert.ok(s.births>0);assert.ok(s.deliveries>300);assert.ok(s.decisions>1000);
  for(const id of ['weaver','tailor','sawmill','carpenter','potter'])assert.ok(s.building(id).output>0,id);
});
