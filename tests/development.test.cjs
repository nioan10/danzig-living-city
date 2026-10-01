const BuildFixture=require('./helpers/construction.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Development:D,Government:G,Housing,Finance,Brain}=require('../sim.js');
const clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s)));
const wealth=s=>s.treasury+s.people.reduce((n,p)=>n+p.coins,0)+s.buildings.reduce((n,b)=>n+b.cash+(b.construction?.capital||0),0)+s.guilds.groups.reduce((n,g)=>n+g.cash,0);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function population(s,n){while(s.alive.length<n){const p=s.createPerson('Горожанин','Испытательных '+s.nextId,'m',30,'h0');s.initializeMind(p);}}
function mature(s){s.day=12;for(const b of s.buildings)Object.assign(b.development.progression,{levelSince:0,observedDay:s.day,lastCash:b.cash,samples:Array.from({length:12},(_,i)=>({day:i+1,net:10}))});}
function hall(){const s=new Simulation();population(s,64);s.treasury=5000;s.minute=600;mature(s);D.review(s);return {s,b:s.building('hall'),p:s.person(s.mayorId)};}
function home(){const s=new Simulation(),b=s.building('h0');mature(s);for(const p of s.people.slice(0,7))p.homeId=b.id;D.review(s);const p=D.owner(s,b);p.coins=5000;return{s,b,p};}
function complete(s,b){BuildFixture.complete(s,b);}

