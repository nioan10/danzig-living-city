(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports,G=node?require('./map-3d-geometry.js'):root.Danzig3DGeometry;
  const C={stone:'#b4b7a5',darkStone:'#818879',wood:'#66503b',timber:'#775341',plaster:'#e4d6b8',roof:'#a6573e',slate:'#526c70',window:'#516367',gold:'#c6a55b',grass:'#91a879',road:'#cabda0'};
  const hash=s=>{let n=[...String(s)].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);n=Math.imul(n^(n>>>16),0x45d9f3b);return(n^(n>>>16))>>>0;},mix=(a,b,t)=>G.color(a).map((x,i)=>x*(1-t)+G.color(b)[i]*t);
  const roofs=['#a95e46','#97513e','#b87552','#667570','#8c6852'];
  function tree(m,x,z,h=26,seed=1){m.disk(x+3,.22,z+3,h*.4,'#7c9369',9);m.cylinder(x,.1,z,1.8,h*.6,C.wood,1.2,6);const green=['#5f7d58','#728958','#819761'][seed%3];if(seed%3===0){m.cylinder(x,h*.3,z,h*.29,h*.6,green,0,7);m.cylinder(x,h*.6,z,h*.22,h*.45,green,0,7);}else{m.cylinder(x,h*.35,z,h*.18,h*.28,green,h*.35,7);m.cylinder(x,h*.63,z,h*.35,h*.35,green,0,7);}}
  function fence(m,x,z,w,d){for(const dz of[-d/2,d/2]){m.box(x,4,z+dz,w,1.4,1.4,C.wood);m.box(x,8,z+dz,w,1.4,1.4,C.wood);for(let dx=-w/2;dx<=w/2;dx+=12)m.box(x+dx,0,z+dz,1.8,11,1.8,C.wood);}for(const dx of[-w/2,w/2])m.box(x+dx,5,z,1.4,1.4,d,C.wood);}
  function barrel(m,x,z,y=1){m.cylinder(x,y,z,3.3,7,'#967147',3.3,8);for(const h of[1.4,5.4])m.cylinder(x,y+h,z,3.5,.7,'#5f6458',3.5,8);}
  function crate(m,x,z,size=7){m.box(x,.6,z,size,size,size,'#b08c55');for(const h of[2,size-1])m.box(x,h,z+size/2+.1,size,.8,.4,C.wood);}
  function facade(m,x,z,w,d,h,level=1){const front=z+d/2+.25;m.box(x,0,front,8,15,.6,C.wood);m.box(x,14,front+.2,8,1,.8,C.gold);
    for(let floor=0;floor<level;floor++){const y=5+floor*15;for(const dx of[-w*.3,w*.3]){m.box(x+dx,y,front,7,8,.5,C.window);m.box(x+dx,y,front+.4,.7,8,.6,C.plaster);m.box(x+dx,y+3.5,front+.4,7,.7,.6,C.plaster);}if(floor>0)m.box(x,y-3,front,w,1.7,1,C.timber);}
    for(const dx of[-w/2+1,0,w/2-1])m.box(x+dx,1,front,1.8,h,1.4,C.timber);
    for(const side of[-1,1]){m.box(x+side*w/2,1,z,1.4,2,d,C.timber);for(const dz of[-d*.27,d*.27])m.box(x+side*(w/2+.25),h*.4,z+dz,.7,8,7,C.window);}
  }
  function house(m,x,z,w,d,h,roof,level=1,stone=false){m.box(x,0,z,w+3,3,d+3,C.darkStone);m.box(x,3,z,w,h,d,stone?'#c4c2ad':C.plaster);facade(m,x,z,w,d,h+3,level);m.roof(x,h+3,z,w+6,d+7,w*.38,roof,C.plaster);
    m.box(x+w*.22,h+4,z-d*.18,5,15,5,'#967b61');m.box(x+w*.22,h+17,z-d*.18,6,2,6,C.darkStone);
    // Roof seams make the volume readable at closer camera distances.
    for(let i=1;i<5;i++){const dx=(w/2+3)*i/5,y=h+3+(w*.38)*(1-i/5);m.box(x-dx,y,z,1,.7,d+7,mix(roof,'#e4b086',.15));m.box(x+dx,y,z,1,.7,d+7,mix(roof,'#e4b086',.15));}
  }
  function tower(m,x,z,r,h,roof=false){m.cylinder(x,0,z,r,h,C.stone,r,10);m.cylinder(x,h-3,z,r+2,4,C.darkStone,r+2,10);if(roof)m.cylinder(x,h+1,z,r+3,r*1.8,C.slate,0,8);else for(let i=0;i<8;i++){const a=i*Math.PI/4;m.box(x+Math.cos(a)*r,h+1,z+Math.sin(a)*r,4,5,4,C.stone);}m.box(x,Math.max(8,h-14),z+r+.2,3,8,.5,C.window);}
  function height(b){if(b.construction)return 27;return({church:133,hall:98,mill:72,dock:35,market:24,market2:24,farm:24,pasture:24,wood:28,charcoal:25,clay:16}[b.type]|| (b.type==='home'&&b.residence==='manor'?64:44))+Math.max(0,(b.development?.level||1)-1)*12;}
  function building(m,b){const x=b.x,z=b.y,w=b.w*.88,d=b.h*.84,level=b.development?.level||1,seed=hash(b.id),roof=b.damaged?'#635950':roofs[seed%roofs.length],h=19+(level-1)*12;
    m.box(x+5,.25,z+5,b.w+7,.15,b.h+7,'#87917a');m.box(x,.55,z,b.w+5,.3,b.h+5,'#c4b89a');
    if(b.construction){m.box(x,1,z,w,3,d,C.stone);for(const dx of[-w/2,w/2])for(const dz of[-d/2,d/2])m.box(x+dx,2,z+dz,2,25,2,C.wood);for(const y of[10,22]){m.box(x,y,z-d/2,w,2,2,C.wood);m.box(x,y,z+d/2,w,2,2,C.wood);}crate(m,x,z,10);crate(m,x+13,z,8);return;}
    if(['farm','pasture','wood','clay','charcoal'].includes(b.type)){
      if(b.type==='farm'){m.box(x,.8,z,w,.2,d,'#aa945d');for(let i=0;i<9;i++){const xx=x-w/2+3+i*(w-6)/8;m.box(xx,1,z,2.5,3,d-4,'#cbb66a');}house(m,x-w*.35,z-d*.36,17,14,10,C.roof);}
      if(b.type==='pasture'){m.box(x,.8,z,w,.2,d,'#8ca577');fence(m,x,z,w,d);for(let i=0;i<3;i++){const xx=x-15+i*15,zz=z+(i%2?8:-5);m.box(xx,3,zz,10,6,5,'#e3d9bc');m.box(xx+6,6,zz,4,4,4,'#a48e6d');for(const dx of[-3,3])for(const dz of[-2,2])m.box(xx+dx,1,zz+dz,1.3,3,1.3,C.wood);}}
      if(b.type==='wood'){house(m,x+10,z+3,22,19,12,C.slate);for(let i=0;i<4;i++)m.box(x-w*.3,1+i*2,z-10,7,2,26,C.wood);}
      if(b.type==='clay'){m.box(x,1,z,w,.4,d,'#b58c70');for(let i=0;i<5;i++)m.cylinder(x-w*.25+i*8,1,z+((i%2)*12-6),8,4,'#aaa38a',3,6);}
      if(b.type==='charcoal'){m.cylinder(x-9,1,z,13,14,'#53554b',2,9);house(m,x+16,z+5,15,14,9,C.slate);}
      return;
    }
    if(b.type==='mill'){m.cylinder(x,1,z,14,38+level*4,C.plaster,9,10);m.cylinder(x,39+level*4,z,13,18,C.roof,0,8);m.box(x,1,z+14,6,13,1,C.wood);return;}
    if(['market','market2'].includes(b.type)){
      for(const dx of[-w*.26,w*.26]){m.box(x+dx,1,z,18,7,10,C.wood);for(const dz of[-7,7])m.box(x+dx-10,0,z+dz,1,17,1,C.wood);m.roof(x+dx,17,z,24,19,6,dx<0?'#ad6c51':'#67847b','#dbcda6');for(let i=0;i<3;i++)m.cylinder(x+dx-6+i*6,8,z,2.7,1.4,['#bf9152','#839255','#b76343'][i],2.7,6);}barrel(m,x,z+d*.4);return;
    }
    if(b.type==='church'){
      house(m,x,z,w,d,33,C.slate,2,true);const tx=x-w*.29, tz=z+d*.12;tower(m,tx,tz,12,88,true);m.box(tx,109,tz,2,15,2,C.gold);m.box(tx,118,tz,12,2,2,C.gold);
      for(const dx of[-w*.33,w*.33])m.box(x+dx,17,z+d/2+.9,5,17,1,C.window);return;
    }
    if(b.type==='hall'){
      house(m,x,z,w,d,31+(level-1)*10,C.roof,2,true);tower(m,x+w*.25,z-d*.15,9,74+(level-1)*7,true);m.box(x+w*.25,62+(level-1)*7,z-d*.15+7.4,6,6,.8,C.gold);m.box(x+w*.25,63+(level-1)*7,z-d*.15+8,1,3,.8,C.wood);return;
    }
    if(b.type==='dock'||b.type==='fish'){
      house(m,x-w*.18,z,w*.56,d*.65,16,C.slate);for(let i=0;i<4;i++)m.box(x+w*.18+i*5,1,z,4,2,d+16,C.wood);for(let i=0;i<3;i++)barrel(m,x-w*.15+i*8,z+d*.3);m.cylinder(x+w*.4,0,z+7,2,30,C.wood,2,6);m.box(x+w*.4+8,28,z+7,20,2,2,C.wood);return;
    }
    if(b.type==='home'&&b.residence==='manor'){
      house(m,x,z,w*.78,d,33+(level-1)*10,C.slate,2,true);for(const dx of[-w*.4,w*.4])house(m,x+dx,z+3,14,d*.7,24,C.slate,1,true);fence(m,x,z,w+12,d+12);return;
    }
    house(m,x,z,w,d,h,roof,Math.min(3,level),b.type==='home'&&b.residence==='townhouse');
    if(['bakery','smith','potter'].includes(b.type)){m.cylinder(x+w*.38,1,z+d*.1,8,11,'#a77856',5,8);m.box(x+w*.38,11,z+d*.1,4,25,4,C.darkStone);m.box(x+w*.38,3,z+d*.1+7.7,4,4,.7,'#dc9e52');}
    if(b.type==='smith'){m.box(x-w*.3,2,z+d*.63,8,3,5,C.darkStone);m.box(x-w*.3,5,z+d*.63,13,3,4,C.window);}
    if(['weaver','tailor','tavern','bakery','school','clinic'].includes(b.type)){const awning=['weaver','tailor'].includes(b.type)?'#6d9190':b.type==='clinic'?'#d5c5a4':'#ad7953';m.box(x,13,z+d*.66,w*.6,1,10,awning);for(const dx of[-w*.3,w*.3])m.box(x+dx,0,z+d*.81,1.3,13,1.3,C.wood);}
    if(['carpenter','sawmill'].includes(b.type)){for(let i=0;i<3;i++)m.box(x-w*.3,1+i*2,z+d*.63,w*.65,1.5,7,C.gold);}
    if(b.type!=='home'){barrel(m,x+w*.35,z+d*.62);crate(m,x+w*.13,z+d*.63,6);}
    if(b.development?.project){for(const dx of[-w/2-3,w/2+3])m.box(x+dx,0,z+d/2+3,1.5,h+8,1.5,C.wood);m.box(x,h,z+d/2+3,w+8,1.5,3,C.wood);}
  }
  function terrain(m,W,s){m.box(800,-14,550,1740,14,1230,'#7a9270');m.box(800,-.2,550,1738,.25,1228,C.grass);m.box(914,.05,565,746,.1,697,'#b6b99a');m.box(1575,.25,550,130,.12,1228,'#729e9e');m.box(1515,.4,550,16,.5,1170,'#c6bfa0');
    // Main streets and occupied approaches use the exact navigation graph.
    const streets=W.edges.filter(e=>e.kind!=='entrance'&&(!e.expansion||s.building(e.b.slice(2))));for(const e of streets){const a=W.nodes[e.a],b=W.nodes[e.b];m.strip(a,b,e.width+8,.42,'#a7aa8e');m.strip(a,b,e.width,.65,C.road);}
    for(const b of s.buildings)m.strip(W.nodes[b.anchor],b.door,6,.7,C.road);
    for(let i=0;i<W.wall.length-1;i++){const [ax,az]=W.wall[i],[bx,bz]=W.wall[i+1],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),cuts=[0,length];const gates=W.gates.map(id=>W.nodes[id]).filter(p=>Math.abs(dx? p.y-az:p.x-ax)<3&& (p.x-ax)*dx+(p.y-az)*dz>=0&& (p.x-bx)*dx+(p.y-bz)*dz<=0);for(const p of gates){const t=Math.hypot(p.x-ax,p.y-az);cuts.push(Math.max(0,t-20),Math.min(length,t+20));}cuts.sort((a,b)=>a-b);for(let j=0;j<cuts.length-1;j++){const a=cuts[j],b=cuts[j+1],mid=(a+b)/2;if(gates.some(p=>Math.abs(Math.hypot(p.x-ax,p.y-az)-mid)<20))continue;const x=ax+dx*mid/length,z=az+dz*mid/length;m.box(x,0,z,dx?b-a:8,19,dx?8:b-a,C.stone);m.box(x,18,z,dx?b-a:10,2,dx?10:b-a,C.darkStone);for(let t=a+4;t<b-2;t+=13)m.box(ax+dx*t/length,20,az+dz*t/length,6,4,6,C.stone);}}
    for(const id of W.gates){const p=W.nodes[id],horizontal=Math.abs(p.x-540)<2||Math.abs(p.x-1290)<2;for(const d of[-24,24])tower(m,p.x+(horizontal?0:d),p.y+(horizontal?d:0),10,34,true);m.box(p.x,25,p.y,horizontal?11:48,7,horizontal?48:11,C.stone);}
    for(const [x,z]of W.wall.slice(0,-1))if(!W.gates.some(id=>Math.hypot(W.nodes[id].x-x,W.nodes[id].y-z)<35))tower(m,x,z,9,29,false);
    for(let i=0;i<180;i++){const x=35+(hash('tree-x'+i)%1480),z=25+(hash('tree-z'+i)%1050);if(x>480&&x<1320&&z>180&&z<940)continue;if([...s.buildings,...W.expansionLots].some(b=>Math.abs(x-b.x)<(b.w||65)/2+22&&Math.abs(z-b.y)<(b.h||50)/2+22))continue;if(W.edges.some(e=>{const a=W.nodes[e.a],b=W.nodes[e.b],dx=b.x-a.x,dz=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.y)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a.x-t*dx,z-a.y-t*dz)<20;}))continue;tree(m,x,z,19+hash(i)%19,i);}
    // A small moored boat on the river, outside all navigable parcels.
    m.cylinder(1560,1,780,12,5,C.wood,10,8);m.box(1560,4,780,17,1,40,C.wood);m.box(1560,5,780,1.8,33,1.8,C.wood);m.tri([1560,13,780],[1560,36,780],[1560,13,797],'#e6d6b2');
  }
  function lot(m,l,selected=false){const w=l.types.includes('farm')?90:60,d=l.types.includes('farm')?62:42,x=l.x,z=l.y,col=selected?'#e2bd65':'#b1bd8f';m.box(x,.76,z,w,.12,d,selected?'#c6c08a':'#9baa80');for(const dx of[-w/2,w/2])for(const dz of[-d/2,d/2]){m.box(x+dx,1,z+dz,1.3,4,1.3,C.wood);m.box(x+dx-Math.sign(dx)*5,1,z+dz,10,.4,1,col);m.box(x+dx,1,z+dz-Math.sign(dz)*5,1,.4,10,col);}}
  function citizen(m,p,at,time,paused=false,facing=0){const start=m.vertices.length,scale=p.age<16?.78:1,x=at.x,z=at.y,h=12*scale,moving=p.path.length>0,phase=moving&&!paused?Math.sin(time*.008+p.id)*2:0,col=['#6f8690','#a66f51','#7d895c','#8c737e','#b09c6c'][p.id%5];m.disk(x+1,.9,z+1,3.8*scale,'#75856b',8);
    for(const side of[-1,1])m.box(x+side*1.2*scale,1,z+phase*side,1.4*scale,h*.38,1.7*scale,C.wood);
    m.cylinder(x,h*.34,z,2.7*scale,h*.38,col,2*scale,6);m.cylinder(x,h*.72,z,1.8*scale,h*.23,'#d8b492',1.7*scale,7);m.cylinder(x,h*.95,z,2.3*scale,1.2*scale,C.wood,1.3*scale,7);
    if(p.cargo||Object.values(p.bag||{}).some(n=>n>0))m.box(x+3*scale,h*.37,z+1,3*scale,4*scale,3*scale,'#b49762');
    const co=Math.cos(facing),si=Math.sin(facing);for(let i=start;i<m.vertices.length;i+=9){const dx=m.vertices[i]-x,dz=m.vertices[i+2]-z,nx=m.vertices[i+3],nz=m.vertices[i+5];m.vertices[i]=x+co*dx+si*dz;m.vertices[i+2]=z-si*dx+co*dz;m.vertices[i+3]=co*nx+si*nz;m.vertices[i+5]=-si*nx+co*nz;}
  }
  function millBlades(m,b,time){const y=40+(b.development?.level||1)*4,z=b.y+15,a=time*.00016;for(let i=0;i<4;i++){const t=a+i*Math.PI/2,r=[Math.cos(t),Math.sin(t)],v=[-Math.sin(t)*2,Math.cos(t)*2];const p=(distance,side)=>[b.x+r[0]*distance+v[0]*side,y+r[1]*distance+v[1]*side,z];m.quad(p(4,-1),p(25,-1),p(25,1),p(4,1),'#ded2aa');}m.box(b.x-1,y-2,z,4,4,3,C.wood);}
  const api={C,hash,height,building,terrain,lot,citizen,millBlades,tree};if(node)module.exports=api;else root.Danzig3DModels=api;
})(typeof window!=='undefined'?window:globalThis);
