(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports,Social=node?require('./social-life.js'):root.DanzigSocial;
  const TERM=24,DAY=1440;
  const living=(s,id)=>{const p=s.person(id);return p?.alive&&!p.absence&&p.age>=18?p:null;};
  const level=s=>s.building('hall').development?.level||1;
  const rank=(s,key)=>key==='mayor'?0:['judge','treasurer'].includes(key)?(level(s)===1?1:1):2;
  let officeSpecs={};
  const specs=()=>officeSpecs;
  function keys(s){return ['mayor',...Object.keys(specs(s)).filter(k=>specs(s)[k].level<=level(s))];}
  function holder(s,key){return key==='mayor'?living(s,s.mayorId):living(s,s.government.offices[key]?.personId);}
  function ensure(s){const g=s.government;g.electoral??={version:1,nextId:1,active:[],archive:[],next:{},bootstrapped:false};return g.electoral;}
  function electors(s,key){const names=key==='mayor'?keys(s).filter(k=>k!=='mayor'):rank(s,key)===1?['mayor']:['judge','treasurer'];return [...new Set(names.map(k=>holder(s,k)?.id).filter(Boolean))];}
  function seat(s,p){return keys(s).find(k=>holder(s,k)?.id===p.id);}
  function eligible(s,p,key){return !!(p?.alive&&!p.absence&&p.age>=25&&(!seat(s,p)||rank(s,seat(s,p))>=rank(s,key)));}
  function preference(s,voter,candidate,key){
    const v=voter.mind?.personality||{},c=candidate.mind?.personality||{},trust=Social.trust(s,voter,candidate),kin=Social.kin(voter,candidate),fit=key==='treasurer'?(c.thrift||.5):key==='judge'?(c.empathy||.5):key==='captain'?(c.diligence||.5):(c.ambition||.5);
    const factors=[{name:'Доверие',value:trust*.55},{name:'Семейная лояльность',value:kin?(v.family||.5)*28:0},{name:'Известная репутация',value:candidate.reputation*.18},{name:'Подход к обязанностям',value:fit*14},{name:'Сходство взглядов',value:(1-Math.abs((v.thrift||.5)-(c.thrift||.5)))*9}];
    if(voter.id===candidate.id)factors.push({name:'Собственные амбиции',value:(v.ambition||.5)*12});
    return {score:factors.reduce((n,f)=>n+f.value,0),reason:factors.sort((a,b)=>b.value-a.value).slice(0,2).map(f=>f.name).join(', ')};
  }
  function apply(s,key,p,acting=false){
    const g=s.government,v=ensure(s),previous=seat(s,p);
    if(previous&&previous!==key){if(previous==='mayor')s.mayorId=null;else g.offices[previous].personId=null;v.next[previous]=s.day;}
    if(key==='mayor'){const old=s.person(s.mayorId);if(old&&old.id!==p.id&&old.jobId==='hall'){old.jobId=null;old.role='Ищет ремесло';old.plan=null;}s.mayorId=p.id;p.jobId='hall';p.role='Бургомистр';p.plan=null;g.mayorSeat={personId:p.id,sinceDay:s.day,acting};}
    else g.offices[key]={personId:p.id,sinceDay:s.day,acting,decision:g.offices[key]?.decision||null};
    v.next[key]=s.day+(acting?4:TERM);s.recordGovernment(key,p,acting?'Временное исполнение до выборов.':'Получен мандат после личного голосования выборщиков.');
  }
  function caretaker(s,key){
    const g=s.government,v=ensure(s),ids=electors(s,key),voter=ids.map(id=>living(s,id)).find(Boolean)||keys(s).map(k=>holder(s,k)).find(Boolean)||s.alive.filter(p=>p.age>=25&&!p.absence).sort((a,b)=>a.id-b.id)[0];
    if(!voter)return;
    const used=new Set(keys(s).filter(k=>k!==key).map(k=>holder(s,k)?.id)),pool=s.alive.filter(p=>eligible(s,p,key)&&!used.has(p.id));
    pool.sort((a,b)=>preference(s,voter,b,key).score-preference(s,voter,a,key).score||a.id-b.id);const p=pool[0];if(!p)return;
    apply(s,key,p,true);g.history.unshift({at:s.now,office:key,personId:p.id,text:'Временное поручение; выборщик '+voter.name+'. '+preference(s,voter,p,key).reason,caretaker:true,voterId:voter.id});v.next[key]=s.day+(v.bootstrapped?1:4);
  }
  function appoint(s){
    const v=ensure(s);for(const key of keys(s))if(!holder(s,key))caretaker(s,key);
    if(!v.bootstrapped){v.bootstrapped=true;for(const [i,key]of keys(s).entries())v.next[key]??=s.day+4+i*2;v.next.mayor??=s.day+4;}
    s.government.nextElection=Math.min(...Object.values(v.next));
  }
  function open(s,key){
    if(s.conclusion||!keys(s).includes(key))return null;const v=ensure(s);if(v.active.some(e=>e.office===key))return null;
    const ids=electors(s,key);if(!ids.length){v.next[key]=s.day+2;return null;}
    const e={id:v.nextId++,office:key,stage:'registration',opened:s.now,until:s.now+2*DAY,electors:ids,candidates:[],ballots:[],round:1,status:'active',winner:null,reason:''};v.active.push(e);return e;
  }
  function nominate(s,p,e){if(e?.status!=='active'||e.stage!=='registration'||s.now>=e.until||!eligible(s,p,e.office)||p.location!=='hall'||e.candidates.includes(p.id)||ensure(s).active.some(q=>q.id!==e.id&&q.candidates.includes(p.id)))return {ok:false,message:'Регистрация недоступна.'};e.candidates.push(p.id);return {ok:true};}
  function cast(s,p,e){
    if(e?.status!=='active'||e.stage!=='ballot'||s.now>=e.until||!e.electors.includes(p.id)||!living(s,p.id)||p.location!=='hall'||e.ballots.some(b=>b.round===e.round&&b.voterId===p.id))return {ok:false,message:'Голосование недоступно.'};
    const choices=e.candidates.map(id=>s.person(id)).filter(q=>eligible(s,q,e.office)).map(q=>({p:q,...preference(s,p,q,e.office)})).sort((a,b)=>b.score-a.score||a.p.id-b.p.id),choice=choices[0];e.ballots.push({at:s.now,round:e.round,voterId:p.id,candidateId:choice?.p.id||null,reason:choice?.reason||'Нет подходящего живого кандидата; воздержался.'});return {ok:true};
  }
  function finish(s,e,p,reason){const v=ensure(s);e.status=p?'elected':'postponed';e.stage='closed';e.winner=p?.id||null;e.closed=s.now;e.reason=reason;if(p){apply(s,e.office,p);s.log((specs(s)[e.office]?.name||'Бургомистр')+': избран '+p.name+'. '+reason,'politics',p.id,{title:'Результат выборов',buildingId:'hall'});}else v.next[e.office]=s.day+3;v.active=v.active.filter(q=>q.id!==e.id);v.archive.unshift(e);v.archive=v.archive.slice(0,80);}
  function tally(s,e){
    const live=e.electors.filter(id=>living(s,id)),ballots=e.ballots.filter(b=>b.round===e.round&&live.includes(b.voterId)),valid=ballots.filter(b=>eligible(s,s.person(b.candidateId),e.office)),quorum=Math.ceil(e.electors.length/2);
    if(ballots.length<quorum||!valid.length){finish(s,e,null,'Нет кворума или действительных голосов; назначено повторное заседание.');return;}
    const count=new Map();for(const b of valid)count.set(b.candidateId,(count.get(b.candidateId)||0)+1);const ranked=[...count].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
    if(ranked[0][1]>valid.length/2){finish(s,e,s.person(ranked[0][0]),`${ranked[0][1]} из ${valid.length} действительных голосов.`);return;}
    if(e.round<3){e.candidates=ranked.slice(0,2).map(r=>r[0]);e.round++;e.until=s.now+2*DAY;return;}
    const tied=ranked.filter(r=>r[1]===ranked[0][1]);const winner=s.person(tied[Math.floor(s.random()*tied.length)][0]);finish(s,e,winner,'После повторного равенства проведён публичный жребий.');
  }
  function tick(s){
    if(s.conclusion)return;const v=ensure(s);for(const e of [...v.active])if(s.now>=e.until){if(e.stage==='registration'){e.candidates=e.candidates.filter(id=>eligible(s,s.person(id),e.office));if(!e.candidates.length){finish(s,e,null,'Никто не зарегистрировался.');continue;}e.stage='ballot';e.until=s.now+2*DAY;}else tally(s,e);}
  }
  function daily(s){appoint(s);const v=ensure(s);for(const key of keys(s))if(s.day>=(v.next[key]??0)&&!v.active.some(e=>e.office===key))open(s,key);tick(s);}
  function candidates(s,p,add,step){
    if(p.age<25||p.absence||s.hour<8||s.hour>=19||p.hunger<15||p.energy<9)return;const v=ensure(s);
    for(const e of v.active){if(e.stage==='ballot'&&e.electors.includes(p.id)&&!e.ballots.some(b=>b.round===e.round&&b.voterId===p.id)){add('civicVote','Проголосовать в ратуше',105,'Я выборщик; коллегия ждёт моего личного голоса.',[step('civicVote','hall','Принять участие в заседании',{duration:20,electionId:e.id})]);return;}}
    const ambition=p.mind?.personality?.ambition||.5;for(const e of v.active)if(e.stage==='registration'&&eligible(s,p,e.office)&&!e.candidates.includes(p.id)&&!v.active.some(q=>q.candidates.includes(p.id))){add('civicNominate','Подать кандидатуру',42+ambition*34+(seat(s,p)===e.office?15:0),'Хочу получить мандат и влиять на город.',[step('civicNominate','hall','Зарегистрировать кандидатуру',{duration:25,electionId:e.id})]);return;}
  }
  function execute(s,p,step){const e=ensure(s).active.find(q=>q.id===step.electionId);return step.kind==='civicVote'?cast(s,p,e):nominate(s,p,e);}
  function load(s){
    const v=ensure(s),finite=n=>Number.isFinite(n)&&n>=0,id=n=>Number.isInteger(n)&&!!s.person(n);
    if(v.version!==1||!Number.isInteger(v.nextId)||v.nextId<1||!Array.isArray(v.active)||!Array.isArray(v.archive)||!v.next||typeof v.bootstrapped!=='boolean'||Object.entries(v.next).some(([k,n])=>k!=='mayor'&&!specs(s)[k]||!finite(n)))throw Error('Некорректное расписание выборов');
    const serial=new Set();for(const e of [...v.active,...v.archive]){if(!Number.isInteger(e.id)||e.id<1||serial.has(e.id)||e.id>=v.nextId||e.office!=='mayor'&&!specs(s)[e.office]||!['registration','ballot','closed'].includes(e.stage)||!['active','elected','postponed'].includes(e.status)||!finite(e.opened)||!finite(e.until)||!Array.isArray(e.electors)||!e.electors.every(id)||new Set(e.electors).size!==e.electors.length||!Array.isArray(e.candidates)||!e.candidates.every(id)||new Set(e.candidates).size!==e.candidates.length||!Number.isInteger(e.round)||e.round<1||e.round>3||!Array.isArray(e.ballots)||e.ballots.some(b=>!id(b.voterId)||!e.electors.includes(b.voterId)||b.candidateId!==null&&!id(b.candidateId)||!finite(b.at)||!Number.isInteger(b.round)||b.round<1||b.round>e.round)||new Set(e.ballots.map(b=>b.voterId+':'+b.round)).size!==e.ballots.length)throw Error('Некорректные бюллетени выборов');serial.add(e.id);}
    if(new Set(v.active.map(e=>e.office)).size!==v.active.length||v.active.some(e=>e.status!=='active'||e.stage==='closed')||v.archive.some(e=>e.status==='active'||e.stage!=='closed'))throw Error('Некорректные этапы выборов');
  }
  const api={configure:o=>{officeSpecs=o;},TERM,keys,rank,holder,seat,ensure,electors,eligible,preference,appoint,open,nominate,cast,tally,tick,daily,candidates,execute,load};if(node)module.exports=api;else root.DanzigElections=api;
})(typeof window!=='undefined'?window:globalThis);