test('новые и старые города получают первые уровни без бесплатной прокачки и расходов',()=>{
 const s=new Simulation(),raw=JSON.parse(JSON.stringify(s));delete raw.state.development;delete raw.state.government;for(const b of raw.state.buildings)delete b.development;
 const r=Simulation.fromJSON(raw);assert.ok(r.development.auto);assert.equal(Object.keys(r.government.offices).length,0);assert.ok(r.buildings.every(b=>b.development.level===1&&!b.development.project));close(wealth(r),wealth(s));assert.deepEqual(clone(r).toJSON(),r.toJSON());
});
test('ратуша требует население и свободные деньги сверх городского резерва',()=>{
 const s=new Simulation(),b=s.building('hall'),p=s.person(s.mayorId);s.treasury=1000;assert.equal(D.start(s,p,b.id,'level').ok,false);population(s,64);s.treasury=320;assert.equal(D.start(s,p,b.id,'level').ok,false);assert.equal(b.development.level,1);assert.equal(s.treasury,320);
});
test('бургомистр сам выбирает развитие ратуши и оформляет его обычными тиками',()=>{
 const {s,b,p}=hall();Object.assign(p,{hunger:100,energy:100,social:100,faith:100,health:100,sick:false});s.building(p.homeId).stock.fish=12;assert.equal(p.developmentWish.buildingId,'hall');assert.equal(Brain.choose(s,p).goal,'develop');s.advance(400);assert.ok(b.development.project);assert.equal(b.development.level,1);assert.equal(s.accounts.days[0].expenses.development,1600);
});
test('подряд списывается один раз, оплаченные работы завершаются и открывают должности',()=>{
 const {s,b,p}=hall(),before=wealth(s);assert.ok(D.start(s,p,b.id,'level').ok);close(wealth(s),before-1600);assert.equal(D.start(s,p,b.id,'level').ok,false);assert.equal(b.development.level,1);assert.equal(Object.keys(s.government.offices).length,2);s.setDevelopmentAuto(false);complete(s,b);assert.equal(b.development.level,2);G.daily(s);assert.deepEqual(Object.keys(s.government.offices),['treasurer','judge','seneschal','captain']);assert.equal(new Set(Object.values(s.government.offices).map(o=>o.personId)).size,4);assert.ok(Object.values(s.government.offices).every(o=>o.personId!==s.mayorId));assert.equal(s.development.completed,1);D.tick(s);assert.equal(s.development.completed,1);
});
test('дом повышает вместимость только после завершения и снимает тесноту',()=>{
 const {s,b,p}=home(),before=wealth(s);assert.ok(Housing.census(s).get(b.id).penalty>0);assert.ok(D.start(s,p,b.id,'level').ok);assert.equal(Housing.room(b),6);close(wealth(s),before-600);assert.ok(p.coins>=60);complete(s,b);assert.equal(Housing.room(b),9);assert.equal(Housing.census(s).get(b.id).penalty,0);
});
test('мастерская не расширяется без спроса, свободного резерва и права владельца',()=>{
 const s=new Simulation(),b=s.building('bakery'),p=s.person(b.ownerId);b.cash=5000;mature(s);b.stock.bread=500;b.enterprise.stockLimit=100;assert.equal(D.start(s,p,b.id,'level').ok,false);b.stock.bread=0;b.cash=170;assert.equal(D.start(s,p,b.id,'extra1').ok,false);b.cash=5000;mature(s);assert.equal(D.start(s,s.people.find(q=>q.id!==p.id),b.id,'extra1').ok,false);assert.ok(D.start(s,p,b.id,'extra1').ok);complete(s,b);assert.equal(D.workFactor(b),1.12);assert.equal(D.start(s,p,b.id,'extra1').ok,false);
});
test('развитие мастерской добавляет вакансии, а третий уровень уменьшает реальные входные нормы',()=>{
 const s=new Simulation(),b=s.building('bakery'),p=s.person(b.ownerId);b.stock.bread=0;b.cash=5000;mature(s);const slots=s.jobSlots(b);assert.ok(D.start(s,p,b.id,'level').ok);complete(s,b);assert.equal(s.jobSlots(b),slots+1);b.development.level=3;b.development.extras=[3];const r=s.productionRecipe(b);close(r.inputs.flour,1.8);b.stock.flour=1.8;b.stock.wood=.27;assert.ok(s.canProduce(b));b.stock.flour=1.79;assert.equal(s.canProduce(b),false);
});
test('старшие уровни и улучшения нельзя открыть раньше времени; блокада останавливает новые подряды',()=>{
 const {s,b,p}=home();assert.equal(D.start(s,p,b.id,'extra2').ok,false);b.development.level=2;for(const q of s.people.slice(0,10))q.homeId=b.id;assert.equal(D.start(s,p,b.id,'level').ok,false);s.triggerCrisis('blockade');assert.equal(D.start(s,p,b.id,'extra1').ok,false);
});
test('наследник принимает решение после смерти владельца; оплаченная работа не пропадает',()=>{
 const {s,b,p}=home();assert.ok(D.start(s,p,b.id,'level').ok);s.die(p,'скончался от старости');D.review(s);assert.ok(D.owner(s,b)?.alive);assert.notEqual(D.owner(s,b).id,p.id);complete(s,b);assert.equal(b.development.level,2);
});
test('сохранение подрядов, целей и должностей детерминировано',()=>{
 const {s,b,p}=hall();assert.ok(D.start(s,p,b.id,'level').ok);const r=clone(s);assert.deepEqual(r.toJSON(),s.toJSON());complete(s,b);complete(r,r.building('hall'));G.daily(s);G.daily(r);assert.deepEqual(r.toJSON(),s.toJSON());assert.deepEqual(clone(s).toJSON(),s.toJSON());
});
test('выбывший чиновник заменяется живым жителем без дублирования должностей',()=>{
 const {s,b}=hall();b.development.level=3;G.daily(s);const id=s.government.offices.seneschal.personId;s.person(id).absence={status:'away'};s.day++;G.daily(s);assert.notEqual(s.government.offices.seneschal.personId,id);assert.equal(new Set(Object.values(s.government.offices).map(o=>o.personId)).size,6);
});
test('казначей принимает и подписывает налоговый указ, капитан меняет реальную стоимость дозора',()=>{
 const {s,b}=hall();b.development.level=2;G.daily(s);s.treasury=0;s.day+=4;G.daily(s);const treasurer=G.officer(s,'treasurer');Finance.daily(s);assert.equal(s.fiscal.history[0].author,treasurer.name);assert.equal(s.government.guard,.75);close(Finance.upkeep(s).watch,(2+s.living.length*.02)*.75);
});
test('служебные выплаты являются переводами, а ручные решения не перезаписываются чиновниками',()=>{
 const {s,b}=hall();b.development.level=3;const before=wealth(s);G.daily(s);close(wealth(s),before);assert.ok(s.government.stipends>0);s.setGuildPolicy({auto:true,profitRate:0,permitRate:0,permitMode:'auto'});s.setOutsidePolicy({quota:22,privateExport:true,importEnabled:true});s.day+=4;G.daily(s);assert.equal(s.guilds.profitRate,0);assert.equal(s.guilds.permitRate,0);assert.equal(s.commerce.outside.quota,22);
});
test('уровень ратуши не отменяет ручной режим разрешений, завершённый город не развивается',()=>{
 const {s,b,p}=hall();s.setGuildPolicy({auto:true,profitRate:8,permitRate:5,permitMode:'manual'});b.development.level=2;G.daily(s);assert.equal(s.guilds.permitMode,'manual');s.finish();const before=JSON.stringify(s);assert.equal(s.reviewDevelopment().ok,false);assert.equal(s.setDevelopmentAuto(false).ok,false);assert.equal(s.setOfficeAutonomy('captain',false).ok,false);assert.equal(D.start(s,p,b.id,'level').ok,false);assert.equal(JSON.stringify(s),before);
});
test('явно изменённый продовольственный резерв не перезаписывается портовым старшиной',()=>{
 const {s,b}=hall();b.development.level=3;G.daily(s);assert.ok(s.setCommerce({levyEnabled:true,levyRate:15,autoExport:true,reserveDays:5}).ok);s.day+=4;G.daily(s);assert.equal(s.commerce.reserveDays,5);assert.ok(s.government.manual.port);s.setOfficeAutonomy('port',true);s.day+=4;G.daily(s);assert.ok([2,3].includes(s.commerce.reserveDays));
});
test('некорректные уровни, дубли дополнений и поддельные подряды не загружаются',()=>{
 const s=new Simulation();for(const value of [0,4,1.5]){const raw=JSON.parse(JSON.stringify(s));raw.state.buildings[0].development.level=value;assert.throws(()=>Simulation.fromJSON(raw));}const raw=JSON.parse(JSON.stringify(s));raw.state.buildings[0].development.extras=[1,1];assert.throws(()=>Simulation.fromJSON(raw));
 const {s:r,b,p}=hall();D.start(r,p,b.id,'level');const broken=JSON.parse(JSON.stringify(r));broken.state.buildings.find(b=>b.id==='hall').development.project.level=9;assert.throws(()=>Simulation.fromJSON(broken));
});
