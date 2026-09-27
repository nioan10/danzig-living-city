const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Housing,Brain}=require('../sim.js');
const crowded=()=>{const s=new Simulation();for(const p of s.people.filter(p=>p.homeId==='h1'))p.homeId='h0';return s;};
const comfortable=p=>Object.assign(p,{hunger:100,energy:100,social:100,faith:100,health:100,mood:70,sick:false,coins:50});
const settle=(s,p,id)=>Object.assign(p,{x:s.building(id).door.x,y:s.building(id).door.y,navNode:'b:'+id,location:id,goal:id,path:[],plan:null});

test('теснота снижает целевое довольство только жильцов конкретного дома',()=>{
 const a=crowded(),b=Simulation.fromJSON(JSON.parse(JSON.stringify(a)));for(const p of b.people.filter(p=>p.id>=5&&p.id<=8))p.homeId='h1';
 for(const s of [a,b])for(const p of s.people)comfortable(p);
 assert.equal(Housing.census(a).get('h0').penalty,6);assert.equal(Housing.census(a).get('h2').penalty,0);
 a.tick(5);b.tick(5);assert.ok(Math.abs(b.person(1).mood-a.person(1).mood-.15)<1e-8);
});
test('военнослужащий сохраняет прописку, но временно не создаёт тесноту',()=>{
 const s=crowded();s.person(5).absence={status:'away'};const home=Housing.census(s).get('h0');assert.equal(home.members.length,8);assert.equal(home.present,7);assert.equal(home.penalty,3);
});
test('житель выбирает переезд, но откладывает его ради критического голода',()=>{
 const s=crowded(),p=s.person(1);s.minute=600;comfortable(p);Housing.review(s);assert.equal(p.housingWish.to,'h1');const plan=Brain.choose(s,p);assert.equal(plan.goal,'relocate');assert.equal(plan.steps[0].target,'h0');assert.equal(plan.steps[0].to,'h1');p.hunger=1;assert.notEqual(Brain.choose(s,p).goal,'relocate');
});
test('при отсутствии жилья сохраняется желание переехать без фиктивного переезда',()=>{
 const s=crowded();for(const home of s.buildings.filter(b=>b.type==='home'&&b.id!=='h0'))while(s.living.filter(p=>p.homeId===home.id).length<Housing.room(home))s.createPerson('Тест','Жилец','m',8,home.id);
 Housing.review(s);assert.equal(s.person(1).housingWish.to,null);assert.equal(s.housing.moves,0);assert.equal(s.person(1).homeId,'h0');
});
test('переезд сохраняет семью, товары и деньги; люди и вещи проходят по дорогам',()=>{
 const s=crowded(),p=s.person(1);Housing.review(s);const goods=s.goods,cash=s.living.reduce((n,p)=>n+p.coins,0)+s.treasury,group=Housing.family(s,p),positions=group.map(p=>[p.x,p.y]);
 assert.ok(Housing.relocate(s,p,'h1','h0').ok);assert.ok(group.every(p=>p.homeId==='h1'&&p.relocation&&p.path.length));assert.deepEqual(group.map(p=>[p.x,p.y]),positions);assert.deepEqual(s.goods,goods);assert.equal(s.living.reduce((n,p)=>n+p.coins,0)+s.treasury,cash);assert.equal(s.person(5).homeId,'h0');assert.equal(Housing.census(s).get('h0').penalty,0);
 for(let i=0;i<60;i++)for(const q of group)if(q.relocation)Housing.travelStep(s,q,5);
 assert.ok(group.every(p=>p.location==='h1'&&!p.relocation));assert.deepEqual(s.goods,goods);assert.equal(s.housing.moves,1);
});
test('занятый после планирования дом не принимает вторую семью сверх обещанного места',()=>{
 const s=crowded(),p=s.person(1);Housing.review(s);for(let n=0;n<4;n++)s.createPerson('Тест','Другие жильцы','m',8,'h1');const before=s.goods;
 assert.equal(Housing.relocate(s,p,'h1','h0').ok,false);assert.equal(p.homeId,'h0');assert.deepEqual(s.goods,before);assert.equal(s.housing.moves,0);
});
test('переезд в пути сохраняется и продолжается воспроизводимо',()=>{
 const s=crowded();Housing.review(s);Housing.relocate(s,s.person(1),'h1','h0');s.advance(5);const restored=Simulation.fromJSON(JSON.parse(JSON.stringify(s)));s.advance(360);restored.advance(360);assert.deepEqual(s.toJSON(),restored.toJSON());
});
test('переселенцы могут делить уже заполненный дом, создавая тесноту',()=>{
 const s=new Simulation();for(const home of s.buildings.filter(b=>b.type==='home'))while(s.living.filter(p=>p.homeId===home.id).length<Housing.room(home))s.createPerson('Тест','Жилец','m',0,home.id);
 for(const p of s.people.filter(p=>p.jobId==='farm'))p.jobId=null;
 assert.equal(s.living.length,86);const result=s.inviteFamily();assert.ok(result.ok,result.message);assert.equal(s.living.length,89);const home=Housing.census(s).get(s.people.at(-1).homeId);assert.ok(home.present>home.capacity);assert.ok(home.present<=Math.floor(home.capacity*5/3));assert.ok(home.penalty>0);
});
test('старые сохранения получают жилищный учёт без сброса жителей',()=>{
 const s=crowded(),data=JSON.parse(JSON.stringify(s));delete data.state.housing;const restored=Simulation.fromJSON(data);assert.equal(restored.living.length,s.living.length);assert.equal(restored.treasury,s.treasury);assert.equal(restored.housing.moves,0);assert.equal(Housing.census(restored).get('h0').penalty,6);
});

