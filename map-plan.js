(function(root){
  'use strict';
  const W=root.DanzigWorld,A=root.DanzigArt;
  const palette={home:'#617a91',production:'#ad663f',public:'#76668b',land:'#4f8463'};
  const names={home:'Дом',farm:'Поля',pasture:'Овчарня',mill:'Мельница',wood:'Лесорубы',sawmill:'Лесопилка',charcoal:'Углежоги',clay:'Карьер',bakery:'Пекарня',smith:'Кузница',weaver:'Ткачи',tailor:'Портные',carpenter:'Столяры',potter:'Гончары',fish:'Рыбаки',tavern:'Таверна',church:'Церковь',hall:'Ратуша',market:'Рынок',clinic:'Лекарь',school:'Школа',dock:'Пристань'};
  const category=b=>b.type==='home'?'home':root.Danzig.TYPES[b.type].recipe?'production':'public';
  const polygon=(c,ps,fill,stroke)=>{c.beginPath();ps.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
  const path=(c,points,color,width)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.stroke();};
  function terrain(c){
    c.fillStyle='#e7dfc3';c.fillRect(0,0,1600,1100);
    polygon(c,[[0,0],[620,0],[443,394],[270,492],[0,458]],'#bec69b');
    polygon(c,[[0,510],[359,457],[479,622],[345,985],[0,1100]],'#d5d4a8');
    polygon(c,[[458,456],[510,342],[641,271],[778,209],[977,207],[1148,297],[1210,448],[1205,679],[1120,793],[973,873],[785,834],[587,776],[505,655]],'#eee5ca');
    polygon(c,[[1296,0],[1600,0],[1600,1100],[1323,1100],[1410,852],[1472,697],[1468,526],[1342,395]],'#8eafb0');
    for(let i=0;i<30;i++){const x=1360+(i*43)%190,y=40+i*35;path(c,[{x,y},{x:x+40,y:y-3}],'#d4dfcd88',1.2);}
    for(let i=0;i<115;i++){const x=20+(i*173)%450,y=25+(i*71)%430;if(x>410-y*.15)continue;c.fillStyle=['#8d9b70','#788c68','#9cab7c'][i%3];c.beginPath();c.ellipse(x,y,9+i%5,16+i%8,-.2,0,7);c.fill();path(c,[{x,y:y+8},{x:x-1,y:y+20}],'#748066',1);}
    const wall=[[518,503],[534,343],[648,255],[788,182],[1010,183],[1180,275],[1272,424],[1261,683],[1127,829],[951,901],[738,873],[559,796],[497,657],[518,503]].map(([x,y])=>({x,y}));
    path(c,wall,'#aa9d80',17);path(c,wall,'#f7f0d8',10);path(c,wall,'#988d77',1);
    for(let i=0;i<wall.length-1;i++){const a=wall[i],b=wall[i+1],n=Math.floor(Math.hypot(b.x-a.x,b.y-a.y)/27);for(let j=0;j<n;j++){const x=a.x+(b.x-a.x)*j/n,y=a.y+(b.y-a.y)*j/n;c.fillStyle='#d2c5a4';c.fillRect(x-4,y-5,8,10);c.strokeStyle='#a09175';c.lineWidth=1;c.strokeRect(x-4,y-5,8,10);}}
    for(const e of W.edges.filter(e=>!e.expansion)){const pts=A.edgePoints(e.a,e.b);path(c,pts,'#c3b595',e.a.startsWith('b:')||e.b.startsWith('b:')?6:14);path(c,pts,'#f4edda',e.a.startsWith('b:')||e.b.startsWith('b:')?3:9);}
    for(const [x,y,text]of [[184,52,'ЛЕСНЫЕ УГОДЬЯ'],[204,920,'ЗАПАДНЫЕ ПОЛЯ'],[831,1070,'ЮЖНОЕ ПРЕДМЕСТЬЕ'],[1494,768,'МОТЛАВА']]){c.save();c.translate(x,y);if(text==='МОТЛАВА')c.rotate(-Math.PI/2);c.fillStyle='#687967';c.font='16px Georgia';c.textAlign='center';c.fillText(text,0,0);c.restore();}
    c.strokeStyle='#aa9e7f';c.lineWidth=2;c.strokeRect(15,15,1570,1070);
  }
  function lot(c,l,selected,scale){const [x,y]=A.centers[l.id],agri=l.types.includes('farm'),forest=l.types.includes('wood'),w=agri?102:68,h=agri?66:48;
    c.save();c.translate(x,y);c.rotate(-.12);c.fillStyle=selected?'#e4cf8dc9':agri?'#c9cc8b99':forest?'#a6ba9388':'#bad0b377';c.fillRect(-w/2,-h/2,w,h);c.setLineDash([6,4]);c.lineWidth=(selected?2:1)/scale;c.strokeStyle=selected?'#855f26':'#578665';c.strokeRect(-w/2,-h/2,w,h);c.setLineDash([]);if(agri)for(let i=0;i<6;i++)path(c,[{x:-w/2+8+i*15,y:-h/2+6},{x:-w/2+8+i*15,y:h/2-6}],'#9c9e6299',1.5);c.restore();
  }
  function building(c,b){const [x,y]=A.centers[b.id],kind=category(b),roof=palette[kind];c.save();c.translate(x,y);
    if(['farm','pasture'].includes(b.type)){polygon(c,[[-65,-10],[-44,-65],[15,-49],[-10,18]],b.type==='farm'?'#c4ad68':'#a7bc87','#8b956c');for(let i=0;i<7;i++)path(c,[{x:-60+i*8,y:-12+i*2},{x:-42+i*8,y:-59+i*2}],'#938857',2);}
    c.fillStyle='#6f64422b';c.beginPath();c.ellipse(7,26,40,13,-.1,0,7);c.fill();
    const tier=b.development?.level||1;if(tier>1){c.fillStyle='#e7d5af';c.strokeStyle='#8d785a';c.fillRect(-37,9,13,20);c.strokeRect(-37,9,13,20);if(tier>2){c.fillRect(30,5,14,23);c.strokeRect(30,5,14,23);}}
    const large=['church','hall','dock'].includes(b.type);if(large)c.scale(1.3,1.3);
    polygon(c,[[-27,-8],[12,-2],[12,24],[-27,18]],'#f5e6c7','#8d785a');polygon(c,[[12,-2],[34,-17],[34,10],[12,24]],'#cbbc96','#8d785a');
    polygon(c,[[-32,-9],[-11,-32],[25,-26],[12,-1]],roof,'#66553f');polygon(c,[[12,-1],[25,-26],[39,-17],[34,-12]],'#6f634d','#66553f');
    for(let i=0;i<4;i++)path(c,[{x:-28+i*5,y:-10-i*5},{x:14+i*3,y:-7-i*5}],'#f5e1b433',1);
    for(const xx of [-24,-7,10])path(c,[{x:xx,y:-6},{x:xx,y:18+(xx+24)*.16}],'#998060',2);
    c.fillStyle='#564e3e';c.fillRect(-7,6,9,16);c.fillStyle='#687872';c.fillRect(-21,-2,7,8);c.fillRect(18,-1,7,8);
    if(b.type==='church'||b.type==='hall'){polygon(c,[[-16,-13],[-16,-56],[1,-53],[1,-10]],'#ddd2b3','#817054');polygon(c,[[-22,-55],[-8,-83],[7,-53]],roof,'#66553f');if(b.type==='church'){path(c,[{x:-8,y:-83},{x:-8,y:-96}],'#796144',2);path(c,[{x:-13,y:-91},{x:-3,y:-91}],'#796144',2);}}
    if(b.type==='mill'){for(let i=0;i<4;i++){c.save();c.translate(0,-20);c.rotate(i*Math.PI/2+.45);polygon(c,[[0,0],[38,0],[38,6],[9,6]],'#f1e5c5','#8b7957');c.restore();}}
    if(b.type==='dock'||b.type==='fish'){path(c,[{x:20,y:24},{x:67,y:38}],'#8c7150',8);for(let i=0;i<4;i++)path(c,[{x:30+i*9,y:20+i*3},{x:27+i*9,y:34+i*3}],'#c4ac7e',2);}
    if(b.construction||b.development?.project){for(let x=-35;x<=35;x+=14)path(c,[{x,y:26},{x,y:-38}],'#a07743',3);path(c,[{x:-39,y:-22},{x:40,y:-12}],'#c29357',4);path(c,[{x:-39,y:14},{x:40,y:24}],'#c29357',4);}
    c.restore();
  }
  function draw(map,c,s){if(!map.planTerrain){map.planTerrain=document.createElement('canvas');map.planTerrain.width=1600;map.planTerrain.height=1100;terrain(map.planTerrain.getContext('2d'));}c.drawImage(map.planTerrain,0,0);for(const b of s.buildings){c.globalAlpha=map.matches(b)?1:.18;if(b.expansion)path(c,[A.nodes[b.anchor],A.nodes['b:'+b.id]],'#c1ae88',7);building(c,b);}c.globalAlpha=1;}
  root.DanzigPlan={palette,names,category,draw,lot};
})(window);
