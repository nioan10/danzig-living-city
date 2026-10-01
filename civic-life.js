(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports,S=node?require('./social-life.js'):root.DanzigSocial,H=node?require('./households.js'):root.DanzigHouseholds;
  const L=node?require('./learning.js'):root.DanzigLearning,P=node?require('./personality.js'):root.DanzigPersonality;
  const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,x)),finite=n=>Number.isFinite(n)&&n>=0;
  const motives={need:'Нужда: семье не хватает средств на жизнь',greed:'Корысть: быстрый доход кажется привлекательнее честного заработка',revenge:'Месть за личный конфликт',gang:'Давление сообщников и надежда на их поддержку'};
  const labels={aid:'Взаимопомощь',mentor:'Наставничество',reconcile:'Примирение',company:'Совместный досуг',quarrel:'Ссора',theft:'Кража',brawl:'Драка',gang:'Уличная компания',justice:'Решение стражи',service:'Общественные работы'};
  function person(p){return p.civic??={nextCrime:0,nextMeeting:0,offences:0,heat:0,fear:0,gangId:null,service:0,fineDue:0,lastMotive:''};}
  function ensure(s){s.civic??={version:1,sinceDay:s.day,lastDay:s.day,nextId:1,nextGang:1,cases:[],groups:[],history:[],days:[],totals:{meetings:0,aid:0,mentoring:0,reconciled:0,thefts:0,brawls:0,stolen:0,recovered:0,fines:0,solved:0}};for(const p of s.people)person(p);return s.civic;}
  const present=(s,p)=>p?.alive&&!p.absence&&!p.arriving&&!p.relocation&&p.location&&!p.path.length;
  const together=(s,p,q)=>p?.id!==q?.id&&present(s,p)&&present(s,q)&&p.location===q.location;
  const group=(s,p)=>s.civic.groups.find(g=>g.id===person(p).gangId&&g.active);
  function note(s,kind,p,q,text,important=false){const v=ensure(s);if(['aid','reconcile'].includes(kind)){P.event(s,p,kind,q?.id??null,text,12);if(q)P.event(s,q,kind==='aid'?'help':'reconcile',p.id,text,12);}if(kind==='quarrel'&&q)P.event(s,q,'conflict',p.id,text,10);v.history.unshift({at:s.now,day:s.day,kind,personId:p.id,otherId:q?.id??null,text});v.history=v.history.slice(0,80);s.log(text,kind==='theft'||kind==='brawl'?'conflict':kind==='justice'?'politics':'friendship',p.id,{title:labels[kind],buildingId:p.location||p.homeId,importance:important?'major':'normal'});}
  function gangMeeting(s,p,q){
    if(!together(s,p,q))return;
    const v=ensure(s),a=person(p),b=person(q);if(p.age<18||q.age<18||a.offences<2||b.offences<2||S.trust(s,p,q)<20)return;
    let g=group(s,p)||group(s,q);if(a.gangId&&b.gangId)return;
    if(!g){if(v.groups.filter(g=>g.active).length>=12)return;g={id:v.nextGang++,name:'Компания '+p.surname,leaderId:p.id,members:[],active:true,formed:s.day,lastAt:s.now};v.groups.push(g);}
    if(g.members.length>=6)return;
    for(const x of [p,q])if(!person(x).gangId&&!g.members.includes(x.id)){g.members.push(x.id);x.civic.gangId=g.id;}
    g.lastAt=s.now;v.groups=v.groups.filter(x=>x.active||s.day-x.formed<60).slice(-24);note(s,'gang',p,q,`${p.name} и ${q.name} договариваются прикрывать друг друга: «${g.name}». Повторные нарушения и личное доверие сблизили их.`,true);
  }
  function encounter(s,p,q){
    if(!together(s,p,q)||s.conclusion)return;const a=person(p),b=person(q);if(a.nextMeeting>s.now||b.nextMeeting>s.now)return;
    a.nextMeeting=b.nextMeeting=s.now+480;const v=ensure(s),x=p.mind.personality,y=q.mind.personality;v.totals.meetings++;
    const donor=p.coins>=q.coins?p:q,recipient=donor===p?q:p,d=donor.mind.personality;
    if(d.empathy>.55&&recipient.coins<15&&donor.coins>75&&H.budget(s,donor).coins>H.budget(s,donor).reserve+20){const amount=Math.min(8,Math.max(2,(donor.coins-60)*.08));donor.coins-=amount;recipient.coins+=amount;S.change(s,donor,recipient,12,'Помог деньгами в трудный день');v.totals.aid+=amount;note(s,'aid',donor,recipient,`${donor.name} помогает ${recipient.name}: ${amount.toFixed(1)} тал. из собственных сбережений.`);}
    else if(S.trust(s,p,q)<0){const reaction=P.conflict(s,p,q),peace=['family','reconcile'].includes(reaction.kind);S.change(s,p,q,peace?14:reaction.kind==='bargain'?3:-2,reaction.reason);if(peace)v.totals.reconciled++;P.event(s,p,'conflict',q.id,reaction.reason+': '+q.name,peace?0:8);note(s,peace?'reconcile':'quarrel',p,q,`${p.name}: ${reaction.reason.toLowerCase()}. Собеседник — ${q.name}.`);}
    else if(Math.abs(p.skill-q.skill)>.7&&Math.max(x.curiosity,y.curiosity)>.55){const teacher=p.skill>q.skill?p:q,student=teacher===p?q:p;student.skill=Math.min(10,student.skill+.025);S.change(s,student,teacher,6,'Получил совет опытного ремесленника');v.totals.mentoring++;note(s,'mentor',teacher,student,`${teacher.name} делится ремесленным опытом с ${student.name}.`);}
    else if(p.traits.includes('Вспыльчивый')&&p.mood<50){S.change(s,p,q,-12,'Ссора из-за раздражения');note(s,'quarrel',p,q,`${p.name} сорвался на ${q.name}: раздражение усилило личный конфликт.`);}
    else{S.change(s,p,q,5,'Провели время вместе');p.social=clamp(p.social+5);q.social=clamp(q.social+5);if(s.random()<.18)note(s,'company',p,q,`${p.name} и ${q.name} провели время вместе в «${s.building(p.location).name}».`);}
    gangMeeting(s,p,q);
  }
  function motive(s,p,q){
    const a=person(p),x=p.mind.personality;if(!together(s,p,q)||p.age<18||q.age<18||p.homeId===q.homeId||p.health<45||q.health<40||a.nextCrime>s.now||a.service>0||S.kin(p,q)||a.gangId&&a.gangId===person(q).gangId)return null;
    if(p.traits.includes('Вспыльчивый')&&S.trust(s,p,q)<-30&&p.mood<50)return{kind:'brawl',motive:'revenge',score:65+(50-p.mood)*.7-x.caution*20};
    if(q.coins<25)return null;
    const budget=p.coins<10&&p.hunger<50?H.budget(s,p):null;
    if(budget&&budget.coins<budget.reserve*.5&&x.caution<.65)return{kind:'theft',motive:'need',score:72+(50-p.hunger)*.5-x.caution*20};
    if(x.empathy<.35&&x.ambition>.72&&q.coins>120)return{kind:'theft',motive:group(s,p)?'gang':'greed',score:46+x.ambition*20-x.caution*22+(group(s,p)?10:0)-a.heat*.2};
    return null;
  }
  function candidates(s,p,add,step){
    const v=s.civic||ensure(s),a=person(p);if(p.age<18||p.absence||p.arriving)return;
    if(a.service>0&&p.hunger>40&&p.energy>35&&s.hour>=8&&s.hour<18)add('civicService','Отработать наказание',48+a.heat*.3,'Нужно выполнить назначенные общественные работы и восстановить доверие',[step('civicService','hall','Работать по поручению стражи',{duration:90})]);
    if(v.cases.filter(c=>c.status==='open').length>=40||a.nextCrime>s.now||!present(s,p))return;
    const seen=s.occupants(p.location).filter(q=>q.id!==p.id&&present(s,q));
    for(const q of seen.slice(0,12)){const m=motive(s,p,q);if(m)add('civicOffence',m.kind==='theft'?'Рискнуть и украсть кошелёк':'Свести счёты с обидчиком',m.score,motives[m.motive]+'; стража, свидетели и наказание повышают риск.',[step('civicOffence',p.location,m.kind==='theft'?'Попытаться совершить кражу':'Затеять драку',{duration:m.kind==='theft'?10:15,personId:q.id,offence:m.kind,motive:m.motive})]);}
  }
  function execute(s,p,step){
    const v=ensure(s),a=person(p);if(s.conclusion||!present(s,p)||p.location!==step.target)return{ok:false,message:'Действие требует личного присутствия.'};
    if(step.kind==='civicService'){if(step.target!=='hall'||a.service<=0)return{ok:false,message:'Общественные работы уже выполнены.'};a.service=Math.max(0,a.service-90);a.heat=Math.max(0,a.heat-12);p.reputation=clamp(p.reputation+1);note(s,'service',p,null,`${p.name} выполнил 90 минут общественных работ. Осталось ${a.service} мин.`);return{ok:true};}
    const q=s.person(step.personId),m=q&&motive(s,p,q);if(!m||m.kind!==step.offence||m.motive!==step.motive)return{ok:false,message:'Обстоятельства изменились: человек ушёл или мотив исчез.'};
    a.nextCrime=s.now+3*1440;a.offences++;a.lastMotive=motives[m.motive];
    const witnesses=s.occupants(p.location).filter(r=>r.id!==p.id&&r.id!==q.id&&present(s,r)).map(r=>r.id).slice(0,8),success=m.kind==='brawl'||s.random()<clamp(.65-(s.government.guard||1)*.12-p.civic.heat*.002,.25,.75);
    let amount=0;if(m.kind==='theft'){v.totals.thefts++;if(success){amount=Math.min(12,Math.max(0,q.coins-12),3+p.mind.personality.ambition*7);q.coins-=amount;p.coins+=amount;v.totals.stolen+=amount;const g=group(s,p),mate=g&&s.occupants(p.location).find(r=>r.id!==p.id&&g.members.includes(r.id)&&present(s,r));if(mate){const share=amount*.25;p.coins-=share;mate.coins+=share;g.lastAt=s.now;}}}
    else{v.totals.brawls++;q.health=clamp(q.health-4);p.health=clamp(p.health-2);}
    const reported=!success||m.kind==='brawl'||witnesses.length>0||s.random()<.55;
    const c={id:v.nextId++,actorId:p.id,victimId:q.id,kind:m.kind,motive:m.motive,buildingId:p.location,day:s.day,at:s.now,amount,recovered:0,fine:0,witnesses,reported,status:'open',resolvedDay:null};v.cases.unshift(c);v.cases=[...v.cases.filter(c=>c.status==='open'),...v.cases.filter(c=>c.status!=='open').slice(0,60)];
    if(success)P.event(s,q,'victim',p.id,(m.kind==='theft'?'Пострадал от кражи: ':'Пострадал в драке: ')+p.name,24);
    if(reported){a.heat=clamp(a.heat+15);S.change(s,q,p,-25,'Подозрение в правонарушении');q.civic.fear=clamp(q.civic.fear+18);}
    note(s,m.kind,p,q,`${p.name}: ${m.kind==='theft'?success?'украл '+amount.toFixed(1)+' тал. у '+q.name:'попытался обокрасть '+q.name:'затеял драку с '+q.name}. Мотив: ${motives[m.motive].toLowerCase()}. ${reported?'Стража получила сообщение.':'Свидетелей не нашлось.'}`,true);
    return{ok:success,message:success?'Правонарушение совершено; сохраняется риск расследования.':'Попытку заметили.'};
  }
  function sentence(s,c){
    const v=ensure(s),p=s.person(c.actorId),q=s.person(c.victimId);if(c.status!=='open'||!p?.alive)return false;
    P.event(s,p,'punished',q?.id??null,'Наказание за правонарушение',22);c.status='solved';c.resolvedDay=s.day;v.totals.solved++;const a=person(p),refund=q?.alive?Math.min(c.amount,Math.max(0,p.coins-12)):0;p.coins-=refund;if(q)q.coins+=refund;c.recovered=refund;v.totals.recovered+=refund;
    const due=c.kind==='brawl'?12:8,fine=Math.min(due,Math.max(0,p.coins-12));p.coins-=fine;if(fine)s.changeTreasury(fine,'crimeFines');c.fine=fine;v.totals.fines+=fine;a.fineDue+=due-fine;a.service+=c.kind==='brawl'?180:90;a.heat=clamp(a.heat+12);p.reputation=clamp(p.reputation-8);
    s.remember(p,'punishment','hall','Стража раскрыла правонарушение: штраф и общественные работы.',-10);L.observe(s,p,{goal:'civicOffence',title:'Риск правонарушения',steps:[]},false,'Расследование завершилось наказанием');
    note(s,'justice',p,q,`${p.name}: дело раскрыто. Возмещено ${refund.toFixed(1)} тал., уплачено штрафа ${fine.toFixed(1)} из ${due}; назначены общественные работы.`,true);return true;
  }
  function daily(s){
    const v=ensure(s);if(v.lastDay>=s.day||s.conclusion)return;v.lastDay=s.day;
    for(const p of s.alive){const a=person(p);a.heat=Math.max(0,a.heat-.8);a.fear=Math.max(0,a.fear-3);const payment=Math.min(a.fineDue,Math.max(0,p.coins-60),2);if(payment){p.coins-=payment;a.fineDue-=payment;s.changeTreasury(payment,'crimeFines');v.totals.fines+=payment;}}
    for(const c of v.cases.filter(c=>c.status==='open'&&s.day>c.day)){const p=s.person(c.actorId);if(!p.alive||s.day-c.day>10){c.status='closed';c.resolvedDay=s.day;continue;}if(c.reported&&!p.absence&&s.random()<clamp(.1*(s.government.guard||1)+c.witnesses.length*.09,.05,.65))sentence(s,c);}
    for(const g of v.groups.filter(g=>g.active)){const members=g.members.map(id=>s.person(id)),live=members.filter(p=>p?.alive);for(const p of members)if(p&&!p.alive)person(p).gangId=null;g.members=live.map(p=>p.id);if(live.length<2||s.now-g.lastAt>30*1440){g.active=false;for(const p of live)person(p).gangId=null;}else if(!live.some(p=>p.id===g.leaderId))g.leaderId=live[0].id;}
    v.days.push({day:s.day,thefts:v.totals.thefts,brawls:v.totals.brawls,solved:v.totals.solved,aid:v.totals.aid,meetings:v.totals.meetings});v.days=v.days.slice(-90);
  }
  function load(s){const v=ensure(s);if(v.version!==1||!['sinceDay','lastDay','nextId','nextGang'].every(k=>finite(v[k]))||v.lastDay>s.day||!Object.values(v.totals).every(finite)||!Array.isArray(v.cases)||v.cases.length>100||!Array.isArray(v.groups)||v.groups.length>24||!Array.isArray(v.history)||v.history.length>80||!Array.isArray(v.days)||v.days.length>90)throw Error('Некорректная социальная жизнь');
    if(!Number.isInteger(v.nextId)||!Number.isInteger(v.nextGang)||v.nextId<=Math.max(0,...v.cases.map(c=>c.id))||v.nextGang<=Math.max(0,...v.groups.map(g=>g.id))||v.sinceDay>s.day||!['meetings','aid','mentoring','reconciled','thefts','brawls','stolen','recovered','fines','solved'].every(k=>finite(v.totals[k]))||v.history.some(h=>!labels[h.kind]||!s.person(h.personId)||h.otherId!==null&&!s.person(h.otherId)||!finite(h.at)||h.at>s.now||!finite(h.day)||h.day>s.day||typeof h.text!=='string')||v.days.some(d=>!['day','thefts','brawls','solved','aid','meetings'].every(k=>finite(d[k]))||d.day>s.day))throw Error('Некорректная хроника социальной жизни');
    if(new Set(v.cases.map(c=>c.id)).size!==v.cases.length||v.cases.some(c=>!s.person(c.actorId)||!s.person(c.victimId)||!s.building(c.buildingId)||!['theft','brawl'].includes(c.kind)||!motives[c.motive]||!['open','solved','closed'].includes(c.status)||!['id','at','day','amount','recovered','fine'].every(k=>finite(c[k]))||c.recovered>c.amount||c.day>s.day||typeof c.reported!=='boolean'||!Array.isArray(c.witnesses)||c.witnesses.some(id=>!s.person(id))))throw Error('Некорректное дело стражи');
    for(const g of v.groups)if(!Number.isInteger(g.id)||!s.person(g.leaderId)||typeof g.name!=='string'||typeof g.active!=='boolean'||!finite(g.formed)||!finite(g.lastAt)||!Array.isArray(g.members)||g.members.length>6||new Set(g.members).size!==g.members.length||g.members.some(id=>!s.person(id)))throw Error('Некорректная уличная компания');
    for(const p of s.people){const a=person(p);if(!['nextCrime','nextMeeting','offences','heat','fear','service','fineDue'].every(k=>finite(a[k]))||a.heat>100||a.fear>100||a.gangId!==null&&!v.groups.some(g=>g.active&&g.id===a.gangId&&g.members.includes(p.id)))throw Error('Некорректная социальная история жителя');for(const x of p.plan?.steps||[])if(x.kind==='civicOffence'&&(!s.person(x.personId)||!motives[x.motive]||!['theft','brawl'].includes(x.offence)))throw Error('Некорректный социальный план');}
  }
  const api={labels,motives,person,ensure,encounter,gangMeeting,motive,candidates,execute,sentence,daily,load,group};if(node)module.exports=api;else root.DanzigCivic=api;
})(typeof window!=='undefined'?window:globalThis);
