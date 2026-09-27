(function(root){
  'use strict';
  const Mind=typeof module!=='undefined'&&module.exports?require('./citizen-mind.js'):root.DanzigMind;
  const Social=typeof module!=='undefined'&&module.exports?require('./social-life.js'):root.DanzigSocial;
  const skilled=new Set(['smith','tailor','carpenter','weaver','potter','clinic','school']);
  function eligible(s,p){return p.alive&&!p.absence&&p.age>=16&&p.age<65&&p.id!==s.mayorId;}
  function ensure(s,p){if(!p.career)p.career={since:s.day,job:p.jobId,known:[],searchAt:-10000,applications:0,changes:0,training:0,history:[]};p.career.contractRate??=0;p.career.termUntil??=0;p.career.raiseDay??=-1;p.career.referral??=null;return p.career;}
  function qualification(p,b){return skilled.has(b.type)?Math.min(1,(p.tradeExperience?.[b.type]||0)/480+(p.skill||1)/6):1;}
  function rate(s,p,b){const c=ensure(s,p),advertised=b.wage*(c.job===b.id&&c.apprentice?.7:1);return c.job===b.id&&c.termUntil>s.day?Math.max(advertised,c.contractRate):advertised;}
  function observe(s,p,b){
    const c=ensure(s,p);if(!s.jobSlots(b)||b.type==='hall')return;
    const entry={id:b.id,wage:b.wage,slots:Math.max(0,s.hiringSlots(b)-s.workers(b.id).length),at:s.now,open:s.isOpen(b),source:'visit'};
    c.known=c.known.filter(x=>x.id!==b.id);c.known.push(entry);c.known=c.known.slice(-64);
  }
  function search(s,p){
    const c=ensure(s,p);c.searchAt=s.now;
    // A visit to the market reveals advertised vacancies, not private cash balances.
    for(const b of s.buildings)if(b.type!=='hall'&&s.jobSlots(b)>0){observe(s,p,b);c.known.find(x=>x.id===b.id).source='board';}
    Mind.ensure(s,p).lastReplan='Проверил объявления о работе на рынке';
  }
  function gossip(s,p,q){const c=ensure(s,p);for(const offer of ensure(s,q).known.filter(x=>s.now-x.at<1440).slice(-3)){const old=c.known.find(x=>x.id===offer.id);if(!old||old.at<offer.at){c.known=c.known.filter(x=>x!==old);c.known.push({...offer,source:q.id});}}c.known=c.known.slice(-64);}
  function evaluate(s,p,b,known){
    const v=Mind.ensure(s,p).personality,q=qualification(p,b),apprentice=q<1,wage=(known?.wage??b.wage)*(apprentice?.7:1);
    const net=s.netWage?s.netWage(p,wage):wage*.8,walk=s.travelMinutes(p,b.id),reliability=Mind.context(s,p,b.id,'employment');
    const familiarity=Math.min(1,(p.tradeExperience?.[b.type]||0)/1200),bond=Social.trust(s,p,s.person(b.ownerId)),referral=p.knowledge[b.id]?.recommendedBy;
    const expected=Math.max(0,6-walk*2/60)*net;
    const score=expected*8-walk*(.07+v.family*.06)+reliability*(.6+v.caution)+familiarity*(5+v.loyalty*7)+(apprentice?v.curiosity*7:0)+bond*.1+(referral&&s.now-referral.at<10080?4:0);
    return{...known,id:b.id,score,wage,net,expected,walk,apprentice,reason:`≈ ${expected.toFixed(1)} тал. за 6 часов с учётом дороги и сборов; ${Math.ceil(walk)} мин. в пути${apprentice?'; ученичество, 70% ставки':''}${reliability<-2?'; есть плохой опыт':''}`};
  }
  function offers(s,p){
    if(!eligible(s,p))return[];
    return ensure(s,p).known.filter(k=>k.id!==p.jobId&&k.slots>0&&k.open&&s.now-k.at<3*1440&&!s.recentFailure(p,k.id,'rejected')&&!s.recentFailure(p,k.id,'unpaid')).map(k=>{const b=s.building(k.id);return b&&!b.construction?evaluate(s,p,b,k):null;}).filter(Boolean).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  }
  function hire(s,p,b){
    const c=ensure(s,p);c.applications++;observe(s,p,b);
    if(!eligible(s,p)||!s.isOpen(b)||b.type==='hall'||s.workers(b.id).length>=s.hiringSlots(b))return{ok:false,message:'Работодатель отказал: свободного места нет.'};
    const apprentice=qualification(p,b)<1,required=b.wage*(s.workers(b.id).length+1)*2;
    if(b.cash<required)return{ok:false,message:'Работодатель не может обеспечить даже два оплаченных часа работы.'};
    if(Social.trust(s,s.person(b.ownerId),p)<-35&&qualification(p,b)<1)return{ok:false,message:'Хозяин не доверяет соискателю после прошлых конфликтов.'};
    const previous=p.jobId;p.jobId=b.id;if(!b.ownerId)b.ownerId=p.id;
    const referral=p.knowledge[b.id]?.recommendedBy;
    c.job=b.id;c.since=s.day;c.apprentice=apprentice;c.training=0;c.changes++;c.contractRate=b.wage*(apprentice?.7:1);c.termUntil=s.day+6;c.referral=referral&&s.now-referral.at<10080?referral.id:null;c.history.unshift({day:s.day,from:previous,to:b.id,apprentice});c.history=c.history.slice(0,8);
    return{ok:true,apprentice};
  }
  function raise(s,p,b){
    const c=ensure(s,p);c.raiseDay=s.day;if(p.jobId!==b.id||!s.isOpen(b)||s.recentFailure(p,b.id,'unpaid'))return{ok:false,message:'Повышение сейчас невозможно.'};
    const trust=Social.trust(s,s.person(b.ownerId),p),skill=qualification(p,b),offered=rate(s,p,b)*1.08;
    if(skill<.8||trust<-15||b.cash<(s.workers(b.id).length*b.wage+offered)*12+30)return{ok:false,message:'Мастерская не может позволить предложенную ставку.'};
    c.contractRate=Math.min(offered,(b.enterprise?.baseWage||b.wage)*1.5);c.termUntil=s.day+6;Social.change(s,p,s.person(b.ownerId),4,'Хозяин согласился повысить оплату');s.log(`${p.name} договорился с ${b.name}: ${c.contractRate.toFixed(2)} тал./ч. на следующие шесть дней.`,'career',p.id);return{ok:true};
  }
  function worked(s,p,b,dt){
    const c=ensure(s,p);if(c.job!==b.id){c.job=b.id;c.apprentice=false;c.training=0;}
    if(c.apprentice){c.training+=dt;p.skill=Math.min(10,p.skill+dt*.00035);if(c.training>=480){c.apprentice=false;s.log(p.name+' завершил ученичество: '+b.name+'.','career',p.id);}}
    // One confirmation per hour keeps memory bounded without a write on every tick.
    if(c.lastPaid===undefined||s.now-c.lastPaid>=60){Mind.record(s,p,b.id,'employment',true,'Оплаченный труд');c.lastPaid=s.now;}
  }
  function candidates(s,p,add,step,household){
    if(p.absence||p.age<16||s.hour<6||s.hour>=21||p.cargo)return;
    const owned=s.buildings.find(b=>b.damaged&&b.ownerId===p.id&&!b.construction);
    if(owned)add('repair','Вернуть свой двор к работе',98,'Простой лишает семью дохода. Восстановлю принадлежащее мне здание',[
      step('repair',owned.id,'Восстановить собственный двор',{duration:Math.max(15,200-(owned.repairWork||0))})]);
    if(!eligible(s,p))return;
    const c=ensure(s,p),job=s.building(p.jobId),v=Mind.ensure(s,p).personality,h=household||Mind.household(s,p);
    if(job?.damaged&&job!==owned)add('repair','Восстановить своё рабочее место',96+v.loyalty*10,'Мастерская повреждена. Ремонт сохраняет знакомое ремесло и заработок',[
      step('repair',job.id,'Вернуть мастерскую к работе',{duration:Math.max(15,200-(job.repairWork||0))})]);
    const bad=job&&(s.recentFailure(p,job.id,'unpaid')||s.recentFailure(p,job.id,'closed')||Mind.context(s,p,job.id,'employment')<-7);
    const best=offers(s,p)[0],current=job?evaluate(s,p,job):null;
    const willing=!job||bad||(s.day-c.since>=2&&best&&best.score>current.score+10+v.loyalty*14);
    if(job&&!bad&&best&&willing&&s.day-c.raiseDay>=4&&qualification(p,job)>=.8)add('bargain','Обсудить повышение оплаты',66+v.loyalty*8,`Есть другое предложение. Сначала предложу своему хозяину пересмотреть ставку`,[step('bargain',job.id,'Договориться об оплате',{duration:30})]);
    if(willing&&best)add('career',job?'Выбрать более подходящую работу':'Найти оплачиваемое дело',!job?73:bad?84:57,`${s.building(best.id).name}: ${best.reason}`,[step('hire',best.id,'Поговорить с работодателем',{duration:30})]);
    const stale=s.now-c.searchAt>720;
    if(stale&&(!job||bad||!best&&s.day-c.since>=3))add('jobSearch','Узнать о вакансиях на рынке',!job?70:bad?81:20+v.ambition*10,'Нужны свежие объявления: условия работы, ставка и свободные места',[step('seekWork','market','Изучить объявления и спросить торговцев',{duration:30})]);
    if(!job)for(const k of c.known.filter(k=>k.slots>0&&s.now-k.at<3*1440).slice().sort((a,b)=>a.id.localeCompare(b.id))){
      const b=s.building(k.id);if(!b?.damaged||b.construction||s.recentFailure(p,b.id,'rejected'))continue;
      add('career','Восстановить двор и устроиться на работу',74+v.diligence*6-v.caution*5,
        `${b.name}: рабочие места есть, но сначала нужен ремонт. После него мастер заново проверит возможность найма`,[
          step('repair',b.id,'Помочь восстановить мастерскую',{duration:Math.max(15,200-(b.repairWork||0))}),step('hire',b.id,'Договориться об оплате',{duration:30})]);
      break;
    }
    // A breadwinner with adequate personal food still budgets for dependents.
    if(job&&h.dependents&&h.coins<h.reserve&&s.canProduce(job)&&!bad)add('work','Заработать семейный резерв',67+v.family*10,'Моих сбережений недостаточно для расходов семьи на три дня',[step('work',job.id,'Отработать семейную смену',{duration:120})]);
  }
  function load(s){for(const p of s.people){const c=ensure(s,p),finite=n=>Number.isFinite(n)&&n>=0;if(!Array.isArray(c.known)||c.known.length>64||!c.known.every(k=>typeof k.id==='string'&&finite(k.wage)&&finite(k.slots)&&finite(k.at))||!finite(c.since)||!finite(c.applications)||!finite(c.changes)||!finite(c.training)||!finite(c.contractRate)||!finite(c.termUntil)||!Array.isArray(c.history)||c.history.length>8||!Number.isFinite(c.searchAt)||!Number.isFinite(c.raiseDay))throw Error('Некорректная трудовая история');}}
  const api={eligible,ensure,qualification,observe,search,gossip,evaluate,offers,hire,raise,worked,rate,candidates,load};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigLabour=api;
})(typeof window!=='undefined'?window:globalThis);
