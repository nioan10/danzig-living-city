(function(root){
  'use strict';
  const names={biscuits:'Галеты',beams:'Балки',nails:'Гвозди',tiles:'Черепица'},prices={biscuits:1.15,beams:1.2,nails:.45,tiles:.8};
  const variants={bakery:{inputs:{flour:2.5,wood:.5},out:'biscuits',amount:7,time:70},sawmill:{inputs:{wood:4},out:'beams',amount:4,time:100},smith:{inputs:{iron:1,coal:1},out:'nails',amount:10,time:90},potter:{inputs:{clay:3,wood:.7},out:'tiles',amount:7,time:100}};
  const foods=['bread','fish','biscuits'],food=stock=>foods.reduce((n,g)=>n+(stock?.[g]||0),0);
  const all=(b,base)=>base?[base,...(variants[b.type]?[variants[b.type]]:[])]:[];
  const recipe=(b,base)=>variants[b.type]&&variants[b.type].out===b.product?.selected?variants[b.type]:base;
  function migrate(state){for(const b of state.buildings||[])if(b.stock)for(const g of Object.keys(names))if(b.stock[g]===undefined)b.stock[g]=0;const c=state.commerce;if(c)for(const [g,p]of Object.entries(prices)){c.stock[g]??=0;c.prices[g]??=p;if(c.outside)c.outside.base[g]??=p*2.4;}}
  function spoil(s,onLoss){const v=s.materialLife??={sinceDay:s.day,lastDay:s.day,lost:{}};if(v.lastDay>=s.day)return;const elapsed=s.day-v.lastDay;v.lastDay=s.day;
    const lose=(stock,b)=>{for(const [g,rate]of Object.entries({bread:.025,fish:.06,biscuits:.002})){const reserved=b?s.commerce.orders.filter(o=>o.seller===b.id&&o.good===g).reduce((n,o)=>n+o.amount,0):0,amount=Math.max(0,(stock[g]||0)-reserved)*(1-(1-rate)**elapsed);stock[g]=Math.max(0,(stock[g]||0)-amount);v.lost[g]=(v.lost[g]||0)+amount;if(b)onLoss(s,b,g,amount);}};
    for(const b of s.buildings)lose(b.stock,b);lose(s.commerce.stock);for(const p of s.alive)lose(p.bag);
  }
  function choose(s,b,base,market){
    if(!variants[b.type]||b.construction)return;const v=b.product??={selected:base.out,lastDay:s.day,progress:{},reason:'Основное ремесло'};
    if(v.lastDay>=s.day)return;v.lastDay=s.day;
    const recipes=all(b,base),scores=recipes.map(r=>{const orders=s.commerce.orders.filter(o=>o.seller===b.id&&o.good===r.out).reduce((n,o)=>n+o.amount,0),need=(market[r.out]||0),stock=s.buildings.reduce((n,x)=>n+(x.stock[r.out]||0),0),margin=s.commerce.prices[r.out]*r.amount*(1-s.commerce.levyRate/100)-Object.entries(r.inputs).reduce((n,[g,q])=>n+s.commerce.prices[g]*q,0)-b.wage*r.time/60;return {r,score:orders*5+Math.min(8,need/Math.max(1,stock))*12+margin/Math.max(1,r.time)*40+(r.out===v.selected?3:0)};});
    if(b.type==='bakery'&&s.food<s.living.length*1.5)scores.find(x=>x.r.out==='bread').score+=50;
    scores.sort((a,z)=>z.score-a.score||a.r.out.localeCompare(z.r.out));const chosen=scores[0].r;
    if(chosen.out!==v.selected){v.progress[v.selected]=b.progress;b.progress=v.progress[chosen.out]||0;v.selected=chosen.out;v.reason='Сравнил спрос, запасы, заказы и маржу: '+s.goodName(chosen.out);}
  }
  function load(s,types){migrate(s);const life=s.materialLife;if(life&&(!Number.isFinite(life.sinceDay)||life.sinceDay<0||!Number.isFinite(life.lastDay)||life.lastDay>s.day||life.lastDay<life.sinceDay||!life.lost||!Object.entries(life.lost).every(([g,n])=>foods.includes(g)&&Number.isFinite(n)&&n>=0)))throw Error('Некорректный учёт порчи');for(const b of s.buildings){const v=b.product;if(v&&(!all(b,types[b.type]?.recipe).some(r=>r.out===v.selected)||!Number.isFinite(v.lastDay)||v.lastDay>s.day||!v.progress||!Object.entries(v.progress).every(([g,n])=>all(b,types[b.type]?.recipe).some(r=>r.out===g)&&Number.isFinite(n)&&n>=0)))throw Error('Некорректный ассортимент');}}
  const api={names,prices,variants,foods,food,all,recipe,migrate,choose,spoil,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigProducts=api;
})(typeof window!=='undefined'?window:globalThis);
