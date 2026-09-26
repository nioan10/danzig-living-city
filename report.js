(function(root){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x)),sum=o=>Object.values(o||{}).reduce((a,b)=>a+b,0);
  const round=n=>Math.round(n*10)/10;
  function snapshot(s){return {at:s.now,total:s.living.length,population:s.alive.length,treasury:round(s.treasury),food:s.food,happiness:s.happiness,debt:round(s.region?.debt||0)};}
  function money(s,amount,category){const a=s.reportArchive;if(!a||!amount)return;const bucket=amount<0?a.expenses:a.income;bucket[category]=(bucket[category]||0)+Math.abs(amount);}
  function record(s,e){const a=s.reportArchive;if(!a)return;const key=e.type||'life';a.counts[key]=(a.counts[key]||0)+1;
    // Preserve the opening and recent entries of each category, not an unbounded log.
    const list=a.stories[key]||(a.stories[key]=[]);list.push(copy(e));if(list.length>7)list.splice(2,1);
  }
  function sample(s,force=false){const a=s.reportArchive;if(!a)return;const bucket=Math.floor(s.now/360);if(!force&&a.lastSample===bucket)return;a.lastSample=bucket;const point=snapshot(s);
    for(const key of ['total','treasury','happiness','food','debt']){if(!a.peaks[key]||point[key]>a.peaks[key].value)a.peaks[key]={value:point[key],at:point.at};}
    const last=a.timeline.at(-1);if(last?.at===point.at)a.timeline[a.timeline.length-1]=point;
    else if(!last||force||point.at-last.at>=a.stride)a.timeline.push(point);
    if(a.timeline.length>360){a.timeline=a.timeline.filter((_,i)=>i%2===0);a.stride*=2;}
  }
  function ensure(s,legacy=false){if(s.reportArchive)return s.reportArchive;
    const snapshots=s.statistics?.snapshots||[],days=s.accounts?.days||[],events=s.events||[];
    s.reportArchive={version:1,legacy,installedAt:s.now,chartSince:snapshots[0]?.at??s.now,moneySince:legacy?(days[0]?.day??s.day):s.day,eventSince:legacy?Math.min(s.day,...events.map(e=>e.day)):s.day,counts:{},stories:{},income:{},expenses:{},timeline:[],peaks:{},stride:360,lastSample:-1};
    const a=s.reportArchive;
    for(const day of days)for(const side of ['income','expenses'])for(const[k,v]of Object.entries(day[side]||{}))a[side][k]=(a[side][k]||0)+v;
    for(const e of [...events].reverse())record(s,e);
    for(const row of snapshots){const p={at:row.at,total:row.total??row.population,population:row.population,treasury:row.treasury,food:row.food,happiness:row.happiness,debt:row.debt};a.timeline.push(p);for(const key of ['total','treasury','happiness','food','debt'])if(!a.peaks[key]||p[key]>a.peaks[key].value)a.peaks[key]={value:p[key],at:p.at};}
    sample(s,true);return a;
  }
  function build(s){
    const a=ensure(s),living=s.living,dead=s.people.filter(p=>!p.alive),byId=new Map(s.people.map(p=>[p.id,p]));
    const childCount=new Map();for(const p of s.people)for(const id of new Set(p.parents))childCount.set(id,(childCount.get(id)||0)+1);
    const person=p=>p?{id:p.id,name:p.name,age:p.age,alive:p.alive,generation:(p.learning?.generation||0)+1,skill:round(p.skill||0),children:childCount.get(p.id)||0,successes:p.learning?.successes||0,lessons:p.learning?.lessons||0}:null;
    const cohorts=new Map(),families=new Map();
    for(const p of s.people){const l=p.learning||{},g=(l.generation||0)+1;let c=cohorts.get(g);if(!c){c={generation:g,total:0,living:0,successes:0,failures:0,lessons:0,inherited:0,skill:0,preferences:{}};cohorts.set(g,c);}c.total++;c.living+=p.alive?1:0;c.successes+=l.successes||0;c.failures+=l.failures||0;c.lessons+=l.lessons||0;c.inherited+=l.inherited||0;c.skill+=p.skill||0;
      for(const [key,v] of Object.entries(l.values||{})){c.preferences[key]??={title:v.title,value:0,count:0};c.preferences[key].value+=v.value;c.preferences[key].count++;}
      let f=families.get(p.surname);if(!f){f={name:p.surname,total:0,living:0,generations:new Set(),eldest:null};families.set(p.surname,f);}f.total++;f.living+=p.alive?1:0;f.generations.add(g);if(!f.eldest||p.age>f.eldest.age)f.eldest=person(p);
    }
    const generations=[...cohorts.values()].sort((a,b)=>a.generation-b.generation).map(c=>{const favorite=Object.values(c.preferences).map(v=>({title:v.title,value:round(v.value/v.count)})).sort((a,b)=>b.value-a.value)[0];return {...c,skill:round(c.skill/c.total),successRate:c.successes+c.failures?round(c.successes/(c.successes+c.failures)*100):null,favorite,preferences:undefined};});
    const dynasties=[...families.values()].map(f=>({...f,generations:f.generations.size})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name)).slice(0,8);
    const memo=new Map();function lineage(p,visiting=new Set()){if(memo.has(p.id))return memo.get(p.id);if(visiting.has(p.id))return [];visiting.add(p.id);let best=[];for(const id of p.parents){const parent=byId.get(id);if(parent){const chain=lineage(parent,new Set(visiting));if(chain.length>best.length)best=chain;}}const result=[...best,person(p)];memo.set(p.id,result);return result;}
    let chain=[];for(const p of s.people){const next=lineage(p);if(next.length>chain.length)chain=next;}
    const top=score=>person([...s.people].sort((a,b)=>score(b)-score(a)||a.id-b.id)[0]);
    const stories=Object.values(a.stories).flat().filter(e=>e.importance!=='minor').sort((a,b)=>(b.importance==='critical')-(a.importance==='critical')||b.day-a.day||b.minute-a.minute).slice(0,24).sort((a,b)=>a.day-b.day||a.minute-b.minute);
    const timeline=copy(a.timeline);const end=snapshot(s);if(timeline.at(-1)?.at===end.at)timeline[timeline.length-1]=end;else timeline.push(end);
    const deaths={};for(const p of dead){const key=p.deathCause||'unknown';deaths[key]=(deaths[key]||0)+1;}
    const rows=s.buildings.filter(b=>b.type==='home'&&!b.construction).map(b=>({id:b.id,name:b.name,capacity:s.buildingCapacity(b),count:living.filter(p=>p.homeId===b.id&&p.absence?.status!=='away').length}));
    return copy({version:1,at:s.now,day:s.day,year:s.year,elapsedDays:round(Math.max(0,(s.now-430)/1440)),elapsedYears:round(Math.max(0,(s.now-430)/1440/24)),coverage:{legacy:a.legacy,installedAt:a.installedAt,chartSince:a.chartSince,moneySince:a.moneySince,eventSince:a.eventSince,statisticsSince:s.statistics.sinceDay},
      population:{living:living.length,inCity:s.alive.length,ever:s.people.length,births:s.births,deaths:s.deaths,immigrants:s.expansion?.immigrants||0,away:living.filter(p=>p.absence?.status==='away').length,causes:deaths},
      economy:{treasury:round(s.treasury),debt:round(s.region.debt),paidRegion:round(s.region.totalPaid),exportRevenue:round(s.commerce.totalRevenue),exportSince:s.commerce.sinceDay,regionSince:s.statistics.sinceDay,income:copy(a.income),expenses:copy(a.expenses),production:copy(s.statistics.production),consumption:copy(s.statistics.consumption),food:s.food,deliveries:s.deliveries,trips:s.statistics.trips},
      city:{happiness:s.happiness,built:s.buildings.filter(b=>b.expansion&&!b.construction).length,constructing:s.buildings.filter(b=>b.construction).length,moves:s.housing?.moves||0,crowded:rows.filter(r=>r.count>r.capacity).length,houses:rows.length,comfortable:rows.reduce((n,r)=>n+r.capacity,0)},
      development:s.development?{completed:s.development.completed,spent:round(s.development.spent),hallLevel:s.building('hall').development.level,upgraded:s.buildings.filter(b=>b.development.level>1).length,offices:copy(s.government.offices)}:null,
      guilds:s.guilds?{built:s.guilds.built,taxPaid:s.guilds.taxPaid,permitsPaid:s.guilds.permitsPaid,groups:s.guilds.groups.map(g=>({name:g.name,cash:round(g.cash),assets:s.buildings.filter(b=>b.guildId===g.id).length,dividends:round(g.dividends)}))}:null,
      learning:{successes:generations.reduce((n,g)=>n+g.successes,0),failures:generations.reduce((n,g)=>n+g.failures,0),lessons:generations.reduce((n,g)=>n+g.lessons,0),generations:generations.length},
      generations,dynasties,lineage:chain,heroes:{oldest:top(p=>p.age),parent:top(p=>childCount.get(p.id)||0),experienced:top(p=>p.learning?.successes||0),wealthy:person([...living].sort((a,b)=>b.coins-a.coins)[0])},
      timeline,peaks:copy(a.peaks),counts:copy(a.counts),stories,activeCrises:(s.incidents||[]).filter(e=>e.status==='active').map(e=>({title:e.title,type:e.type})),mayor:person(s.person(s.mayorId))});
  }
  function finish(s){if(s.conclusion)return s.conclusion;ensure(s);sample(s,true);s.conclusion=build(s);return s.conclusion;}
  function resume(s){s.conclusion=null;}
  function load(s){const a=ensure(s,true);if(a.version!==1||!Array.isArray(a.timeline)||a.timeline.length>361||!Number.isFinite(a.stride)||a.stride<360||!a.peaks||!a.stories||!a.income||!a.expenses)throw Error('Некорректный архив итогов');if(s.conclusion&&(s.conclusion.version!==1||s.conclusion.at!==s.now||!Array.isArray(s.conclusion.generations)||!Array.isArray(s.conclusion.timeline)||!s.conclusion.population))throw Error('Некорректный итоговый отчёт');}
  const api={ensure,record,money,sample,build,finish,resume,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigReport=api;
})(typeof window!=='undefined'?window:globalThis);
