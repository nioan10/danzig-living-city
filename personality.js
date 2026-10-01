(function(root){
  'use strict';
  const labels={honesty:'Честность',justice:'Справедливость',familyLoyalty:'Лояльность семье'};
  const feelings={grief:'Горе',fear:'Страх',anger:'Обида',stress:'Напряжение',confidence:'Уверенность'};
  const effects={bereavement:{grief:1,stress:.25},victim:{fear:1,anger:.7},punished:{stress:1,confidence:-.5},help:{confidence:.3,fear:-.2},betrayal:{anger:1,stress:.3},success:{confidence:.5},failure:{confidence:-.3,stress:.5},reconcile:{anger:-.6,fear:-.3},aid:{confidence:.2},repaid:{confidence:.3},conflict:{anger:.4,stress:.2},nickname:{}};
  const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
  function hash(text){let v=2166136261;for(const c of text)v=Math.imul(v^c.charCodeAt(0),16777619);return (v>>>0)/4294967296;}
  const kin=(p,q)=>!!q&&(p.spouseId===q.id||p.parents.includes(q.id)||q.parents.includes(p.id)||p.parents.some(id=>q.parents.includes(id)));
  function person(s,p){
    if(p.character)return p.character;
    const parents=p.parents.map(id=>s.person(id)).filter(q=>q?.character),values={};
    for(const k of Object.keys(labels)){let value=.15+hash(p.id+':'+p.name+':'+k)*.7;if(parents.length)value=value*.45+parents.reduce((n,q)=>n+q.character.values[k],0)/parents.length*.55;values[k]=clamp(value,.05,.95);}
    return p.character={version:1,values,origin:{...values},state:{grief:0,fear:0,anger:0,stress:0,confidence:35},lastDay:s.day,events:[],deeds:{aid:0,reconcile:0,repaid:0},nickname:null};
  }
  function event(s,p,kind,subject,text,impact=20){
    const c=person(s,p),effect=effects[kind];if(!effect)return false;
    // A repeated encounter is not a new trauma every five-minute model step.
    if(c.events.some(e=>e.kind===kind&&e.subject===subject&&s.now-e.at<1440))return false;
    impact=clamp(impact,0,45);for(const [k,n]of Object.entries(effect))c.state[k]=clamp(c.state[k]+n*impact);
    if(kind==='betrayal'&&kin(p,s.person(subject)))c.values.familyLoyalty=clamp(c.values.familyLoyalty-.003,Math.max(.05,c.origin.familyLoyalty-.12),Math.min(.95,c.origin.familyLoyalty+.12));
    if(kind==='help')c.values.justice=clamp(c.values.justice+.002,Math.max(.05,c.origin.justice-.12),Math.min(.95,c.origin.justice+.12));
    c.events.unshift({at:s.now,kind,subject,text:String(text).slice(0,300)});c.events=c.events.slice(0,24);
    if(Object.hasOwn(c.deeds,kind)){c.deeds[kind]++;const names={aid:'Щедрая рука',reconcile:'Миротворец',repaid:'Честное слово'};if(!c.nickname&&c.deeds[kind]>=3){c.nickname=names[kind];c.events.unshift({at:s.now,kind:'nickname',subject:p.id,text:'Соседи прозвали «'+c.nickname+'» за повторные поступки'});c.events=c.events.slice(0,24);s.log(p.name+' заслужил прозвище «'+c.nickname+'».','life',p.id);}}
    return true;
  }
  function bereave(s,dead){for(const p of s.alive){if(p.id===dead.id)continue;const close=kin(p,dead),friend=(p.relationships[dead.id]||0)>50;if(close||friend)event(s,p,'bereavement',dead.id,'Потеря близкого: '+dead.name,close?38:15);}}
  function daily(s){for(const p of s.living){const c=person(s,p);if(c.lastDay>=s.day)continue;const days=s.day-c.lastDay;c.lastDay=s.day;c.state.grief*=.94**days;c.state.anger*=.86**days;c.state.fear*=.9**days;const stress=clamp(Math.max(0,35-p.hunger)*1.2+Math.max(0,18-p.coins)*1.4+(p.sick?15:0)+(p.absence?12:0));c.state.stress=clamp(c.state.stress*.7**days+stress*(1-.7**days));c.state.confidence=clamp(c.state.confidence*.9**days+(p.reputation*.45+p.skill*4)*(1-.9**days));}}
  function conflict(s,p,q){
    const c=person(s,p),v=c.values,t=c.state,m=p.mind?.personality||{},family=kin(p,q);
    const choices=[
      {kind:'principle',score:v.justice*42+v.honesty*12,reason:'Требует признать несправедливость и разобраться по правилам'},
      {kind:'bargain',score:(1-v.honesty)*36+(m.ambition||.5)*18,reason:'Ищет выгодное для себя соглашение'},
      {kind:'family',score:family?v.familyLoyalty*62:0,reason:'Ставит сохранение семейной связи выше спора'},
      {kind:'reconcile',score:(m.empathy||.5)*27+v.honesty*12-t.anger*.1,reason:'Старается примириться и восстановить доверие'},
      {kind:'withdraw',score:(m.caution||.5)*12+t.fear*.35+t.stress*.15,reason:'Избегает столкновения из-за страха и напряжения'}
    ];return choices.sort((a,b)=>b.score-a.score)[0];
  }
  function bias(p,goal){
    const c=p.character;if(!c)return{score:0,why:[]};const v=c.values,t=c.state;let score=0,reason='';
    if(goal==='civicOffence'){score=(.5-v.honesty)*26+t.anger*.08;reason='Честность и пережитая обида';}
    if(['care','familyAid'].includes(goal)){score=(v.familyLoyalty-.5)*7+t.grief*.03;reason='Привязанность к семье и пережитая утрата';}
    if(['civicVote','civicNominate'].includes(goal)){score=(v.justice-.5)*5-t.fear*.04;reason='Отношение к справедливости и страх';}
    if(['friend','social','faith'].includes(goal)){score=t.grief*.05+t.stress*.03;reason='Ищет поддержку после пережитого';}
    if(['enterprise','invest'].includes(goal)){score=(t.confidence-35)*.04-t.stress*.04;reason='Уверенность в себе и напряжение';}
    if(goal==='repay'){score=(v.honesty-.5)*18;reason='Отношение к исполнению обещаний';}
    return{score,why:Math.abs(score)>=1.5?[reason]:[]};
  }
  function mood(p){const t=p.character?.state;return t?(t.confidence-35)*.025-t.grief*.1-t.stress*.03:0;}
  function load(s){
    const finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
    // Parents precede children in normal saves; sort migration explicitly for older exports.
    for(const p of [...s.people].sort((a,b)=>b.age-a.age||a.id-b.id)){
      const c=person(s,p);
      if(c.version!==1||!c.values||!c.origin||!Object.keys(labels).every(k=>finite(c.values[k],0,1)&&finite(c.origin[k],0,1))||!c.state||!Object.keys(feelings).every(k=>finite(c.state[k],0,100))||!finite(c.lastDay,0,s.day)||!c.deeds||!['aid','reconcile','repaid'].every(k=>Number.isInteger(c.deeds[k])&&c.deeds[k]>=0)||!Array.isArray(c.events)||c.events.length>24||c.events.some(e=>!finite(e.at,0,s.now)||!Object.hasOwn(effects,e.kind)||typeof e.text!=='string'||e.text.length>300||e.subject!==null&&!s.person(e.subject))||c.nickname!==null&&(typeof c.nickname!=='string'||c.nickname.length>50))throw Error('Некорректная биография жителя');
    }
  }
  const api={labels,feelings,person,event,bereave,daily,conflict,bias,mood,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigPersonality=api;
})(typeof window!=='undefined'?window:globalThis);
