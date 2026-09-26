(function(root){
  'use strict';
  const W=root.DanzigWorld;
  const {TYPES,clamp}=root.Danzig;
  const poly=(c,points,fill,stroke)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
  const line=(c,points,color,width=1)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x??p[0],p.y??p[1]):c.moveTo(p.x??p[0],p.y??p[1]));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
  const distanceToSegment=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
  class CityMap{
    constructor(canvas,getSim,getSelection,onSelect){
      this.canvas=canvas;this.ctx=canvas.getContext('2d');this.getSim=getSim;this.getSelection=getSelection;this.onSelect=onSelect;
      this.zoom=1;this.panX=0;this.panY=0;this.labels=true;this.positions=new Map();this.last=0;this.hover=null;this.drag=null;
      this.terrain=document.createElement('canvas');this.terrain.width=W.WIDTH*2;this.terrain.height=W.HEIGHT*2;this.paintTerrain();
      new ResizeObserver(()=>this.resize()).observe(canvas);this.resize();this.bind();
    }
    reset(){this.zoom=1;this.panX=this.panY=0;this.positions.clear();}
    resize(){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*d);this.canvas.height=Math.round(r.height*d);this.fit=Math.min(r.width/W.WIDTH,r.height/W.HEIGHT);}
    transform(){const s=this.fit*this.zoom;return{s,x:(this.width-W.WIDTH*s)/2+this.panX,y:(this.height-W.HEIGHT*s)/2+this.panY};}
    screenPoint(x,y){const t=this.transform();return{x:x*t.s+t.x,y:y*t.s+t.y};}
    worldPoint(e){const r=this.canvas.getBoundingClientRect(),t=this.transform();return{x:(e.clientX-r.left-t.x)/t.s,y:(e.clientY-r.top-t.y)/t.s,sx:e.clientX-r.left,sy:e.clientY-r.top};}
    zoomBy(delta){this.zoom=clamp(this.zoom+delta,.85,3.5);if(this.zoom<=1)this.panX=this.panY=0;}
    focus(x,y){this.zoom=Math.max(1.55,this.zoom);const s=this.fit*this.zoom;this.panX=(W.WIDTH/2-x)*s;this.panY=(W.HEIGHT/2-y)*s;}
    personPosition(p){const at=this.positions.get(p.id)||p,a=p.id*2.39996;return{x:at.x+(p.path.length?0:Math.cos(a)*(5+p.id%4*2)),y:at.y+(p.path.length?0:Math.sin(a)*5)};}
    visible(p){return p.path.length||!['Дома','Отдыхает','Ест дома','Ухаживает за близким'].includes(p.action)||this.getSelection().person===p.id;}
    hit(point){const sim=this.getSim();let best=null,distance=Math.max(8,6/(this.fit*this.zoom));for(const p of sim.alive){if(!this.visible(p))continue;const at=this.personPosition(p),d=Math.hypot(at.x-point.x,at.y-point.y);if(d<distance){best={kind:'person',id:p.id};distance=d;}}if(best)return best;
      for(const b of sim.buildings.slice().reverse()){const r=-b.angle*Math.PI/180,dx=point.x-b.x,dy=point.y-b.y,x=dx*Math.cos(r)-dy*Math.sin(r),y=dx*Math.sin(r)+dy*Math.cos(r);if(Math.abs(x)<b.w/2+14&&y>-b.h*.8-20&&y<b.h/2+23)return{kind:'building',id:b.id};}return null;
    }
    bind(){const c=this.canvas,tip=document.getElementById('map-tooltip');
      c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);this.drag={x:e.clientX,y:e.clientY,px:this.panX,py:this.panY,moved:false};});
      c.addEventListener('pointermove',e=>{if(this.drag){const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.hypot(dx,dy)>4)this.drag.moved=true;if(this.drag.moved){this.panX=clamp(this.drag.px+dx,-this.width,this.width);this.panY=clamp(this.drag.py+dy,-this.height,this.height);tip.hidden=true;}return;}
        const p=this.worldPoint(e);this.hover=this.hit(p);tip.hidden=!this.hover;if(this.hover){const sim=this.getSim(),h=this.hover;tip.textContent=h.kind==='person'?sim.person(h.id).name+' · '+(sim.person(h.id).plan?.title||sim.person(h.id).action):sim.building(h.id).name;tip.style.left=Math.max(8,Math.min(p.sx+12,this.width-235))+'px';tip.style.top=Math.max(8,Math.min(p.sy-34,this.height-48))+'px';}
      });
      c.addEventListener('pointerup',e=>{if(this.drag&&!this.drag.moved){const hit=this.hit(this.worldPoint(e));if(hit)this.onSelect(hit);}this.drag=null;});
      c.addEventListener('pointercancel',()=>this.drag=null);c.addEventListener('pointerleave',()=>{this.hover=null;tip.hidden=true;});
      c.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();this.zoomBy(e.deltaY<0?.15:-.15);},{passive:false});
    }
    tree(c,x,y,s=1,pine=false){
      c.fillStyle='#485b3930';c.beginPath();c.ellipse(x+8*s,y+4*s,13*s,6*s,-.2,0,Math.PI*2);c.fill();c.fillStyle='#776647';c.fillRect(x-s,y-6*s,2*s,13*s);
      if(pine){poly(c,[[x-13*s,y],[x,y-36*s],[x+13*s,y]],'#64785c');poly(c,[[x,y-34*s],[x,y],[x+13*s,y]],'#526c52');poly(c,[[x-10*s,y-12*s],[x,y-39*s],[x+10*s,y-12*s]],'#768767');return;}
      for(const [dx,dy,r,color]of [[0,-10,14,'#87966b'],[-7,-11,9,'#75865e'],[5,-17,9,'#9da879'],[-2,-22,8,'#a6b185']]){c.fillStyle=color;c.beginPath();c.arc(x+dx*s,y+dy*s,r*s,0,Math.PI*2);c.fill();}
    }
    house(c,b,secondary=false){
      const {x,y,w,h}=b;const roof=secondary?['#9e7054','#92795a','#a78361','#85765e'][Math.abs(Math.floor(x+y))%4]:TYPES[b.type].color;
      c.save();c.translate(x,y);c.rotate((b.angle||0)*Math.PI/180);
      const tall=b.type==='home'||b.type==='tailor'||b.type==='hall'?22:14;
      poly(c,[[-w/2+5,-h*.2],[w/2+12,-h*.25],[w/2+23,h/2+16],[-w/2+16,h/2+22]],'#31463826');
      poly(c,[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2+tall],[-w/2,h/2+tall]],'#d9c7a1','#8e816554');
      poly(c,[[w/2,-h/2],[w/2+8,-h/2-5],[w/2+8,h/2+tall-7],[w/2,h/2+tall]],'#a99979');
      // Long ridged roofs, gables, tiles and timber frames give each plot depth.
      poly(c,[[-w/2-4,-h/2],[-1,-h/2-23],[w/2+4,-h/2],[w/2+4,h/2],[-1,h/2-23],[-w/2-4,h/2]],roof,'#6e62584a');
      poly(c,[[-1,-h/2-23],[w/2+4,-h/2],[w/2+4,h/2],[-1,h/2-23]],'#635c433b');
      poly(c,[[-w/2,h/2],[0,h/2-23],[w/2,h/2]],'#e4d4b2','#9a806458');
      for(let yy=-h/2+5;yy<h/2;yy+=7){line(c,[[-w/2+2,yy],[0,yy-22],[w/2-2,yy]],'#e4c19538',.7);}
      if(b.type==='home'||b.type==='tavern'||b.type==='weaver'){
        line(c,[[-w/2,h/2+6],[w/2,h/2+6]],'#695c47',1.7);for(const xx of [-w*.3,0,w*.3])line(c,[[xx,h/2],[xx,h/2+tall]],'#796449',1.5);
        line(c,[[-w/2+2,h/2+7],[-w*.3,h/2+tall]],'#796449',1);line(c,[[w/2-2,h/2+7],[w*.3,h/2+tall]],'#796449',1);
      }
      c.fillStyle='#485a51';for(const dx of [-w*.28,w*.28]){c.fillRect(dx-2,h/2+3,4,6);if(tall>16)c.fillRect(dx-2,h/2+13,4,5);}c.fillStyle='#6f624b';c.fillRect(-3,h/2+tall-8,7,8);
      if(!secondary){c.fillStyle='#a18b6d';c.fillRect(w*.22,-h*.4-20,5,15);c.fillStyle='#785e4f';c.fillRect(w*.22-1,-h*.4-22,7,3);}
      if(b.type==='tailor'){line(c,[[w/2+3,3],[w/2+15,3]],'#756747',2);c.fillStyle='#cfb56d';c.fillRect(w/2+9,4,9,12);}
      if(b.type==='clinic'){c.fillStyle='#7b845d';c.fillRect(-2,h/2-16,4,13);c.fillRect(-6,h/2-12,12,4);}
      c.restore();
    }
    landmark(c,b){
      if(b.type==='church'){
        this.house(c,{...b,w:121,h:70});
        this.house(c,{...b,x:b.x+48,y:b.y-11,w:37,h:91,angle:b.angle});
        this.tower(c,b.x-43,b.y+10,21,103,'#8c6659');
        for(let i=0;i<5;i++){c.fillStyle='#837363';c.fillRect(b.x-23+i*17,b.y+38,5,15);c.fillStyle='#cfbd99';c.fillRect(b.x-26+i*17,b.y+37,3,22);}
      }else if(b.type==='hall'){this.house(c,b);this.tower(c,b.x-15,b.y-10,13,75,'#987463');c.fillStyle='#e0d3a6';c.beginPath();c.arc(b.x-15,b.y-42,5,0,Math.PI*2);c.fill();line(c,[[b.x-15,b.y-46],[b.x-15,b.y-42],[b.x-12,b.y-40]],'#5b6453',1);
      }else if(b.type==='mill'){poly(c,[[b.x-22,b.y+24],[b.x-16,b.y-25],[b.x+16,b.y-25],[b.x+23,b.y+24]],'#cbb997','#978769');poly(c,[[b.x-23,b.y-25],[b.x,b.y-49],[b.x+23,b.y-25]],'#8d7660','#746652');c.fillStyle='#756849';c.fillRect(b.x-4,b.y+12,9,13);
      }else if(b.id==='market'){
        for(let i=0;i<7;i++){const x=b.x-66+(i%4)*36,y=b.y+(i>3?34:-12);c.fillStyle='#7e6d49';c.fillRect(x-12,y+4,2,15);c.fillRect(x+12,y+4,2,15);c.fillStyle='#b49d70';c.fillRect(x-13,y+9,28,6);for(let j=0;j<4;j++){c.fillStyle=j%2?'#ebd6aa':['#af6e55','#7f916b','#b09c62'][i%3];c.fillRect(x-15+j*8,y-10,8,16);}poly(c,[[x-15,y-10],[x+1,y-19],[x+17,y-10]],['#a87054','#6f8865','#9d8959'][i%3]);}
        c.fillStyle='#9eab8d';c.beginPath();c.ellipse(b.x+8,b.y+14,11,6,0,0,Math.PI*2);c.fill();c.fillStyle='#829b8c';c.beginPath();c.ellipse(b.x+8,b.y+12,8,4,0,0,Math.PI*2);c.fill();
      }else if(b.type==='charcoal'){this.house(c,{...b,w:28,h:25});c.fillStyle='#5e6553';c.beginPath();c.ellipse(b.x-30,b.y+15,23,16,0,Math.PI,Math.PI*2);c.fill();
      }else this.house(c,b);
    }
    tower(c,x,y,r,h,color='#b4a385'){
      c.fillStyle='#35433825';c.beginPath();c.ellipse(x+12,y+9,r*1.5,r*.6,0,0,Math.PI*2);c.fill();
      c.fillStyle=color;c.fillRect(x-r,y-h,r*2,h);poly(c,[[x,y-h],[x+r,y-h],[x+r,y],[x,y+3]],'#483e3325');
      poly(c,[[x-r-4,y-h],[x,y-h-r*1.7],[x+r+4,y-h]],'#786f5b','#646751');
      c.fillStyle='#5c6453';c.fillRect(x-2,y-h+9,4,10);c.fillRect(x-2,y-14,4,8);
    }
    paintTerrain(){
      const c=this.terrain.getContext('2d');c.scale(2,2);let seed=620;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
      c.fillStyle='#e6e3c9';c.fillRect(0,0,W.WIDTH,W.HEIGHT);
      const grass=c.createRadialGradient(620,520,50,620,520,1000);grass.addColorStop(0,'#d9dabb');grass.addColorStop(1,'#d3d7b6');c.fillStyle=grass;c.fillRect(0,0,W.WIDTH,W.HEIGHT);
      // Fallow land, cropland and meadow follow parcels, never a city grid.
      const fields=[[[75,566],[217,551],[199,648],[64,667]],[[89,703],[190,683],[217,790],[69,818]],[[288,541],[387,565],[352,638],[267,635]],[[294,773],[365,735],[398,804],[326,847]],[[65,861],[143,828],[180,947],[80,970]]];
      for(let i=0;i<fields.length;i++){poly(c,fields[i],['#b7b27b','#c4b777','#abb282','#c4bc8b','#c5c092'][i],'#999b744f');c.save();c.clip();for(let y=520;y<990;y+=10){line(c,[[40,y],[410,y-54]],i===2?'#83926970':'#eee0a670',2);line(c,[[40,y+3],[410,y-51]],'#8b895b2e',1);}c.restore();}
      poly(c,[[177,799],[308,822],[355,951],[243,1003],[158,942]],'#b5c393','#9aa67a');
      // The river bends past the port; the opposite bank remains visible.
      c.beginPath();c.moveTo(1340,0);c.bezierCurveTo(1330,190,1427,269,1408,457);c.bezierCurveTo(1400,580,1450,671,1408,826);c.bezierCurveTo(1380,950,1360,1020,1400,1100);c.lineTo(1600,1100);c.lineTo(1600,0);c.closePath();c.fillStyle='#7e9f99';c.fill();c.lineWidth=12;c.strokeStyle='#bbbea0';c.stroke();
      c.beginPath();c.moveTo(1532,0);c.bezierCurveTo(1482,190,1580,366,1575,580);c.bezierCurveTo(1550,770,1483,962,1515,1100);c.lineTo(1600,1100);c.lineTo(1600,0);c.closePath();c.fillStyle='#c8d0ac';c.fill();
      for(let i=0;i<85;i++){const x=1430+rnd()*108,y=35+rnd()*1030;line(c,[[x,y],[x+15+rnd()*20,y]],'#e9efda40',.8);}
      // A moat and thick, irregular enceinte enclose the old town.
      line(c,W.wall,'#aec1a67a',39);line(c,W.wall,'#c9d0ae',27);poly(c,W.wall,'#ddd5b7');
      for(let i=0;i<5600;i++){c.fillStyle=i%2?'#5963400c':'#fff4d51e';c.fillRect(rnd()*1600,rnd()*1100,1+rnd()*3,1+rnd()*2);}
      // A soft irregular market square and churchyard.
      poly(c,[[806,563],[944,544],[1025,594],[1007,674],[895,701],[823,660]],'#c9bca0','#b3a68a55');
      poly(c,[[788,330],[907,304],[969,363],[965,464],[846,465],[795,417]],'#d5ceb0','#b4b797');
      for(const e of W.edges){const a=W.nodes[e.a],b=W.nodes[e.b];c.lineCap='round';line(c,[a,b],e.kind==='country'?'#b7ad8490':'#b3a58977',e.width+5);line(c,[a,b],e.kind==='country'?'#d8c59c':e.kind==='entrance'?'#d1c09c':'#d9c9a8',e.width);if(e.kind==='country'){line(c,[{x:a.x-2,y:a.y},{x:b.x-2,y:b.y}],'#a498722b',1);}}
      c.lineCap='butt';
      for(let i=0;i<400;i++){const e=W.edges[Math.floor(rnd()*W.edges.length)];if(e.kind==='country'||e.kind==='entrance')continue;const a=W.nodes[e.a],b=W.nodes[e.b],t=rnd(),x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;line(c,[[x-2,y],[x+2,y+1]],'#9f967254',.8);}
      // Bridges at the four gates match the navigable road crossings.
      for(const id of W.gates){const n=W.nodes[id];c.save();c.translate(n.x,n.y);if(id==='northGate'||id==='southGate')c.rotate(Math.PI/2);c.fillStyle='#b7a37b';c.fillRect(-30,-14,60,28);for(let x=-28;x<30;x+=6)line(c,[[x,-14],[x,14]],'#8a7b5e',1);line(c,[[-30,-16],[30,-16]],'#8c8769',2);line(c,[[-30,16],[30,16]],'#8c8769',2);c.restore();}
      // Working quays, timber piers, mooring ropes and warehouses.
      for(const y of [504,666,776,928]){const x=y===504?1393:y===928?1385:1408;c.fillStyle='#b49d76';c.fillRect(x-30,y,91,23);for(let q=x-27;q<x+60;q+=7)line(c,[[q,y],[q,y+23]],'#877956',1);for(const xx of [x-29,x+58]){c.fillStyle='#6f745a';c.fillRect(xx,y-3,4,29);}}
      const boat=(x,y,scale,angle)=>{c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);poly(c,[[-14,-33],[10,-30],[19,15],[4,39],[-18,18]],'#77604b','#5c5a48');poly(c,[[-8,-20],[6,-21],[12,17],[1,29],[-11,15]],'#b5996d');line(c,[[0,-37],[0,30]],'#675e45',2);poly(c,[[2,-31],[36,16],[2,8]],'#eee4c8','#c5b99c');poly(c,[[-3,-23],[-27,10],[-3,4]],'#d3d2b5');c.restore();};
      boat(1465,366,1.2,.12);boat(1472,686,.8,-.12);boat(1459,901,.7,.3);boat(1500,160,.65,-.2);
      // Forest edge, hedges and clusters of trees, kept clear of roads/buildings.
      const lots=this.getSim().buildings;
      for(let i=0;i<560;i++){const x=65+rnd()*1240,y=105+rnd()*898,forest=x<500&&y<450,inside=W.insideTown(x,y);
        if(!forest&&rnd()>(inside?.1:.25))continue;if(W.edges.some(e=>distanceToSegment({x,y},W.nodes[e.a],W.nodes[e.b])<21))continue;
        if(lots.some(b=>Math.abs(b.x-x)<b.w/2+22&&Math.abs(b.y-y)<b.h/2+32)||fields.some(f=>x>Math.min(...f.map(p=>p[0]))&&x<Math.max(...f.map(p=>p[0]))&&y>Math.min(...f.map(p=>p[1]))&&y<Math.max(...f.map(p=>p[1]))))continue;
        this.tree(c,x,y,.6+rnd()*.65,forest&&rnd()>.45);
      }
      // Attached workshops and narrow neighbouring roofs make continuous blocks.
      this.scenery=[];
      for(const e of W.edges.filter(e=>['main','lane','quay'].includes(e.kind))){const a=W.nodes[e.a],b=W.nodes[e.b],len=Math.hypot(a.x-b.x,a.y-b.y),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;
        for(let t=.2;t<.95;t+=.22)for(const side of [-1,1]){const x=a.x+(b.x-a.x)*t+nx*side*39,y=a.y+(b.y-a.y)*t+ny*side*39,w=20+rnd()*9,h=24+rnd()*13;
          if(!W.insideTown(x,y)||W.wall.some(([wx,wy])=>Math.hypot(x-wx,y-wy)<38)||lots.some(q=>Math.abs(q.x-x)<q.w/2+w/2+7&&Math.abs(q.y-y)<q.h/2+h/2+26)||this.scenery.some(q=>Math.abs(q.x-x)<(q.w+w)/2+3&&Math.abs(q.y-y)<(q.h+h)/2+12)||W.edges.some(q=>distanceToSegment({x,y},W.nodes[q.a],W.nodes[q.b])<20))continue;
          this.scenery.push({x,y,w,h,angle:(rnd()-.5)*22,type:'home'});
        }
      }
      // Enclosed kitchen gardens and orchard trees behind family plots.
      for(const id of ['h0','h3','h8','h11','clinic']){const b=lots.find(b=>b.id===id);const x=b.x+b.w/2+17,y=b.y-12;poly(c,[[x,y],[x+21,y-4],[x+25,y+27],[x+4,y+29]],'#a6ae7e','#93966c');for(let j=0;j<4;j++)line(c,[[x+4,y+3+j*6],[x+21,y+j*6]],'#6f835a',2);}
      // Small stock animals and fences in the pasture.
      for(let i=0;i<13;i++){const x=193+rnd()*104,y=821+rnd()*113;c.fillStyle='#fbf1d4';c.beginPath();c.ellipse(x,y,5,3,-.2,0,Math.PI*2);c.fill();c.fillStyle='#817759';c.fillRect(x+3,y-1,3,3);}
      const fence=[[177,799],[308,822],[355,951],[243,1003],[158,942],[177,799]];line(c,fence,'#98946d',1.5);for(const [x,y]of fence){line(c,[[x,y-6],[x,y+4]],'#7e7c56',2);}
      c.font='italic 22px Georgia';c.fillStyle='#747e567d';c.textAlign='center';c.fillText('Пашни и выгоны',214,1024);c.fillText('Городской лес',243,147);
      c.save();c.translate(1510,530);c.rotate(-Math.PI/2);c.font='italic 28px Georgia';c.fillStyle='#e7e7cf9c';c.fillText('М о т л а в а',0,0);c.restore();
      c.font='italic 15px Georgia';c.fillStyle='#867958';c.fillText('Дорога к Высоким воротам',353,591);c.fillText('Ремесленное предместье',852,1010);
      // A restrained map border and scale, away from the playable streets.
      c.strokeStyle='#8a927040';c.lineWidth=1;c.strokeRect(25,26,1550,1048);c.font='11px Georgia';c.fillStyle='#8a8768';c.textAlign='left';c.fillText('ОКРЕСТНОСТИ ДАНЦИГА',58,77);c.font='italic 15px Georgia';c.fillText('Город у реки · XV век',58,100);
    }
    walls(c){
      for(let i=1;i<W.wall.length;i++){const a=W.wall[i-1],b=W.wall[i],len=Math.hypot(a[0]-b[0],a[1]-b[1]),dx=(b[0]-a[0])/len,dy=(b[1]-a[1])/len;
        for(let d=0;d<len;d+=9){const x=a[0]+dx*d,y=a[1]+dy*d;if(W.gates.some(id=>Math.hypot(W.nodes[id].x-x,W.nodes[id].y-y)<19))continue;
          line(c,[[x+3,y+5],[x+dx*9+3,y+dy*9+5]],'#626b5045',10);line(c,[[x,y-5],[x+dx*9,y+dy*9-5]],'#a99372',11);line(c,[[x,y-12],[x+dx*9,y+dy*9-12]],'#cab797',8);if(Math.floor(d/9)%2===0){c.fillStyle='#d7c6a4';c.fillRect(x-3,y-19,7,8);}
        }
      }
      for(const i of [1,2,4,5,6,7,9,10,12,13]){const [x,y]=W.wall[i];this.tower(c,x,y,11,25);}
      for(const id of W.gates){const {x,y}=W.nodes[id],vertical=id==='northGate'||id==='southGate';this.tower(c,x+(vertical?-21:0),y+(vertical?0:-22),10,29);this.tower(c,x+(vertical?21:0),y+(vertical?0:22),10,29);if(vertical){line(c,[[x-12,y-20],[x+12,y-20]],'#b8a080',7);}else line(c,[[x,y-11],[x,y+11]],'#b8a080',6);c.fillStyle='#a55d46';poly(c,[[x+10,y-49],[x+28,y-45],[x+10,y-40]],'#a9604a');line(c,[[x+10,y-50],[x+10,y-31]],'#786c4f',1);}
    }
    draw(now){
      const sim=this.getSim(),c=this.ctx,t=this.transform(),d=Math.min(devicePixelRatio||1,2),selection=this.getSelection();
      c.setTransform(d,0,0,d,0,0);c.fillStyle='#d9dabc';c.fillRect(0,0,this.width,this.height);c.translate(t.x,t.y);c.scale(t.s,t.s);c.drawImage(this.terrain,0,0,W.WIDTH,W.HEIGHT);
      const selected=sim.person(selection.person);
      if(selected?.alive&&selection.tab==='people'&&selected.path.length){c.setLineDash([7,5]);line(c,[selected,...selected.path],'#b77c40bb',3);c.setLineDash([]);}
      for(const b of [...this.scenery,...sim.buildings].sort((a,b)=>a.y-b.y)){if(b.id)this.landmark(c,b);else this.house(c,b,true);}
      this.walls(c);
      const blend=Math.min(1,(now-this.last)/70);this.last=now;
      for(const p of sim.alive){const previous=this.positions.get(p.id)||{x:p.x,y:p.y};previous.x+=(p.x-previous.x)*blend;previous.y+=(p.y-previous.y)*blend;this.positions.set(p.id,previous);if(!this.visible(p))continue;const at=this.personPosition(p),scale=Math.max(1,.85/t.s);
        if(selection.tab==='people'&&p.id===selection.person){c.strokeStyle='#b7783c';c.lineWidth=1.5/t.s;c.beginPath();c.arc(at.x,at.y-2,8*scale,0,Math.PI*2);c.stroke();}
        c.fillStyle='#41533838';c.beginPath();c.ellipse(at.x+2,at.y+3,4*scale,2*scale,0,0,Math.PI*2);c.fill();c.fillStyle=p.id===sim.mayorId?'#8a6685':p.age<16?'#67865c':p.cargo?'#ae7947':'#6b7b68';c.fillRect(at.x-1.8*scale,at.y-3*scale,3.6*scale,5*scale);c.fillStyle='#ddc19a';c.beginPath();c.arc(at.x,at.y-5*scale,1.8*scale,0,Math.PI*2);c.fill();
        if(p.cargo){c.fillStyle='#b6a078';c.fillRect(at.x+3*scale,at.y-3*scale,5*scale,5*scale);c.strokeStyle='#786747';c.lineWidth=.6;c.strokeRect(at.x+3*scale,at.y-3*scale,5*scale,5*scale);}
        if(p.path.length){const step=Math.sin(now*.015+p.id)*1.5;line(c,[[at.x-1,at.y+2],[at.x-1+step,at.y+5]],'#53664d',1);line(c,[[at.x+1,at.y+2],[at.x+1-step,at.y+5]],'#53664d',1);}
      }
      // Windmill sails turn while the mill can work; smoke marks active hearths.
      const mill=sim.building('mill');c.save();c.translate(mill.x,mill.y-10);c.rotate(sim.isOpen(mill)?sim.now*.01:0);for(let i=0;i<4;i++){c.rotate(Math.PI/2);poly(c,[[4,-2],[42,-2],[42,7],[11,7]],'#e7d9b5','#877b60');for(let j=12;j<42;j+=6)line(c,[[j,-2],[j,7]],'#9c9273',1);}c.restore();
      for(const b of sim.buildings){if(b.damaged||b.closedUntil>sim.now){c.fillStyle=b.damaged?'#ac5e38':'#977849';c.beginPath();c.arc(b.x+b.w/2,b.y-26,9,0,Math.PI*2);c.fill();c.fillStyle='#fff0ce';c.font='bold 13px Georgia';c.textAlign='center';c.fillText('!',b.x+b.w/2,b.y-22);}
        if(['bakery','smith','potter','charcoal'].includes(b.type)&&sim.isOpen(b)&&sim.occupants(b.id).some(p=>p.action==='Работает'))for(let j=0;j<3;j++){const phase=(now*.00022+j*.3)%1;c.fillStyle=`rgba(103,107,87,${.28*(1-phase)})`;c.beginPath();c.arc(b.x+b.w*.22+Math.sin(phase*4)*5,b.y-b.h*.4-27-phase*37,3+phase*6,0,Math.PI*2);c.fill();}
        if(selection.tab==='buildings'&&b.id===selection.building){c.setLineDash([5,4]);c.strokeStyle='#ab7841';c.lineWidth=2/t.s;c.strokeRect(b.x-b.w/2-9,b.y-b.h/2-19,b.w+18,b.h+44);c.setLineDash([]);}
      }
      const night=sim.hour<5||sim.hour>=22?.35:sim.hour<7||sim.hour>=20?.15:0;if(night){c.fillStyle=`rgba(25,46,66,${night})`;c.fillRect(0,0,W.WIDTH,W.HEIGHT);for(const b of sim.buildings.filter(b=>b.type==='home'||b.type==='tavern')){c.fillStyle='#f3d28d';c.fillRect(b.x-8,b.y+b.h*.5+5,3,4);}}
      if(this.labels)this.drawLabels(c,t.s,selection);
    }
    drawLabels(c,s,selection){
      const label=(text,x,y,important=false)=>{const size=(important?11:10)/s;c.font=(important?'italic ':'')+size+'px Georgia';c.textAlign='center';const width=c.measureText(text).width;c.fillStyle='#f1e9cce6';c.fillRect(x-width/2-4,y-size,width+8,size+4);c.fillStyle=important?'#786647':'#5f694f';c.fillText(text,x,y);};
      const compact=this.width<600&&this.zoom<1.5;
      const names=compact?{farm:'Поля',market:'Рынок',church:'Церковь'}:{farm:'Загородные поля',mill:'Ветряная мельница',wood:'Лесной промысел',pasture:'Пастбище',market:'Длинный рынок',church:'Святая Мария',hall:'Ратуша',dock:'Ганзейская пристань',fish:'Рыбацкое предместье'};
      for(const b of this.getSim().buildings)if(names[b.id])label(names[b.id],b.x,b.y+b.h/2+(b.type==='church'?48:42),b.type==='market');
      if(!compact){label('Высокие ворота',513,661);label('Ремесленные дворы',708,921);}
      if(selection.tab==='buildings'&&!names[selection.building]){const b=this.getSim().building(selection.building);label(b.name,b.x,b.y+b.h/2+41);}
    }
  }
  root.DanzigMap=CityMap;
})(window);
