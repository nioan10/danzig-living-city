const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Report}=require('../sim.js');
const View=require('../report-view.js');
const clone=s=>Simulation.fromJSON(JSON.parse(JSON.stringify(s)));

test('завершение фиксирует данные, не расходует время и случайность, повторяется безопасно',()=>{
 const s=new Simulation();s.advance(45);const now=s.now,seed=s.seed,report=s.finish();assert.equal(report.at,now);assert.equal(s.now,now);assert.equal(s.seed,seed);assert.equal(s.finish(),report);assert.equal(report.population.living,48);
 const before=JSON.stringify(s);s.advance(100);s.tick(5);s.nextMorning();assert.equal(s.triggerCrisis('mobilization').ok,false);assert.equal(s.act('food').ok,false);assert.equal(s.inviteFamily().ok,false);assert.equal(s.setTax(30).ok,false);assert.equal(JSON.stringify(s),before);
});
test('итоги и остановка переживают сохранение; явное продолжение возобновляет время',()=>{
 const s=new Simulation();s.advance(25);s.finish();const restored=clone(s);assert.deepEqual(restored.conclusion,s.conclusion);restored.advance(1440);assert.equal(restored.now,s.now);restored.resume();restored.advance(5);assert.equal(restored.now,s.now+5);assert.equal(restored.conclusion,null);assert.equal(s.conclusion.at,s.now);
});
test('завершённый срез не зависит от дальнейших изменений модели',()=>{
 const s=new Simulation(),r=s.finish();const original=JSON.stringify(r);s.resume();s.changeTreasury(50,'custom');s.person(1).surname='Другая фамилия';s.log('Новая запись','family');assert.equal(JSON.stringify(r),original);assert.notEqual(s.finish().economy.treasury,r.economy.treasury);
});
test('поколения, родительская цепочка и утраты считаются по людям, включая умерших',()=>{
 const s=new Simulation(),parent=s.person(3),child=s.createPerson('Тест','Фогель','f',0,'h0');child.parents=[parent.id];s.initializeMind(child);s.births++;s.die(parent,'умер от болезни');const r=s.finish();assert.equal(r.lineage.length,3);assert.equal(r.lineage.at(-1).id,child.id);assert.ok(r.lineage.some(p=>p.id===parent.id&&!p.alive));assert.equal(r.generations.find(g=>g.generation===3).total,1);assert.equal(r.population.causes.illness,1);assert.equal(r.dynasties.find(f=>f.name==='Фогель').total,5);
});
test('архив денег не обрезается вместе с 60-дневным журналом казны',()=>{
 const s=new Simulation();for(let i=0;i<80;i++){s.day=i;s.changeTreasury(10,'custom');s.changeTreasury(-2,'food');}assert.equal(s.accounts.days.length,60);const r=s.finish();assert.equal(r.economy.income.custom,800);assert.equal(r.economy.expenses.food,160);assert.equal(r.economy.treasury,960);assert.equal(r.coverage.moneySince,0);
});
test('счётчики событий и первые памятные записи переживают очистку обычной хроники',()=>{
 const s=new Simulation();for(let i=0;i<400;i++)s.log('Событие '+i,'custom',null,{title:'Событие '+i});assert.equal(s.events.length,300);assert.equal(s.reportArchive.counts.custom,400);assert.equal(s.reportArchive.stories.custom.length,7);assert.ok(s.finish().stories.some(e=>e.text==='Событие 0'));
});
test('сжатие графика сохраняет начало и отдельный рекорд, число точек ограничено',()=>{
 const s=new Simulation(),start=s.now;for(let i=1;i<1200;i++){s.day=Math.floor(i/4);s.minute=(i%4)*360;s.treasury=i===451?10000:200;Report.sample(s);}assert.ok(s.reportArchive.timeline.length<=360);assert.equal(s.reportArchive.timeline[0].at,start);assert.equal(s.reportArchive.peaks.treasury.value,10000);const r=s.finish();assert.equal(r.timeline.at(-1).at,s.now);assert.ok(r.timeline.length<=361);
});
test('старый город получает честное покрытие доступных журналов без сброса',()=>{
 const s=new Simulation();s.day=100;s.changeTreasury(25,'custom');const data=JSON.parse(JSON.stringify(s));delete data.state.reportArchive;const restored=Simulation.fromJSON(data),r=restored.finish();assert.equal(r.coverage.legacy,true);assert.equal(r.coverage.installedAt,s.now);assert.equal(r.coverage.moneySince,100);assert.equal(r.economy.income.custom,25);assert.equal(restored.treasury,s.treasury);assert.equal(restored.living.length,48);
});
test('новые сохранения продолжают архив воспроизводимо',()=>{
 const s=new Simulation();s.advance(380);const restored=clone(s);s.advance(720);restored.advance(720);assert.deepEqual(JSON.parse(JSON.stringify(s)),JSON.parse(JSON.stringify(restored)));assert.deepEqual(s.finish(),restored.finish());
});
test('пустой и короткий город дают корректный отчёт без фиктивного опыта',()=>{
 const s=new Simulation();let r=s.finish();assert.ok(r.generations.every(g=>g.successRate===null));assert.match(View.chart(r),/Время ещё не прошло/);s.resume();for(const p of [...s.living])s.die(p,'умер от болезни');r=s.finish();assert.equal(r.population.living,0);assert.equal(r.heroes.wealthy,null);assert.doesNotMatch(View.body(r),/NaN|Infinity|undefined/);
});
test('выгрузка содержит все разделы, экранирует пользовательские события и не требует сети',()=>{
 const s=new Simulation();s.log('<img src=x onerror=alert(1)>','custom',null,{title:'<script>bad()</script>'});const html=View.exportHTML(s.finish(),'body{color:green}');for(const name of ['Люди и поколения','Казна и ремёсла','События и наследие'])assert.ok(html.includes(name));assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));assert.ok(html.includes('&lt;img'));assert.doesNotMatch(html,/<script|<link|<img|data-report-resume/);assert.ok(html.includes('body{color:green}'));
});
test('повреждённый итоговый отчёт не загружается молча',()=>{
 const s=new Simulation();s.finish();const data=JSON.parse(JSON.stringify(s));data.state.conclusion.at++;assert.throws(()=>Simulation.fromJSON(data),/отчёт/);
});
