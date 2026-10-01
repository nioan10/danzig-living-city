const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Civic:C,Brain,Finance,Households:H}=require('../sim.js');
const clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s))),total=s=>s.treasury+s.people.reduce((n,p)=>n+p.coins,0)+s.buildings.reduce((n,b)=>n+b.cash,0),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function meet(){const s=new Simulation(),p=s.person(1),q=s.person(5);for(const x of [p,q]){Object.assign(x,{age:30,hunger:80,energy:90,health:90,social:40,mood:70,path:[],location:'market',goal:'market',navNode:'b:market',coins:200});}Object.assign(p.mind.personality,{ambition:.95,empathy:.1,caution:.1});return{s,p,q};}
const crime=q=>({kind:'civicOffence',target:'market',personId:q.id,offence:'theft',motive:'greed',elapsed:0,duration:10});
test('корысть даёт социальную цель только при личной встрече; осторожный добрый человек не выбирает кражу',()=>{
 const{s,p,q}=meet();assert.ok(Brain.options(s,p).some(o=>o.goal==='civicOffence'));q.location='hall';assert.equal(C.motive(s,p,q),null);q.location='market';p.mind.personality.empathy=.9;assert.equal(C.motive(s,p,q),null);
});
test('кража переводит деньги, имеет свидетелей и мотив, повтор ограничен; уход жертвы отменяет действие',()=>{
 const{s,p,q}=meet(),a=crime(q);s.random=()=>0;const before=total(s),cash=q.coins;p.location='hall';assert.equal(C.execute(s,p,a).ok,false);p.location='market';assert.ok(C.execute(s,p,a).ok);close(total(s),before);assert.ok(q.coins<cash);assert.equal(s.civic.cases[0].motive,'greed');assert.equal(C.execute(s,p,a).ok,false);assert.equal(p.civic.offences,1);assert.deepEqual(clone(s).civic,s.civic);
});
test('нужда отличается от корысти и не выводится только из бедного личного кошелька',()=>{
 const{s,p,q}=meet();p.coins=2;p.hunger=35;p.mind.personality.ambition=.2;for(const x of H.family(s,p))x.coins=0;assert.equal(C.motive(s,p,q)?.motive,'need');s.person(p.spouseId).coins=500;assert.equal(C.motive(s,p,q),null);
});
test('вражда и вспыльчивость мотивируют драку; здоровье и связи ухудшаются без создания денег',()=>{
 const{s,p,q}=meet();p.traits=['Вспыльчивый'];p.relationships[q.id]=-60;p.mood=25;const before=total(s),health=q.health;assert.equal(C.motive(s,p,q).kind,'brawl');assert.ok(C.execute(s,p,{...crime(q),offence:'brawl',motive:'revenge'}).ok);close(total(s),before);assert.ok(q.health<health);assert.ok(q.relationships[p.id]<0);assert.equal(s.civic.totals.brawls,1);
});
test('раскрытое дело взыскивается однократно, штраф поступает казне, наказание влияет на обучение',()=>{
 const{s,p,q}=meet();s.random=()=>0;C.execute(s,p,crime(q));const before=total(s),treasury=s.treasury,c=s.civic.cases[0];assert.ok(C.sentence(s,c));assert.ok(!C.sentence(s,c));close(total(s),before);close(s.treasury-treasury,8);close(c.recovered,c.amount);assert.equal(p.civic.service,90);assert.ok(p.learning.values.civicOffence.value<0);assert.equal(C.execute(s,p,{kind:'civicService',target:'hall'}).ok,false);p.location='hall';assert.ok(C.execute(s,p,{kind:'civicService',target:'hall'}).ok);assert.equal(p.civic.service,0);assert.deepEqual(clone(s).civic,s.civic);
});
test('бедный нарушитель не уходит в минус: неоплаченный штраф ждёт дохода',()=>{
 const{s,p,q}=meet();s.random=()=>0;C.execute(s,p,crime(q));p.coins=12;C.sentence(s,s.civic.cases[0]);assert.equal(p.coins,12);assert.equal(p.civic.fineDue,8);p.coins=80;s.day++;const before=total(s);C.daily(s);assert.equal(p.civic.fineDue,6);close(total(s),before);const snapshot=JSON.stringify(s.civic);C.daily(s);assert.equal(JSON.stringify(s.civic),snapshot);
});
test('помощь и наставничество требуют встречи и меняют реальные деньги или умение',()=>{
 const{s,p,q}=meet();p.mind.personality.empathy=.9;q.coins=2;const before=total(s);C.encounter(s,p,q);close(total(s),before);assert.ok(q.coins>2);assert.ok(s.civic.totals.aid>0);
 s.day++;p.skill=5;q.skill=1;q.coins=50;p.mind.personality.curiosity=.9;C.encounter(s,p,q);assert.ok(q.skill>1);assert.equal(s.civic.totals.mentoring,1);q.location='hall';const n=s.civic.totals.meetings;C.encounter(s,p,q);assert.equal(s.civic.totals.meetings,n);
});
test('примирение снижает враждебность вместо фиктивной дружбы',()=>{const{s,p,q}=meet();p.mind.personality.empathy=.9;Object.assign(p.character.values,{honesty:.9,justice:.2,familyLoyalty:.3});p.relationships[q.id]=-40;q.relationships[p.id]=-40;C.encounter(s,p,q);assert.ok(p.relationships[q.id]>-40&&p.relationships[q.id]<0);assert.equal(s.civic.totals.reconciled,1);});
test('банды не существуют заранее и формируются из встретившихся знакомых повторных нарушителей',()=>{
 const{s,p,q}=meet();assert.equal(s.civic.groups.length,0);p.civic.offences=q.civic.offences=2;p.relationships[q.id]=q.relationships[p.id]=40;C.encounter(s,p,q);assert.equal(s.civic.groups.length,1);assert.equal(p.civic.gangId,q.civic.gangId);const g=s.civic.groups[0];assert.deepEqual(clone(s).civic,s.civic);s.die(q,'умер от болезни');s.day++;C.daily(s);assert.equal(g.active,false);assert.equal(q.civic.gangId,null);assert.equal(p.civic.gangId,null);assert.doesNotThrow(()=>clone(s));
});
test('сообщник получает долю только при личном присутствии; участники не выбирают друг друга жертвами',()=>{
 const{s,p,q}=meet();p.civic.offences=q.civic.offences=2;p.relationships[q.id]=q.relationships[p.id]=40;C.gangMeeting(s,p,q);assert.equal(C.motive(s,p,q),null);const victim=s.person(9);Object.assign(victim,{age:30,location:'market',path:[],health:90,coins:200});s.random=()=>0;const before=total(s),mate=q.coins;assert.ok(C.execute(s,p,{...crime(victim),motive:'gang'}).ok);close(total(s),before);close(q.coins-mate,s.civic.cases[0].amount*.25);
});
test('старый город получает социальную жизнь без выдуманных преступлений и денежных переводов',()=>{const s=new Simulation(),raw=JSON.parse(JSON.stringify(s));delete raw.state.civic;for(const p of raw.state.people)delete p.civic;const r=Simulation.fromJSON(raw);close(total(s),total(r));assert.equal(r.civic.cases.length,0);assert.equal(r.civic.groups.length,0);assert.deepEqual(clone(r).toJSON(),r.toJSON());});
test('повреждённые социальные дела, планы и принадлежность к банде не загружаются',()=>{for(const change of [s=>s.civic.cases.push({}),s=>s.person(1).civic.gangId=99,s=>s.person(1).civic.fineDue=-1,s=>s.person(1).plan={goal:'civicOffence',index:0,steps:[{kind:'civicOffence',target:'market',duration:10,elapsed:0,personId:9999,motive:'greed',offence:'theft'}]}]){const s=new Simulation();change(s);assert.throws(()=>clone(s));}});
test('штрафы не считаются устойчивым налоговым доходом',()=>{const s=new Simulation();s.day=6;s.accounts.days=Array.from({length:6},(_,day)=>({day,income:{sales:60},expenses:{}}));const a=Finance.budget(s);s.accounts.days[0].income.crimeFines=10000;const b=Finance.budget(s);close(a.sustainableNet,b.sustainableNet);assert.ok(Finance.prepareBudget(s).income<100);});
