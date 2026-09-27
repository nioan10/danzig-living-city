(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Social=node?require('./social-life.js'):root.DanzigSocial,Mind=node?require('./citizen-mind.js'):root.DanzigMind;
  const Households=node?require('./households.js'):root.DanzigHouseholds;
  const LABELS={loan:'Заём у знакомого',venture:'Партнёрский вклад',supply:'Поставка с предоплатой'};
  const STATUS={proposed:'Обсуждается',active:'Действует',overdue:'Просрочен',fulfilled:'Исполнен',declined:'Отказ',cancelled:'Отменён',closed:'Завершён с убытком'};
  const live=a=>['proposed','active','overdue'].includes(a.status),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function ensure(s){return s.agreements??={version:1,since:s.day,lastDay:s.day,nextId:1,items:[],history:[],transferred:0,repaid:0,defaults:0,fulfilled:0,invested:0};}
  function record(s,a,text,type='economy'){
    const book=ensure(s);book.history.unshift({id:a.id,day:s.day,kind:a.kind,text});book.history=book.history.slice(0,40);
    s.log(text,type,a.borrowerId||null,{title:LABELS[a.kind],buildingId:a.buildingId||a.sellerId||null});
  }
  function add(s,row){const book=ensure(s);if(book.items.filter(live).length>=256)return null;book.items=book.items.filter(live).concat(book.items.filter(a=>!live(a)).slice(-80));const a={id:book.nextId++,at:s.now,paid:0,remaining:0,...row};book.items.push(a);return a;}
  function reserve(s,p){return Math.max(30,Mind.household(s,p).expense*4);}
  function outstanding(s,p){return ensure(s).items.some(a=>a.borrowerId===p.id&&a.kind==='loan'&&live(a));}
  function canOffer(s,p,q,kind,buildingId){
    if(!p?.alive||!q?.alive||p.id===q.id||p.age<16||q.age<16||p.absence||q.absence)return false;
    if(kind==='loan'&&outstanding(s,p))return false;
    if(kind==='venture'&&(s.building(buildingId)?.ownerId!==p.id||!s.productionRecipe(s.building(buildingId))))return false;
    if(ensure(s).items.some(a=>live(a)&&a.borrowerId===p.id&&a.kind===kind))return false;
    return true;
  }
  function propose(s,p,q,kind,requested,target,buildingId=null){
    if(!['loan','venture'].includes(kind)||!Number.isFinite(requested)||requested<2||requested>60||!s.building(target)||!canOffer(s,p,q,kind,buildingId))return{ok:false,message:'Эту договорённость сейчас нельзя заключить.'};
    const a=add(s,{kind,status:'proposed',borrowerId:p.id,lenderId:q.id,buildingId,target,requested,amount:0,due:s.day+(kind==='loan'?12:24),expires:s.now+360,remaining:0,notified:false});
    if(!a)return{ok:false,message:'Слишком много незавершённых договорённостей.'};
    p.lastDealAt=s.now;record(s,a,`${p.name} предложил ${q.name}: ${kind==='loan'?'заём на семейные расходы':'вклад в оборот мастерской'}.`);return{ok:true,agreement:a};
  }
  function resolve(s,a){
    if(a.status!=='proposed')return{ok:['active','fulfilled'].includes(a.status),pending:false,message:STATUS[a.status]};
    const p=s.person(a.borrowerId),q=s.person(a.lenderId),b=s.building(a.buildingId);
    if(!p?.alive||!q?.alive||p.absence||q.absence||s.now>a.expires){a.status='cancelled';return{ok:false,message:'Стороны не смогли встретиться вовремя.'};}
    if(p.location!==a.target||q.location!==a.target||p.path.length||q.path.length)return{ok:false,pending:true};
    const investment=a.kind==='venture'&&b?Households.investment(s,q,b):null;
    const trust=Social.trust(s,q,p),available=investment?.amount??Math.max(0,q.coins-reserve(s,q)),cap=a.kind==='loan'?24:60;
    const amount=Math.floor(Math.min(a.requested,available,cap)),risk=Mind.ensure(s,q).personality;
    const accept=amount>=2&&trust>=(a.kind==='loan'?15:20)&&(!outstandingOther(s,p,a))&&(a.kind!=='venture'||b?.ownerId===p.id&&s.productionRecipe(b))&&(p.jobId||Social.kin(p,q)||risk.empathy>.65||a.kind==='venture');
    if(!accept){a.status='declined';record(s,a,`${q.name} отказал ${p.name}: не хватает свободных денег, доверия или уверенности в возврате.`);return{ok:false,message:'Собеседник не согласился на условия.'};}
    q.coins-=amount;a.amount=amount;a.remaining=amount;a.status='active';a.acceptedAt=s.now;
    if(a.kind==='loan'){p.coins+=amount;a.interest=Social.kin(p,q)?0:.03;a.remaining=amount*(1+a.interest);}
    else {b.cash+=amount;if(b.enterprise)b.enterprise.openingCash+=amount;a.share=.2;a.cap=amount*1.25;ensure(s).invested+=amount;}
    ensure(s).transferred+=amount;Social.change(s,p,q,4,`${q.name} поддержал договорённость деньгами`);
    record(s,a,`${q.name} передал ${amount} тал. ${a.kind==='loan'?p.name:b.name}. ${a.kind==='loan'?'Возврат к дню '+(a.due+1)+'.':'Участник получает 20% свободной прибыли в течение 24 дней и принимает риск убытка. '+investment.reason}`);return{ok:true};
  }
  function outstandingOther(s,p,a){return ensure(s).items.some(x=>x.id!==a.id&&x.borrowerId===p.id&&x.kind==='loan'&&['active','overdue'].includes(x.status));}
  function complete(s,a,text){a.status='fulfilled';a.remaining=0;ensure(s).fulfilled++;record(s,a,text);}
  function repay(s,p,a){
    if(a?.kind!=='loan'||a.borrowerId!==p.id||!['active','overdue'].includes(a.status))return{ok:false,message:'Долговое обязательство уже не действует.'};
    const q=s.person(a.lenderId);if(!q?.alive)return{ok:false,message:'Получатель недоступен.'};
    const amount=Math.min(a.remaining,Math.max(0,p.coins-12));if(amount<=0)return{ok:false,message:'Нужно оставить средства на жизнь.'};
    p.coins-=amount;q.coins+=amount;a.paid+=amount;a.remaining=Math.max(0,a.remaining-amount);ensure(s).repaid+=amount;
    Social.change(s,q,p,3,`${p.name} вернул ${amount.toFixed(1)} тал. по договорённости`);
    if(a.remaining<1e-7){p.reputation=Math.min(100,p.reputation+1);complete(s,a,`${p.name} полностью вернул заём ${q.name}.`);}return{ok:true};
  }
  function candidates(s,p,addChoice,step){
    if(p.absence||p.age<16)return;const book=ensure(s);
    const invitation=book.items.find(a=>a.status==='proposed'&&a.lenderId===p.id&&a.expires>s.now);
    if(invitation){const q=s.person(invitation.borrowerId);if(q?.alive)addChoice('negotiate','Обсудить просьбу знакомого',82+Math.max(0,Social.trust(s,p,q))*.08,`${q.name} ждёт ответа: ${LABELS[invitation.kind].toLowerCase()}`,[step('answerDeal',invitation.target,'Обсудить условия лично',{duration:20,agreementId:invitation.id})]);}
    const debt=book.items.find(a=>a.kind==='loan'&&a.borrowerId===p.id&&['active','overdue'].includes(a.status)),creditor=debt&&s.person(debt.lenderId);
    if(debt&&creditor?.alive&&p.coins>18&&(s.day>=debt.due-2||p.coins>debt.remaining+30))addChoice('repay','Исполнить денежное обещание',72+(debt.status==='overdue'?18:0),'Возврат долга сохраняет доверие и возможность помощи в будущем',[step('repay',creditor.homeId,'Передать возврат кредитору',{duration:20,agreementId:debt.id})]);
    if(p.hunger<15||p.energy<12||p.cargo||s.now-(p.lastDealAt??-10000)<3*1440||book.items.some(a=>a.borrowerId===p.id&&live(a)))return;
    const owned=s.buildings.find(b=>b.ownerId===p.id&&s.productionRecipe(b)&&!b.construction&&b.cash<18),h=p.mind?.forecast||Mind.household(s,p);
    const kind=owned?'venture':p.coins<6&&h.foodDays<1?'loan':null;if(!kind)return;
    const contacts=s.alive.filter(q=>q.age>=16&&!q.absence&&q.id!==p.id&&(Social.kin(p,q)||(p.relationships[q.id]||0)>=20)).sort((a,b)=>Social.trust(s,p,b)-Social.trust(s,p,a)||a.id-b.id).slice(0,4);
    const q=contacts.find(q=>!s.recentFailure(p,q.homeId,'deal')&&!book.items.some(a=>a.borrowerId===p.id&&a.lenderId===q.id&&a.status==='declined'&&s.now-a.at<10*1440));if(!q)return;
    // The applicant knows the contact, not their private balance. Consent is checked at the meeting.
    const requested=kind==='loan'?Math.min(24,Math.max(6,h.expense*2)):40;
    addChoice('negotiate',kind==='loan'?'Попросить заём у близкого':'Найти партнёра для мастерской',kind==='loan'?78:76,
      `${q.name}: обсудить ${requested.toFixed(0)} тал. ${kind==='loan'?'на семейные расходы':'в оборот двора, с долей свободной прибыли'}`,[step('negotiate',q.homeId,'Встретиться и договориться',{duration:30,lenderId:q.id,dealKind:kind,requested,buildingId:owned?.id||null})]);
  }
  function execute(s,p,step){
    const book=ensure(s);
    if(step.kind==='repay')return repay(s,p,book.items.find(a=>a.id===step.agreementId));
    if(step.kind==='answerDeal'&&!step.agreementId)return{ok:false,message:'Предложение не найдено.'};
    if(!step.agreementId){const r=propose(s,p,s.person(step.lenderId),step.dealKind,step.requested,step.target,step.buildingId);if(!r.ok)return r;step.agreementId=r.agreement.id;}
    const a=book.items.find(a=>a.id===step.agreementId);if(!a)return{ok:false,message:'Договорённость больше не найдена.'};
    if(step.kind==='answerDeal'&&a.lenderId!==p.id||step.kind==='negotiate'&&a.borrowerId!==p.id)return{ok:false,message:'Это чужая договорённость.'};
    return resolve(s,a);
  }
  function supply(s,order){
    if(order.agreementId)return ensure(s).items.find(a=>a.id===order.agreementId);
    // Legacy orders did not track how much of the original prepayment was used.
    // Bound their remaining claim by both the stored payment and today's quote.
    order.unitPrice??=Math.min(order.paid/order.amount,s.price(s.building(order.seller),order.good));
    const amount=Math.min(order.paid,order.amount*order.unitPrice);
    const a=add(s,{kind:'supply',status:'active',buyerId:order.buyer,sellerId:order.seller,good:order.good,amount,remaining:amount,units:order.amount,delivered:0,refunded:0,unitPrice:order.unitPrice,due:s.day+4,notified:false});
    if(a)order.agreementId=a.id;return a;
  }
  function delivered(s,order,amount){const a=supply(s,order);if(!a)return;a.delivered+=amount;a.remaining=Math.max(0,a.remaining-amount*a.unitPrice);if(a.remaining<1e-7)complete(s,a,`${s.building(a.sellerId).name} исполнил оплаченную поставку для ${s.building(a.buyerId).name}.`);}
  function daily(s){
    const book=ensure(s);if(book.lastDay===s.day)return;book.lastDay=s.day;
    for(const order of s.commerce.orders)supply(s,order);
    for(const a of book.items.filter(live)){
      if(a.status==='proposed'){if(a.expires<s.now||!s.person(a.borrowerId)?.alive||!s.person(a.lenderId)?.alive)a.status='cancelled';continue;}
      if(a.kind==='supply'){
        if(s.day<=a.due)continue;const buyer=s.building(a.buyerId),seller=s.building(a.sellerId),order=s.commerce.orders.find(o=>o.agreementId===a.id);
        if(!order||!buyer||!seller){a.status='closed';continue;}
        if(!a.notified){a.notified=true;a.status='overdue';book.defaults++;Social.change(s,s.person(buyer.ownerId),s.person(seller.ownerId),-14,'Оплаченная поставка просрочена; доверие снизилось');record(s,a,`${seller.name} просрочил поставку для ${buyer.name}; покупатель требует возврата за недоставленное.`);}
        const refund=Math.min(a.remaining,Math.max(0,seller.cash-seller.wage*2));if(refund>0){seller.cash-=refund;buyer.cash+=refund;a.refunded+=refund;a.remaining=Math.max(0,a.remaining-refund);order.amount=Math.max(0,order.amount-refund/a.unitPrice);order.paid=Math.max(0,order.paid-refund);if(seller.enterprise)seller.enterprise.openingCash-=refund;if(buyer.enterprise)buyer.enterprise.openingCash+=refund;}
        if(a.remaining<1e-7){s.commerce.orders=s.commerce.orders.filter(o=>o!==order);a.status='closed';record(s,a,`${seller.name} вернул деньги за недоставленную часть заказа.`);}continue;
      }
      const p=s.person(a.borrowerId);let q=s.person(a.lenderId);
      if(!q?.alive){const heir=q&&s.alive.find(x=>x.id===q.spouseId||x.parents.includes(q.id));if(heir){a.lenderId=heir.id;q=heir;}else{a.status='closed';continue;}}
      if(a.kind==='loan'){
        if(!p?.alive){const amount=Math.min(a.remaining,p?.coins||0);if(p)p.coins-=amount;q.coins+=amount;a.paid+=amount;a.remaining-=amount;book.repaid+=amount;a.status=a.remaining<1e-7?'fulfilled':'closed';continue;}
        if(s.day>a.due+2&&!a.notified){a.notified=true;a.status='overdue';book.defaults++;p.reputation=Math.max(0,p.reputation-3);Social.change(s,q,p,-18,`${p.name} просрочил обещанный возврат`);record(s,a,`${p.name} не вернул заём ${q.name} в срок. Осталось ${a.remaining.toFixed(1)} тал.; отношения ухудшились.`,'conflict');}
      }else{
        const b=s.building(a.buildingId);if(!b){a.status='closed';continue;}
        const free=Math.max(0,b.cash-Math.max(30,b.wage*(s.workers(b.id).length+1)*12)),profit=Math.max(0,b.enterprise?.lastProfit||0),payment=Math.min(free,profit*a.share,a.cap-a.paid);
        if(payment>0){b.cash-=payment;q.coins+=payment;a.paid+=payment;a.remaining=Math.max(0,a.amount-a.paid);book.repaid+=payment;if(b.enterprise)b.enterprise.openingCash-=payment;}
        if(a.paid>=a.cap-1e-7)complete(s,a,`${b.name} полностью исполнил условия партнёрского вклада.`);
        else if(s.day>=a.due){const buyout=Math.min(Math.max(0,b.cash-40),Math.max(0,a.amount-a.paid));b.cash-=buyout;q.coins+=buyout;a.paid+=buyout;book.repaid+=buyout;if(b.enterprise)b.enterprise.openingCash-=buyout;a.remaining=Math.max(0,a.amount-a.paid);a.status=a.remaining<1e-7?'fulfilled':'closed';record(s,a,`Завершён вклад ${q.name} в ${b.name}: вложено ${a.amount.toFixed(1)}, получено ${a.paid.toFixed(1)} тал. Результат зависит от хозяйства.`);}
      }
    }
  }
  function load(s){
    const b=ensure(s),finite=n=>Number.isFinite(n)&&n>=0;if(b.version!==1||!Number.isInteger(b.nextId)||b.nextId<1||!['since','lastDay','transferred','repaid','defaults','fulfilled','invested'].every(k=>finite(b[k]))||!Array.isArray(b.items)||b.items.length>400||!Array.isArray(b.history)||b.history.length>40||new Set(b.items.map(a=>a.id)).size!==b.items.length)throw Error('Некорректная книга договорённостей');
    for(const a of b.items){if(!Object.hasOwn(LABELS,a.kind)||!Object.hasOwn(STATUS,a.status)||!Number.isInteger(a.id)||a.id<1||a.id>=b.nextId||!['id','at','due','amount','paid','remaining'].every(k=>finite(a[k]))||a.kind==='supply'&&(!s.building(a.buyerId)||!s.building(a.sellerId)||!['units','delivered','refunded','unitPrice'].every(k=>finite(a[k]))||a.unitPrice<=0)||a.kind!=='supply'&&(!s.person(a.borrowerId)||!s.person(a.lenderId)||a.kind==='venture'&&!s.building(a.buildingId))||a.kind==='venture'&&a.amount>0&&(!finite(a.share)||a.share>1||!finite(a.cap)||a.cap<a.amount)||a.kind==='loan'&&a.amount>0&&(!finite(a.interest)||a.interest>.03)||a.status==='proposed'&&(!finite(a.expires)||!finite(a.requested)||a.requested>60||!s.building(a.target)))throw Error('Некорректный договор');}
    for(const order of s.commerce.orders)if(!order.agreementId)supply(s,order);
  }
  const api={LABELS,STATUS,ensure,live,reserve,propose,resolve,repay,candidates,execute,supply,delivered,daily,load};if(node)module.exports=api;else root.DanzigAgreements=api;
})(typeof window!=='undefined'?window:globalThis);
