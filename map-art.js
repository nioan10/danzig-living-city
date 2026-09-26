(function(root){
  // Art-space coordinates register the painted streets to the simulation graph.
  // Only presentation changes: saved residents keep their original world coordinates.
  const junctions={
    field:[292,659],farmLane:[348,576],country:[428,507],westGate:[518,503],
    west:[612,480],bend:[699,440],marketWest:[802,460],square:[929,473],
    marketEast:[1070,527],quay:[1185,550],waterGate:[1307,540],port:[1431,554],
    portSouth:[1437,705],fishLane:[1378,850],millLane:[385,431],woodLane:[402,290],
    forest:[282,231],charcoalLane:[349,162],pastureLane:[380,733],pasture:[244,857],
    clayLane:[511,861],northGate:[788,148],north:[784,222],churchWest:[739,382],
    churchSouth:[880,367],council:[1037,423],northEast:[1114,291],chapelLane:[1080,216],
    quayNorth:[1225,336],quayBend:[1253,466],tavernLane:[797,636],westSouth:[685,556],
    craft:[689,768],south:[887,761],southGate:[951,887],southRoad:[947,1059],
    eastSouth:[1099,760],eastCraft:[1129,641]
  };
  const centers={h0:[589,437],h1:[637,374],h2:[710,305],h3:[596,555],h4:[616,629],h5:[795,363],h6:[909,508],h7:[1030,574],h8:[1003,676],h9:[1204,660],h10:[770,689],h11:[836,821],farm:[222,572],mill:[311,376],wood:[236,164],pasture:[178,787],sawmill:[459,269],charcoal:[360,119],clay:[427,837],bakery:[727,431],smith:[641,718],weaver:[1075,658],tailor:[1146,464],carpenter:[1023,821],potter:[593,687],fish:[1348,827],tavern:[798,565],church:[865,284],hall:[1006,370],market:[924,477],market2:[1223,428],clinic:[1117,269],school:[906,181],dock:[1414,501]};
  const nodes={};for(const[id,xy]of Object.entries(junctions))nodes[id]={x:xy[0],y:xy[1]};
  const W=typeof module!=='undefined'&&module.exports?require('./world.js'):root.DanzigWorld;
  for(const lot of W.expansionLots)centers[lot.id]=[lot.artX,lot.artY];
  for(const b of W.routeBuildings()){const xy=centers[b.id];const a=nodes[b.anchor],dx=a.x-xy[0],dy=a.y-xy[1],len=Math.hypot(dx,dy)||1;nodes['b:'+b.id]={x:xy[0]+dx/len*20,y:xy[1]+dy/len*20};}
  const bends={'country>westGate':[[466,498]],'westGate>west':[[555,494]],'west>bend':[[656,467]],'bend>marketWest':[[751,455]],'churchWest>churchSouth':[[798,372]],'quay>waterGate':[[1249,551]],'port>portSouth':[[1440,625]],'south>southGate':[[918,819]],'southGate>southRoad':[[952,969]],'forest>charcoalLane':[[319,205]],'millLane>woodLane':[[390,364]],'pastureLane>pasture':[[311,803]]};
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
