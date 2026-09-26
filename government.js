(function(root){
  'use strict';
  const OFFICES={
    treasurer:{name:'Казначей',level:2,power:'Налоги, сбор с дворов и ежедневный план расходов',trait:'Бережливый'},
    seneschal:{name:'Сенешаль',level:2,power:'Строительные разрешения и размер сбора за них',trait:'Амбициозный'},
    captain:{name:'Капитан стражи',level:2,power:'Расходы на стражу и противопожарный дозор',trait:'Трудолюбивый'},
    guildmaster:{name:'Гильдейский мастер',level:3,power:'Налог на прибыль мастерских',trait:'Добрый'},
    port:{name:'Портовый старшина',level:3,power:'Экспортная квота и продовольственный резерв',trait:'Бережливый'}
  };
  const hallLevel=s=>s.building('hall').development?.level||1;
  function ensure(s){s.government??={sinceDay:s.day,lastDay:s.day-1,nextElection:s.day,offices:{},manual:{},guard:1,history:[],stipends:0};return s.government;}
  function available(s,id){const p=s.person(id);return p?.alive&&!p.absence&&p.age>=18?p:null;}
  function officer(s,key){if(key==='mayor')return available(s,s.mayorId);return available(s,s.government?.offices[key]?.personId)||available(s,s.mayorId);}
  function record(s,key,p,text,announce=true){
    const v=ensure(s),row={at:s.now,office:key,personId:p?.id||null,text};v.history.unshift(row);v.history=v.history.slice(0,80);
    if(v.offices[key])v.offices[key].decision=row;
    if(announce)s.log(`${OFFICES[key]?.name||'Бургомистр'} ${p?.name||''}: ${text}`,'politics',p?.id,{title:'Решение магистрата',buildingId:'hall'});
  }
  function appoint(s){
    const v=ensure(s),term=s.day>=v.nextElection,used=new Set([s.mayorId]);
    // Existing officeholders keep their seat until the next election; a death or
    // mobilization creates an immediate vacancy, with a living substitute.
    for(const [key,spec]of Object.entries(OFFICES)){
      if(spec.level>hallLevel(s))continue;
      const old=v.offices[key],holder=old&&available(s,old.personId);
      if(!term&&holder&&!used.has(holder.id)){used.add(holder.id);continue;}
      const candidates=s.alive.filter(p=>p.age>=25&&!p.absence&&!used.has(p.id));
      const score=p=>p.reputation+p.skill*3+(p.traits.includes(spec.trait)?16:0)+(p.traits.includes('Общительный')?5:0)+(key==='guildmaster'&&p.guildId?10:0);
      candidates.sort((a,b)=>score(b)-score(a)||a.id-b.id);const p=candidates[0];
      v.offices[key]={personId:p?.id||null,sinceDay:s.day,decision:old?.decision||null};
      if(p){used.add(p.id);if(old?.personId!==p.id)record(s,key,p,'Совет поручил должность. Полномочия: '+spec.power+'.');}
    }
    if(term)v.nextElection=s.day+12;
  }
  function daily(s){
    const v=ensure(s);if(v.lastDay===s.day)return;v.lastDay=s.day;appoint(s);
    for(const [key,seat]of Object.entries(v.offices)){
      const p=available(s,seat.personId);if(!p||OFFICES[key].level>hallLevel(s))continue;
      // A part-time council allowance transfers existing city money to a person.
      const stipend=Math.min(.25,Math.max(0,s.treasury-Math.max(80,s.regionBill()+s.region.debt)));
      if(stipend){s.changeTreasury(-stipend,'administration');p.coins+=stipend;v.stipends+=stipend;}
      if(v.manual[key]||seat.decision&&s.now-seat.decision.at<3*1440)continue;
      if(key==='treasurer')continue; // Finance.daily performs this office's budget review.
      let text='',changed=false;
      if(key==='seneschal'){
        const cash=s.guilds.groups.reduce((n,g)=>n+g.cash,0)/Math.max(1,s.guilds.groups.length),rate=cash<350?3:p.traits.includes('Бережливый')?8:5;
        changed=s.guilds.permitRate!==rate;s.guilds.permitRate=rate;text=`Сбор за разрешение ${rate}%. ${cash<350?'У семей мало свободного капитала — облегчаю новые проекты.':'Гильдии могут участвовать в расходах на оформление земли.'}`;
      }
      if(key==='captain'){
        const fires=s.buildings.filter(b=>b.damaged).length,guard=s.treasury<140?.75:fires?1.4:1;
        changed=v.guard!==guard;v.guard=guard;text=`Дозор: ${Math.round(guard*100)}% обычного бюджета. ${guard<1?'Казна стеснена; сокращаю смены.':fires?'После пожаров усиливаю противопожарную стражу.':'Оставляю обычные смены.'}`;
      }
      if(key==='guildmaster'){
        const shops=s.buildings.filter(b=>b.enterprise&&!b.construction),loss=shops.filter(b=>b.enterprise.lastProfit<0).length,rate=loss>shops.length*.4?4:s.treasury<150?10:8;
        changed=s.guilds.profitRate!==rate;s.guilds.profitRate=rate;text=`Налог на прибыль ${rate}%. ${rate===4?'Многие мастерские убыточны: даю им восстановиться.':'Сверяю состояние мастерских с потребностями казны.'}`;
      }
      if(key==='port'){
        const c=s.commerce,scarce=s.food<s.alive.length*2,quota=scarce?65:p.traits.includes('Амбициозный')?100:85,reserve=scarce?3:2;
        changed=c.outside.quota!==quota||c.reserveDays!==reserve;c.outside.quota=quota;c.reserveDays=reserve;text=`Экспортная квота ${quota}%, резерв еды ${reserve} дня. ${scarce?'Прежде всего обеспечиваю горожан.':'Разрешаю вывоз, сохраняя запас для города.'}`;
      }
      if(text)record(s,key,p,text,changed);
    }
  }
  function setAutonomy(s,key,enabled){if(s.conclusion||!OFFICES[key])return{ok:false,message:'Нельзя изменить полномочия.'};ensure(s).manual[key]=!enabled;record(s,key,officer(s,key),enabled?'Самостоятельные решения возобновлены.':'Настройки закреплены вашим указом.');if(key==='treasurer'){s.fiscal.autoMayor=enabled;s.fiscal.property.auto=enabled;s.fiscal.property.nextReview=s.day+1;s.fiscal.nextReview=s.day+1;}return{ok:true,message:'Полномочия обновлены.'};}
  function load(s){ensure(s);const v=s.government,finite=n=>Number.isFinite(n)&&n>=0;
    if(!Number.isFinite(v.lastDay)||!finite(v.nextElection)||!finite(v.sinceDay)||!finite(v.stipends)||!Number.isFinite(v.guard)||v.guard<.5||v.guard>1.5||!Array.isArray(v.history)||!v.manual||!v.offices)throw Error('Некорректный магистрат');
    for(const[key,seat]of Object.entries(v.offices))if(!OFFICES[key]||seat.personId!==null&&!s.person(seat.personId)||!finite(seat.sinceDay))throw Error('Некорректная городская должность');
    for(const[key,value]of Object.entries(v.manual))if(!OFFICES[key]||typeof value!=='boolean')throw Error('Некорректные полномочия');
  }
  const api={OFFICES,hallLevel,ensure,officer,record,appoint,daily,setAutonomy,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigGovernment=api;
})(typeof window!=='undefined'?window:globalThis);