test('штраф резко растёт после полутора вместимостей, одинаково для разных классов жилья',()=>{
 for(const [people,penalty] of [[6,0],[8,6],[10,13],[12,24],[18,90],[22,100]])assert.equal(Housing.pressure(people,6).penalty,penalty);
 assert.equal(Housing.pressure(22,6).restFactor,.35);assert.equal(Housing.pressure(22,6).severity,'Критическая теснота');
 assert.equal(Housing.pressure(12,6).penalty,Housing.pressure(16,8).penalty);assert.equal(Housing.pressure(16,8).penalty,Housing.pressure(20,10).penalty);
 const s=new Simulation(),home=s.building('h0');home.development.level=3;assert.equal(Housing.pressure(12,Housing.room(home)).penalty,0);
});

test('перенаселение замедляет реальный отдых только в соответствующем доме',()=>{
 const a=new Simulation(),b=new Simulation();while(a.living.filter(p=>p.homeId==='h0').length<22)a.createPerson('Тест','Жилец','m',8,'h0');
 for(const s of [a,b])for(const id of [1,9]){const p=s.person(id);settle(s,p,p.homeId);p.energy=20;p.plan={goal:'rest',index:0,steps:[{kind:'rest',target:p.homeId,elapsed:0,duration:90}]};s.execute(p,5);}
 assert.ok(Math.abs((a.person(1).energy-20)/(b.person(1).energy-20)-.35)<1e-8);assert.equal(a.person(9).energy,b.person(9).energy);
});

function crisis(){
 const s=new Simulation();for(const q of s.people.filter(p=>p.homeId==='h1'))q.homeId='h0';
 for(let n=0;n<4;n++){const q=s.createPerson('Тест','Ребёнок','m',8,'h0');q.parents=[1,2];}
 for(const home of s.buildings.filter(b=>b.type==='home'&&b.id!=='h1'))while(s.living.filter(p=>p.homeId===home.id).length<(home.id==='h0'?22:Housing.room(home)))s.createPerson('Тест','Жилец','m',8,home.id);
 return s;
}

