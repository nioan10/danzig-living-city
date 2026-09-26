const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Brain,Mind,Labour,Planner,Learning}=require('../sim.js');
const clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s)));
const settle=(s,p,id)=>Object.assign(p,{location:id,goal:id,navNode:'b:'+id,x:s.building(id).door.x,y:s.building(id).door.y,path:[],plan:null});
const comfortable=p=>Object.assign(p,{hunger:100,energy:100,social:100,faith:100,health:100,sick:false});
const money=s=>s.treasury+s.people.reduce((n,p)=>n+p.coins,0)+s.buildings.reduce((n,b)=>n+b.cash,0);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('ИИ 2.0: наследуемая индивидуальность стабильна и не копирует родителей',()=>{
 const s=new Simulation(),a=s.person(1),b=s.person(2);a.mind.personality.caution=.9;b.mind.personality.caution=.8;
 const child=s.createPerson('Новый','Фогель','m',0,'h0');child.parents=[a.id,b.id];s.initializeMind(child);
 assert.deepEqual(child.mind.inheritedFrom,[a.id,b.id]);assert.ok(child.mind.personality.caution>.45);assert.notDeepEqual(child.mind.personality,a.mind.personality);
 assert.deepEqual(clone(s).person(child.id).mind,child.mind);
});
test('ИИ 2.0: при одинаковых нуждах характер меняет выбор',()=>{
 const s=new Simulation(),p=s.person(2);s.minute=600;comfortable(p);p.traits=[];p.social=40;p.coins=60;
 p.mind.personality.diligence=.1;p.mind.personality.sociability=.95;p.mind.personality.curiosity=.1;
 const outgoing=Brain.choose(s,p);p.mind.personality.sociability=.05;p.mind.personality.diligence=.95;
 const worker=Brain.choose(s,p);assert.equal(outgoing.goal,'social');assert.equal(worker.goal,'work');
});
test('ИИ 2.0: ежедневная сверка не назначает работу без ведома человека',()=>{
 const s=new Simulation(),p=s.person(2);p.jobId=null;s.assignJobs();assert.equal(p.jobId,null);assert.equal(p.role,'Ищет ремесло');
 assert.equal(Labour.offers(s,p).length,0);comfortable(p);s.minute=600;
 assert.equal(Brain.choose(s,p).goal,'jobSearch');
 settle(s,p,'market');p.plan={goal:'jobSearch',index:0,steps:[{kind:'seekWork',target:'market',duration:30,elapsed:0}]};s.execute(p,30);
 assert.ok(Labour.offers(s,p).length);assert.equal(p.jobId,null);
 const next=Brain.choose(s,p);assert.equal(next.goal,'career');settle(s,p,next.steps[0].target);p.plan=next;s.execute(p,30);assert.ok(p.jobId);assert.equal(p.career.applications,1);
});
test('ИИ 2.0: несостоятельный работодатель отказывает, прежняя работа остаётся',()=>{
 const s=new Simulation(),p=s.person(2),b=s.building('smith');for(const q of s.workers(b.id))q.jobId=null;b.cash=0;
 const previous=p.jobId,coins=money(s);assert.equal(Labour.hire(s,p,b).ok,false);assert.equal(p.jobId,previous);close(money(s),coins);
});
test('ИИ 2.0: собеседования не переполняют штат',()=>{
 const s=new Simulation(),b=s.building('smith'),p=s.person(2),q=s.person(5);for(const x of s.workers(b.id))x.jobId=null;b.cash=100;
 assert.ok(Labour.hire(s,p,b).ok);assert.equal(Labour.hire(s,q,b).ok,false);assert.equal(s.workers(b.id).length,1);
});
test('ИИ 2.0: ученичество оплачивается реальными деньгами и завершается практикой',()=>{
 const s=new Simulation(),p=s.person(2),b=s.building('smith');for(const q of s.workers(b.id))q.jobId=null;b.cash=100;p.skill=1;p.tradeExperience={};
 assert.ok(Labour.hire(s,p,b).apprentice);close(Labour.rate(s,p,b),b.wage*.7);
 settle(s,p,b.id);p.plan={goal:'work',index:0,steps:[{kind:'work',target:b.id,duration:600,elapsed:0}]};const before=money(s),cash=b.cash;
 s.execute(p,60);close(money(s),before);close(cash-b.cash,b.wage*.7);assert.equal(p.career.training,60);
 Labour.worked(s,p,b,420);assert.equal(p.career.apprentice,false);close(Labour.rate(s,p,b),b.wage);
});
test('ИИ 2.0: память о невыплате относится к конкретному работодателю',()=>{
 const s=new Simulation(),p=s.person(2);const before=Mind.context(s,p,'mill','employment');
 p.plan={goal:'work',title:'Работа',index:0,steps:[{kind:'work',target:'bakery'}],baseline:Learning.baseline(p)};s.fail(p,'unpaid','bakery','Не выплатили зарплату');
 assert.ok(Mind.context(s,p,'bakery','employment')<-8);assert.equal(Mind.context(s,p,'mill','employment'),before);assert.ok(Learning.bias(s,p,'work')>-1);
 const cautious=p.mind.personality.caution;s.day+=7;assert.ok(Mind.context(s,p,'bakery','employment')>-4);assert.ok(cautious>0);
});
test('ИИ 2.0: слухи слабее личного опыта и не превращаются в свежие факты',()=>{
 const s=new Simulation(),p=s.person(2),q=s.person(5);Mind.record(s,q,'smith','employment',false,'Не платят');Mind.gossip(s,p,q);
 assert.ok(Math.abs(Mind.context(s,p,'smith','employment'))<Math.abs(Mind.context(s,q,'smith','employment')));
 const at=p.mind.contexts[0].at;s.minute+=60;Mind.gossip(s,p,q);assert.equal(p.mind.contexts[0].at,at);
 Mind.record(s,p,'smith','employment',true,'Получил деньги');Mind.gossip(s,p,q);assert.equal(p.mind.contexts[0].source,'personal');
});
test('ИИ 2.0: объявления устаревают и не сообщают о невидимых новых местах',()=>{
 const s=new Simulation(),p=s.person(2);p.jobId=null;assert.equal(Labour.offers(s,p).length,0);Labour.search(s,p);assert.ok(Labour.offers(s,p).length);
 s.day+=4;assert.equal(Labour.offers(s,p).length,0);assert.ok(Brain.options(s,p).some(x=>x.goal==='jobSearch'));
});
test('ИИ 2.0: семья не дублирует доставку, поручение освобождается при срыве',()=>{
 const s=new Simulation(),p=s.person(1),q=s.person(2);comfortable(q);s.minute=600;s.building(q.homeId).stock.bread=s.building(q.homeId).stock.fish=0;
 const before=Brain.options(s,q).find(x=>x.goal==='provision').score;
 p.plan={goal:'provision',steps:[{kind:'storeFood',target:p.homeId}],estimatedMinutes:60};Mind.claim(s,p,p.plan);
 const after=Brain.options(s,q).find(x=>x.goal==='provision').score;assert.ok(after<before-40);assert.ok(Mind.activeClaim(s,q,'provision'));
 s.die(p,'умер от болезни');assert.equal(Mind.activeClaim(s,q,'provision'),false);
});
test('ИИ 2.0: срочная еда не ждёт чужой семейной закупки',()=>{
 const s=new Simulation(),p=s.person(1),q=s.person(2);s.minute=600;comfortable(q);q.hunger=10;s.building(q.homeId).stock.bread=s.building(q.homeId).stock.fish=0;
 p.plan={goal:'provision',steps:[{kind:'storeFood',target:p.homeId}]};Mind.claim(s,p,p.plan);
 const choices=Brain.options(s,q).filter(x=>x.goal==='eat');assert.ok(choices.length);assert.ok(choices.every(x=>x.steps.find(z=>z.kind==='buyFood')?.amount===1));
});
test('ИИ 2.0: поиск строит выполнимую цепочку найм → заработок → покупка → еда',()=>{
 const s=new Simulation(),p=s.person(2);s.minute=600;s.people=[p];p.jobId=null;p.coins=0;comfortable(p);p.hunger=20;settle(s,p,'market');
 s.building(p.homeId).stock.bread=s.building(p.homeId).stock.fish=0;Labour.search(s,p);
 const result=Planner.foodPlan(s,p);assert.deepEqual(result.steps.map(x=>x.kind),['hire','work','buyFood','eatBag']);assert.ok(result.expanded<=Planner.LIMIT);
 p.plan={goal:'earnFood',title:'На еду',steps:result.steps,index:0};
 for(let i=0;i<600&&p.hunger<50;i+=5)s.advance(5);
 assert.ok(p.jobId);assert.ok(p.hunger>50);assert.ok(p.coins>=0);
});
test('ИИ 2.0: невозможный план не превышает лимит поиска',()=>{
 const s=new Simulation(),p=s.person(2);p.coins=0;p.jobId=null;s.building(p.homeId).stock.bread=s.building(p.homeId).stock.fish=0;
 for(const b of s.buildings)b.cash=0;Labour.search(s,p);const plan=Planner.foodPlan(s,p);assert.equal(plan.steps.length,0);assert.ok(plan.expanded<=Planner.LIMIT);
});
test('ИИ 2.0: утрата работы пересматривает план, приобретённый груз сохраняется',()=>{
 const s=new Simulation(),p=s.person(2);p.plan={goal:'work',index:0,steps:[{kind:'work',target:p.jobId}],createdAt:s.now};p.jobId=null;p.cargo={good:'flour',amount:3,to:'bakery'};
 assert.ok(Brain.shouldReplan(s,p));assert.match(p.mind.lastReplan,/работы/);assert.equal(p.cargo.amount,3);
});
test('ИИ 2.0: загрузка старого города не меняет деньги, работу и генератор случайности',()=>{
 const s=new Simulation(),data=JSON.parse(JSON.stringify(s));for(const p of data.state.people){delete p.mind;delete p.career;}
 const restored=Simulation.fromJSON(data);assert.equal(restored.seed,s.seed);close(money(restored),money(s));assert.deepEqual(restored.people.map(p=>p.jobId),s.people.map(p=>p.jobId));assert.ok(restored.people.every(p=>p.mind.version===2));
});
test('ИИ 2.0: память и поиск переживают сохранение с детерминированным продолжением',()=>{
 const s=new Simulation();s.person(2).jobId=null;s.advance(300);const restored=clone(s);assert.deepEqual(restored.toJSON(),s.toJSON());s.advance(500);restored.advance(500);assert.deepEqual(restored.toJSON(),s.toJSON());
});
test('ИИ 2.0: повреждённая личность и нечисловые сведения о работе отклоняются',()=>{
 const data=JSON.parse(JSON.stringify(new Simulation()));data.state.people[0].mind.personality.caution='bad';assert.throws(()=>Simulation.fromJSON(data),/память/);
 const bad=JSON.parse(JSON.stringify(new Simulation()));bad.state.people[1].career.known[0].wage=-1;assert.throws(()=>Simulation.fromJSON(bad),/трудовая/);
});
test('ИИ 2.0: работник сначала восстанавливает повреждённый двор',()=>{
 const s=new Simulation(),p=s.person(2),b=s.building(p.jobId);s.minute=600;comfortable(p);p.coins=80;b.damaged=true;Labour.search(s,p);
 const plan=Brain.choose(s,p);assert.equal(plan.goal,'repair');assert.equal(plan.steps[0].target,b.id);
 settle(s,p,b.id);p.plan=plan;s.execute(p,200);assert.equal(b.damaged,false);assert.equal(p.jobId,b.id);
});
test('ИИ 2.0: безработный может вернуть закрытую мастерскую и пройти реальный найм',()=>{
 const s=new Simulation(),p=s.person(2);s.people=[p];p.jobId=null;p.coins=80;s.minute=600;comfortable(p);const b=s.building('bakery');b.damaged=true;b.cash=100;
 p.career.known=[];Labour.observe(s,p,b);p.career.searchAt=s.now;
 const choices=Brain.options(s,p),plan=choices.find(x=>x.steps[0].kind==='repair'&&x.steps[1]?.kind==='hire');assert.ok(plan);
 settle(s,p,b.id);p.plan={...plan,index:0};s.execute(p,200);assert.equal(p.jobId,null);assert.equal(b.damaged,false);s.execute(p,30);assert.equal(p.jobId,b.id);
});
test('[long] ИИ 2.0: после остановки ремёсел горожане восстанавливают занятость',()=>{
 const s=new Simulation();const production=s.buildings.filter(b=>s.productionRecipe(b));
 for(const b of production)b.damaged=true;
 for(const p of s.alive.filter(p=>Labour.eligible(s,p))){p.jobId=null;p.plan=null;}
 s.assignJobs();assert.ok(s.alive.filter(p=>Labour.eligible(s,p)).every(p=>!p.jobId));
 for(let day=0;day<18;day++)s.nextMorning();
 const workers=s.alive.filter(p=>Labour.eligible(s,p)&&p.jobId),restored=production.filter(b=>!b.damaged);
 assert.ok(workers.length>=14,`Трудоустроились ${workers.length}`);assert.ok(restored.length>=10,`Восстановлено ${restored.length}`);
 assert.equal(s.people.filter(p=>p.deathCause==='hunger').length,0);assert.ok(s.people.reduce((n,p)=>n+(p.career?.applications||0),0)>workers.length);
});
