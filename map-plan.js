(function(root){
  'use strict';
  const W=root.DanzigWorld,A=root.DanzigArt;
  const palette={home:'#3e6b91',production:'#a95c33',public:'#68528c',land:'#3c8065'};
  const names={home:'Дом',farm:'Поле',pasture:'Пастбище',wood:'Лесной двор',mill:'Мельница',sawmill:'Лесопилка',charcoal:'Углежог',clay:'Карьер',bakery:'Пекарня',smith:'Кузница',weaver:'Ткачи',tailor:'Портной',carpenter:'Столяр',potter:'Гончар',fish:'Рыбаки',tavern:'Трактир',church:'Церковь',hall:'Ратуша',market:'Рынок',clinic:'Лечебница',school:'Школа',dock:'Пристань'};
  const category=b=>b.type==='home'?'home':root.Danzig.TYPES[b.type].recipe?'production':'public';
  const shortNames={wood:'Лес',charcoal:'Уголь',sawmill:'Пилорама',clinic:'Лекарь'};
  function path(c,pts,color,width){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
  function text(c,label,x,y,size=18,color='#596568'){c.font=`600 ${size}px Segoe UI`;c.textAlign='center';c.fillStyle=color;c.fillText(label,x,y);}
  function terrain(c){
    c.fillStyle='#f4f6f3';c.fillRect(0,0,1600,1100);
    const zones=[['rural',40,40,445,995],['suburbs',550,32,720,170],['suburbs',390,455,135,465],['suburbs',490,940,825,140],['noble',555,245,710,65],['civic',555,315,710,195],['market',790,510,475,172],['artisan',555,690,710,210],['artisan',555,575,230,108],['port',1315,455,220,550]];
    for(const [id,x,y,w,h]of zones){c.fillStyle=W.Layout.districts[id].color;c.fillRect(x,y,w,h);}
    c.fillStyle='#c2dde7';c.fillRect(1530,0,70,1100);c.fillStyle='#e1eff2';c.fillRect(1545,0,3,1100);
    const streets=W.edges.filter(e=>e.kind!=='entrance');for(const e of streets)path(c,A.edgePoints(e.a,e.b),'#bac4c5',e.width+6);for(const e of streets)path(c,A.edgePoints(e.a,e.b),'#fffef9',e.width);
    const wall=W.wall.map(([x,y])=>({x,y}));path(c,wall,'#596674',12);path(c,wall,'#b6c0c8',6);
    for(const id of W.gates){const p=W.nodes[id];c.fillStyle='#fffef9';c.fillRect(p.x-17,p.y-17,34,34);c.strokeStyle='#596674';c.lineWidth=2;c.strokeRect(p.x-18,p.y-18,36,36);}
    for(const [label,x,y,size]of [['ПОЛЯ И ПРОМЫСЛЫ',240,25,14],['СЕВЕРНАЯ СЛОБОДА',855,20,14],['ДВОРЯНСКИЙ КВАРТАЛ',1050,217,14],['СОБОРНАЯ УЛИЦА',950,349,11],['ДЛИННАЯ УЛИЦА',930,536,11],['УЛИЦА МАСТЕРОВ',900,688,11],['ЮЖНОЕ ПРЕДМЕСТЬЕ',850,1070,14],['ПОРТОВАЯ СЛОБОДА',1410,450,13],['ЗАПАДНОЕ ПРЕДМЕСТЬЕ',420,590,10],['ПОЛЕВАЯ ДОРОГА',210,535,10]])text(c,label,x,y,size);
    c.save();c.translate(1575,280);c.rotate(-Math.PI/2);text(c,'МОТЛАВА',0,0,17,'#4d7989');c.restore();text(c,'С',1480,80,15);path(c,[{x:1480,y:135},{x:1480,y:96}],'#64727b',2);path(c,[{x:1474,y:104},{x:1480,y:96},{x:1486,y:104}],'#64727b',2);
  }
  function lot(c,l,selected,scale,numbered=false){const w=l.types.includes('farm')?90:60,h=l.types.includes('farm')?62:42;c.fillStyle=selected?'#d5ecd5':'#f5faf2';c.fillRect(l.x-w/2,l.y-h/2,w,h);c.strokeStyle=selected?'#246749':'#6d967a';c.lineWidth=(selected?2:1)/scale;c.setLineDash([4/scale,3/scale]);c.strokeRect(l.x-w/2,l.y-h/2,w,h);c.setLineDash([]);const size=Math.min(11/scale,20);c.font=`600 ${size}px Segoe UI`;c.textAlign='center';c.fillStyle='#4b7a5d';c.fillText(numbered||selected?l.id.slice(3):'+',l.x,l.y+size*.35);}
  function building(c,b){
    const color=palette[category(b)];c.fillStyle=b.construction?'#e8dfc7':'#ffffff';c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.roundRect(b.x-b.w/2,b.y-b.h/2,b.w,b.h,3);c.fill();c.stroke();c.fillStyle=color;c.fillRect(b.x-b.w/2,b.y-b.h/2,5,b.h);
    text(c,b.construction?'⚒':(b.type==='home'?root.DanzigResidences.spec(b).symbol:root.Danzig.TYPES[b.type].symbol),b.x,b.y+7,21,color);if(b.development?.level>1)text(c,['','I','II','III'][b.development.level],b.x+b.w/2-9,b.y-b.h/2+12,11,color);if(b.development?.project){c.setLineDash([5,3]);c.strokeRect(b.x-b.w/2-4,b.y-b.h/2-4,b.w+8,b.h+8);c.setLineDash([]);}
  }
  function draw(map,c,s){if(!map.planTerrain){map.planTerrain=document.createElement('canvas');map.planTerrain.width=W.WIDTH;map.planTerrain.height=W.HEIGHT;terrain(map.planTerrain.getContext('2d'));}c.drawImage(map.planTerrain,0,0);for(const b of s.buildings){c.globalAlpha=map.matches(b)?1:.2;path(c,[W.nodes[b.anchor],b.door],'#a4aeac',5);building(c,b);}c.globalAlpha=1;}
  root.DanzigPlan={palette,names,shortNames,category,draw,lot};
})(window);
