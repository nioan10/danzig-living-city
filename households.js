(function(root){
  'use strict';
  const GOODS=['biscuits','bread','fish','wood','clothes','pottery','furniture'];
  const LABELS={food:'Питание',wood:'Топливо',clothes:'Одежда',pottery:'Посуда',furniture:'Мебель'};
  const cache=new WeakMap(),sum=a=>a.reduce((n,x)=>n+x,0),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  function ensure(s){
    s.households??={version:1,sinceDay:s.day,lastDay:s.day,days:[],purchases:[]};
    for(const p of s.people)person(p);return s.households;
  }
  function person(p){const d=p.domestic??={pottery:0,furniture:0,warmth:100,lastShop:-1,days:[]};d.foodStress??=0;return d;}
  function invalidate(s){cache.delete(s);}
  function groups(s){
    let c=cache.get(s);if(c&&c.at===s.now&&c.people===s.people&&c.count===s.people.length)return c;
    const living=s.living,byId=new Map(living.map(p=>[p.id,p])),parent=new Map(living.map(p=>[p.id,p.id]));
    const find=id=>{while(parent.get(id)!==id)id=parent.get(id);return id;};
    for(const p of living)for(const id of [p.spouseId,...p.parents]){const q=byId.get(id);if(q&&q.homeId===p.homeId){const a=find(p.id),b=find(q.id);if(a!==b)parent.set(Math.max(a,b),Math.min(a,b));}}
    const rows=new Map(),members=new Map(),homes=new Map();
    for(const p of living){const id=find(p.id);if(!rows.has(id))rows.set(id,[]);rows.get(id).push(p);if(!p.absence)homes.set(p.homeId,(homes.get(p.homeId)||0)+1);}
    for(const row of rows.values()){row.sort((a,b)=>a.id-b.id);for(const p of row)members.set(p.id,row);}
    c={at:s.now,people:s.people,count:s.people.length,rows:[...rows.values()],members,homes};cache.set(s,c);return c;
  }
  function family(s,p){return (groups(s).members.get(p.id)||[p]).filter(q=>q.alive&&q.homeId===p.homeId&&!q.absence);}
  function row(list,day){let r=list.at(-1);if(r?.day!==day){r={day,income:0,spending:{},bought:{}};list.push(r);if(list.length>30)list.shift();}return r;}
  function charge(s,p,key,amount){spending(s,p,key,amount);const r=row(ensure(s).days,s.day);r.spending[key]=(r.spending[key]||0)+amount;}
  function income(s,p,amount){const r=row(person(p).days,s.day);r.income+=amount;if(s.households)row(s.households.days,s.day).income+=amount;}
  function spending(s,p,good,amount){const r=row(person(p).days,s.day);r.spending[good]=(r.spending[good]||0)+amount;}
  const fuelRate=s=>s.season==='Зима'?.09:s.season==='Осень'?.045:s.season==='Весна'?.03:.01;
  function budget(s,p,history=false){
    const members=family(s,p),adults=members.filter(q=>q.age>=16),home=s.building(p.homeId),v=p.mind?.personality||{};
    const head=members.find(q=>q.age>=16)||members[0]||p,traits={};
    for(const key of ['thrift','caution','ambition','family'])traits[key]=adults.length?sum(adults.map(q=>q.mind?.personality[key]??.5))/adults.length:v[key]??.5;
    const coins=sum(adults.map(q=>q.coins)),count=members.length,diners=groups(s).homes.get(p.homeId)||count||1;
    const food=s.foodAmount(home?.stock)*count/diners,dailyFood=count*1.15;
    const foodPrice=Math.min(s.commerce?.prices.bread||1,s.commerce?.prices.fish||1),foodExpense=dailyFood*foodPrice;
    const fuel=count*fuelRate(s),fuelExpense=fuel*(s.commerce?.prices.wood||.3),replacement=count*((s.commerce?.prices.clothes||4)/35+(s.commerce?.prices.pottery||2)*.007+(s.commerce?.prices.furniture||5)*.002);
    const foodDays=dailyFood?food/dailyFood:0,fuelStock=(home?.stock.wood||0)*count/diners;
    const dependents=members.filter(q=>q.age<16||q.health<40).length,stress=Math.max(0,...members.map(q=>person(q).foodStress));
    const risk=clamp((1-traits.caution)*.65+traits.ambition*.35-traits.thrift*.25-dependents/Math.max(1,count)*.4-stress*.5);
    const horizon=clamp(.5+traits.caution*2+traits.thrift*1.5+dependents/Math.max(1,count)*traits.family+stress*2,.5,6);
    const observedDays=Math.max(1,Math.min(7,s.day-(s.households?.sinceDay??s.day)+1));
    const expectedIncome=sum(adults.map(q=>sum(person(q).days.filter(d=>d.day>=s.day-6).map(d=>d.income))))/observedDays;
    // Income is an expectation, never credited to the wallet. Existing supplies reduce the cash target.
    const incomeCredit=Math.min(foodExpense*1.25,expectedIncome*risk);
    const reserve=Math.max(0,foodExpense*Math.max(0,horizon-foodDays)+Math.max(0,fuel*2-fuelStock)*(s.commerce?.prices.wood||.3)-incomeCredit);
    const housingReserve=s.housingSavings?.(members)||0,spendingFloor=reserve*(1-risk*.45),free=Math.max(0,coins-spendingFloor),limit=Math.min(Math.max(0,free-housingReserve),coins*(.15+(1-traits.thrift)*.2+risk*.15));
    const lowestHunger=Math.min(100,...members.map(q=>q.hunger)),canShop=lowestHunger>=(dependents?45:30)&&(foodDays>=.7||risk>.55&&expectedIncome>=foodExpense&&lowestHunger>55);
    const days=history?members.flatMap(q=>person(q).days.filter(d=>d.day>=s.day-6)):[],received=sum(days.map(d=>d.income)),spent={};
    for(const d of days)for(const [good,value]of Object.entries(d.spending))spent[good]=(spent[good]||0)+value;
    return {id:head.id,members,adults,home,coins,food,dailyFood,foodDays,foodExpense,fuel,fuelExpense,replacement,housingReserve,expense:foodExpense+fuelExpense+replacement+(s.propertyRent?.(head)||0)+sum(adults.map(q=>s.housingExpense?.(q)||0)),reserve,spendingFloor,free,limit,received,spent,traits,risk,horizon,expectedIncome,dependents,stress,canShop,
      pottery:sum(members.map(q=>person(q).pottery)),furniture:sum(members.map(q=>person(q).furniture)),fuelStock,
      shopping:members.some(q=>person(q).lastShop===s.day),pending:members.find(q=>q.householdParcel)};
  }
  function needs(s,p,b=budget(s,p)){
    if(!b.members.length)return [];
    const v=b.traits,worst=[...b.members].sort((a,b)=>a.clothing-b.clothing||a.id-b.id)[0],clothingAt=45+(1-(v.thrift??.5))*20;
    const result=[{good:'food',amount:Math.max(0,Math.ceil(b.dailyFood*Math.min(3,b.horizon)-b.food)),priority:100,reason:'Желаемый запас еды с учётом характера семьи'}];
    const add=(good,amount,priority,reason,recipient=null)=>{if(amount>0)result.push({good,amount,priority,reason,recipient});};
    add('wood',Math.max(0,Math.ceil(b.fuel*3-b.fuelStock)),b.fuelStock<b.fuel&&s.season==='Зима'?78:47,'Топливо на три дня');
    if(worst.clothing<clothingAt)add('clothes',1,48+(clothingAt-worst.clothing)*.7,'Износ одежды: '+worst.name, worst.id);
    add('pottery',Math.max(0,Math.ceil(b.members.length*.5-b.pottery-.1)),42+(v.family??.5)*8,'Посуда для членов семьи');
    add('furniture',Math.max(0,Math.ceil(b.members.length*.35-b.furniture-.1)),25+(v.ambition??.5)*15,'Обстановка дома для семьи');
    return result.filter(x=>x.amount>0).sort((a,b)=>b.priority-a.priority);
  }
  function allowance(b,need){return need.good==='food'?b.coins:(need.good==='wood'||need.good==='clothes'&&need.priority>70)?b.free:b.limit;}
  function explanation(b,cost=0){return b.coins-cost<b.reserve?`Готовы уменьшить желаемый запас ради покупки; ожидаемый доход ${b.expectedIncome.toFixed(1)} тал./день не гарантирован.`:`Желаемый запас на ${b.horizon.toFixed(1)} дня учитывает еду дома, осторожность и бережливость семьи.`;}
  function investment(s,p,building){
    const b=budget(s,p),v=p.mind?.personality||b.traits,r=s.productionRecipe(building),margin=r?s.commerce.prices[r.out]*r.amount-Object.entries(r.inputs).reduce((n,[g,a])=>n+s.commerce.prices[g]*a,0)-building.wage*r.time/60:0;
    const evidence=!!r&&!s.overstock(building)&&margin>0&&((building.enterprise?.lastProfit||0)>0||(building.enterprise?.totalRevenue||0)>0);
    const risk=clamp((1-(v.caution??.5))*.65+(v.ambition??.5)*.35-(v.thrift??.5)*.25-b.stress*.5);
    const days=evidence?Math.min(b.dependents?.5:2,Math.max(0,risk-.35)*3):0;
    const floor=Math.max(0,b.reserve-b.foodExpense*days),safe=p.age>=16&&!p.absence&&p.health>=50&&b.members.every(q=>q.hunger>=(q.age<16?45:30));
    const amount=safe?Math.min(p.coins,Math.max(0,b.coins-floor-b.housingReserve)):0;
    return {amount,reserve:b.reserve,riskDays:days,reason:days>0?`Готов рискнуть запасом питания на ${days.toFixed(1)} дня: у двора были продажи и есть расчётная маржа. Возврат не гарантирован.`:'Сохраняю желаемый семейный запас; оснований рисковать им пока нет.'};
  }
  function foodMoney(s,p){return p.age<16||p.absence?p.coins:budget(s,p).coins;}
  function pay(s,p,good,cost){
    const payers=p.age<16?[p]:family(s,p).filter(q=>q.age>=16).sort((a,b)=>(b.id===p.id)-(a.id===p.id)||a.id-b.id);
    if(sum(payers.map(q=>q.coins))+1e-8<cost)return false;
    let left=cost;for(const q of payers){const amount=Math.min(left,q.coins);q.coins=Math.max(0,q.coins-amount);spending(s,q,good,amount);left-=amount;if(left<1e-8)break;}
    return true;
  }
  function receipt(s,p,seller,good,amount,cost){
    if(!s.households)ensure(s);const r=row(s.households.days,s.day);r.spending[good]=(r.spending[good]||0)+cost;r.bought[good]=(r.bought[good]||0)+amount;
    s.households.purchases.unshift({at:s.now,personId:p.id,homeId:p.homeId,sellerId:seller.id,good,amount,cost});s.households.purchases=s.households.purchases.slice(0,40);
  }
  function foodPurchase(s,p,seller,good,wanted,sale){
    const price=s.price(seller,good),amount=Math.min(wanted,Math.floor(seller.stock[good]),Math.floor((foodMoney(s,p)+1e-8)/price));
    if(amount<1||!pay(s,p,good,amount*price))return false;
    seller.stock[good]-=amount;sale(s,seller,amount*price,false,{good,amount});p.bag[good]=(p.bag[good]||0)+amount;receipt(s,p,seller,good,amount,amount*price);return true;
  }
  function claimed(s,b,need,p){return b.members.some(q=>q.id!==p.id&&(q.householdParcel||q.plan?.goal==='householdShopping'&&q.plan.steps.some(x=>x.kind==='buyHousehold'&&(x.good===need.good||x.good==='clothes'&&x.recipient===need.recipient))));}
  function candidates(s,p,add,step){
    if(p.householdParcel){add('householdDelivery','Доставить семейную покупку',96,'Покупка уже оплачена. Дома ждут вещи',[step('storeHousehold',p.homeId,'Передать семье покупку',{duration:10})]);return;}
    if(p.age<16||p.absence||p.arriving||p.relocation||p.cargo||p.constructionCargo||s.hour<6||s.hour>=20||p.hunger<35||p.energy<30)return;
    const b=budget(s,p),wanted=needs(s,p,b);
    for(const need of wanted.filter(n=>['clothes','pottery','furniture'].includes(n.good)))if((b.home.stock[need.good]||0)>=1){add('householdShopping','Использовать домашний запас',need.priority+14,'Нужная вещь уже есть дома. Новая покупка не требуется',[step('useHousehold',p.homeId,'Использовать имеющиеся вещи',{duration:20,good:need.good,recipient:need.recipient})]);return;}
    if(b.shopping||b.pending||!b.canShop||b.free<=0)return;
    for(const need of needs(s,p,b).filter(x=>x.good!=='food').slice(0,3)){
      if(claimed(s,b,need,p))continue;
      const offers=s.suppliers(p,need.good,1).filter(o=>o.price<=allowance(b,need)&&!s.recentFailure(p,o.id,'expensive'));
      offers.sort((a,z)=>a.price*(1+(b.traits.thrift??.5)*3)+s.travelMinutes(p,a.id)*.018-s.trust(p,a.id)*.01-(z.price*(1+(b.traits.thrift??.5)*3)+s.travelMinutes(p,z.id)*.018-s.trust(p,z.id)*.01));
      const o=offers[0];if(!o)continue;
      const amount=Math.min(need.amount,need.good==='wood'?4:1,Math.floor(allowance(b,need)/o.price));if(amount<1)continue;
      const waiting=Math.min(18,Math.max(0,s.day-Math.max(s.households?.sinceDay||0,...b.members.map(q=>person(q).lastShop)))*2);
      add('householdShopping','Купить для семьи: '+s.goodName(need.good).toLowerCase(),need.priority-12+(p.mind?.personality.family||.5)*8-(p.mind?.personality.diligence||.5)*8+waiting+(p.work>=240?12:0),
        `${need.reason}. ${explanation(b,o.price*amount)} ${s.building(o.id).name}: ${o.price.toFixed(1)} тал./ед.`,[
          step('buyHousehold',o.id,'Купить необходимое семье',{duration:15,good:need.good,amount,recipient:need.recipient,quotedPrice:o.price,homeId:p.homeId}),step('storeHousehold',p.homeId,'Принести вещи домой',{duration:10})]);
      break;
    }
  }
  function execute(s,p,seller,action,sale){
    if(action.kind==='useHousehold'){
      const need=needs(s,p).find(n=>n.good===action.good);if(!need||seller.id!==p.homeId||p.location!==p.homeId||seller.stock[action.good]<1||p.householdParcel)return {ok:false,message:'Домашний запас или потребность изменились.'};
      seller.stock[action.good]--;p.bag[action.good]=(p.bag[action.good]||0)+1;p.householdParcel={good:action.good,amount:1,recipient:need.recipient,ownerId:p.id};action={...action,kind:'storeHousehold'};
    }
    if(action.kind==='storeHousehold'){
      const parcel=p.householdParcel;if(!parcel)return {ok:true};if(p.location!==p.homeId||seller.id!==p.homeId)return {ok:false,message:'Покупку нужно принести домой.'};
      const amount=Math.min(parcel.amount,p.bag[parcel.good]||0);p.bag[parcel.good]=Math.max(0,(p.bag[parcel.good]||0)-amount);
      const members=family(s,p);let target=s.person(parcel.recipient);if(!target?.alive||target.homeId!==p.homeId)target=[...members].sort((a,b)=>a.clothing-b.clothing)[0]||p;
      if(parcel.good==='clothes'&&amount>=1)target.clothing=100;
      if(['pottery','furniture'].includes(parcel.good)){const owner=members.find(q=>q.id===parcel.ownerId)||p;person(owner)[parcel.good]+=amount;}
      if(parcel.good==='wood')seller.stock.wood+=amount;else s.statistics.consumption[parcel.good]=(s.statistics.consumption[parcel.good]||0)+amount;
      if(p.plan&&amount>0)p.plan.householdBenefit=Math.min(8,amount*4);
      p.householdParcel=null;return {ok:true};
    }
    const b=budget(s,p),need=needs(s,p,b).find(n=>n.good===action.good);
    if(p.age<16||p.absence||p.householdParcel||p.homeId!==action.homeId||b.shopping||!need||!b.canShop)return {ok:false,message:'Потребность или положение семьи изменились. Покупку откладываем.'};
    if(claimed(s,b,need,p))return {ok:false,message:'Покупку уже взял на себя другой член семьи.'};
    const price=s.price(seller,action.good),reserved=(s.commerce.orders||[]).filter(o=>o.seller===seller.id&&o.good===action.good).reduce((n,o)=>n+o.amount,0);
    const amount=Math.min(action.amount,need.amount,Math.floor(Math.max(0,seller.stock[action.good]-reserved)),Math.floor((allowance(b,need)+1e-8)/price));
    if(price>action.quotedPrice*1.2||amount<1)return {ok:false,message:'Цена, остаток товара или семейный лимит изменились.'};
    if(!pay(s,p,action.good,price*amount))return {ok:false,message:'Семье больше не хватает денег на эту покупку.'};
    seller.stock[action.good]-=amount;sale(s,seller,price*amount,false,{good:action.good,amount});p.bag[action.good]=(p.bag[action.good]||0)+amount;
    p.householdParcel={good:action.good,amount,recipient:need.recipient,ownerId:b.id};for(const q of b.members)person(q).lastShop=s.day;
    receipt(s,p,seller,action.good,amount,price*amount);s.remember(p,'trade',seller.id,'Семья приобрела '+s.goodName(action.good).toLowerCase()+' в '+seller.name,2);return {ok:true};
  }
  function daily(s){
    const h=ensure(s);if(h.lastDay===s.day)return;const elapsed=Math.max(0,s.day-h.lastDay);h.lastDay=s.day;invalidate(s);
    for(const p of s.alive){if(p.absence)continue;const d=person(p);d.foodStress=clamp(d.foodStress+(p.hunger<35?.2:-.025)*elapsed);p.clothing=Math.max(0,p.clothing-elapsed*(p.jobId?1.6:1.1));d.pottery=Math.max(0,d.pottery-.007*elapsed);d.furniture=Math.max(0,d.furniture-.002*elapsed);}
    for(const home of s.buildings.filter(b=>b.type==='home')){const members=s.alive.filter(p=>p.homeId===home.id&&!p.absence),wanted=members.length*fuelRate(s)*elapsed,used=Math.min(home.stock.wood,wanted);home.stock.wood-=used;s.statistics.consumption.wood=(s.statistics.consumption.wood||0)+used;for(const p of members)person(p).warmth=clamp(person(p).warmth+(wanted>0&&used<wanted?(s.season==='Зима'?-15:-4):10),0,100);}
    const d=row(h.days,s.day);d.wanted={};d.funded={};
    for(const members of groups(s).rows){const p=members.find(p=>!p.absence);if(!p)continue;const b=budget(s,p);let left=b.coins;
      for(const need of needs(s,p,b)){const good=need.good==='food'?'bread':need.good,price=s.commerce.prices[good],funds=need.good==='food'?left:Math.min(allowance(b,need),Math.max(0,left-b.spendingFloor)),n=Math.min(need.amount,Math.floor(funds/price));d.wanted[need.good]=(d.wanted[need.good]||0)+need.amount;d.funded[need.good]=(d.funded[need.good]||0)+n;left-=n*price;}
    }
  }
  function comfort(p){const d=person(p);return (p.clothing<25?-2:0)+(d.warmth<35?-2:0)+Math.min(2,d.pottery+d.furniture);}
  function market(s){
    const days=(s.households?.days||[]).filter(d=>d.day>=s.day-6&&d.day<s.day),latest=s.households?.days.at(-1),result={};
    for(const g of ['clothes','pottery','furniture'])result[g]=Math.max(sum(days.map(d=>d.bought[g]||0))/Math.max(1,days.length),(latest?.funded?.[g]||0)/4);
    result.wood=s.alive.filter(p=>!p.absence).length*fuelRate(s);return result;
  }
  function death(s,p){
    const kin=family(s,p).find(q=>q.id!==p.id&&q.alive),d=person(p);if(kin){person(kin).pottery+=d.pottery;person(kin).furniture+=d.furniture;}d.pottery=d.furniture=0;
    if(p.householdParcel){const home=s.building(p.homeId),parcel=p.householdParcel,n=Math.min(parcel.amount,p.bag[parcel.good]||0);home.stock[parcel.good]+=n;p.bag[parcel.good]=Math.max(0,(p.bag[parcel.good]||0)-n);p.householdParcel=null;}invalidate(s);
  }
  function load(s){
    const h=ensure(s),valid=n=>Number.isFinite(n)&&n>=0,map=(o,keys)=>o&&Object.entries(o).every(([k,n])=>keys.includes(k)&&valid(n)),days=list=>Array.isArray(list)&&list.length<=30&&list.every((d,i)=>valid(d.day)&&d.day<=s.day&&(!i||d.day>list[i-1].day)&&valid(d.income)&&map(d.spending,[...GOODS,'landRent','titleFee','rent','propertyMaintenance','homeConstruction'])&&map(d.bought,GOODS)&&(!d.wanted||map(d.wanted,Object.keys(LABELS)))&&(!d.funded||map(d.funded,Object.keys(LABELS))));
    if(h.version!==1||!valid(h.sinceDay)||h.sinceDay>s.day||!valid(h.lastDay)||h.lastDay>s.day||!days(h.days)||!Array.isArray(h.purchases)||h.purchases.length>40||h.purchases.some(r=>!valid(r.at)||r.at>s.now||!s.person(r.personId)||!s.building(r.homeId)||!s.building(r.sellerId)||!GOODS.includes(r.good)||!valid(r.amount)||!valid(r.cost)))throw Error('Некорректная семейная экономика');
    for(const p of s.people){const d=person(p),q=p.householdParcel;if(!['pottery','furniture','warmth','foodStress'].every(k=>valid(d[k]))||d.foodStress>1||d.warmth>100||!Number.isInteger(d.lastShop)||d.lastShop< -1||d.lastShop>s.day||!days(d.days)||q&&(!['wood','clothes','pottery','furniture'].includes(q.good)||!valid(q.amount)||q.amount<=0||q.amount>(p.bag[q.good]||0)+1e-8||q.recipient!==null&&!s.person(q.recipient)||!s.person(q.ownerId)))throw Error('Некорректное имущество семьи');}
    for(const p of s.people)for(const x of p.plan?.steps||[]){
      if(x.kind==='buyHousehold'&&(!['wood','clothes','pottery','furniture'].includes(x.good)||!Number.isInteger(x.amount)||x.amount<1||x.amount>4||!valid(x.quotedPrice)||x.quotedPrice<=0||s.building(x.homeId)?.type!=='home'||x.recipient!==null&&!s.person(x.recipient)))throw Error('Некорректная семейная покупка');
      if(x.kind==='useHousehold'&&!['clothes','pottery','furniture'].includes(x.good))throw Error('Некорректное использование семейных вещей');
    }
    invalidate(s);
  }
  const api={LABELS,ensure,person,invalidate,groups,family,budget,needs,allowance,explanation,investment,foodMoney,pay,income,charge,receipt,foodPurchase,candidates,execute,daily,comfort,death,market,load};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigHouseholds=api;
})(typeof window!=='undefined'?window:globalThis);
