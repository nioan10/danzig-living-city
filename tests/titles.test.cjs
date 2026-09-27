const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Titles:T,World:W,Finance,Brain,Learning,Households:H,Expansion}=require('../sim.js');
const clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s))),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),wealth=s=>s.treasury+s.people.reduce((n,p)=>n+p.coins,0)+s.buildings.reduce((n,b)=>n+b.cash,0);
function applicant(){const s=new Simulation(),p=s.person(2);Object.assign(p,{coins:1000,reputation:90,hunger:95,health:100,energy:95,social:95,faith:95});for(const q of H.family(s,p))q.hunger=q.health=95;return {s,p};}
function atHall(s,p){const b=s.building('hall');Object.assign(p,{location:'hall',goal:'hall',navNode:'b:hall',x:b.door.x,y:b.door.y,path:[]});}
test('титул оплачивается один раз личными деньгами и меняет сословие',()=>{
 const {s,p}=applicant();atHall(s,p);const total=wealth(s),cash=s.treasury,coins=p.coins;assert.ok(T.grant(s,p,1).ok);close(wealth(s),total);close(s.treasury-cash,150);close(coins-p.coins,150);assert.equal(p.estate,'burgher');assert.equal(p.title.rank,1);assert.equal(s.titles.granted,1);assert.equal(s.households.days.at(-1).spending.titleFee,150);assert.equal(s.accounts.days.at(-1).income.titleFees,150);const r=clone(s);assert.equal(T.grant(r,r.person(p.id),1).ok,false);close(r.treasury,s.treasury);assert.deepEqual(r.titles,s.titles);
});
test('возраст, репутация, ратуша и запас семьи ограничивают пожалование',()=>{
 const {s,p}=applicant();p.age=17;assert.equal(T.assess(s,p).ok,false);p.age=30;p.reputation=34;assert.equal(T.assess(s,p).ok,false);p.reputation=90;p.coins=209;assert.equal(T.assess(s,p).ok,false);p.coins=1000;s.person(p.spouseId).hunger=20;assert.equal(T.assess(s,p).ok,false);s.person(p.spouseId).hunger=95;atHall(s,p);assert.ok(T.grant(s,p,1).ok);assert.equal(T.assess(s,p,2).ok,false);s.day+=13;assert.match(T.assess(s,p,2).message,/уровня 2/);s.building('hall').development.level=2;assert.ok(T.assess(s,p,2).ok);const cash=p.coins;assert.ok(T.grant(s,p,2).ok);close(cash-p.coins,600);
});
test('деньги без визита в ратушу не дают титул, смена взноса проверяется при оплате',()=>{
 const {s,p}=applicant(),before=wealth(s);assert.equal(T.grant(s,p,1).ok,false);const policy={fee1:400,fee2:600,fee3:2400,fee4:7200,auto:true};assert.ok(s.setTitlePolicy(policy).ok);p.coins=300;atHall(s,p);const snapshot=JSON.stringify(s.toJSON());assert.equal(T.grant(s,p,1).ok,false);assert.equal(JSON.stringify(s.toJSON()),snapshot);p.coins=1000;const cash=s.treasury;assert.ok(T.grant(s,p,1).ok);close(s.treasury-cash,400);close(wealth(s),before);
});
test('настройка взносов атомарна, ручное отключение самостоятельных прошений сохраняется',()=>{
 const {s,p}=applicant(),original=JSON.stringify(s.titles);for(const fee1 of [0,-1,1.5,NaN,100001]){assert.equal(s.setTitlePolicy({fee1,fee2:600,fee3:2400,fee4:7200,auto:true}).ok,false);assert.equal(JSON.stringify(s.titles),original);}assert.equal(s.setTitlePolicy({fee1:700,fee2:600,fee3:2400,fee4:7200,auto:true}).ok,false);
 assert.ok(s.setTitlePolicy({fee1:200,fee2:800,fee3:3000,fee4:9000,auto:false}).ok);s.minute=600;assert.equal(Brain.options(s,p).some(x=>x.goal==='title'),false);assert.deepEqual(clone(s).titles,s.titles);
});
test('богатый амбициозный житель сам планирует поход за титулом, результат учитывается обучением',()=>{
 const {s,p}=applicant();s.minute=600;p.traits=['Амбициозный'];Object.assign(p.mind.personality,{ambition:1,thrift:0});const option=Brain.options(s,p).find(q=>q.goal==='title');assert.ok(option);assert.equal(option.steps[0].target,'hall');p.plan={...option,index:0,baseline:Learning.baseline(p)};s.travel(p,'hall');assert.ok(p.path.length);const saved=clone(s);assert.deepEqual(saved.person(p.id).plan,p.plan);atHall(s,p);const before=p.coins;s.execute(p,45);assert.equal(p.title.rank,1);close(before-p.coins,150);assert.ok(p.learning.history.some(r=>r.goal==='title'&&r.success&&r.reward>0));
});
test('наследуется сословие, но не личное пожалование; взрослый наследник оплачивает свою ступень',()=>{
 const {s,p}=applicant();p.estate='noble';p.title={rank:4,source:'existing',day:null,paid:0,nextAt:0};const c=s.createPerson('Наследник','Семьи','m',0,p.homeId);c.parents=[p.id];T.inherit(s,c);assert.equal(c.estate,'noble');assert.equal(c.title.rank,0);assert.equal(T.next(c),3);assert.equal(T.assess(s,c).ok,false);Object.assign(c,{age:18,coins:3000,reputation:75,health:95,hunger:95});s.building('hall').development.level=2;atHall(s,c);assert.ok(T.grant(s,c,3).ok);assert.equal(c.title.paid,2400);assert.equal(c.title.rank,3);
});
test('старые сословия признаются без выдуманного дохода и задних списаний',()=>{
 const s=new Simulation();s.day=700;const data=JSON.parse(JSON.stringify(s));delete data.state.titles;for(const p of data.state.people)delete p.title;const r=Simulation.fromJSON(data);close(wealth(r),wealth(s));assert.equal(r.titles.sinceDay,700);assert.equal(r.titles.revenue,0);assert.ok(r.people.filter(p=>p.estate==='noble').every(p=>p.title.rank===3&&p.title.source==='existing'));assert.deepEqual(clone(r).toJSON(),r.toJSON());
});
test('разовый взнос не раздувает прогноз повседневных доходов',()=>{
 const {s,p}=applicant();s.day=6;s.accounts.days=Array.from({length:6},(_,day)=>({day,income:{sales:60},expenses:{}}));const before=Finance.budget(s);s.accounts.days[3].income.titleFees=7200;const after=Finance.budget(s);close(after.net,before.net);close(after.sustainableNet,before.sustainableNet);const plan=Finance.prepareBudget(s);assert.ok(plan.income<100);
});
test('повреждённые титулы, ставки и прошения отклоняются при загрузке',()=>{
 for(const mutate of [s=>s.titles.fees[0]=-1,s=>s.people[0].title.rank=5,s=>s.titles.history.push({day:0,at:0,personId:2,rank:9,fee:150}),s=>s.people[0].plan={goal:'title',index:0,steps:[{kind:'title',titleRank:9,target:'hall',elapsed:0,duration:45}]}]){const s=new Simulation();mutate(s);assert.throws(()=>clone(s),/титул|прошение/);}
});
test('добавлены 13 внутренних участков: дворы не перекрываются и связаны с улицами',()=>{
 assert.equal(W.expansionLots.length,66);const added=W.expansionLots.filter(l=>l.infill);assert.equal(added.length,13);assert.equal(W.expansionLots.filter(l=>W.insideTown(l.x,l.y)).length,27);for(const l of added){assert.ok(W.insideTown(l.x,l.y));assert.ok(W.route('b:hall','b:'+l.id).length);assert.ok(l.types.every(t=>!['farm','pasture','wood','clay'].includes(t)));}
 const parcels=W.routeBuildings();for(let i=0;i<parcels.length;i++)for(const b of parcels.slice(i+1)){const a=parcels[i];assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2||Math.abs(a.y-b.y)>=(a.h+b.h)/2,a.id+' overlaps '+b.id);}
});
test('новый внутренний двор строится и сохраняется как обычный участок',()=>{
 const s=new Simulation();s.treasury=1000;assert.ok(Expansion.build(s,'new25','home').ok);assert.equal(s.building('new25').district,'noble');assert.deepEqual(clone(s).building('new25'),s.building('new25'));
});
test('при добавлении перекрёстков человек на неизменённой улице сохраняет позицию и груз',()=>{
 const s=new Simulation(),p=s.person(2),a=W.nodes.west,b=W.nodes.bend;Object.assign(p,{location:null,goal:'bakery',navNode:'west',x:(a.x+b.x)/2,y:(a.y+b.y)/2,path:[{id:'bend',x:b.x,y:b.y},...W.route('bend','b:bakery')],motionSegments:[]});p.bag.wood=2;const raw=JSON.parse(JSON.stringify(s));raw.state.layoutVersion=2;const r=Simulation.fromJSON(raw),q=r.person(p.id);close(q.x,p.x);close(q.y,p.y);assert.equal(q.bag.wood,2);assert.equal(q.path.at(-1).id,'b:bakery');assert.deepEqual(clone(r).toJSON(),r.toJSON());
});