test('критическая теснота заставляет большую семью переехать даже после недавнего переезда и без поместья',()=>{
 const s=crisis(),p=s.person(1);comfortable(p);s.minute=600;p.lastRelocation=s.day;p.estate='noble';p.coins=800;p.mind.personality.ambition=1;
 Housing.review(s);assert.equal(p.housingWish.to,'h1');assert.match(p.housingWish.reason,/Критическая/);assert.equal(Housing.family(s,p).length,8);
 assert.equal(Brain.choose(s,p).goal,'relocate');for(const key of ['hunger','energy','health']){p[key]=1;assert.notEqual(Brain.choose(s,p).goal,'relocate',key);p[key]=100;}
 const goods=s.goods,money=s.people.reduce((n,p)=>n+p.coins,0),positions=Housing.family(s,p).map(q=>[q.x,q.y]);assert.ok(Housing.relocate(s,p,'h1','h0').ok);
 assert.equal(Housing.census(s).get('h1').present,8);assert.equal(Housing.census(s).get('h1').penalty,6);assert.deepEqual(Housing.family(s,p).map(q=>[q.x,q.y]),positions);assert.ok(p.path.length);assert.deepEqual(s.goods,goods);assert.equal(s.people.reduce((n,p)=>n+p.coins,0),money);
 for(let n=0;n<90;n++)for(const q of Housing.family(s,p))if(q.relocation)Housing.travelStep(s,q,5);assert.ok(Housing.family(s,p).every(q=>!q.relocation&&q.location==='h1'));assert.deepEqual(s.goods,goods);
});

test('экстренный переезд повторно проверяет тесноту и не переполняет уже занятый дом',()=>{
 const s=crisis(),p=s.person(1);Housing.review(s);assert.equal(p.housingWish.to,'h1');for(let n=0;n<3;n++)s.createPerson('Тест','Занял место','m',8,'h1');
 const goods=s.goods;assert.equal(Housing.relocate(s,p,'h1','h0').ok,false);assert.equal(p.homeId,'h0');assert.equal(s.housing.moves,0);assert.deepEqual(s.goods,goods);
});

test('новую семью не впускают сверх 10 мест из 6, места военнослужащих тоже заняты',()=>{
 const s=new Simulation();for(const home of s.buildings.filter(b=>b.type==='home'))while(s.living.filter(p=>p.homeId===home.id).length<Math.floor(Housing.room(home)*5/3))s.createPerson('Тест','Жилец','m',8,home.id);
 assert.equal(Housing.newcomerHome(s),undefined);for(const p of s.people.filter(p=>p.homeId==='h0'))p.absence={status:'away'};
 const before=JSON.stringify(s);const result=s.inviteFamily();assert.equal(result.ok,false);assert.match(result.message,/10 человек/);assert.equal(JSON.stringify(s),before);
 const occupants=s.living.filter(p=>p.homeId==='h0');for(const p of occupants.slice(-3))s.die(p,'умер от болезни');assert.equal(Housing.newcomerHome(s).id,'h0');
 s.createPerson('Тест','Занял место','m',8,'h0');assert.equal(Housing.newcomerHome(s),undefined);
});

test('сохранение с 22 жильцами не выселяет людей и воспроизводит новые последствия',()=>{
 const s=crisis(),data=JSON.parse(JSON.stringify(s));delete data.state.housing;const r=Simulation.fromJSON(data);assert.equal(Housing.census(r).get('h0').present,22);assert.equal(Housing.census(r).get('h0').penalty,100);assert.equal(r.living.length,s.living.length);assert.deepEqual(r.goods,s.goods);assert.equal(r.treasury,s.treasury);
 const replay=Simulation.fromJSON(JSON.parse(JSON.stringify(r)));r.advance(180);replay.advance(180);assert.deepEqual(r.toJSON(),replay.toJSON());
});
