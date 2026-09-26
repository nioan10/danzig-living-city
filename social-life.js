(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function kin(a,b){return !!(a&&b)&&(a.spouseId===b.id||a.parents.includes(b.id)||b.parents.includes(a.id)||a.parents.some(id=>b.parents.includes(id)));}
  function trust(s,a,b){if(!a||!b)return 0;return clamp((a.relationships[b.id]||0)+(kin(a,b)?25:0),-100,100);}
  function change(s,a,b,amount,why){if(!a||!b||a.id===b.id)return;a.relationships[b.id]=clamp((a.relationships[b.id]||0)+amount,-100,100);b.relationships[a.id]=clamp((b.relationships[a.id]||0)+amount*.65,-100,100);s.remember(a,amount>=0?'help':'quarrel',b.id,why,amount>=0?3:-4);}
  function share(s,listener,speaker){
    const confidence=clamp(.4+trust(s,listener,speaker)/200,.1,.85);
    for(const [id,k]of Object.entries(speaker.knowledge)){
      const old=listener.knowledge[id];if(s.now-k.seenAt>3*1440||old&&old.seenAt>=k.seenAt)continue;
      // A rumour keeps its original observation date. Each relay loses certainty.
      const copy=JSON.parse(JSON.stringify(k));copy.confidence=(k.confidence??1)*confidence;copy.source=speaker.id;copy.hops=(k.hops||0)+1;
      if(copy.prices&&copy.hops===1&&trust(s,listener,speaker)<15){const drift=1+(s.random()-.5)*.12;for(const good of Object.keys(copy.prices))copy.prices[good]*=drift;}
      listener.knowledge[id]=copy;
    }
    // Recommendations require a real encounter with a worker, not a global roster scan.
    if(speaker.jobId&&trust(s,listener,speaker)>=12&&listener.knowledge[speaker.jobId])listener.knowledge[speaker.jobId].recommendedBy={id:speaker.id,at:s.now};
  }
  function supplierBias(s,p,b,known){
    const owner=s.person(b.ownerId),bond=trust(s,p,owner),recommendation=known.recommendedBy;
    const referred=recommendation&&s.now-recommendation.at<7*1440?trust(s,p,s.person(recommendation.id))*.035:0;
    const habit=p.patronage?.find(x=>x.id===b.id);return bond*.025+referred+(habit?Math.min(1.5,habit.visits*.15)*Math.exp(-(s.now-habit.at)/10080):0);
  }
  function bought(s,p,b){p.patronage??=[];let row=p.patronage.find(x=>x.id===b.id);if(!row){row={id:b.id,visits:0,at:s.now};p.patronage.unshift(row);}row.visits++;row.at=s.now;p.patronage=p.patronage.slice(0,8);}
  function politicalSupport(s,p){return Math.min(12,s.alive.reduce((n,q)=>n+Math.max(-1,Math.min(1,(q.relationships[p.id]||0)/40)),0)*.3);}
  function load(s){for(const p of s.people){p.patronage??=[];if(!Array.isArray(p.patronage)||p.patronage.length>8||!p.patronage.every(x=>s.building(x.id)&&Number.isFinite(x.visits)&&x.visits>=0&&Number.isFinite(x.at)&&x.at>=0))throw Error('Некорректные торговые связи');for(const k of Object.values(p.knowledge)){if(k.prices&&!Object.values(k.prices).every(v=>Number.isFinite(v)&&v>0)||k.confidence!==undefined&&(!Number.isFinite(k.confidence)||k.confidence<0||k.confidence>1))throw Error('Некорректные сведения жителя');}}}
  const api={kin,trust,change,share,supplierBias,bought,politicalSupport,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigSocial=api;
})(typeof window!=='undefined'?window:globalThis);
