(function(root){
  'use strict';
  const districts={
    suburbs:{name:'Предместья',estate:'common',rent:.18,tax:.5,color:'#dce6df'},
    artisan:{name:'Ремесленный квартал',estate:'artisan',rent:.45,tax:1,color:'#ecdcc9'},
    noble:{name:'Дворянский квартал',estate:'noble',rent:1,tax:1.6,color:'#e3dcef'},
    civic:{name:'Ратуша и собор',estate:'artisan',rent:.65,tax:1.2,color:'#dce5ec'},
    market:{name:'Торговый квартал',estate:'artisan',rent:.6,tax:1,color:'#ede7cf'},
    rural:{name:'Поля и промыслы',estate:'common',rent:.12,tax:.5,color:'#e1e8cd'},
    port:{name:'Портовая слобода',estate:'common',rent:.2,tax:.6,color:'#d4e6e9'}
  };
  const junctions={field:[220,550],farmLane:[350,550],country:[450,550],westGate:[540,550],west:[640,550],bend:[760,550],marketWest:[860,550],square:[960,550],marketEast:[1100,550],quay:[1220,550],waterGate:[1280,550],port:[1410,550],portSouth:[1410,780],fishLane:[1410,930],millLane:[350,400],woodLane:[350,240],forest:[220,240],charcoalLane:[220,130],pastureLane:[350,810],pasture:[220,810],clayLane:[450,1020],northGate:[760,230],north:[760,330],churchWest:[760,430],churchSouth:[960,430],council:[1100,430],northEast:[1100,330],chapelLane:[960,330],quayNorth:[1220,330],quayBend:[1220,430],tavernLane:[960,700],westSouth:[640,700],craft:[640,850],south:[960,850],southGate:[960,920],southRoad:[960,1020],eastSouth:[1100,850],eastCraft:[1100,700],villageSouth:[450,700],suburbanWest:[650,1020],suburbanMid:[790,1020],suburbanEast:[1180,1020],craftMid:[760,700],northRoad:[760,110]};
  const wall=[[540,230],[760,230],[1280,230],[1280,550],[1280,920],[960,920],[540,920],[540,550],[540,230]];
  const positions={h0:[470,440],h1:[350,480],h2:[490,635],h3:[650,975],h4:[790,975],h5:[1060,975],h6:[1180,975],h7:[700,780],h8:[860,780],h9:[1040,780],h10:[870,275],h11:[1060,275],farm:[220,620],mill:[280,400],wood:[150,240],pasture:[220,880],sawmill:[420,240],charcoal:[150,130],clay:[400,955],bakery:[810,610],smith:[700,635],weaver:[1040,635],tailor:[1150,610],carpenter:[1170,780],potter:[570,780],fish:[1340,860],tavern:[870,885],church:[865,380],hall:[1040,380],market:[900,610],market2:[1340,620],clinic:[1160,280],school:[650,380],dock:[1490,550]};
  const land=[[650,885],[780,885],[1100,885],[580,980],[100,620],[220,470],[100,340],[1340,1040],[490,780],[580,635],[860,475],[1180,885],[1280,1040],[1490,780],[100,740],[100,880],[220,980],[100,450],[420,150],[600,165],[680,165],[860,165],[1000,165],[340,955]];
  const infill=[
    [600,275,'Дворянский квартал · запад',['home']],
    [690,275,'Дворянский квартал · у ворот',['home']],
    [970,275,'Дворянский квартал · середина',['home']],
    [580,470,'Соборный квартал · запад',['home','tailor']],
    [675,470,'Соборный квартал · школа',['home','bakery']],
    [970,480,'Торговый квартал · север',['home','tailor','bakery']],
    [1155,480,'Торговый квартал · набережная',['home','tailor']],
    [1160,380,'Соборный квартал · восток',['home','tailor']],
    [820,660,'Улица мастеров · пекарский ряд',['bakery','tailor','home']],
    [880,735,'Ремесленный квартал · ткацкий ряд',['home','weaver']],
    [1030,735,'Ремесленный квартал · жилой двор',['home','weaver','carpenter']],
    [1165,700,'Ремесленный квартал · восточный двор',['potter','carpenter']],
    [580,860,'Ремесленный квартал · у стены',['smith','potter','home']]
  ];
  const extensions=[
    [100,45,"Лесная опушка · север",["wood","charcoal"]],
    [300,60,"Северный лесной двор",["wood","sawmill"]],
    [300,150,"Верхний промысловый двор",["wood","charcoal","sawmill"]],
    [280,310,"Мельничный луг",["farm","mill"]],
    [450,340,"Восточная опушка",["wood","sawmill","charcoal"]],
    [270,680,"Западные пашни",["farm","pasture"]],
    [290,875,"Пастуший двор",["pasture","home"]],
    [600,55,"Северная слобода · запад",["home","tailor"]],
    [690,55,"Северная слобода · ткацкий двор",["home","weaver"]],
    [860,55,"Северная слобода · пекарский двор",["home","bakery"]],
    [970,55,"Северная слобода · столярный двор",["home","carpenter"]],
    [1080,55,"Северная слобода · восток",["home","potter"]],
    [1120,165,"Северная слобода · у стены",["home","smith"]],
    [1230,165,"Северная слобода · крайний двор",["home","carpenter"]],
    [805,275,"Дворянский квартал · у северных ворот",["home"]],
    [1230,275,"Дворянский квартал · восточный сад",["home"]],
    [580,380,"Соборный квартал · малый двор",["home","tailor"]],
    [970,380,"Соборный квартал · между собором и ратушей",["home","tailor"]],
    [1040,480,"Торговый квартал · восточный ряд",["home","tailor","bakery"]],
    [1015,592,"Торговый квартал · суконный двор",["weaver","tailor"]],
    [760,780,"Ремесленный квартал · средний двор",["home","weaver"]],
    [1200,830,"Ремесленный квартал · у восточной стены",["potter","carpenter"]],
    [495,890,"Западное предместье · южный двор",["home","potter"]],
    [1490,635,"Портовая слобода · верхний двор",["home","tailor"]],
    [1335,700,"Портовая слобода · торговый двор",["home","carpenter"]],
    [1490,700,"Портовая слобода · средний двор",["home","weaver"]],
    [1330,780,"Портовая слобода · рыбацкий двор",["fish","home"]],
    [1490,865,"Портовая слобода · нижний двор",["fish","home"]],
    [1490,945,"Портовая слобода · устье",["fish","home"]]
  ];
  function districtAt(x,y){if(x>1280)return 'port';if(x<300||x<500&&y<450||x<380&&y>730)return 'rural';if(x<540||y>920||y<230)return 'suburbs';if(y<320)return 'noble';if(y<480)return 'civic';if(y>=690||x<800&&y>550)return 'artisan';return 'market';}
  function apply(j,streets,lots,expansion){
    Object.keys(j).forEach(k=>delete j[k]);Object.assign(j,junctions);
    j.northWest=[550,110];j.northEastRoad=[1140,110];streets.push(['northWest','northRoad',12,'country'],['northRoad','northEastRoad',12,'country']);
    j.nobleWest=[580,330];streets.push(['nobleWest','north',14,'lane']);
    const remove=new Set(['churchSouth>marketWest','westSouth>craft','westSouth>tavernLane','pastureLane>clayLane','clayLane>southRoad','eastCraft>quay','south>eastSouth']);
    const retained=streets.filter(([a,b])=>!remove.has(a+'>'+b));streets.splice(0,streets.length,...retained);
    for(const [a,b,kind='lane']of [['westSouth','craft'],['westSouth','craftMid'],['craftMid','tavernLane'],['tavernLane','eastCraft'],['craft','south'],['south','eastSouth'],['country','villageSouth','country'],['villageSouth','pastureLane','country'],['villageSouth','clayLane','country'],['clayLane','suburbanWest','country'],['suburbanWest','suburbanMid','country'],['suburbanMid','southRoad','country'],['southRoad','suburbanEast','country'],['suburbanEast','fishLane','country'],['northGate','northRoad','country']]){if(!streets.some(e=>e[0]===a&&e[1]===b))streets.push([a,b,kind==='country'?12:16,kind]);}
    for(const b of lots){const p=positions[b[0]];b[3]=p[0];b[4]=p[1];b[5]=b[0]==='market'?94:b[1]==='church'?96:b[1]==='home'?58:64;b[6]=b[0]==='market'?48:42;b[8]=0;}
    expansion.forEach((l,i)=>{[l.x,l.y]=land[i];l.artX=l.x;l.artY=l.y;});
    for(const [i,[x,y,name,types]]of infill.entries())expansion.push({id:'new'+(25+i),name,x,y,artX:x,artY:y,types,infill:true});
    for(const [i,[x,y,name,types]]of extensions.entries())expansion.push({id:'new'+(38+i),name,x,y,artX:x,artY:y,types,extension:true});
    // A surveyed frontage splits a street at its projection. Entrances never cut across another block.
    const original=streets.slice(),fronts=original.map(()=>[]);
    for(const b of [...lots.map(b=>({id:b[0],x:b[3],y:b[4],row:b})),...expansion]){
      const inside=(x,y)=>x>540&&x<1280&&y>230&&y<920;
      let best=null;original.forEach((e,i)=>{const a=j[e[0]],z=j[e[1]],dx=z[0]-a[0],dy=z[1]-a[1],t=Math.max(0,Math.min(1,((b.x-a[0])*dx+(b.y-a[1])*dy)/(dx*dx+dy*dy))),x=a[0]+t*dx,y=a[1]+t*dy,d=Math.hypot(x-b.x,y-b.y);if(inside(b.x,b.y)!==inside(x,y))return;if(!best||d<best.d)best={i,t,x,y,d};});
      const edge=original[best.i],existing=fronts[best.i].find(q=>Math.abs(q.t-best.t)<1e-8),id=best.t<1e-8?edge[0]:best.t>1-1e-8?edge[1]:existing?.id||'front:'+b.id;
      if(!j[id]){j[id]=[best.x,best.y];fronts[best.i].push({id,t:best.t});}if(b.row)b.row[7]=id;else b.anchor=id;
    }
    streets.length=0;original.forEach((e,i)=>{const ids=[e[0],...fronts[i].sort((a,b)=>a.t-b.t||a.id.localeCompare(b.id)).map(q=>q.id),e[1]];for(let k=1;k<ids.length;k++)streets.push([ids[k-1],ids[k],e[2],e[3]]);});
  }
  const api={version:4,districts,districtAt,apply,wall};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DanzigTownLayout=api;
})(typeof window!=='undefined'?window:globalThis);
