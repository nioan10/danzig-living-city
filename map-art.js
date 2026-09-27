(function(root){
  // The schematic map and simulation use one street survey.
  // Legacy saves migrate their routes once in World.migrate.
  const W=typeof module!=='undefined'&&module.exports?require('./world.js'):root.DanzigWorld;
  const nodes=Object.fromEntries(Object.entries(W.nodes).map(([id,p])=>[id,{x:p.x,y:p.y}])),centers=Object.fromEntries(W.routeBuildings().map(b=>[b.id,[b.x,b.y]])),bends={};
  function edgePoints(a,b){const mid=bends[a+'>'+b]||bends[b+'>'+a]?.slice().reverse()||[];return[nodes[a],...mid.map(([x,y])=>({x,y})),nodes[b]];}
  function onEdge(a,b,t){const ps=edgePoints(a,b),ls=ps.slice(1).map((p,i)=>Math.hypot(p.x-ps[i].x,p.y-ps[i].y)),total=ls.reduce((a,b)=>a+b,0);let d=Math.max(0,Math.min(1,t))*total;for(let i=0;i<ls.length;i++){if(d<=ls[i]||i===ls.length-1){const q=ls[i]?d/ls[i]:0;return{x:ps[i].x+(ps[i+1].x-ps[i].x)*q,y:ps[i].y+(ps[i+1].y-ps[i].y)*q};}d-=ls[i];}return ps[0];}
  function personPoint(p,fraction=1){
    const segments=p.motionSegments||[];if(segments.length){let distance=segments.reduce((n,v)=>n+v.distance,0)*Math.max(0,Math.min(1,fraction));for(let i=0;i<segments.length;i++){const v=segments[i];if(distance<=v.distance||i===segments.length-1)return onEdge(v.from,v.to,v.start+(v.end-v.start)*(v.distance?distance/v.distance:1));distance-=v.distance;}}
    if(p.path.length){const n=p.path[0],a=W.nodes[p.navNode],total=Math.hypot(n.x-a.x,n.y-a.y);return onEdge(p.navNode,n.id,total?1-Math.hypot(n.x-p.x,n.y-p.y)/total:1);}return{...nodes[p.navNode]};
  }
  function remainingPath(p){
    if(!p.path.length)return[];
    const n=p.path[0],a=W.nodes[p.navNode],total=Math.hypot(n.x-a.x,n.y-a.y),t=total?1-Math.hypot(n.x-p.x,n.y-p.y)/total:1;
    const points=edgePoints(p.navNode,n.id),lengths=points.slice(1).map((v,i)=>Math.hypot(v.x-points[i].x,v.y-points[i].y));
    let distance=Math.max(0,Math.min(1,t))*lengths.reduce((a,b)=>a+b,0),index=0;while(index<lengths.length-1&&distance>=lengths[index])distance-=lengths[index++];
    return[onEdge(p.navNode,n.id,t),...points.slice(index+1),...p.path.slice(1).flatMap((v,i)=>edgePoints(p.path[i].id,v.id).slice(1))];
  }
  const api={nodes,centers,edgePoints,onEdge,personPoint,remainingPath};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigArt=api;
})(typeof window!=='undefined'?window:globalThis);
