(function(root){
  'use strict';
  const Mind=typeof module!=='undefined'&&module.exports?require('./citizen-mind.js'):root.DanzigMind;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function ensure(s,p){if(p.learning)return p.learning;const parents=(p.parents||[]).map(id=>s.person(id)).filter(Boolean),values={};for(const parent of parents)for(const[goal,v]of Object.entries(parent.learning?.values||{})){if(!values[goal])values[goal]={value:0,trials:0,title:v.title};values[goal].value+=v.value*.55/parents.length;}
    p.learning={generation:parents.length?1+Math.max(...parents.map(q=>q.learning?.generation||0)):0,values,successes:0,failures:0,inherited:Object.keys(values).length,lessons:0,lastLesson:-1,history:[]};return p.learning;}
  function bias(s,p,goal){const l=ensure(s,p);return clamp(l.values[goal]?.value||0,-12,12);}
  function baseline(p){return{hunger:p.hunger,energy:p.energy,social:p.social,health:p.health,coins:p.coins};}
  function observe(s,p,plan,success,why=''){
    if(!plan?.goal)return;const l=ensure(s,p),before=plan.baseline||baseline(p);const status=success&&plan.goal==='title'?(plan.titlePaid||0)*.3+(plan.titleBenefit||0):0;const benefit=status+(p.hunger-before.hunger)*.12+(p.energy-before.energy)*.1+(p.social-before.social)*.08+(p.health-before.health)*.15+(p.coins-before.coins)*.3;
    // A local failure is evidence about that supplier/employer, not every job.
    const reward=success?clamp(3+benefit+clamp(plan.householdBenefit||0,0,8),-5,12):plan.contextualFailure?-2:-10;const v=l.values[plan.goal]||{value:0,trials:0,title:plan.title};v.value=clamp(v.value*.82+reward*.18,-12,12);v.trials++;v.title=plan.title;l.values[plan.goal]=v;if(success)l.successes++;else l.failures++;
    l.history.unshift({at:s.now,goal:plan.goal,title:plan.title,success,reward:Math.round(reward*10)/10||0,why:why||'План завершён'});l.history=l.history.slice(0,8);
    Mind.finished(s,p,plan,success);
  }
  function teach(s){for(const child of s.alive.filter(p=>p.age>=6&&p.age<16&&!p.absence)){const l=ensure(s,child);if(l.lastLesson===s.day)continue;const parents=child.parents.map(id=>s.person(id)).filter(p=>p?.alive&&!p.absence&&p.homeId===child.homeId);const lessons=parents.flatMap(p=>Object.entries(ensure(s,p).values).filter(([,v])=>v.trials>=2).map(([goal,v])=>({goal,v,parent:p}))).sort((a,b)=>Math.abs(b.v.value)-Math.abs(a.v.value));if(!lessons.length)continue;const lesson=lessons[s.day%Math.min(3,lessons.length)],v=l.values[lesson.goal]||{value:0,trials:0,title:lesson.v.title};v.value=clamp(v.value*.92+lesson.v.value*.65*.08,-12,12);l.values[lesson.goal]=v;l.lessons++;l.lastLesson=s.day;child.skill=Math.min(10,child.skill+.015);if(l.lessons===1||l.lessons%6===0)s.remember(child,'lesson',lesson.parent.id,'Урок от '+lesson.parent.name+': '+lesson.v.title.toLowerCase(),2);}}
  const api={ensure,bias,baseline,observe,teach};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigLearning=api;
})(typeof window!=='undefined'?window:globalThis);
