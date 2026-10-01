const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Personality:P,Names,Brain,Civic,Labour,Government}=require('../sim.js');
const clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s)));
test('Личность: один спор вызывает принципиальную, корыстную или семейную реакцию',()=>{
 const s=new Simulation(),p=s.person(1),q=s.person(2),v=p.character.values;p.mind.personality.empathy=.3;p.mind.personality.caution=.2;p.mind.personality.ambition=.9;
 Object.assign(v,{honesty:.95,justice:.95,familyLoyalty:.1});assert.equal(P.conflict(s,p,q).kind,'principle');
 Object.assign(v,{honesty:.05,justice:.1,familyLoyalty:.1});assert.equal(P.conflict(s,p,q).kind,'bargain');
 Object.assign(v,{honesty:.5,justice:.4,familyLoyalty:.95});assert.equal(P.conflict(s,p,q).kind,'family');
 p.character.state.fear=100;p.character.state.stress=100;v.familyLoyalty=.1;assert.equal(P.conflict(s,p,q).kind,'withdraw');
});
test('Личность: честность меняет оценку нарушения, не подавляя срочную еду',()=>{
 const s=new Simulation(),p=s.person(2);p.character.values.honesty=.05;const low=P.bias(p,'civicOffence').score;p.character.values.honesty=.95;assert.ok(P.bias(p,'civicOffence').score<low-20);
 Object.assign(p,{hunger:5,energy:80,social:0,faith:0});p.character.state.grief=100;p.character.state.stress=100;s.minute=600;s.building(p.homeId).stock.bread=10;assert.equal(Brain.choose(s,p).goal,'eat');
});
test('Личность: смерть близкого вызывает горе, повтор не удваивает его, дни ослабляют',()=>{
 const s=new Simulation(),p=s.person(1),q=s.person(2),before={...q.character.values};s.die(p,'умер от болезни');assert.equal(q.character.state.grief,38);assert.equal(q.character.events[0].subject,p.id);
 P.bereave(s,p);assert.equal(q.character.state.grief,38);s.day+=10;P.daily(s);assert.ok(q.character.state.grief<25);assert.deepEqual(q.character.values,before);assert.deepEqual(clone(s).person(q.id).character,q.character);
});
test('Личность: переживания ограничены, биография ограничена, влияние на ценности постепенно',()=>{
 const s=new Simulation(),p=s.person(1),origin=p.character.values.familyLoyalty;
 for(let i=0;i<100;i++){s.day++;P.event(s,p,'betrayal',2,'Нарушенное обещание',1000);}
 assert.ok(p.character.values.familyLoyalty>=origin-.1200001);assert.ok(p.character.state.anger<=100);assert.equal(p.character.events.length,24);clone(s);
 const stable={...p.character.values};s.day+=30;P.daily(s);assert.deepEqual(p.character.values,stable);
});
test('Личность: прозвище заслуживается реальными повторными поступками',()=>{
 const s=new Simulation(),p=s.person(1);p.reputation=100;P.daily(s);assert.equal(p.character.nickname,null);
 for(let i=0;i<3;i++){s.day++;P.event(s,p,'aid',2,'Помог нуждающемуся',12);}
 assert.equal(p.character.nickname,'Щедрая рука');assert.equal(p.character.deeds.aid,3);assert.ok(p.character.events.some(e=>e.kind==='nickname'));assert.equal(clone(s).person(p.id).character.nickname,p.character.nickname);
});
test('Личность: дети наследуют склонности без копирования; миграция сохраняет имена и родство',()=>{
 const s=new Simulation(),a=s.person(1),b=s.person(2);a.character.values.honesty=.9;b.character.values.honesty=.8;
 const child=s.createPerson('Старое имя','Фогель','m',0,'h0');child.parents=[a.id,b.id];s.initializeMind(child);assert.ok(child.character.values.honesty>.5);assert.notDeepEqual(child.character.values,a.character.values);
 const raw=JSON.parse(JSON.stringify(s));for(const p of raw.state.people)delete p.character;const migrated=Simulation.fromJSON(raw);assert.equal(migrated.person(child.id).name,child.name);assert.deepEqual(migrated.person(child.id).parents,child.parents);assert.deepEqual(clone(migrated).person(child.id).character,migrated.person(child.id).character);
 const bad=JSON.parse(JSON.stringify(s));bad.state.people[0].character.state.fear=-1;assert.throws(()=>Simulation.fromJSON(bad),/биография/);
});
test('Имена: большой справочник, составные имена и семейная традиция воспроизводимы',()=>{
 assert.ok(new Set([...Names.first.m,...Names.first.f]).size>=160);assert.ok(new Set(Names.surnames).size>=120);
 const s=new Simulation(),copy=clone(s);const a=Array.from({length:100},()=>Names.name(s,'m')),b=Array.from({length:100},()=>Names.name(copy,'m'));assert.deepEqual(a,b);assert.ok(a.some(n=>n.includes('-')));
 const parent=s.person(3),grand=s.person(parent.parents[0]);s.random=()=>0;assert.equal(Names.name(s,'m',parent),grand.firstName);assert.ok(!s.people.some(p=>p.surname===Names.family(s)));
});
test('Биография: работа и победа на выборах дают уверенность; чужой долг не меняет семейную лояльность',()=>{
 const s=new Simulation(),p=s.person(2),b=s.building('smith');for(const q of s.workers(b.id))q.jobId=null;b.cash=100;p.skill=1;
 const before=p.character.state.confidence;assert.ok(Labour.hire(s,p,b).ok);assert.ok(p.character.state.confidence>before);assert.match(p.character.events[0].text,/Принят/);
 const loyalty=p.character.values.familyLoyalty;P.event(s,p,'betrayal',6,'Знакомый не вернул долг');assert.equal(p.character.values.familyLoyalty,loyalty);assert.ok(p.character.state.anger>0);
 const E=Government.Elections,e=E.open(s,'treasurer'),candidate=s.alive.find(q=>q.age>=25&&!E.seat(s,q));candidate.location='hall';assert.ok(E.nominate(s,candidate,e).ok);s.day+=2;E.tick(s);const mayor=s.person(s.mayorId);mayor.location='hall';assert.ok(E.cast(s,mayor,e).ok);E.tally(s,e);assert.ok(candidate.character.events.some(x=>x.text.includes('Избран')));
});
