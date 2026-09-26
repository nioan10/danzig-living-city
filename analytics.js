(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Housing=node?require('./housing.js'):root.DanzigHousing;
  const INTERVAL=360,RECENT=720,ARCHIVE=360;
  const sum=xs=>xs.reduce((n,x)=>n+x,0),round=n=>Math.round(n*100)/100;
  const avg=xs=>xs.length?round(sum(xs)/xs.length):null;
  function median(xs){if(!xs.length)return null;const a=[...xs].sort((a,b)=>a-b),i=Math.floor(a.length/2);return round(a.length%2?a[i]:(a[i-1]+a[i])/2);}
  function capture(s){
    const present=s.alive,living=s.living,adults=present.filter(p=>p.age>=16&&p.age<65&&!p.absence);
    const workshops=s.buildings.filter(b=>s.productionRecipe(b)&&!b.construction),homes=[...Housing.census(s).values()];
    const learning=s.people.map(p=>p.learning||{}),agreements=(s.agreements?.items||[]).filter(a=>['active','overdue'].includes(a.status));
    const goods=s.goods,keys=Object.keys(goods),livingIds=new Set(living.map(p=>p.id));
    const map=o=>Object.fromEntries(keys.map(k=>[k,round(o?.[k]||0)]));
    return {
      at:s.now,population:present.length,total:living.length,away:living.filter(p=>p.absence?.status==='away').length,
      treasury:round(s.treasury),debt:round(s.region?.debt||0),arrears:round(s.fiscal?.infrastructure?.arrears||0),food:s.food,happiness:s.happiness,
      employed:adults.filter(p=>p.jobId).length,jobless:adults.filter(p=>!p.jobId).length,
      children:present.filter(p=>p.age<16).length,elderly:present.filter(p=>p.age>=65).length,
      health:avg(present.map(p=>p.health)),hunger:avg(present.map(p=>p.hunger)),energy:avg(present.map(p=>p.energy)),
      sick:present.filter(p=>p.sick).length,hungry:present.filter(p=>p.hunger<25).length,
      personalCash:round(sum(living.map(p=>p.coins))),medianCash:median(living.filter(p=>p.age>=16).map(p=>p.coins)),
      workshopCash:round(sum(workshops.map(b=>b.cash))),guildCash:round(sum((s.guilds?.groups||[]).map(g=>g.cash))),
      capacity:Housing.capacity(s),crowded:sum(homes.filter(r=>r.penalty>0).map(r=>r.present)),moves:s.housing?.moves||0,
      buildings:s.buildings.filter(b=>!b.construction).length,sites:s.buildings.filter(b=>b.construction).length,workshops:workshops.length,
      births:s.births,deaths:s.deaths,immigrants:s.expansion?.immigrants||0,
      successes:sum(learning.map(l=>l.successes||0)),failures:sum(learning.map(l=>l.failures||0)),lessons:sum(learning.map(l=>l.lessons||0)),
      skill:avg(living.filter(p=>p.age>=16).map(p=>p.skill)),generations:new Set(learning.map(l=>l.generation||0)).size,
      agreements:agreements.length,overdue:agreements.filter(a=>a.status==='overdue').length,
      trust:sum(living.map(p=>Object.entries(p.relationships||{}).filter(([id,v])=>livingIds.has(Number(id))&&v>=25).length)),
      lent:round(s.agreements?.transferred||0),repaid:round(s.agreements?.repaid||0),fulfilled:s.agreements?.fulfilled||0,
      goods:map(goods),prices:map(s.commerce?.prices),produced:map(s.statistics?.production),
      consumed:map(Object.fromEntries(keys.map(k=>[k,(s.statistics?.consumption[k]||0)+(s.statistics?.materials?.[k]||0)])))
    };
  }
  function used(s,good,amount){const stats=s.statistics;stats.materials??={};stats.materials[good]=(stats.materials[good]||0)+amount;}
  function sample(s){
    s.analytics??={version:1,since:s.now,lastSample:-1,stride:INTERVAL,recent:[],archive:[]};
    const a=s.analytics,bucket=Math.floor(s.now/INTERVAL);if(a.lastSample===bucket)return;
    a.lastSample=bucket;const point=capture(s);a.recent.push(point);if(a.recent.length>RECENT)a.recent.shift();
    if(!a.archive.length||point.at-a.archive.at(-1).at>=a.stride)a.archive.push(point);
    if(a.archive.length>ARCHIVE){a.archive=a.archive.filter((_,i)=>i%2===0);a.stride*=2;}
  }
  function load(s){
    if(!s.analytics){sample(s);return;}
    const a=s.analytics,finite=n=>Number.isFinite(n)&&n>=0;
    const values=o=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.values(o).every(v=>v===null||typeof v==='number'&&Number.isFinite(v)||v&&typeof v==='object'&&values(v));
    if(a.version!==1||!finite(a.since)||a.since>s.now||!Number.isInteger(a.lastSample)||a.lastSample<0||a.lastSample>Math.floor(s.now/INTERVAL)||!finite(a.stride)||a.stride<INTERVAL||!Array.isArray(a.recent)||!Array.isArray(a.archive)||a.recent.length>RECENT||a.archive.length>ARCHIVE)throw Error('Некорректная история статистики');
    for(const rows of [a.recent,a.archive])if(rows.some((p,i)=>!values(p)||!finite(p.at)||p.at<a.since||p.at>s.now||i>0&&p.at<=rows[i-1].at))throw Error('Некорректные точки статистики');
  }
  // Merge only recorded fields. Missing historical metrics are never filled with today's values or zero.
  function points(s,days=30){
    const map=new Map();
    for(const row of [...(s.reportArchive?.timeline||[]),...(s.statistics?.snapshots||[]),...(s.analytics?.archive||[]),...(s.analytics?.recent||[]),capture(s)])map.set(row.at,{...map.get(row.at),...row});
    const from=days==='all'?0:s.now-Number(days)*1440;
    return [...map.values()].filter(p=>p.at>=from&&p.at<=s.now).sort((a,b)=>a.at-b.at);
  }
  function value(row,key){const v=key.split('.').reduce((o,k)=>o?.[k],row);return Number.isFinite(v)?v:null;}
  function rates(rows,key){
    return rows.map((p,i)=>{const prev=rows[i-1],a=value(p,key),b=prev&&value(prev,key),dt=prev?p.at-prev.at:0;return {at:p.at,value:a!==null&&b!==null&&dt>0&&a>=b?round((a-b)*1440/dt):null};});
  }
  function accounts(s,days=30){
    const book=s.accounts,rows=book?.days||[],span=days==='all'?60:Math.min(60,Number(days));
    const start=Math.max(book?.sinceDay??s.day,s.day-span+1,rows.length>=60?rows[0].day:0);
    return Array.from({length:Math.max(0,s.day-start+1)},(_,i)=>{const day=start+i,row=rows.find(r=>r.day===day),income=sum(Object.values(row?.income||{})),expenses=sum(Object.values(row?.expenses||{}));return {at:day*1440,income:round(income),expenses:round(expenses),net:round(income-expenses)};});
  }
  const api={INTERVAL,RECENT,ARCHIVE,capture,sample,load,points,value,rates,accounts,median,used};
  if(node)module.exports=api;else root.DanzigAnalytics=api;
})(typeof window!=='undefined'?window:globalThis);
