(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Mind=node?require('./citizen-mind.js'):root.DanzigMind,Labour=node?require('./labour.js'):root.DanzigLabour;
  const LIMIT=48,DEPTH=6;
  const step=(kind,target,label,extra={})=>({kind,target,label,duration:15,elapsed:0,...extra});
  // Bounded forward search. Preconditions and predicted effects connect earning,
  // buying and eating; real stocks, wages and hiring are checked again on arrival.
  function foodPlan(s,p){
    const home=s.building(p.homeId),food=s.suppliers(p,'food',1).slice(0,3),employers=Labour.offers(s,p).slice(0,2);
    const initial={cash:p.coins,bag:s.foodAmount(p.bag),home:s.foodAmount(home.stock),job:p.jobId,worked:false,ate:false,at:p.location||p.goal,steps:[],cost:0,minutes:0};
    const queue=[initial],seen=new Map();let expanded=0;
    const push=(x,action,effect,extraCost=0)=>{
      const route=x.steps.length?s.routeBetween('b:'+x.at,'b:'+action.target):null;
      if(route&&x.at!==action.target&&!route.length)return;
      const travel=x.at===action.target?0:s.travelMinutes({...p,path:[],navNode:'b:'+x.at},action.target),minutes=x.minutes+action.duration+travel;
      if(!Number.isFinite(minutes)||minutes>540)return;
      const energy=p.energy-minutes*.028;
      if(energy<4&&action.kind==='hire')return;
      const next={...x,...effect,at:action.target,steps:[...x.steps,action],minutes,cost:x.cost+action.duration+travel+extraCost};
      const key=[next.job,Math.floor(next.cash),next.bag>0,next.home>0,next.worked,next.ate,next.at].join('|');
      if(seen.has(key)&&seen.get(key)<=next.cost)return;seen.set(key,next.cost);queue.push(next);
    };
    while(queue.length&&expanded<LIMIT){
      queue.sort((a,b)=>a.cost-b.cost);const x=queue.shift();expanded++;
      if(x.ate)return{steps:x.steps,expanded,minutes:x.minutes,cost:x.cost};
      if(x.steps.length>=DEPTH)continue;
      if(x.bag>=1)push(x,step('eatBag',x.at,'Поесть из купленных припасов',{duration:10}),{ate:true,bag:x.bag-1});
      if(x.home>=1)push(x,step('eatHome',home.id,'Поесть дома',{duration:15}),{ate:true,home:x.home-1});
      if(s.hour>=6&&s.hour<21){
        for(const offer of food)if(x.cash+1e-8>=offer.price&&x.bag<1)push(x,step('buyFood',offer.id,'Купить доступную порцию',{good:offer.good,amount:1}),{cash:x.cash-offer.price,bag:x.bag+1},offer.price*Mind.ensure(s,p).personality.thrift*8);
        const job=s.building(x.job);
        if(job&&!x.worked&&s.canProduce(job)&&!s.recentFailure(p,job.id,'unpaid')){
          const price=Math.min(...food.map(f=>f.price));const gross=x.job!==p.jobId?job.wage*(Labour.qualification(p,job)<1?.7:1):Labour.rate(s,p,job);
          const net=s.netWage(p,gross),duration=Math.min(180,Math.max(30,Math.ceil((Math.max(0,price-x.cash)/Math.max(.01,net)*60+10)/5)*5));
          if(Number.isFinite(price)&&job.cash>=gross*duration/60)push(x,step('work',job.id,'Заработать недостающую сумму',{duration}),{cash:x.cash+net*duration/60,worked:true});
        }
        if(!x.job&&Labour.eligible(s,p))for(const offer of employers)push(x,step('hire',offer.id,'Договориться о работе',{duration:30}),{job:offer.id});
      }
    }
    return{steps:[],expanded,minutes:0};
  }
  function candidates(s,p,add){
    const home=s.building(p.homeId);if(p.hunger>=55||s.foodAmount(home.stock)>=1||s.foodAmount(p.bag)>=1)return;
    if(p.jobId&&p.coins>=Math.min(...s.suppliers(p,'food',1).map(x=>x.price)))return;
    const plan=foodPlan(s,p);Mind.ensure(s,p).search={expanded:plan.expanded,limit:LIMIT,depth:plan.steps.length,at:s.now};
    if(!plan.steps.length)return;
    add('earnFood','Построить путь к заработку и еде',(100-p.hunger)*1.3+(p.hunger<25?65:0)+12,
      `Проверил ${plan.expanded} состояний: ${plan.steps.map(x=>x.label.toLowerCase()).join(' → ')}. Около ${Math.ceil(plan.minutes)} мин.`,plan.steps);
  }
  function estimate(s,p,steps){
    let at=p.location||p.goal,minutes=0;for(const action of steps){minutes+=action.duration;if(at!==action.target)minutes+=s.travelMinutes({...p,path:[],navNode:'b:'+at},action.target);at=action.target;}
    return Math.ceil(minutes);
  }
  function invalid(s,p){
    const plan=p.plan,x=plan?.steps[plan.index];if(!x)return'';
    if(!s.building(x.target))return'Место назначения исчезло';
    if(x.kind==='work'&&p.jobId!==x.target)return'Изменилось место работы';
    if(x.kind==='care'&&!s.person(x.personId)?.alive)return'Получатель помощи больше не нуждается в уходе';
    if(['work','hire'].includes(x.kind)&&s.recentFailure(p,x.target,'unpaid'))return'Здесь недавно отказали в оплате';
    if(s.now>(plan.createdAt??s.now)+Math.max(720,(plan.estimatedMinutes||180)*2))return'План затянулся: пересматриваю условия';
    return'';
  }
  const api={LIMIT,DEPTH,foodPlan,candidates,estimate,invalid};if(node)module.exports=api;else root.DanzigPlanner=api;
})(typeof window!=='undefined'?window:globalThis);
