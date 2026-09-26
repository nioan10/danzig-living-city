(function (root) {
  'use strict';
  const WIDTH = 1600, HEIGHT = 1100;
  // Streets are shared by navigation and rendering. No actor can cross a wall
  // merely because the destination is closer in a straight line.
  const junctions = {
    field: [285, 754], farmLane: [350, 675], country: [435, 625], westGate: [520, 595],
    west: [605, 580], bend: [692, 548], marketWest: [797, 576], square: [925, 610],
    marketEast: [1060, 633], quay: [1187, 650], waterGate: [1286, 620], port: [1390, 651],
    portSouth: [1394, 812], fishLane: [1360, 897],
    millLane: [392, 527], woodLane: [420, 396], forest: [293, 340], charcoalLane: [369, 280],
    pastureLane: [385, 836], pasture: [264, 941], clayLane: [492, 905],
    northGate: [785, 254], north: [781, 337], churchWest: [741, 458],
    churchSouth: [885, 496], council: [1030, 527], northEast: [1094, 419],
    chapelLane: [1046, 332], quayNorth: [1195, 454], quayBend: [1222, 546],
    tavernLane: [820, 739], westSouth: [698, 693], craft: [709, 871],
    south: [877, 859], southGate: [953, 958], southRoad: [948, 1055],
    eastSouth: [1094, 853], eastCraft: [1139, 741],
  };
  const streetSpecs = [
    ['field','farmLane',13,'country'],['farmLane','country',14,'country'],['country','westGate',17,'country'],
    ['westGate','west',20,'main'],['west','bend',19,'main'],['bend','marketWest',22,'main'],
    ['marketWest','square',30,'main'],['square','marketEast',29,'main'],['marketEast','quay',22,'main'],
    ['quay','waterGate',20,'main'],['waterGate','port',20,'main'],['port','portSouth',17,'quay'],['portSouth','fishLane',13,'country'],
    ['country','millLane',12,'country'],['millLane','woodLane',12,'country'],['woodLane','forest',12,'country'],['forest','charcoalLane',9,'country'],
    ['farmLane','pastureLane',12,'country'],['pastureLane','pasture',10,'country'],['pastureLane','clayLane',10,'country'],['clayLane','southRoad',10,'country'],
    ['northGate','north',19,'main'],['north','churchWest',16,'lane'],['churchWest','bend',16,'lane'],
    ['churchWest','churchSouth',15,'lane'],['churchSouth','council',17,'lane'],['churchSouth','marketWest',16,'lane'],
    ['council','marketEast',15,'lane'],['council','northEast',16,'lane'],['northEast','chapelLane',13,'lane'],
    ['chapelLane','north',13,'lane'],['northEast','quayNorth',13,'lane'],['quayNorth','quayBend',14,'quay'],['quayBend','quay',15,'quay'],
    ['west','westSouth',15,'lane'],['westSouth','tavernLane',16,'lane'],['tavernLane','square',18,'lane'],
    ['westSouth','craft',16,'lane'],['craft','south',17,'lane'],['tavernLane','south',15,'lane'],
    ['south','southGate',20,'main'],['southGate','southRoad',17,'country'],['south','eastSouth',16,'lane'],
    ['eastSouth','eastCraft',14,'lane'],['eastCraft','marketEast',15,'lane'],['eastCraft','quay',15,'lane'],
  ];
  const wall = [[520,595],[503,447],[598,323],[785,254],[978,226],[1163,267],[1268,393],[1302,523],[1286,620],[1265,803],[1140,928],[953,958],[756,942],[586,829],[520,595]];
  const gates = ['westGate','northGate','waterGate','southGate'];
  const lots = [
    ['h0','home','Дом семьи Фогель',627,471,37,48,'west',8],
    ['h1','home','Дом семьи Беккер',671,455,38,54,'churchWest',-13],
    ['h2','home','Дом семьи Крюгер',707,388,35,47,'north',18],
    ['h3','home','Дом семьи Вебер',602,650,37,46,'westSouth',-16],
    ['h4','home','Дом семьи Фишер',643,711,39,47,'westSouth',12],
    ['h5','home','Дом семьи Шульц',804,478,37,41,'churchSouth',-12],
    ['h6','home','Дом семьи Мюллер',966,558,35,43,'square',10],
    ['h7','home','Дом семьи Шнайдер',1031,710,40,45,'marketEast',-16],
    ['h8','home','Дом семьи Бауэр',995,795,34,51,'eastSouth',-9],
    ['h9','home','Дом семьи Кох',1165,844,39,51,'eastSouth',12],
    ['h10','home','Дом семьи Вольф',777,792,40,47,'south',-8],
    ['h11','home','Дом семьи Брандт',833,897,36,39,'south',7],
    ['farm','farm','Хутор за Высокими воротами',228,679,66,41,'field',-13],
    ['mill','mill','Ветряная мельница на холме',325,467,51,46,'millLane',-8],
    ['wood','wood','Лесной промысел',260,264,65,39,'forest',12],
    ['pasture','pasture','Овечий двор',217,871,65,40,'pasture',-8],
    ['sawmill','sawmill','Пильный двор',482,365,67,42,'woodLane',-17],
    ['charcoal','charcoal','Углежог у рощи',375,217,46,36,'charcoalLane',8],
    ['clay','clay','Глиняный карьер',424,907,45,32,'clayLane',-10],
    ['bakery','bakery','Пекарня «Золотой колос»',741,539,48,39,'marketWest',8],
    ['smith','smith','Кузница братьев Вольф',650,831,61,41,'craft',9],
    ['weaver','weaver','Суконный двор',1065,772,59,43,'eastCraft',-14],
    ['tailor','tailor','Портняжная мастерская',1127,569,35,43,'marketEast',14],
    ['carpenter','carpenter','Столярный двор',1031,897,60,36,'eastSouth',7],
    ['potter','potter','Гончарный двор',608,759,50,35,'westSouth',-10],
    ['fish','fish','Рыбацкое предместье',1300,880,65,35,'fishLane',-12],
    ['tavern','tavern','Трактир «Три гуся»',807,681,62,47,'tavernLane',12],
    ['church','church','Церковь Святой Марии',875,384,117,68,'churchSouth',-5],
    ['hall','hall','Городская ратуша',1020,462,75,51,'council',8],
    ['market','market','Длинный рынок',911,614,138,67,'square',-8],
    ['market2','market','Купеческая лавка у воды',1204,579,43,53,'quayBend',-10],
    ['clinic','clinic','Лечебница Святого Луки',1115,357,58,46,'northEast',12],
    ['school','school','Приходская школа',912,296,58,41,'chapelLane',-7],
    ['dock','dock','Ганзейская пристань',1351,588,70,51,'port',-7],
  ];
  const expansionLots=[
    ['new1','Южное предместье · запад',650,1018,'southRoad',650,976,['home','bakery','tailor','potter']],
    ['new2','Южное предместье · середина',742,1040,'southRoad',755,1000,['home','weaver','carpenter']],
    ['new3','Южное предместье · восток',1080,1020,'southRoad',1085,980,['home','bakery','smith']],
    ['new4','Гончарная слобода',560,952,'clayLane',590,908,['home','potter','carpenter','sawmill']],
    ['new5','Западные поля',160,738,'field',167,691,['farm','pasture']],
    ['new6','Мельничный просёлок',295,595,'farmLane',265,511,['mill','farm']],
    ['new7','Лесная опушка',150,350,'forest',151,303,['wood','charcoal']],
    ['new8','Рыбацкая слобода',1220,983,'fishLane',1225,936,['fish','home']],
  ].map(([id,name,x,y,anchor,artX,artY,types])=>({id,name,x,y,anchor,artX,artY,types}));
  // Surveyed peripheral land: only occupied parcels add visible roads and buildings.
  const extraLand=[
    [420,1005,'clayLane',430,970,['home','bakery','potter','carpenter']],
    [510,1030,'clayLane',515,1020,['home','weaver','tailor','smith']],
    [835,1035,'southRoad',842,1005,['home','bakery','tailor']],
    [980,1025,'southRoad',1000,1015,['home','bakery','potter']],
    [1180,1000,'fishLane',1120,1040,['home','weaver','carpenter']],
    [1310,1020,'fishLane',1160,970,['fish','home']],
    [90,620,'farmLane',80,575,['farm','mill']],
    [100,865,'pasture',95,815,['farm','pasture']],
    [280,1015,'pasture',265,990,['farm','pasture','mill']],
    [120,480,'forest',75,420,['wood','charcoal','sawmill']],
    [475,220,'woodLane',460,175,['wood','sawmill','charcoal']],
    [590,180,'northGate',570,140,['home','smith','potter','clay']],
    [650,140,'northGate',665,95,['home','tailor','weaver']],
    [920,135,'northGate',935,105,['home','bakery','carpenter']],
    [1080,130,'northGate',1070,105,['home','smith','potter']],
    [210,970,'pasture',160,960,['farm','pasture','mill']]
  ];
  for(const [i,[x,y,anchor,artX,artY,types]]of extraLand.entries())expansionLots.push({id:'new'+(i+9),name:'Новая слобода · участок '+(i+9),x,y,anchor,artX,artY,types});
  function fromLot([id,type,name,x,y,w,h,anchor,angle],i=0){return {
      id,type,name,x,y,w,h,anchor,angle,
      door: type==='market'&&id==='market'?{x:925,y:610}:{x:x+Math.sin(angle*Math.PI/180)*-h*.45,y:y+h*.55+16},
      progress:0,output:0,today:0,damaged:false,damageDay:-1,repairedDay:-1,repairWork:0,closedUntil:0,
      stock:{},cash:type==='home'?0:200,wage:1.15+(i%4)*.1,ownerId:null,
    };}
  function buildings() {return lots.map(fromLot);}
  function expansionBuilding(id,type){const lot=expansionLots.find(l=>l.id===id);if(!lot||!lot.types.includes(type))return null;return {...fromLot([id,type,lot.name,lot.x,lot.y,54,42,lot.anchor,-8]),expansion:true};}
  function routeBuildings(){return [...buildings(),...expansionLots.map(l=>expansionBuilding(l.id,l.types[0]))];
  }
  const nodes=Object.fromEntries(Object.entries(junctions).map(([id,[x,y]])=>[id,{id,x,y}]));
  const edges=streetSpecs.map(([a,b,width,kind])=>({a,b,width,kind}));
  for(const b of routeBuildings()){nodes['b:'+b.id]={id:'b:'+b.id,...b.door};edges.push({a:b.anchor,b:'b:'+b.id,width:5,kind:'entrance',expansion:b.expansion||false});}
  const adjacency=Object.fromEntries(Object.keys(nodes).map(id=>[id,[]]));
  for(const e of edges){const a=nodes[e.a],b=nodes[e.b],d=Math.hypot(a.x-b.x,a.y-b.y);adjacency[e.a].push({id:e.b,d});adjacency[e.b].push({id:e.a,d});}
  const cache=new Map();
  function route(from,to){
    if(!nodes[from]||!nodes[to])return null;
    const key=from+'>'+to;if(cache.has(key))return cache.get(key).map(p=>({...p}));
    const dist={[from]:0},prev={},open=new Set([from]),done=new Set();
    while(open.size){let current=null;for(const id of open)if(current===null||dist[id]<dist[current])current=id;open.delete(current);if(current===to)break;done.add(current);
      for(const next of adjacency[current])if(!done.has(next.id)){const d=dist[current]+next.d;if(d<(dist[next.id]??Infinity)){dist[next.id]=d;prev[next.id]=current;open.add(next.id);}}
    }
    if(dist[to]===undefined)return null;
    const ids=[];let id=to;while(id!==from){ids.unshift(id);id=prev[id];}const result=ids.map(id=>nodes[id]);cache.set(key,result);return result.map(p=>({...p}));
  }
  function distance(from,to){const path=route(from,to);if(!path)return Infinity;let at=nodes[from],total=0;for(const p of path){total+=Math.hypot(at.x-p.x,at.y-p.y);at=p;}return total;}
  function insideTown(x,y){let inside=false;for(let i=0,j=wall.length-1;i<wall.length;j=i++){const a=wall[i],b=wall[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
  const api={WIDTH,HEIGHT,junctions,nodes,edges,wall,gates,buildings,expansionLots,expansionBuilding,routeBuildings,route,distance,insideTown};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigWorld=api;
})(typeof window!=='undefined'?window:globalThis);
