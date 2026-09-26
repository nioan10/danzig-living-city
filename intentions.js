(function(root){
  'use strict';
  const TACTICS={security:['Заработать резерв','Обратиться к близким','Сменить источник дохода'],mastery:['Практиковаться в ремесле','Найти наставника','Учиться в школе'],enterprise:['Копить собственный капитал','Искать партнёра','Подготовить семейное дело'],standing:['Укреплять знакомства','Помогать горожанам','Выполнять обязательства'],home:['Копить на переселение','Искать свободный дом','Улучшить семейный двор']};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function ensure(s,p,goal='security'){
    p.intention??={goal,since:s.day,reviewAt:s.day+6,tactic:0,failures:0,progress:0,paused:false,history:[],milestone:false,lastProgress:0,lastCheck:s.day};return p.intention;
  }
  function progress(s,p,h,goal){
    if(goal==='security')return Math.min(h.coins/Math.max(1,h.reserve),h.foodDays/2);
    if(goal==='mastery')return p.skill/6;
    if(goal==='enterprise')return p.guildId?1:p.coins/300;
    if(goal==='standing')return (p.reputation+Math.min(30,Object.values(p.relationships).filter(v=>v>=25).length*5))/100;
    return s.alive.filter(q=>q.homeId===p.homeId).length<=s.buildingCapacity(s.building(p.homeId))?1:0;
  }
  function review(s,p,h,suggested){
    const i=ensure(s,p,suggested);i.paused=h.coins<h.reserve*.3||p.health<40;
    if(s.day>=i.reviewAt||p.enterpriseWish&&i.goal!=='enterprise'){
      if(i.goal!==suggested){i.history.unshift({day:s.day,goal:i.goal,progress:i.progress,reason:i.milestone?'Цель достигнута':'Обстоятельства изменились'});i.history=i.history.slice(0,6);i.goal=suggested;i.since=s.day;i.tactic=0;i.failures=0;i.milestone=false;}
      i.reviewAt=s.day+6;
    }
    i.progress=clamp(progress(s,p,h,i.goal),0,1);
    if(s.day>i.lastCheck){if(i.progress>i.lastProgress+.02)i.failures=Math.max(0,i.failures-1);else if(s.day-i.since>=6&&i.progress<1&&s.day%3===p.id%3)i.tactic=(i.tactic+1)%3;i.lastProgress=i.progress;i.lastCheck=s.day;}
    if(i.progress>=1&&!i.milestone){i.milestone=true;i.history.unshift({day:s.day,goal:i.goal,progress:1,reason:'Достигнут ориентир'});i.history=i.history.slice(0,6);}
    return i.paused?'security':i.goal;
  }
  function fail(s,p,kind){const i=ensure(s,p,p.mind?.goal||'security');if(!['unpaid','rejected','enterprise','development','deal','empty'].includes(kind))return;i.failures++;if(i.failures%3===0){i.tactic=(i.tactic+1)%3;i.history.unshift({day:s.day,goal:i.goal,progress:i.progress,reason:'После неудач: '+TACTICS[i.goal][i.tactic]});i.history=i.history.slice(0,6);}}
  function bias(p,goal){const i=p.intention;if(!i||i.paused)return 0;const favored={security:[['work','supply'],['negotiate'],['career','jobSearch']],mastery:[['work','supply'],['career','social'],['learn']],enterprise:[['work'],['negotiate','social'],['enterprise']],standing:[['social','friend'],['care','repair'],['repay']],home:[['work'],['housing','relocate'],['develop']]};return favored[i.goal]?.[i.tactic]?.includes(goal)?5:0;}
  function candidates(s,p,add,step){const i=p.intention;if(!i||p.age<16||p.absence||s.hour<8||s.hour>=18)return;if(i.goal==='mastery'&&i.tactic===2&&p.hunger>40&&p.energy>35)add('learn','Учиться ради нового ремесла',48+(p.mind?.personality.curiosity||0)*15,'Практика не даёт нужного продвижения. Посвящу время обучению',[step('learn','school','Заниматься с наставником',{duration:90})]);}
  function load(s){for(const p of s.people){const i=ensure(s,p,p.mind?.goal||'security');if(!Object.hasOwn(TACTICS,i.goal)||!Number.isInteger(i.tactic)||i.tactic<0||i.tactic>2||!['since','reviewAt','failures','progress','lastProgress','lastCheck'].every(k=>Number.isFinite(i[k])&&i[k]>=0)||i.progress>1||!Array.isArray(i.history)||i.history.length>6)throw Error('Некорректное намерение жителя');}}
  const api={TACTICS,ensure,review,fail,bias,candidates,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigIntentions=api;
})(typeof window!=='undefined'?window:globalThis);
