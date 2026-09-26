(function(root){
  'use strict';
  const META={development:['Развитие дворов','major'],guild:['Гильдии','major'],tribute:['Регион','major'],crisis:['Кризис','critical'],military:['Служба','major'],custom:['Ваше событие','major'],fire:['Пожар','critical'],death:['Утрата','major'],family:['Семья','major'],politics:['Совет','major'],health:['Здоровье','major'],food:['Продовольствие','major'],economy:['Торговля','minor'],career:['Ремесло','minor'],conflict:['Ссора','minor'],friendship:['Знакомство','minor'],festival:['Праздник','major'],weather:['Погода','major'],experiment:['Перемены','major'],reaction:['Реакция','minor'],life:['Повседневность','minor'],season:['Сезон','minor']};
  const CATALOG=[
    {id:'fire',title:'Пожар',icon:'♨',tone:'danger',description:'Мастерская остановится. Соседи решат, помогать ли с восстановлением.',target:'bakery',duration:240},
    {id:'caravan',title:'Купеческий обоз',icon:'⚓',tone:'trade',description:'Мука, зерно и железо поступят в порт. Мастера узнают о поставке.',target:'dock',duration:180},
    {id:'feast',title:'Ярмарка',icon:'⚑',tone:'joy',description:'На рынке откроются гуляния. Общительные жители отложат дела.',target:'market',duration:360},
    {id:'storm',title:'Гроза',icon:'ϟ',tone:'weather',description:'Дороги замедлятся, полевые работы притихнут. Люди будут искать укрытие.',target:'farm',duration:180},
    {id:'illness',title:'Вспышка болезни',icon:'✚',tone:'danger',description:'Заболеют трое взрослых. Лекарь и близкие пересмотрят планы.',target:'clinic',duration:480},
    {id:'breakdown',title:'Поломка мельницы',icon:'⚙',tone:'trade',description:'Мельница встанет на 6 часов. Пекари начнут искать другой источник муки.',target:'mill',duration:360}
  ];
  function ensure(sim){sim.incidents??=[];sim.eventSerial??=sim.events?.length||0;sim.incidentSerial??=0;sim.pulseState??={last:sim.now,lowFood:false};}
  function decorate(e,id){const [label,importance]=META[e.type]||META.life;return{id,label,importance,...e};}
  function active(sim,type){return(sim.incidents||[]).find(e=>e.type===type&&e.status==='active');}
  function trigger(sim,type,targetId){
    ensure(sim);const spec=CATALOG.find(e=>e.id===type);if(!spec)return{ok:false,message:'Такого события нет'};
    if(type==='caravan'&&active(sim,'blockade'))return{ok:false,message:'Обоз не может пройти торговую блокаду'};
    if(active(sim,type))return{ok:false,message:'Это событие уже происходит'};
    const target=type==='fire'?sim.building(targetId||spec.target):sim.building(spec.target);
    if(!target||type==='fire'&&(!sim.workers(target.id).length||target.type==='home'||target.damaged))return{ok:false,message:'Выберите действующую мастерскую'};
    // Establish an ordinary plan before the event, so idle residents are not
    // incorrectly reported as having changed their minds because of it.
    for(const p of sim.alive)if(!p.plan)sim.decide(p);
    const e={id:++sim.incidentSerial,type,title:spec.title,targetId:target.id,startedAt:sim.now,until:sim.now+spec.duration,status:'active',reactions:[],affected:[],effects:[]};
    sim.incidents.unshift(e);sim.incidents=sim.incidents.filter((e,i)=>e.status==='active'||i<40);
    let story='',eventType='experiment';
    if(type==='fire'){
      target.damaged=true;target.damageDay=sim.day;target.repairWork=0;
      const lost=Math.floor(target.stock.wood*.2);target.stock.wood-=lost;
      e.effects=['Работа остановлена','Двору нужен ремонт',...(lost?[`Потеряно дров: ${lost}`]:[])];eventType='fire';
      story=`Над двором «${target.name}» поднялся дым. Работники зовут соседей на помощь.`;
    }
    if(type==='caravan'){
      for(const [good,n]of Object.entries({flour:50,grain:80,iron:25,wood:35}))target.stock[good]+=n;
      e.effects=['+50 муки','+80 зерна','+25 железа','+35 древесины'];eventType='economy';
      story='У пристани разгружают купеческий обоз. Глашатай объявил о новых запасах муки, зерна и железа.';
      for(const p of sim.alive){sim.observe(p,target);p.memories=p.memories.filter(m=>!(m.subject===target.id&&['empty','closed'].includes(m.kind)));}
    }
    if(type==='feast'){
      e.effects=['Площадь принимает гостей','Общение восстанавливается быстрее'];eventType='festival';
      story='На Длинном рынке началась ярмарка. Музыканты зовут горожан, но не каждый готов бросить свои дела.';
    }
    if(type==='storm'){
      e.previousWeather=sim.weather;sim.weather='Гроза';e.effects=['Скорость пути −30%','Полевое производство −65%'];eventType='weather';
      story='С реки надвигается гроза. Работники в предместьях ищут укрытие, а обозы замедляют ход.';
    }
    if(type==='illness'){
      const candidates=sim.alive.filter(p=>p.age>=16&&!p.sick&&p.jobId!=='clinic');
      for(let i=0;i<3&&candidates.length;i++){const p=sim.pick(candidates);candidates.splice(candidates.indexOf(p),1);p.sick=true;p.health=Math.min(48,p.health);e.affected.push(p.id);sim.remember(p,'illness','self','Заболел во время городской вспышки');}
      e.effects=[`Заболело жителей: ${e.affected.length}`,'Лекарь ожидает больных'];eventType='health';
      story='В городе заболели '+e.affected.map(id=>sim.person(id).name).join(', ')+'. Родные ищут помощь.';
    }
    if(type==='breakdown'){
      target.closedUntil=e.until;e.effects=['Мельница закрыта на 6 ч.','Срываются поставки муки'];story='У мельницы сломался привод. Мельники и покупатели получили известие об остановке.';
    }
    const report=sim.log(story,eventType,null,{title:spec.title,importance:type==='fire'?'critical':'major',buildingId:target.id,incidentId:e.id,phase:'start',effects:e.effects});
    e.reportId=report.id;
    for(const p of sim.alive){
      if(p.absence)continue;
      if(type==='breakdown')sim.remember(p,'closed',target.id,'Мельник сообщил: привод сломан, работа приостановлена',-4);
      if(type==='fire'&&(p.jobId===target.id||p.goal===target.id))sim.remember(p,'closed',target.id,'Пожар остановил работу двора',-4);
      const old=p.plan?.goal+'|'+p.plan?.steps[p.plan.index]?.target;
      p.plan=null;sim.decide(p);
      const next=p.plan?.goal+'|'+p.plan?.steps[p.plan.index]?.target;
      if(old!==next&&p.plan){e.reactions.push({personId:p.id,name:p.name,title:p.plan.title,goal:p.plan.goal});sim.remember(p,'event',e.id,spec.title+': '+p.plan.title);}
    }
    const direct=new Set(['helpFire','shelter','fair','medicalDuty','heal','supply']);e.reactions.sort((a,b)=>Number(direct.has(b.goal))-Number(direct.has(a.goal)));
    sim.log(e.reactions.length?`${e.reactions.length} жителей пересмотрели планы. ${e.reactions.slice(0,2).map(r=>r.name+': '+r.title.toLowerCase()).join('; ')}.`:'Горожане узнали новость. Текущие нужды пока важнее.', 'reaction',e.reactions[0]?.personId||null,{title:'Город отреагировал',incidentId:e.id,buildingId:target.id,phase:'reaction'});
    return{ok:true,message:spec.title+': '+e.reactions.length+' жителей пересмотрели планы',incident:e};
  }
  function candidates(sim,p,add,step){
    for(const e of (sim.incidents||[]).filter(e=>e.status==='active')){
      const b=sim.building(e.targetId),adult=p.age>=16&&p.age<70,able=adult&&p.health>55&&p.hunger>28&&p.energy>22;
      if(e.type==='fire'&&b.damaged){
        const near=Math.hypot(p.x-b.x,p.y-b.y)<230,worker=p.jobId===b.id;
        if(able&&(worker||near&&p.traits.some(t=>['Добрый','Трудолюбивый'].includes(t))))add('helpFire','Помочь пострадавшему двору',worker?170:142,'Соседям нужна помощь. Возьму инструменты и помогу восстановить двор',[step('repair',b.id,'Восстановить двор',{duration:80})]);
        else if(p.goal===b.id||p.location===b.id)add('shelter','Уйти от пожара',180,'У двора опасно. Пережду у церкви',[step('pray','church','Переждать в безопасном месте',{duration:45})]);
      }
      if(e.type==='feast'&&p.age>=6)add('fair','Зайти на ярмарку',58+(100-p.social)*.55+(p.traits.includes('Общительный')?42:0)-(p.traits.includes('Замкнутый')?30:0),'На рынке музыка и знакомые. Решаю, можно ли отложить дела',[step('social','market','Гулять на ярмарке',{duration:90})]);
      if(e.type==='storm'&&['farm','fish','wood','pasture','clay'].includes(p.jobId)&&p.hunger>25)add('shelter','Переждать грозу дома',145,'Под дождём работать трудно. Вернусь к делу после грозы',[step('rest',p.homeId,'Укрыться от грозы',{duration:60})]);
      if(e.type==='illness'){
        if(e.affected.includes(p.id)&&p.sick)add('heal','Обратиться к лекарю',170,'Мне стало плохо после вспышки. Нужна помощь',[step('heal','clinic','Пройти лечение',{duration:90})]);
        if(p.jobId==='clinic')add('medicalDuty','Принять заболевших',165,'В городе вспышка болезни. Меня ждут в лечебнице',[step('work','clinic','Принимать заболевших',{duration:120})]);
      }
    }
  }
  function tick(sim){
    ensure(sim);
    for(const e of sim.incidents.filter(e=>e.status==='active'&&CATALOG.some(c=>c.id===e.type))){
      const repaired=e.type==='fire'&&!sim.building(e.targetId).damaged;
      const healed=e.type==='illness'&&e.affected.every(id=>!sim.person(id)?.sick||!sim.person(id)?.alive);
      if(!repaired&&!healed&&sim.now<e.until)continue;
      e.status='resolved';e.endedAt=sim.now;
      if(e.type==='storm')sim.weather=e.previousWeather||'Облачно';
      const text=repaired?'Двор восстановлен. Мастерская снова может работать.':healed?'Заболевшие получили помощь; вспышка завершилась.':e.type==='fire'?'Открытого огня больше нет. Повреждённый двор всё ещё требует ремонта.':e.type==='storm'?'Гроза ушла. Дороги и полевые работы возвращаются к обычному темпу.':e.type==='breakdown'?'Мельничный привод починили. Мельница снова принимает зерно.':e.type==='feast'?'Ярмарка завершилась. Горожане возвращаются к повседневным делам.':e.type==='illness'?'Новых заболевших нет. Лечение тех, кто ещё болен, продолжается.':'Обоз разгружен. Привезённые товары остались на складе пристани.';
      sim.log(text,e.type==='fire'?'fire':e.type==='illness'?'health':'life',null,{title:e.title+' · итоги',importance:'major',buildingId:e.targetId,incidentId:e.id,phase:'resolved'});
      for(const p of sim.alive){if(e.type==='breakdown')p.memories=p.memories.filter(m=>!(m.kind==='closed'&&m.subject===e.targetId));if(['helpFire','fair','shelter','medicalDuty'].includes(p.plan?.goal)){p.plan=null;sim.decide(p);}}
    }
    if(sim.now-sim.pulseState.last>=180){
      sim.pulseState.last=sim.now;const low=sim.food<sim.alive.length;
      if(low&&!sim.pulseState.lowFood)sim.log('Готовой еды осталось меньше одной порции на человека. Семьи ищут новые запасы.','food',null,{title:'На рынках не хватает еды',buildingId:'market',importance:'major'});
      if(!low&&sim.pulseState.lowFood)sim.log('Запасы готовой еды снова покрывают одну порцию на каждого горожанина.','food',null,{title:'Запасы еды восстановлены',buildingId:'market'});
      sim.pulseState.lowFood=low;
    }
  }
  function summary(sim){const today=sim.events.filter(e=>e.day===sim.day);return{major:today.filter(e=>e.importance!=='minor').length,minor:today.filter(e=>e.importance==='minor').length,active:(sim.incidents||[]).filter(e=>e.status==='active')};}
  const api={META,CATALOG,ensure,decorate,active,trigger,candidates,tick,summary};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigEvents=api;
})(typeof window!=='undefined'?window:globalThis);
