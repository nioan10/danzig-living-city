const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,Analytics:A}=require('../sim.js');
const View=require('../statistics-view.js');
const copy=s=>JSON.parse(JSON.stringify(s));

test('статистическое чтение не меняет город, случайность, деньги и время',()=>{
  const s=new Simulation(),before=JSON.stringify(s),point=A.capture(s);
  A.points(s,'all');A.accounts(s,30);
  assert.equal(JSON.stringify(s),before);assert.equal(point.population,48);assert.equal(point.capacity,72);
  assert.equal(point.employed+point.jobless,s.alive.filter(p=>p.age>=16&&p.age<65&&!p.absence).length);
  assert.equal(point.personalCash,s.living.reduce((n,p)=>n+p.coins,0));
});

test('сэмплирование раз в шесть часов, текущий срез без лишней записи',()=>{
  const s=new Simulation(),count=s.analytics.recent.length;s.advance(10);assert.equal(s.analytics.recent.length,count);
  assert.equal(A.points(s,7).at(-1).at,s.now);assert.equal(s.analytics.recent.length,count);
  s.advance(720-s.now);assert.equal(s.analytics.recent.length,count+1);assert.equal(s.analytics.recent.at(-1).at,720);
});

test('старое сохранение начинает новые ряды с момента миграции без выдуманного прошлого',()=>{
  const s=new Simulation();s.day=100;s.statistics.snapshots=[{at:1440,population:30,treasury:100}];
  const data=copy(s);delete data.state.analytics;const r=Simulation.fromJSON(data),rows=A.points(r,'all');
  assert.equal(r.analytics.since,s.now);assert.equal(r.treasury,s.treasury);assert.equal(r.seed,s.seed);
  assert.equal(rows.find(p=>p.at===1440).population,30);assert.equal(A.value(rows.find(p=>p.at===1440),'employed'),null);
  assert.equal(rows.filter(p=>p.employed!==undefined).length,1);
});

test('архив ограничен, сохраняет начало и подробные последние 180 дней',()=>{
  const s=new Simulation(),start=s.now;for(let i=2;i<3000;i++){s.day=Math.floor(i/4);s.minute=i%4*360;A.sample(s);}
  assert.equal(s.analytics.recent.length,A.RECENT);assert.ok(s.analytics.archive.length<=A.ARCHIVE);
  assert.equal(s.analytics.archive[0].at,start);assert.ok(s.analytics.stride>360);
  const points=A.points(s,'all');assert.equal(points[0].at,start);assert.equal(points.at(-1).at,s.now);
  assert.equal(new Set(points.map(p=>p.at)).size,points.length);assert.ok(A.points(s,7).every(p=>p.at>=s.now-7*1440));
});

test('новая история и счётчики продолжаются после загрузки воспроизводимо',()=>{
  const s=new Simulation();s.advance(360);const r=Simulation.fromJSON(copy(s));s.advance(370);r.advance(370);
  assert.deepEqual(copy(r),copy(s));
});

test('испорченные точки, порядок и бесконечные значения отклоняются',()=>{
  const make=()=>copy(new Simulation());let data=make();data.state.analytics.recent[0].at+=500;assert.throws(()=>Simulation.fromJSON(data),/статистик/);
  data=make();data.state.analytics.recent[0].goods.bread=Infinity;assert.throws(()=>Simulation.fromJSON(data),/статистик/);
  data=make();data.state.analytics.recent.push({...data.state.analytics.recent[0]});assert.throws(()=>Simulation.fromJSON(data),/статистик/);
});

test('скорость производства использует настоящий интервал и не превращает пропуски в нули',()=>{
  const rows=[{at:0,produced:{grain:10}},{at:360,produced:{grain:15}},{at:1440,produced:{grain:45}},{at:1800},{at:2160,produced:{grain:50}},{at:2520,produced:{grain:1}}];
  assert.deepEqual(A.rates(rows,'produced.grain').map(p=>p.value),[null,20,40,null,null,null]);
  assert.equal(View.trend([{at:0},{at:300,x:10},{at:700,x:25}],'x'),15);
});

test('дневной бюджет показывает реальные суммы, дни без операций и незавершённый день',()=>{
  const s=new Simulation();s.changeTreasury(20,'custom');s.day=2;s.changeTreasury(-7,'food');
  const rows=A.accounts(s,7);assert.equal(rows.length,3);assert.equal(rows[0].income,20);assert.equal(rows[1].income,0);assert.equal(rows[2].net,-7);
  s.day=120;assert.equal(A.accounts(s,'all').length,60);assert.equal(A.accounts(s,90)[0].at,61*1440);
});

test('реальное производство учитывает сырьё и фактический износ инструментов',()=>{
  const s=new Simulation(),b=s.building('bakery'),p=s.workers(b.id)[0],r=s.productionRecipe(b);b.progress=r.time;b.stock.tools=.003;
  Object.assign(p,{location:b.id,path:[],goal:b.id,plan:{index:0,steps:[{kind:'work',target:b.id,elapsed:0,duration:100}]}});
  const flour=b.stock.flour;s.execute(p,5);assert.ok(s.statistics.materials.flour>0);
  assert.equal(s.statistics.materials.flour,flour-b.stock.flour);assert.equal(s.statistics.materials.tools,.003);assert.equal(b.stock.tools,0);
  s.eat(b.stock,p);assert.equal(A.capture(s).consumed.bread,1);
});

test('медиана денег не искажается единичным богачом и корректна без взрослых',()=>{
  assert.equal(A.median([1,2,1000]),2);assert.equal(A.median([2,8]),5);assert.equal(A.median([]),null);
  const s=new Simulation();for(const p of s.people)p.alive=false;const point=A.capture(s);assert.equal(point.medianCash,null);assert.equal(point.health,null);assert.equal(point.personalCash,0);
});

test('графики строятся для всех тем в пустой и короткой истории без NaN и с экранированием',()=>{
  const s=new Simulation();for(const topic of ['life','money','work','goods','society','learning']){
    const d={sim:s,statsTopic:topic};assert.doesNotMatch(View.render(d),/NaN|Infinity|undefined/);assert.ok(d.statsPlots.length>=2);
  }
  for(const p of s.people)p.alive=false;assert.doesNotMatch(View.render({sim:s,statsTopic:'learning'}),/NaN|Infinity|undefined/);
  const html=View.chart({plots:[]},'<script>','<b>',[{at:0,x:2},{at:100,x:-3}],[{key:'x',label:'<img>',unit:'тал.'}]);
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img&gt;'));assert.doesNotMatch(html,/<script>|<img>/);
});
