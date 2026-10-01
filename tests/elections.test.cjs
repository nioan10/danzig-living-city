const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Government:G,Brain}=require('../sim.js'),E=G.Elections;
const clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s))),atHall=(s,p)=>Object.assign(p,{location:'hall',navNode:'b:hall',goal:'hall',x:s.building('hall').door.x,y:s.building('hall').door.y,path:[],plan:null});
function ballot(s,key='mayor',ids=[5,9]){const e=E.open(s,key);for(const id of ids){atHall(s,s.person(id));assert.ok(E.nominate(s,s.person(id),e).ok);}s.day+=2;s.minute=600;E.tick(s);assert.equal(e.stage,'ballot');return e;}
test('ратуши имеют 3/5/7 мест, бургомистра избирают 2/4/6 лиц; нижние роли избирает непосредственный верх',()=>{
 for(let level=1;level<=3;level++){const s=new Simulation();s.building('hall').development.level=level;G.appoint(s);assert.equal(E.keys(s).length,level*2+1);assert.equal(E.electors(s,'mayor').length,level*2);assert.deepEqual(E.electors(s,'judge'),[s.mayorId]);if(level>1)assert.deepEqual(E.electors(s,'captain'),[s.government.offices.judge.personId,s.government.offices.treasurer.personId]);assert.equal(new Set(E.keys(s).map(k=>E.holder(s,k).id)).size,level*2+1);}
});
test('живой выборщик голосует лично, повторный или посторонний голос не проходит; отношения меняют результат',()=>{
 const s=new Simulation(),e=ballot(s);s.person(5).reputation=100;s.person(9).reputation=0;
 for(const id of e.electors){const p=s.person(id);p.relationships[5]=-100;p.relationships[9]=100;assert.equal(E.cast(s,p,e).ok,false);atHall(s,p);assert.ok(E.cast(s,p,e).ok);assert.equal(E.cast(s,p,e).ok,false);}
 assert.equal(E.cast(s,s.person(13),e).ok,false);assert.ok(e.ballots.every(b=>b.candidateId===9&&b.reason.includes('Доверие')));E.tally(s,e);assert.equal(s.mayorId,9);assert.equal(e.winner,9);assert.equal(e.status,'elected');
});
test('равенство проходит второй тур и воспроизводимый жребий; отсутствие кворума сохраняет временную власть',()=>{
 const s=new Simulation(),e=ballot(s);for(let round=1;round<=3;round++){for(const [i,id]of e.electors.entries()){const p=s.person(id);p.relationships[5]=i?-100:100;p.relationships[9]=i?100:-100;atHall(s,p);E.cast(s,p,e);}if(round===3){const r=clone(s),other=r.government.electoral.active.find(q=>q.id===e.id);E.tally(s,e);E.tally(r,other);assert.deepEqual(r.toJSON(),s.toJSON());assert.match(e.reason,/жребий/);}else E.tally(s,e);}
 const t=new Simulation(),q=ballot(t),old=t.mayorId;E.tally(t,q);assert.equal(t.mayorId,old);assert.equal(q.status,'postponed');assert.ok(t.government.electoral.next.mayor>t.day);
});
test('переход вверх освобождает прежнюю должность, вакансия получает временного исполнителя и выборы',()=>{
 const s=new Simulation(),id=s.government.offices.treasurer.personId,e=ballot(s,'mayor',[id]);for(const voter of e.electors){const p=s.person(voter);atHall(s,p);E.cast(s,p,e);}E.tally(s,e);assert.equal(s.mayorId,id);G.appoint(s);assert.notEqual(s.government.offices.treasurer.personId,id);assert.ok(s.government.offices.treasurer.acting);assert.equal(new Set(E.keys(s).map(k=>E.holder(s,k).id)).size,3);
});
test('ИИ идёт голосовать по дороге и учитывает критический голод',()=>{
 const s=new Simulation(),e=ballot(s),p=s.person(e.electors[0]);s.minute=600;Object.assign(p,{hunger:100,energy:100,health:100,social:100,faith:100,sick:false});p.location=p.homeId;p.navNode='b:'+p.homeId;p.plan=null;
 const choice=Brain.choose(s,p);assert.equal(choice.goal,'civicVote');assert.equal(choice.steps[0].target,'hall');s.travel(p,'hall');assert.ok(p.path.length);p.hunger=1;assert.notEqual(Brain.choose(s,p).goal,'civicVote');
});
test('загрузка промежуточных выборов и старого магистрата не повторяет выплаты, поддельные голоса отвергаются',()=>{
 const s=new Simulation(),e=ballot(s),p=s.person(e.electors[0]);atHall(s,p);E.cast(s,p,e);const r=clone(s);assert.deepEqual(r.toJSON(),s.toJSON());s.advance(120);r.advance(120);assert.deepEqual(r.toJSON(),s.toJSON());
 const raw=JSON.parse(JSON.stringify(s));delete raw.state.government.electoral;const t=Simulation.fromJSON(raw);assert.equal(t.treasury,s.treasury);assert.equal(t.living.length,s.living.length);
 const broken=JSON.parse(JSON.stringify(s));broken.state.government.electoral.active[0].ballots.push({...e.ballots[0]});assert.throws(()=>Simulation.fromJSON(broken),/бюллетени/);
});
