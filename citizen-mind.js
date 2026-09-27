(function(root){
  'use strict';
  const Intentions=typeof module!=='undefined'&&module.exports?require('./intentions.js'):root.DanzigIntentions;
  const Households=typeof module!=='undefined'&&module.exports?require('./households.js'):root.DanzigHouseholds;
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const LABELS={diligence:'Трудолюбие',ambition:'Амбиции',caution:'Осторожность',thrift:'Бережливость',family:'Забота о семье',sociability:'Общительность',loyalty:'Верность делу',empathy:'Сочувствие',curiosity:'Любознательность'};
  const GOALS={security:'Обеспечить запас на три дня',mastery:'Стать мастером своего ремесла',enterprise:'Накопить на собственное дело',standing:'Заслужить уважение горожан',home:'Улучшить условия семьи'};
  function hash(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0)/4294967296;}
  function ensure(s,p){
    if(p.mind?.version===2)return p.mind;
    const parents=(p.parents||[]).map(id=>s.person(id)).filter(q=>q?.mind?.version===2),personality={};
    const trait={diligence:['Трудолюбивый','Ленивый'],ambition:['Амбициозный'],thrift:['Бережливый'],family:['Добрый'],sociability:['Общительный','Замкнутый'],empathy:['Добрый','Вспыльчивый'],caution:['Бережливый','Вспыльчивый']};
    for(const key of Object.keys(LABELS)){
      let v=.18+.64*hash(`${p.id}:${p.name}:${p.bornDay}:${key}`);
      if(parents.length)v=v*.5+parents.reduce((n,q)=>n+q.mind.personality[key],0)/parents.length*.5;
      if(trait[key]?.[0]&&p.traits.includes(trait[key][0]))v+=.22;
      if(trait[key]?.[1]&&p.traits.includes(trait[key][1]))v-=.22;
      personality[key]=clamp(v,.05,.95);
    }
    p.mind={version:2,personality,inheritedFrom:parents.map(q=>q.id),goal:null,goalSince:s.day,lastReview:-1,contexts:[],claims:[],decisions:0,replans:0,lastReplan:'',forecast:null,explanation:[],search:null};
    return p.mind;
  }
  function family(s,p){
    return Households.family(s,p);
  }
  function household(s,p){
    const members=family(s,p),adults=members.filter(q=>q.age>=16&&q.health>30),home=s.building(p.homeId);
    const diners=s.alive.filter(q=>q.homeId===p.homeId&&!q.absence),food=s.foodAmount(home?.stock);
    const budget=Households.budget(s,p),dailyFood=budget.dailyFood,coins=budget.coins;
    const breadPrice=s.commerce?.prices.bread||1,expense=budget.expense;
    const ranked=adults.map(q=>{const v=ensure(s,q).personality;return{p:q,score:v.family*12+v.thrift*6+(q.coins>=breadPrice?10:-20)-(q.jobId?3:0)-s.travelMinutes(q,p.homeId)*.03};}).sort((a,b)=>b.score-a.score||a.p.id-b.p.id);
    const sick=members.find(q=>q.sick||q.health<60);
    const carer=adults.filter(q=>q.id!==sick?.id).sort((a,b)=>(ensure(s,b).personality.empathy*10-(b.jobId?3:0))-(ensure(s,a).personality.empathy*10-(a.jobId?3:0))||a.id-b.id)[0];
    return{members:members.map(q=>q.id),food,foodDays:budget.foodDays,coins,dailyFood,expense,reserve:budget.reserve,shopper:ranked[0]?.p.id??null,carer:sick?(carer?.id??null):null,sickId:sick?.id??null,dependents:members.filter(q=>q.age<16||q.health<40).length};
  }
  function review(s,p,h=household(s,p)){
    const m=ensure(s,p),v=m.personality;
    const poor=h.coins<h.reserve||h.foodDays<.7;
    const crowded=s.alive.filter(q=>q.homeId===p.homeId).length>s.buildingCapacity(s.building(p.homeId));
    const goal=poor?'security':p.enterpriseWish?'enterprise':crowded&&v.family>.45?'home':v.ambition>.7&&p.age>=16?'enterprise':v.sociability>.72&&v.ambition>.5?'standing':'mastery';
    const committed=Intentions.review(s,p,h,goal);if(committed!==m.goal){m.goal=committed;m.goalSince=s.day;}m.lastReview=s.day;
    m.forecast={...h,at:s.now};p.ambition=GOALS[m.goal];return m;
  }
  function context(s,p,subject,kind){
    const entries=ensure(s,p).contexts.filter(c=>c.subject===subject&&c.kind===kind);
    return entries.reduce((n,c)=>n+c.value*c.confidence*Math.exp(-Math.max(0,s.now-c.at)/(7*1440)),0);
  }
  function record(s,p,subject,kind,success,why,source='personal'){
    if(!subject)return;const m=ensure(s,p),old=m.contexts.find(c=>c.subject===subject&&c.kind===kind);
    const value=success?8:-24,confidence=source==='personal'?1:.35;
    if(old&&source!=='personal'&&old.source==='personal'&&s.now-old.at<3*1440)return;
    const entry={subject,kind,value:clamp((old?.value||0)*.6+value*.4,-24,8),confidence,source,at:s.now,trials:(old?.trials||0)+1,why};
    m.contexts=m.contexts.filter(c=>c!==old);m.contexts.unshift(entry);m.contexts=m.contexts.slice(0,24);
    if(!success&&kind==='employment')m.personality.caution=clamp(m.personality.caution+.005,.05,.95);
  }
  function gossip(s,p,q){
    for(const c of ensure(s,q).contexts.filter(c=>c.source==='personal'&&s.now-c.at<2*1440).slice(0,2)){
      const m=ensure(s,p),old=m.contexts.find(x=>x.subject===c.subject&&x.kind===c.kind),confidence=clamp(.35+(p.relationships[q.id]||0)/250,.1,.7);
      if(old&&old.at>=c.at||old?.source==='personal')continue;
      m.contexts=m.contexts.filter(x=>x!==old);m.contexts.unshift({...c,confidence,source:q.id});m.contexts=m.contexts.slice(0,24);
    }
  }
  function activeClaim(s,p,duty){
    return s.alive.some(q=>q.id!==p.id&&q.homeId===p.homeId&&!q.absence&&q.plan&&ensure(s,q).claims.some(c=>c.duty===duty&&c.until>s.now));
  }
  function claim(s,p,plan){
    const m=ensure(s,p);m.claims=[];
    if(plan?.steps.some(x=>x.kind==='storeFood'))m.claims.push({duty:'provision',until:s.now+Math.min(720,(plan.estimatedMinutes||180)+120)});
    if(plan?.goal==='care')m.claims.push({duty:'care',until:s.now+180});
  }
  function bias(s,p,goal,steps,h){
    const m=ensure(s,p),v=m.personality;let score=0;const why=[];
    const add=(n,text)=>{score+=n;if(Math.abs(n)>=3)why.push(text);};
    if(['work','supply','earnFood','makeMeal','career'].includes(goal)){
      add((v.diligence-.5)*12,'Личная готовность трудиться');
      if(m.goal==='security'&&p.age>=16)add(clamp((h.reserve-h.coins)/Math.max(1,h.reserve),0,1)*18,'Семье нужен денежный резерв');
      if(m.goal==='mastery'&&['work','supply'].includes(goal))add(5+v.curiosity*5,'Долгосрочная цель: освоить ремесло');
    }
    if(goal==='provision'){
      add((v.family-.5)*16+Math.min(18,Math.max(0,1-h.foodDays)*18),'Прогноз домашних запасов');
      if(h.shopper===p.id)add(9,'Семья поручила мне припасы');
      if(activeClaim(s,p,'provision'))add(-65,'Другой житель уже несёт продукты');
    }
    if(goal==='care'){add(v.empathy*12+v.family*8,'Забота о близких');if(h.carer===p.id)add(12,'Я могу подменить близкого');if(activeClaim(s,p,'care'))add(-50,'За больным уже ухаживают');}
    if(['social','friend','festival'].includes(goal))add((v.sociability-.5)*16,'Потребность в общении');
    if(m.goal==='standing'&&['social','friend','care','repair'].includes(goal))add(6,'Хочу укрепить связи и заслужить уважение');
    if(['learn','explore','jobSearch'].includes(goal))add((v.curiosity-.5)*12,'Интерес к знаниям и возможностям');
    if(['enterprise','charter','commission'].includes(goal)&&m.goal==='enterprise')add(14,'Коплю на собственное дело');
    if(['relocate','housing','develop'].includes(goal)&&m.goal==='home')add(12,'Семье нужен просторный дом');
    add(Intentions.bias(p,goal),'Следую выбранному способу достижения цели');
    const first=steps[0],kind=['work','hire'].includes(first.kind)?'employment':['buyFood','pickup'].includes(first.kind)?'trade':null;
    if(kind)add(context(s,p,first.target,kind)*(v.caution+.5),'Опыт именно с этим двором');
    return{score,why};
  }
  function finished(s,p,plan,success){
    const m=ensure(s,p);m.claims=[];
    if(success&&plan?.goal==='care')m.personality.empathy=clamp(m.personality.empathy+.001,.05,.95);
  }
  function load(s){
    for(const p of s.people){
      if(p.mind){const m=p.mind,finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
        if(m.version!==2||!m.personality||!Object.keys(LABELS).every(k=>finite(m.personality[k],0,1))||!Array.isArray(m.inheritedFrom)||!Array.isArray(m.contexts)||m.contexts.length>24||!m.contexts.every(c=>typeof c.subject==='string'&&['employment','trade'].includes(c.kind)&&finite(c.value,-24,8)&&finite(c.confidence,0,1)&&finite(c.at,0,1e12)&&finite(c.trials,0,1e12))||!Array.isArray(m.claims)||m.claims.length>2||!m.claims.every(c=>['provision','care'].includes(c.duty)&&finite(c.until,0,1e12))||!finite(m.decisions,0,1e12)||!finite(m.replans,0,1e12)||!Array.isArray(m.explanation)||m.goal!==null&&!Object.hasOwn(GOALS,m.goal)||m.forecast&&!['food','foodDays','coins','dailyFood','expense','reserve'].every(k=>finite(m.forecast[k],0,1e12)))throw Error('Некорректная память жителя');
      }else ensure(s,p);
    }
  }
  const api={LABELS,GOALS,ensure,family,household,review,context,record,gossip,activeClaim,claim,bias,finished,load};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigMind=api;
})(typeof window!=='undefined'?window:globalThis);
