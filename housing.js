(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports,W=node?require('./world.js'):root.DanzigWorld;
  const R=node?require('./residences.js'):root.DanzigResidences;
  const estates={common:'Простолюдины',artisan:'Ремесленники',burgher:'Бюргеры',patrician:'Патриции',noble:'Дворяне'};
  const district=b=>W.Layout.districts[b?.district||W.Layout.districtAt(b?.x||0,b?.y||0)];
  function ensure(s){R.ensure(s);s.housing??={moves:0,history:[]};s.housing.land??={sinceDay:s.day,lastDay:s.day,paid:0,relief:0,days:[]};for(const p of s.people)p.estate??=s.person(p.parents?.[0])?.estate||district(s.building(p.homeId)).estate;return s.housing;}
  function rent(s,p,b=s.building(p.homeId)){return p.age<16||p.absence||!b||b.construction||b.damaged||b.closedUntil>s.now?0:district(b).rent*R.spec(b).rent*(1+((b.development?.level||1)-1)*.25);}
  function collectRent(s){const v=ensure(s).land;if(v.lastDay>=s.day)return;v.lastDay=s.day;let paid=0,relief=0;for(const p of s.alive){const due=rent(s,p),actual=Math.min(due,Math.max(0,p.coins-12));p.coins-=actual;paid+=actual;relief+=due-actual;p.landRent={day:s.day,due,paid:actual,relief:due-actual};if(actual)s.recordHousingExpense?.(p,actual);}if(paid)s.changeTreasury(paid,'landRent');v.paid+=paid;v.relief+=relief;v.days.push({day:s.day,paid,relief});v.days=v.days.slice(-60);}
  function affordable(s,p,group,b){return (s.propertyAccess?.(p,group,b)??true)&&R.eligible(b,group)&&(district(b).estate!=='noble'||['noble','patrician'].includes(p.estate)||p.reputation>=60&&group.reduce((n,q)=>n+q.coins,0)>=300);}
  const room=b=>b?.type==='home'&&!b.construction?R.spec(b).capacity+((b.development?.level||1)-1)*3+(b.development?.extras.includes(3)?2:0):0;
  // Capacity is a comfort target. Above 150% the cost grows quadratically.
  function pressure(present,capacity){const ratio=capacity>0?present/capacity:0,excess=Math.max(0,ratio-1),penalty=Math.min(100,Math.round(18*excess+24*Math.max(0,excess-.5)**2));return {ratio,penalty,restFactor:Math.max(.35,1-penalty*.0065),severity:ratio>2?'Критическая теснота':ratio>5/3?'Сильная теснота':ratio>1?'Теснота':'Места достаточно'};}
  const admissionLimit=capacity=>Math.floor(capacity*5/3);
  const relief=(old,dest,size,occupied,source=old.members.length)=>old.present>old.capacity*2&&source>old.capacity*2&&occupied+size<=admissionLimit(dest.capacity)&&(occupied+size)/dest.capacity<=source/old.capacity-.5;
  function conditions(row){return row.penalty?`${row.severity}: −${row.penalty} к целевому довольству; восстановление сил дома ${Math.round(row.restFactor*100)}% от обычного.`:'Места достаточно; отдых без штрафа.';}
  function census(s){
    const rows=new Map(s.buildings.filter(b=>b.type==='home').map(b=>[b.id,{b,capacity:room(b),members:[],present:0,penalty:0}]));
    for(const p of s.people)if(p.alive){const row=rows.get(p.homeId);if(row){row.members.push(p);if(p.absence?.status!=='away')row.present++;}}
    for(const row of rows.values())Object.assign(row,pressure(row.present,row.capacity));
    return rows;
  }
  const capacity=s=>s.buildings.reduce((n,b)=>n+room(b),0);
  function family(s,p){const spouse=s.person(p.spouseId),adults=[p];if(spouse?.alive&&spouse.homeId===p.homeId)adults.push(spouse);const ids=adults.map(q=>q.id);return [...adults,...s.living.filter(q=>q.age<16&&q.homeId===p.homeId&&!ids.includes(q.id)&&q.parents.some(id=>ids.includes(id)))];}
  const available=group=>group.every(p=>!p.absence&&!p.arriving&&!p.relocation&&!p.cargo&&!p.householdParcel&&!p.constructionCargo);
  function review(s){
    ensure(s);const rows=census(s),reserved=new Map([...rows].map(([id,r])=>[id,r.members.length]));
    for(const p of s.living)p.housingWish=null;
    for(const row of rows.values()){
      const leaders=row.members.filter(p=>p.age>=18&&!p.absence&&!p.arriving&&!p.relocation&&(!s.person(p.spouseId)?.alive||s.person(p.spouseId).homeId!==p.homeId||p.id<p.spouseId));
      for(const p of leaders){
        const group=family(s,p),cramped=reserved.get(row.b.id)>row.capacity,emergency=row.ratio>2&&reserved.get(row.b.id)>row.capacity*2,expensive=group.filter(q=>q.age>=16).every(q=>q.coins<24)&&district(row.b).rent*R.spec(row.b).rent>.2,prestige=!cramped&&group.reduce((n,q)=>n+q.coins,0)>600&&(p.mind?.personality?.ambition||0)>.65&&R.kind(row.b)!=='manor'&&group.some(q=>q.age>=18&&q.estate==='noble');
        if(!cramped&&!expensive&&!prestige||!available(group)||!emergency&&s.day-(p.lastRelocation??-100)<12)continue;
        const choices=[...rows.values()].filter(r=>r.b.id!==row.b.id&&s.isOpen(r.b)&&affordable(s,p,group,r.b)&&(!prestige||R.kind(r.b)==='manor')&&(!expensive||emergency||district(r.b).rent*R.spec(r.b).rent<district(row.b).rent*R.spec(row.b).rent)&&(r.capacity-reserved.get(r.b.id)>=group.length||relief(row,r,group.length,reserved.get(r.b.id),reserved.get(row.b.id))));
        const occupancy=r=>(reserved.get(r.b.id)+group.length)/r.capacity;
        choices.sort((a,b)=>Number(occupancy(a)>1)-Number(occupancy(b)>1)||(occupancy(a)>1?occupancy(a)-occupancy(b):0)||s.travelMinutes(p,a.b.id)-s.travelMinutes(p,b.b.id)+(district(a.b).rent-district(b.b).rent)*60||a.b.id.localeCompare(b.b.id));
        const dest=choices[0];p.housingWish={from:row.b.id,to:dest?.b.id||null,day:s.day,penalty:row.penalty,prestige,reason:emergency?'Критическая теснота: семье срочно нужно менее переполненное жильё.':prestige?'Хочу поселить дворянскую семью в поместье.':expensive?'Высокая земельная аренда: семье нужно более дешёвое жильё.':'Семье тесно: нужно больше места.',members:group.map(q=>q.id)};
        if(dest){reserved.set(dest.b.id,reserved.get(dest.b.id)+group.length);reserved.set(row.b.id,reserved.get(row.b.id)-group.length);}
      }
    }
  }
  function candidate(s,p,add,step){const wish=p.housingWish;if(!wish?.to||wish.from!==p.homeId||p.relocation||s.hour<6||s.hour>=21||p.hunger<15||p.energy<9||p.health<20)return;const preference=p.traits.includes('Замкнутый')?10:p.traits.includes('Общительный')?-5:0;add('relocate','Переехать в подходящий семье дом',Math.min(105,48+wish.penalty*2)+preference,wish.reason||'Семье нужно более просторное жильё.',[step('relocate',p.homeId,'Собраться и переехать',{duration:35,from:wish.from,to:wish.to})]);}
  function relocate(s,p,target,from){
    const rows=census(s),old=rows.get(p.homeId),dest=rows.get(target),group=family(s,p);
    if(from!==p.homeId||!old||(!old.penalty&&!(p.housingWish?.prestige&&p.housingWish?.to===target)&&!(p.housingWish?.to===target&&group.filter(q=>q.age>=16).every(q=>q.coins<24)&&district(dest?.b).rent<district(old.b).rent))||!dest||!affordable(s,p,group,dest.b)||target===p.homeId||!s.isOpen(dest.b)||!available(group)||(dest.capacity-dest.members.length<group.length&&!relief(old,dest,group.length,dest.members.length))){p.housingWish=null;return {ok:false,message:'Условия изменились: свободного места для всей семьи больше нет или переезд пока невозможен.'};}
    if(s.propertyAccess&&!s.propertyAccess(p,group,dest.b,true))return {ok:false,message:'Не удалось заключить договор аренды.'};
    const share=group.length/old.members.length;
    // Household goods remain in the simulation and travel in personal bags.
    for(const[g,stock]of Object.entries(old.b.stock)){const amount=Math.floor(stock*share);old.b.stock[g]-=amount;group[0].bag[g]=(group[0].bag[g]||0)+amount;}
    for(const q of group){q.homeId=target;q.lastRelocation=s.day;q.housingWish=null;q.plan=null;q.relocation={from:old.b.id,to:target,at:s.now};q.action='Переезжает';q.reason='Семья выбрала подходящее по цене и вместимости жильё';s.travel(q,target);s.remember(q,'housing',target,'Переезжаю в подходящий семье дом: '+dest.b.name,4);}
    s.invalidateHouseholds?.();const state=ensure(s);state.moves++;state.history.unshift({at:s.now,from:old.b.id,to:target,people:group.map(q=>q.id)});state.history=state.history.slice(0,30);
    s.log(`${p.name}: семья из ${group.length} чел. переселяется из ${old.b.name} в ${dest.b.name}, с учётом тесноты и стоимости жилья.`,'family',p.id,{title:'Семья меняет жильё',buildingId:target});return {ok:true};
  }
  function travelStep(s,p,dt){s.travel(p,p.homeId);s.move(p,dt);if(p.path.length||p.location!==p.homeId)return;const home=s.building(p.homeId);for(const[g,n]of Object.entries(p.bag)){home.stock[g]+=n;p.bag[g]=0;}p.relocation=null;p.action='В новом доме';}
  function newcomerHome(s,size=3){return [...census(s).values()].filter(r=>s.isOpen(r.b)&&r.members.length+size<=admissionLimit(r.capacity)&&district(r.b).estate!=='noble'&&R.kind(r.b)!=='manor').sort((a,b)=>(a.members.length+size)/a.capacity-(b.members.length+size)/b.capacity||a.b.id.localeCompare(b.b.id))[0]?.b;}
  function load(s){ensure(s);R.load(s);if(!Number.isFinite(s.housing.moves)||s.housing.moves<0||!Array.isArray(s.housing.history))throw Error('Некорректные сведения о жилье');const v=s.housing.land,finite=n=>Number.isFinite(n)&&n>=0;if(!['sinceDay','lastDay','paid','relief'].every(k=>finite(v[k]))||v.lastDay>s.day||!Array.isArray(v.days)||v.days.some(r=>!['day','paid','relief'].every(k=>finite(r[k]))))throw Error('Некорректная земельная аренда');for(const p of s.people){if(!estates[p.estate])throw Error('Некорректное сословие');if(p.relocation&&(!s.building(p.relocation.from)||p.relocation.to!==p.homeId))throw Error('Некорректный переезд');if(p.housingWish&&(!s.building(p.housingWish.from)||p.housingWish.to&&!s.building(p.housingWish.to)))throw Error('Некорректный поиск жилья');}}
  const api={residenceSpec:R.spec,ensure,district,estates,rent,collectRent,affordable,room,pressure,conditions,census,capacity,family,review,candidate,relocate,travelStep,newcomerHome,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigHousing=api;
})(typeof window!=='undefined'?window:globalThis);
