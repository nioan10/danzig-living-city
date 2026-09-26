(function(root){
  'use strict';
  const W=root.DanzigWorld,A=root.DanzigArt,{clamp}=root.Danzig;
  const line=(c,ps,color,w)=>{c.beginPath();ps.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=color;c.lineWidth=w;c.stroke();};
  class CityMap{
    constructor(canvas,getSim,getSelection,onSelect){
      Object.assign(this,{canvas,ctx:canvas.getContext('2d'),getSim,getSelection,onSelect,zoom:1,panX:0,panY:0,labels:true,routes:false,mode:'plan',filter:'all',showLots:true,labelHits:[],showPeople:true,followId:null,positions:new Map(),last:0,hover:null,drag:null});
      this.art=new Image();this.art.onload=()=>canvas.dataset.art='ready';this.art.onerror=()=>canvas.dataset.art='error';this.art.src='assets/danzig-painted.png';
      new ResizeObserver(()=>this.resize()).observe(canvas);this.resize();this.bind();
    }
    reset(){this.zoom=1;this.panX=this.panY=0;this.positions.clear();this.followId=null;}
    resize(){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*d);this.canvas.height=Math.round(r.height*d);this.fit=Math.min(r.width/W.WIDTH,Math.max(100,r.height-55)/W.HEIGHT);}
    transform(){const s=this.fit*this.zoom;return{s,x:(this.width-W.WIDTH*s)/2+this.panX,y:(this.height-55-W.HEIGHT*s)/2+10+this.panY};}
    artPoint(x,y){
      const b=this.getSim().buildings.find(b=>b.x===x&&b.y===y);if(b){const p=A.centers[b.id];return{x:p[0],y:p[1]};}
      let result={x,y},best=Infinity;
      for(const e of W.edges){const a=W.nodes[e.a],b=W.nodes[e.b],dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy),0,1),d=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);if(d<best){best=d;const u=A.nodes[e.a],v=A.nodes[e.b];result={x:u.x+(v.x-u.x)*t,y:u.y+(v.y-u.y)*t};}}return result;
    }
    screenPoint(x,y){const p=this.artPoint(x,y),t=this.transform();return{x:p.x*t.s+t.x,y:p.y*t.s+t.y};}
    worldPoint(e){const r=this.canvas.getBoundingClientRect(),t=this.transform();return{x:(e.clientX-r.left-t.x)/t.s,y:(e.clientY-r.top-t.y)/t.s,sx:e.clientX-r.left,sy:e.clientY-r.top};}
    zoomBy(delta){this.zoom=clamp(this.zoom+delta,.85,3.5);if(this.zoom<=1)this.panX=this.panY=0;}
    focus(x,y){const p=this.artPoint(x,y);this.zoom=Math.max(1.5,this.zoom);const s=this.fit*this.zoom;const mx=Math.max(0,(W.WIDTH*s-this.width)/2),my=Math.max(0,(W.HEIGHT*s-this.height)/2);this.panX=clamp((W.WIDTH/2-p.x)*s,-mx,mx);this.panY=clamp((W.HEIGHT/2-p.y)*s,-my,my);}
    personPosition(p){return this.positions.get(p.id)||A.personPoint(p);}
    visible(p){const s=this.getSelection();if(p.absence?.status==='away')return false;if(!this.showPeople&&s.person!==p.id)return false;return p.path.length||['market','dock'].includes(p.location)||s.person===p.id&&s.tab==='people';}
    matches(b){return this.filter==='all'||this.filter===DanzigPlan.category(b);}
    focusLot(id){const [x,y]=A.centers[id];this.zoom=Math.max(1.5,this.zoom);const s=this.fit*this.zoom;this.panX=(W.WIDTH/2-x)*s;this.panY=(W.HEIGHT/2-y)*s;}
    hit(point){for(const h of [...this.labelHits].reverse())if(point.x>=h.x&&point.x<=h.x+h.w&&point.y>=h.y&&point.y<=h.y+h.h)return{kind:h.kind,id:h.id};if(this.showLots&&(this.filter==='all'||this.filter==='land'))for(const l of W.expansionLots){const [x,y]=A.centers[l.id];if(!this.getSim().building(l.id)&&Math.abs(x-point.x)<(l.types.includes('farm')?51:34)&&Math.abs(y-point.y)<(l.types.includes('farm')?33:24))return{kind:'lot',id:l.id};}const sim=this.getSim();let best=null,distance=Math.max(9,6/(this.fit*this.zoom));for(const p of sim.alive){if(!this.visible(p))continue;const at=this.personPosition(p),d=Math.hypot(at.x-point.x,at.y-point.y);if(d<distance){best={kind:'person',id:p.id};distance=d;}}if(best)return best;
      distance=Infinity;for(const b of sim.buildings.filter(b=>this.matches(b))){const [x,y]=A.centers[b.id],dx=Math.abs(x-point.x),dy=Math.abs(y-point.y),d=Math.hypot(dx,dy);if(dx<Math.max(20,b.w*.52)&&dy<Math.max(25,b.h*.65)&&d<distance){best={kind:'building',id:b.id};distance=d;}}return best;
    }
    bind(){const c=this.canvas,tip=document.getElementById('map-tooltip');
      c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);this.followId=null;this.drag={x:e.clientX,y:e.clientY,px:this.panX,py:this.panY,moved:false};});
      c.addEventListener('pointermove',e=>{if(this.drag){const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.hypot(dx,dy)>4)this.drag.moved=true;if(this.drag.moved){this.panX=clamp(this.drag.px+dx,-this.width,this.width);this.panY=clamp(this.drag.py+dy,-this.height,this.height);tip.hidden=true;}return;}const p=this.worldPoint(e);this.hover=this.hit(p);tip.hidden=!this.hover;if(this.hover){const sim=this.getSim(),h=this.hover;tip.textContent=h.kind==='person'?sim.person(h.id).name+' · '+(sim.person(h.id).plan?.title||sim.person(h.id).action):h.kind==='lot'?'Участок '+h.id.slice(3)+' · '+W.expansionLots.find(l=>l.id===h.id).types.map(t=>DanzigPlan.names[t]).join(', '):sim.building(h.id).name+' · '+DanzigGuilds.ownerName(sim,sim.building(h.id));tip.style.left=Math.max(8,Math.min(p.sx+12,this.width-240))+'px';tip.style.top=Math.max(8,Math.min(p.sy-35,this.height-48))+'px';}});
      c.addEventListener('pointerup',e=>{if(this.drag&&!this.drag.moved){const hit=this.hit(this.worldPoint(e));if(hit)this.onSelect(hit);}this.drag=null;});
      c.addEventListener('pointercancel',()=>this.drag=null);c.addEventListener('pointerleave',()=>{this.hover=null;tip.hidden=true;});
      c.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();this.zoomBy(e.deltaY<0?.15:-.15);},{passive:false});
    }
    label(c,text,x,y,s,important=false){const size=(important?11:10)/s;c.font=`${important?'600':'500'} ${size}px Segoe UI`;c.textAlign='center';const w=c.measureText(text).width,pad=7/s;c.fillStyle='#162623e8';c.beginPath();c.roundRect(x-w/2-pad,y-size-pad*.6,w+pad*2,size+pad*1.5,3/s);c.fill();c.strokeStyle='#e4c78b60';c.lineWidth=.5/s;c.stroke();c.fillStyle='#f3e6cc';c.fillText(text,x,y);}
    draw(now){
      const sim=this.getSim(),c=this.ctx;const follow=sim.person(this.followId);if(follow&&follow.absence?.status!=='away'){const p=A.personPoint(follow,this.getSelection().paused?1:sim.remainder/5),scale=this.fit*this.zoom;const maxX=Math.max(0,(W.WIDTH*scale-this.width)/2),maxY=Math.max(0,(W.HEIGHT*scale-this.height)/2);this.panX=clamp((W.WIDTH/2-p.x)*scale,-maxX,maxX);this.panY=clamp((W.HEIGHT/2-p.y)*scale,-maxY,maxY);}else if(follow)this.followId=null;const t=this.transform(),d=Math.min(devicePixelRatio||1,2),sel=this.getSelection();
      c.setTransform(d,0,0,d,0,0);c.fillStyle='#14241e';c.fillRect(0,0,this.width,this.height);c.translate(t.x,t.y);c.scale(t.s,t.s);
      if(this.mode==='art'&&(!this.art.complete||!this.art.naturalWidth)){c.fillStyle='#d4c19a';c.textAlign='center';c.font='24px Georgia';c.fillText(this.canvas.dataset.art==='error'?'Не удалось загрузить карту':'Открываем атлас города…',800,550);return;}
      if(this.mode==='plan')DanzigPlan.draw(this,c,sim);else{c.drawImage(this.art,0,0,1600,1100);c.fillStyle='#17282088';c.fillRect(0,0,1600,1100);for(const b of sim.buildings.filter(b=>b.expansion))this.drawExtension(c,b);}
      if(this.showLots&&(this.filter==='all'||this.filter==='land'))for(const l of W.expansionLots)if(!sim.building(l.id))DanzigPlan.lot(c,l,sel.lot===l.id,t.s);
      const night=sim.hour>=22||sim.hour<5?.19:sim.hour>=20||sim.hour<7?.08:0;if(night&&this.mode==='art'){c.fillStyle=`rgba(10,22,43,${night})`;c.fillRect(0,0,1600,1100);}
      if(this.routes)for(const e of W.edges)if(!e.expansion||sim.building(e.b.slice(2)))line(c,A.edgePoints(e.a,e.b),'#f6e7b275',1.5/t.s);
      const selected=sel.tab==='people'?sim.person(sel.person):null;
      if(selected?.path.length){c.setLineDash([5/t.s,4/t.s]);line(c,A.remainingPath(selected),'#fff1ba',2/t.s);c.setLineDash([]);}
      for(const p of sim.alive){const target=A.personPoint(p,sel.paused?1:sim.remainder/5);this.positions.set(p.id,target);if(!this.visible(p))continue;const at=this.personPosition(p),z=Math.max(1.15,1.2/t.s),chosen=selected?.id===p.id;
        c.fillStyle='#15201bb3';c.beginPath();c.ellipse(at.x+2*z,at.y+2*z,3*z,1.8*z,0,0,Math.PI*2);c.fill();
        c.fillStyle=p.absence?'#d77052':p.cargo?'#d9a44f':p.id===sim.mayorId?'#c293d2':p.age<16?'#88b5b8':'#f1d1a0';c.beginPath();c.moveTo(at.x,at.y-5*z);c.lineTo(at.x-2.2*z,at.y+2*z);c.lineTo(at.x+2.2*z,at.y+2*z);c.closePath();c.fill();c.fillStyle='#f4d3b0';c.beginPath();c.arc(at.x,at.y-5*z,1.4*z,0,Math.PI*2);c.fill();
        if(p.path.length){const gait=Math.sin((sim.now+sim.remainder)*.22+p.id)*1.5*z;line(c,[{x:at.x-z,y:at.y+2*z},{x:at.x-z+gait,y:at.y+5*z}],'#e9d9bb',.9*z);line(c,[{x:at.x+z,y:at.y+2*z},{x:at.x+z-gait,y:at.y+5*z}],'#d5c1a0',.9*z);}
        if(p.cargo){c.fillStyle='#c48c41';c.fillRect(at.x+2*z,at.y-2*z,3*z,3*z);}
        if(chosen){c.strokeStyle='#ffdc86';c.lineWidth=1.6/t.s;c.beginPath();c.arc(at.x,at.y-2*z,7*z,0,Math.PI*2);c.stroke();}
      }
      for(const e of(sim.incidents||[]).filter(e=>e.status==='active'))this.drawIncident(c,e,now,t.s);
      for(const b of sim.buildings.filter(b=>this.matches(b))){const [x,y]=A.centers[b.id];const guild=DanzigGuilds.owner(sim,b);if(guild){line(c,[{x:x+24,y:y-10},{x:x+24,y:y-35}],'#d8c69c',1.2);c.fillStyle=guild.color;c.beginPath();c.moveTo(x+24,y-35);c.lineTo(x+40,y-31);c.lineTo(x+24,y-26);c.fill();} if(b.damaged||b.closedUntil>sim.now){c.fillStyle=b.damaged?'#c1643c':'#af8c4c';c.beginPath();c.arc(x+18,y-27,7/t.s,0,Math.PI*2);c.fill();c.fillStyle='#fff2d6';c.font=`bold ${10/t.s}px Segoe UI`;c.textAlign='center';c.fillText('!',x+18,y-27+3/t.s);}
        if(sel.tab==='buildings'&&sel.building===b.id||this.hover?.kind==='building'&&this.hover.id===b.id){c.strokeStyle='#ffe1a0';c.lineWidth=2/t.s;c.beginPath();c.ellipse(x,y+15,Math.max(23,b.w*.6),Math.max(18,b.h*.5),0,0,Math.PI*2);c.stroke();}
      }
      this.drawLabels(c,t.s,sel);
    }
    drawExtension(c,b){
      const [x,y]=A.centers[b.id],door=A.nodes['b:'+b.id],a=A.nodes[b.anchor];
      line(c,[a,door],'#78694d88',9);line(c,[a,door],'#bea67b',6);
      const poly=(ps,fill,stroke='#594b38')=>{c.beginPath();ps.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=.8;c.stroke();};
      c.save();c.translate(x,y);c.fillStyle='#413d2840';c.beginPath();c.ellipse(8,22,41,14,-.12,0,Math.PI*2);c.fill();
      if(['farm','pasture'].includes(b.type)){poly([[-57,10],[-30,-29],[4,-7],[-21,33]],b.type==='farm'?'#b19b58':'#80905b');for(let i=0;i<6;i++)line(c,[{x:-52+i*5,y:7+i*3},{x:-30+i*5,y:-25+i*3}],'#6c713e',2);}
      poly([[-28,-7],[12,-1],[12,28],[-28,21]],'#dbc6a0');poly([[12,-1],[32,-15],[32,15],[12,28]],'#ad9671');
      if(b.construction){for(let x=-31;x<35;x+=13)line(c,[{x,y:28},{x,y:-28}],'#685437',2);for(const y of [-19,0,18])line(c,[{x:-36,y},{x:37,y:y+6}],'#937753',2);line(c,[{x:-30,y:22},{x:29,y:-24}],'#c6a57b',2);poly([[-39,25],[-16,29],[-9,22],[-30,18]],'#8e6a49');}
      else{poly([[-33,-8],[-12,-32],[18,-27],[11,0]],'#8b4e32');poly([[11,0],[18,-27],[37,-16],[32,-12]],'#b5794a');for(let i=0;i<4;i++)line(c,[{x:-29+i*5,y:-8-i*5},{x:12+i*1.4,y:-2-i*6}],'#ba82594d',1);for(const xx of [-26,-8,10])line(c,[{x:xx,y:-4+(xx+26)*.16},{x:xx,y:21+(xx+26)*.16}],'#665238',2);line(c,[{x:-27,y:9},{x:11,y:15}],'#746044',2);poly([[-5,27],[-5,9],[4,10],[4,28]],'#554631');poly([[-22,2],[-14,3],[-14,10],[-22,9]],'#536158');line(c,[{x:-18,y:3},{x:-18,y:9}],'#ddcaa1',1);poly([[21,-20],[21,-35],[26,-36],[26,-24]],'#96755c');if(b.type==='mill'){c.save();c.translate(3,-21);c.rotate(this.getSim().now*.012);for(let i=0;i<4;i++){c.rotate(Math.PI/2);poly([[1,1],[29,1],[29,6],[9,6]],'#d9cfac');}c.restore();}}
      for(let i=0;i<5;i++)line(c,[{x:-38+i*11,y:36+i*.5},{x:-38+i*11,y:28+i*.5}],'#877254',1.4);line(c,[{x:-40,y:31},{x:9,y:33}],'#9a815b',1.2);c.restore();
      if(this.labels)this.label(c,(b.construction?'Стройка · ':Danzig.TYPES[b.type].name+' · ')+b.id.slice(3),x,y+49,this.transform().s);
    }
    drawIncident(c,e,now,s){const [x,y]=A.centers[e.targetId],phase=(now*.0003)%1;
      c.strokeStyle=e.type==='fire'?'#ee9160aa':'#ffe4a3aa';c.lineWidth=1.5/s;c.beginPath();c.ellipse(x,y+10,24+phase*17,14+phase*9,0,0,Math.PI*2);c.stroke();
      if(e.type==='fire'&&this.getSim().building(e.targetId).damaged){for(let i=0;i<8;i++){const q=(now*.00038+i*.127)%1;c.fillStyle=`rgba(51,42,32,${.5*(1-q)})`;c.beginPath();c.arc(x+Math.sin(q*4+i)*11+q*15,y-15-q*88,8+q*15,0,Math.PI*2);c.fill();}for(let i=0;i<4;i++){const h=20+Math.sin(now*.008+i)*8;c.fillStyle=i%2?'#ffd272d9':'#e47c36cf';c.beginPath();c.moveTo(x-15+i*9,y);c.quadraticCurveTo(x-22+i*9,y-15,x-11+i*9,y-h);c.quadraticCurveTo(x-3+i*9,y-8,x-6+i*9,y);c.fill();}}
      if(e.type==='storm'){c.fillStyle='#17323c30';c.fillRect(0,0,1600,1100);for(let i=0;i<120;i++){const px=(i*137)%1600,py=(i*87+now*.16)%1100;line(c,[{x:px,y:py},{x:px-5,y:py+12}],'#d3e5e94a',1);}}
      if(e.type==='feast'){line(c,[{x:x-55,y:y-15},{x:x+50,y:y-15}],'#e7bd72',1.5);for(let i=0;i<7;i++){c.fillStyle=['#c67948','#7f9d80','#d9b55e'][i%3];c.beginPath();c.moveTo(x-50+i*14,y-15);c.lineTo(x-39+i*14,y-15);c.lineTo(x-45+i*14,y-3);c.closePath();c.fill();}}
      this.label(c,e.title,x,y-60,s,true);
    }
    drawLabels(c,s,sel){
      this.labelHits=[];const sim=this.getSim(),rows=sim.buildings.filter(b=>this.matches(b)).map(b=>({kind:'building',id:b.id,type:b.type,x:A.centers[b.id][0],y:A.centers[b.id][1],text:(b.construction||b.development?.project?'⚒ ':'')+DanzigPlan.names[b.type]+((b.development?.level||1)>1?' '+['','I','II','III'][b.development.level]:'')+(b.expansion?' · '+b.id.slice(3):b.type==='home'?' '+(Number(b.id.slice(1))+1):''),color:DanzigPlan.palette[DanzigPlan.category(b)],selected:sel.tab==='buildings'&&sel.building===b.id,home:b.type==='home'}));
      if(this.showLots&&(this.filter==='all'||this.filter==='land'))for(const l of W.expansionLots)if(!sim.building(l.id))rows.push({kind:'lot',id:l.id,x:l.artX,y:l.artY,text:'+ '+l.id.slice(3),color:'#3b7251',selected:sel.lot===l.id});
      rows.sort((a,b)=>Number(b.selected)-Number(a.selected)||Number(a.home)-Number(b.home));
      const bounds=this.transform(),compact=this.width<500&&this.zoom<1.5&&this.filter==='all';for(const r of rows){const px=r.x*s+bounds.x,py=r.y*s+bounds.y;if(px<0||px>this.width||py<0||py>this.height-32)continue;const text=this.labels?(compact&&!r.selected&&r.kind==='building'?(r.home?r.text.replace('Дом ',''):Danzig.TYPES[r.type].symbol):r.text):r.kind==='lot'?r.text:'●';c.font=`600 ${11/s}px Segoe UI`;const w=c.measureText(text).width+14/s,h=21/s;let box;
        for(const [dx,dy]of [[0,24],[0,-32/s],[35/s,0],[-35/s,0],[0,34/s]]){const candidate={x:clamp(r.x+dx-w/2,(5-bounds.x)/s,(this.width-5-bounds.x)/s-w),y:clamp(r.y+dy,(5-bounds.y)/s,(this.height-36-bounds.y)/s-h),w,h};if(!this.labelHits.some(b=>candidate.x<b.x+b.w+2/s&&candidate.x+w>b.x-2/s&&candidate.y<b.y+b.h+2/s&&candidate.y+h>b.y-2/s)){box=candidate;break;}}
        if(!box)box={x:r.x-w/2,y:r.y+24,w,h};
        pathLabel(c,{...r,text},box,s);this.labelHits.push({...box,id:r.id,kind:r.kind});
      }
      function pathLabel(c,r,b,s){line(c,[{x:r.x,y:r.y},{x:b.x+b.w/2,y:b.y+b.h/2}],r.color,1/s);c.fillStyle=r.selected?'#fff3ce':r.kind==='lot'?'#edf1de':'#fff9e9';c.strokeStyle=r.selected?'#98702d':r.color;c.lineWidth=(r.selected?2:1)/s;c.beginPath();c.roundRect(b.x,b.y,b.w,b.h,3/s);c.fill();c.stroke();c.fillStyle=r.color;c.textAlign='center';c.fillText(r.labelText||r.text,b.x+b.w/2,b.y+14/s);}
    }
  }
  root.DanzigMap=CityMap;
})(window);
