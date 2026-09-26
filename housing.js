(function(root){
  'use strict';
  function ensure(s){s.housing??={moves:0,history:[]};return s.housing;}
  const room=b=>b?.type==='home'&&!b.construction?6+((b.development?.level||1)-1)*3+(b.development?.extras.includes(3)?2:0):0;
  function census(s){
    const rows=new Map(s.buildings.filter(b=>b.type==='home').map(b=>[b.id,{b,capacity:room(b),members:[],present:0,penalty:0}]));
    for(const p of s.people)if(p.alive){const row=rows.get(p.homeId);if(row){row.members.push(p);if(p.absence?.status!=='away')row.present++;}}
    for(const row of rows.values())row.penalty=row.capacity?Math.min(30,Math.max(0,row.present-row.capacity)*3):0;
    return rows;
  }
  const capacity=s=>s.buildings.reduce((n,b)=>n+room(b),0);
  function family(s,p){const spouse=s.person(p.spouseId),adults=[p];if(spouse?.alive&&spouse.homeId===p.homeId)adults.push(spouse);const ids=adults.map(q=>q.id);return [...adults,...s.living.filter(q=>q.age<16&&q.homeId===p.homeId&&!ids.includes(q.id)&&q.parents.some(id=>ids.includes(id)))];}
  const available=group=>group.every(p=>!p.absence&&!p.arriving&&!p.relocation&&!p.cargo);
  function review(s){
    ensure(s);const rows=census(s),reserved=new Map([...rows].map(([id,r])=>[id,r.members.length]));
    for(const p of s.living)p.housingWish=null;
    for(const row of rows.values()){
      if(!row.penalty)continue;
      const leaders=row.members.filter(p=>p.age>=18&&!p.absence&&!p.arriving&&!p.relocation&&(!s.person(p.spouseId)?.alive||s.person(p.spouseId).homeId!==p.homeId||p.id<p.spouseId));
      for(const p of leaders){
        if(reserved.get(row.b.id)<=row.capacity)break;
        const group=family(s,p);if(!available(group))continue;
        const choices=[...rows.values()].filter(r=>r.b.id!==row.b.id&&s.isOpen(r.b)&&r.capacity-reserved.get(r.b.id)>=group.length);
        choices.sort((a,b)=>s.travelMinutes(p,a.b.id)-s.travelMinutes(p,b.b.id)||a.b.id.localeCompare(b.b.id));
        const dest=choices[0];p.housingWish={from:row.b.id,to:dest?.b.id||null,day:s.day,penalty:row.penalty,members:group.map(q=>q.id)};
        if(dest){reserved.set(dest.b.id,reserved.get(dest.b.id)+group.length);reserved.set(row.b.id,reserved.get(row.b.id)-group.length);}
      }
    }
  }
  function candidate(s,p,add,step){const wish=p.housingWish;if(!wish?.to||wish.from!==p.homeId||p.relocation||s.hour<6||s.hour>=21)return;const preference=p.traits.includes('Замкнутый')?10:p.traits.includes('Общительный')?-5:0;add('relocate','Переселиться в более просторный дом',48+wish.penalty*2+preference,`В нашем доме тесно: это снижает довольство. В ${s.building(wish.to).name} есть место для семьи.`,[step('relocate',p.homeId,'Собраться и переехать',{duration:35,from:wish.from,to:wish.to})]);}
  function relocate(s,p,target,from){
    const rows=census(s),old=rows.get(p.homeId),dest=rows.get(target),group=family(s,p);
    if(from!==p.homeId||!old?.penalty||!dest||target===p.homeId||!s.isOpen(dest.b)||!available(group)||dest.capacity-dest.members.length<group.length){p.housingWish=null;return {ok:false,message:'Условия изменились: свободного места для всей семьи больше нет или переезд пока невозможен.'};}
    const share=group.length/old.members.length;
    // Household goods remain in the simulation and travel in personal bags.
    for(const[g,stock]of Object.entries(old.b.stock)){const amount=Math.floor(stock*share);old.b.stock[g]-=amount;group[0].bag[g]=(group[0].bag[g]||0)+amount;}
    for(const q of group){q.homeId=target;q.housingWish=null;q.plan=null;q.relocation={from:old.b.id,to:target,at:s.now};q.action='Переезжает';q.reason='Семья выбрала более просторный дом';s.travel(q,target);s.remember(q,'housing',target,'Переезжаю из тесного дома в '+dest.b.name,4);}
    const state=ensure(s);state.moves++;state.history.unshift({at:s.now,from:old.b.id,to:target,people:group.map(q=>q.id)});state.history=state.history.slice(0,30);
    s.log(`${p.name}: семья из ${group.length} чел. переселяется из ${old.b.name} в ${dest.b.name}, чтобы жить просторнее.`,'family',p.id,{title:'Переезд из тесного дома',buildingId:target});return {ok:true};
  }
  function travelStep(s,p,dt){s.travel(p,p.homeId);s.move(p,dt);if(p.path.length||p.location!==p.homeId)return;const home=s.building(p.homeId);for(const[g,n]of Object.entries(p.bag)){home.stock[g]+=n;p.bag[g]=0;}p.relocation=null;p.action='В новом доме';}
  function newcomerHome(s){return [...census(s).values()].filter(r=>s.isOpen(r.b)).sort((a,b)=>a.members.length/a.capacity-b.members.length/b.capacity||a.b.id.localeCompare(b.b.id))[0]?.b;}
  function load(s){ensure(s);if(!Number.isFinite(s.housing.moves)||s.housing.moves<0||!Array.isArray(s.housing.history))throw Error('Некорректные сведения о жилье');for(const p of s.people){if(p.relocation&&(!s.building(p.relocation.from)||p.relocation.to!==p.homeId))throw Error('Некорректный переезд');if(p.housingWish&&(!s.building(p.housingWish.from)||p.housingWish.to&&!s.building(p.housingWish.to)))throw Error('Некорректный поиск жилья');}}
  const api={ensure,room,census,capacity,family,review,candidate,relocate,travelStep,newcomerHome,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigHousing=api;
})(typeof window!=='undefined'?window:globalThis);
