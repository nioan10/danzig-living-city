(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports,H=node?require('./households.js'):root.DanzigHouseholds;
  // Game rules, not a reconstruction of historical municipal privileges.
  const ranks=[null,
    {name:'Бюргер',fee:150,reputation:35,hall:1,estate:'burgher',effect:'Городское право и сословие бюргеров'},
    {name:'Патриций',fee:600,reputation:55,hall:2,estate:'patrician',effect:'Патрициат и право селиться в дворянском квартале'},
    {name:'Дворянин',fee:2400,reputation:70,hall:2,estate:'noble',effect:'Переход в дворянское сословие'},
    {name:'Барон',fee:7200,reputation:85,hall:3,estate:'noble',effect:'Высший личный титул; сословие остаётся дворянским'}];
  const standing={common:0,artisan:0,burgher:1,patrician:2,noble:3};
  function person(p,existing=false){p.title??={rank:existing?(standing[p.estate]||0):0,source:existing?'existing':'none',day:null,paid:0,nextAt:0};return p.title;}
  function ensure(s){s.titles??={version:1,sinceDay:s.day,auto:true,fees:ranks.slice(1).map(r=>r.fee),revenue:0,granted:0,history:[]};for(const p of s.people)person(p,true);return s.titles;}
  function founders(s){ensure(s);for(const p of s.people)if(p.estate==='noble')Object.assign(p.title,{rank:3,source:'existing'});}
  function next(p){return Math.min(5,Math.max(person(p).rank+1,standing[p.estate]||1));}
  function assess(s,p,rank=next(p)){
    const v=s.titles||ensure(s),q=ranks[rank],t=person(p),fail=message=>({ok:false,rank,fee:q?v.fees[rank-1]:0,message});
    if(s.conclusion)return fail('История города завершена.');
    if(!q||!Number.isInteger(rank)||rank!==next(p))return fail('Ступень уже получена или недоступна: сначала предыдущий титул.');
    if(!p.alive||p.age<18||p.absence||p.arriving)return fail('Нужен совершеннолетний житель, находящийся в городе.');
    if(s.now<t.nextAt)return fail('После пожалования должно пройти 12 дней.');
    if((s.building('hall').development?.level||1)<q.hall)return fail('Нужна ратуша уровня '+q.hall+'.');
    if(p.reputation<q.reputation)return fail('Нужна репутация '+q.reputation+'.');
    if(!s.isOpen(s.building('hall')))return fail('Ратуша сейчас закрыта.');
    const fee=v.fees[rank-1];if(p.coins<fee+60)return fail('Нужно '+fee+' тал. и личный запас не менее 60 тал. после платежа.');
    const budget=H.budget(s,p),reserve=Math.max(60,budget.reserve+budget.expense*3);
    if(budget.coins-fee<reserve||budget.members.some(q=>q.hunger<45||q.health<35))return fail('Сначала обеспечить семью: здоровье, питание и запас на три дня.');
    return{ok:true,rank,fee,reserve,message:q.name+' · разовый взнос '+fee+' тал. в казну.'};
  }
  function desire(s,p){const a=p.mind?.personality?.ambition??.5,thrift=p.mind?.personality?.thrift??.5;return 28+a*44-thrift*16+(p.traits.includes('Амбициозный')?14:0);}
  function candidates(s,p,add,step){
    if(!s.titles?.auto||p.age<18||p.absence||s.hour<8||s.hour>=18)return;
    const rank=next(p),q=ranks[rank];if(!q||p.coins<s.titles.fees[rank-1]+60)return;
    const check=assess(s,p,rank);if(!check.ok)return;
    add('title','Получить титул «'+q.name+'»',desire(s,p),'Хочу повысить положение семьи. '+check.message+' После оплаты останется запас на жизнь.',[step('title','hall','Подать прошение и уплатить взнос',{duration:45,titleRank:rank})]);
  }
  function grant(s,p,rank){const check=assess(s,p,rank);if(!check.ok)return check;
    if(p.location!=='hall'||p.path.length)return{ok:false,message:'Для пожалования нужно лично прийти в ратушу.'};
    const v=s.titles,t=person(p),q=ranks[rank];p.coins-=check.fee;s.changeTreasury(check.fee,'titleFees');H.charge(s,p,'titleFee',check.fee);
    if(standing[p.estate]<standing[q.estate])p.estate=q.estate;
    p.reputation=Math.min(100,p.reputation+rank*2);
    if(p.plan?.goal==='title'){p.plan.titlePaid=check.fee;p.plan.titleBenefit=2+(p.mind?.personality?.ambition??.5)*6;}
    Object.assign(t,{rank,source:'purchased',day:s.day,paid:t.paid+check.fee,nextAt:s.now+12*1440});v.revenue+=check.fee;v.granted++;
    v.history.unshift({day:s.day,at:s.now,personId:p.id,rank,fee:check.fee});v.history=v.history.slice(0,80);
    s.log(`${p.name} получил титул «${q.name}» и внёс ${check.fee} тал. в казну.`,'politics',p.id,{title:'Пожалован новый титул',importance:'major',buildingId:'hall'});
    return{ok:true,message:check.message};
  }
  function configure(s,data){if(s.conclusion)return{ok:false,message:'История города завершена.'};const fees=ranks.slice(1).map((_,i)=>Number(data['fee'+(i+1)]));if(!fees.every(n=>Number.isInteger(n)&&n>=1&&n<=100000)||fees.some((n,i)=>i&&n<fees[i-1]))return{ok:false,message:'Укажите целые взносы от 1 до 100 000 тал.; каждая следующая ступень не дешевле предыдущей.'};const v=ensure(s);v.fees=fees;v.auto=data.auto===true;return{ok:true,message:'Взносы утверждены для будущих пожалований. Полученные титулы не оплачиваются повторно.'};}
  function inherit(s,p){const parents=p.parents.map(id=>s.person(id)).filter(Boolean).sort((a,b)=>(standing[b.estate]||0)-(standing[a.estate]||0));if(parents[0])p.estate=parents[0].estate;person(p);}
  function load(s){const v=ensure(s),finite=n=>Number.isFinite(n)&&n>=0;if(v.version!==1||typeof v.auto!=='boolean'||!['sinceDay','revenue','granted'].every(k=>finite(v[k]))||v.sinceDay>s.day||!Array.isArray(v.fees)||v.fees.length!==4||!v.fees.every((n,i)=>Number.isInteger(n)&&n>=1&&n<=100000&&(!i||n>=v.fees[i-1]))||!Array.isArray(v.history)||v.history.length>80||!v.history.every(r=>Number.isInteger(r.rank)&&ranks[r.rank]&&s.person(r.personId)&&finite(r.day)&&r.day<=s.day&&finite(r.at)&&r.at<=s.now&&finite(r.fee)))throw Error('Некорректный реестр титулов');
    for(const p of s.people){const t=person(p);if(!Number.isInteger(t.rank)||t.rank<0||t.rank>4||!['existing','none','purchased'].includes(t.source)||!(t.day===null||finite(t.day)&&t.day<=s.day)||!finite(t.paid)||!finite(t.nextAt)||standing[p.estate]<(t.rank===4?3:t.rank))throw Error('Некорректный титул жителя');for(const step of p.plan?.steps||[])if(step.kind==='title'&&(!Number.isInteger(step.titleRank)||!ranks[step.titleRank]||step.target!=='hall'))throw Error('Некорректное прошение о титуле');}
  }
  const api={ranks,standing,person,ensure,founders,next,assess,candidates,grant,configure,inherit,load};if(node)module.exports=api;else root.DanzigTitles=api;
})(typeof window!=='undefined'?window:globalThis);
