(function(root){
  'use strict';
  const W=typeof module!=='undefined'&&module.exports?require('./world.js'):root.DanzigWorld;
  const kinds={cottage:{name:'Простой дом',cost:180,days:2,cash:0,capacity:6,rent:1,tax:1,upgrade:1,comfort:0,symbol:'⌂'},townhouse:{name:'Городской дом',cost:420,days:4,cash:0,capacity:8,rent:1.25,tax:1.5,upgrade:1.5,comfort:2,symbol:'▥'},manor:{name:'Дворянское поместье',cost:1800,days:8,cash:0,capacity:10,rent:2,tax:3,upgrade:3,comfort:4,symbol:'♜'}};
  const noble=b=>W.insideTown(b.x,b.y)&&W.Layout.districtAt(b.x,b.y)==='noble';
  const allowed=b=>W.insideTown(b.x,b.y)?noble(b)?['townhouse','manor']:['townhouse']:['cottage'];
  const kind=b=>b?.residence||(!b?'cottage':noble(b)?'manor':W.insideTown(b.x,b.y)?'townhouse':'cottage');
  const spec=b=>kinds[kind(b)];
  const eligible=(b,people)=>kind(b)!=='manor'||people.some(p=>p.alive&&p.age>=18&&p.estate==='noble');
  function ensure(s){for(const b of s.buildings)if(b.type==='home')b.residence??=kind(b);}
  function load(s){ensure(s);for(const b of s.buildings)if(b.residence!==undefined&&(b.type!=='home'||!kinds[b.residence]||!allowed(b).includes(b.residence)))throw Error('Некорректный вид жилья');}
  const api={kinds,noble,allowed,kind,spec,eligible,ensure,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigResidences=api;
})(typeof window!=='undefined'?window:globalThis);
