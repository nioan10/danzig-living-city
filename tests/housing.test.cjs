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
 const s=crowded();for(const home of s.buildings.filter(b=>b.type==='home'&&b.id!=='h0'))while(s.living.filter(p=>p.homeId===home.id).length<6)s.createPerson('Тест','Жилец','m',8,home.id);
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
 const s=new Simulation();for(const home of s.buildings.filter(b=>b.type==='home'))while(s.living.filter(p=>p.homeId===home.id).length<6)s.createPerson('Тест','Жилец','m',0,home.id);
 for(const p of s.people.filter(p=>p.jobId==='farm'))p.jobId=null;
 assert.equal(s.living.length,72);const result=s.inviteFamily();assert.ok(result.ok,result.message);assert.equal(s.living.length,75);assert.equal(Housing.census(s).get('h0').present,9);assert.equal(Housing.census(s).get('h0').penalty,9);
});
test('старые сохранения получают жилищный учёт без сброса жителей',()=>{
 const s=crowded(),data=JSON.parse(JSON.stringify(s));delete data.state.housing;const restored=Simulation.fromJSON(data);assert.equal(restored.living.length,s.living.length);assert.equal(restored.treasury,s.treasury);assert.equal(restored.housing.moves,0);assert.equal(Housing.census(restored).get('h0').penalty,6);
});
