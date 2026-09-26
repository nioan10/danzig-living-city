(function(root){
  'use strict';
  const publicTypes=['hall','school','clinic','church','dock'],sum=o=>Object.values(o||{}).reduce((n,v)=>n+v,0),round=n=>Math.round(n*100)/100;
  function ensure(s){s.fiscal.spending??={sinceDay:s.day||0,plan:null,history:[],wages:[]};return s.fiscal.spending;}
  function protectedCash(s){
    const bill=s.regionBill(),progress=Math.max(0,Math.min(1,(s.region.period-Math.max(0,s.region.nextDay-s.day)+1)/s.region.period));
    return(bill+Math.min(s.region.debt,bill*.5))*progress;
  }
  function recordWage(s,b,amount){if(!b||!publicTypes.includes(b.type))return;const v=ensure(s);let row=v.wages.find(r=>r.day===s.day);if(!row){row={day:s.day,buildings:{}};v.wages.push(row);v.wages=v.wages.slice(-7);}row.buildings[b.id]=(row.buildings[b.id]||0)+amount;}
  function wageNeed(s,b){const v=ensure(s),days=Math.min(6,Math.max(0,s.day-v.sinceDay)),paid=v.wages.filter(r=>r.day>=s.day-6&&r.day<s.day).reduce((n,r)=>n+(r.buildings[b.id]||0),0);return days?paid/days:s.workers(b.id).length*b.wage*6;}
  const operatingReserve=(s,b)=>Math.max(12,wageNeed(s,b)*2);
  function serviceRequests(s){return s.buildings.filter(b=>publicTypes.includes(b.type)&&!b.construction).map(b=>({id:b.id,wanted:Math.max(0,operatingReserve(s,b)-b.cash),paid:0}));}
  function prepare(s,forecast,upkeep){
    const v=ensure(s);if(v.plan?.day===s.day)return v.plan;
    const property=s.fiscal.property,oldProperty=(forecast.income.property||0)/Math.max(1,forecast.days),income=Math.max(0,(sum(forecast.income)-(forecast.income.custom||0)-(forecast.income.marketRepayment||0))/Math.max(1,forecast.days)-oldProperty+(property.latest?.day===s.day?property.latest.paid:oldProperty));
    const regionalDaily=s.regionBill()/s.region.period,debtDaily=Math.min(s.region.debt/30,regionalDaily*.5),reserve=protectedCash(s),cushion=Math.max(0,s.treasury-reserve-Math.max(80,income*3))/6;
    const envelope=Math.min(Math.max(0,s.treasury-reserve),Math.max(0,income-regionalDaily-debtDaily-(forecast.expenses.administration||0)/Math.max(1,forecast.days))+cushion),services=serviceRequests(s),hungry=s.alive.filter(p=>p.hunger<30).length;
    const need={services:sum(services.map(r=>r.wanted)),food:s.food<s.alive.length*1.5?60-Math.min(48,Math.max(0,s.building('market').cash-80)):s.building('church').stock.bread<10?15:0,infrastructure:upkeep+Math.min(s.fiscal.infrastructure.arrears,upkeep*.25),repair:s.buildings.filter(b=>b.damaged&&s.day-b.damageDay>=3).length*20};
    // Essential services and food share a tight envelope. Repairs get the remainder.
    const weights={services:1.2,food:hungry>Math.max(2,s.alive.length*.1)?2:1,infrastructure:1,repair:.3},limits=Object.fromEntries(Object.keys(need).map(k=>[k,0]));let remaining=envelope;
    for(let pass=0;pass<4&&remaining>1e-8;pass++){const keys=Object.keys(need).filter(k=>limits[k]+1e-8<need[k]),weight=keys.reduce((n,k)=>n+weights[k],0);if(!weight)break;const pool=remaining;for(const k of keys){const allocated=Math.min(need[k]-limits[k],pool*weights[k]/weight);limits[k]+=allocated;remaining-=allocated;}}
    const actor=s.governmentOfficer?.('treasurer')||s.person(s.mayorId),reason=income<regionalDaily+debtDaily+sum(need)?'Потребности превышают прогноз доходов. Сокращаю выплаты, сохраняю средства на регион; помощь и работа служб приоритетны.':'Доходы и свободный запас покрывают план. Финансирую обоснованные заявки служб и содержание города.';
    v.plan={day:s.day,personId:actor?.id||null,income,regionalDaily,debtDaily,reserve,envelope,need,limits,spent:{services:0,food:0,infrastructure:0,repair:0},services,reason};
    v.history.unshift({day:s.day,income,envelope,reserve,reason});v.history=v.history.slice(0,30);
    if(s.day%6===0)s.log(`${actor?.name||'Ратуша'}: бюджет дня ${round(envelope)} тал., защищено на регион ${round(reserve)} тал. ${reason}`,'politics',actor?.id,{title:'Ратуша распределила бюджет',buildingId:'hall'});
    return v.plan;
  }
  function allowance(s,key){const p=ensure(s).plan;if(!p||p.day!==s.day)return Math.max(0,s.treasury-Math.max(60,protectedCash(s)));return Math.max(0,Math.min(p.limits[key]-p.spent[key],s.treasury-protectedCash(s)));}
  function spend(s,key,amount,category=key){const actual=Math.min(Math.max(0,amount),allowance(s,key));if(!actual)return 0;const paid=s.changeTreasury(-actual,category),p=ensure(s).plan;if(p?.day===s.day)p.spent[key]+=paid;return paid;}
  function services(s){const p=ensure(s).plan,requests=serviceRequests(s),wanted=sum(requests.map(r=>r.wanted)),available=Math.min(wanted,allowance(s,'services'));if(!wanted)return;for(const r of requests){const paid=spend(s,'services',available*r.wanted/wanted);s.building(r.id).cash+=paid;if(p?.day===s.day){const row=p.services.find(q=>q.id===r.id);if(row)row.paid+=paid;}}}
  function repair(s){for(const b of s.buildings.filter(b=>b.damaged&&s.day-b.damageDay>=3)){if(allowance(s,'repair')+1e-8<20)break;spend(s,'repair',20);b.damaged=false;b.repairWork=0;s.log('Мастера восстановили '+b.name+'.','economy',null,{buildingId:b.id});}}
  function food(s){if(!s.commerce.outside.importEnabled||s.incidents.some(e=>e.type==='blockade'&&e.status==='active'))return;
    if(s.food<s.alive.length*1.5){const market=s.building('market'),contribution=Math.min(48,Math.max(0,market.cash-80)),net=60-contribution,paid=spend(s,'food',net);if(paid>0){const fraction=paid/net,repayment=contribution*fraction;market.cash-=repayment;s.changeTreasury(repayment,'marketRepayment');s.changeTreasury(-repayment,'food');market.stock.bread+=80*fraction;s.building('church').stock.bread+=20*fraction;s.log(`Ратуша закупила ${round(100*fraction)} порций еды. Город заплатил ${round(paid)} тал., лавка — ${round(repayment)} тал.`,'food',null,{buildingId:'market'});}}
    const church=s.building('church');if(church.stock.bread<10){const paid=spend(s,'food',15);church.stock.bread+=paid/15*20;}
  }
  function load(s){const v=ensure(s),finite=n=>Number.isFinite(n)&&n>=0;if(!finite(v.sinceDay)||!Array.isArray(v.history)||!Array.isArray(v.wages))throw Error('Некорректный бюджет ратуши');for(const r of v.wages)if(!finite(r.day)||!r.buildings||!Object.entries(r.buildings).every(([id,n])=>s.building(id)&&finite(n)))throw Error('Некорректные расходы служб');const p=v.plan;if(p&&(!['day','income','regionalDaily','debtDaily','reserve','envelope'].every(k=>finite(p[k]))||!['limits','spent','need'].every(k=>p[k]&&['services','food','infrastructure','repair'].every(c=>finite(p[k][c])))||!Array.isArray(p.services)||!p.services.every(r=>s.building(r.id)&&finite(r.wanted)&&finite(r.paid))))throw Error('Некорректный план расходов');}
  const api={ensure,protectedCash,recordWage,wageNeed,operatingReserve,prepare,allowance,spend,services,repair,food,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigCityBudget=api;
})(typeof window!=='undefined'?window:globalThis);
