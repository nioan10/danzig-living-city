(function(root){
  'use strict';
  const G=root.Danzig3DGeometry,M=root.Danzig3DModels,W=root.DanzigWorld,A=root.DanzigArt;
  const vertex=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;
    uniform mat4 uCamera;uniform float uDaylight;varying vec3 vColor;
    void main(){gl_Position=uCamera*vec4(aPosition,1.0);float light=.64+.36*max(0.0,dot(normalize(aNormal),normalize(vec3(-.45,.85,.35))));
    vColor=aColor*light*mix(vec3(.53,.64,.75),vec3(1.0),uDaylight);}`;
  const fragment=`precision mediump float;varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,1.0);}`;
  function shader(gl,type,source){const value=gl.createShader(type);gl.shaderSource(value,source);gl.compileShader(value);if(!gl.getShaderParameter(value,gl.COMPILE_STATUS)){gl.deleteShader(value);throw Error('Не удалось подготовить 3D-графику');}return value;}
  class City3D {
    constructor(map){
      this.map=map;this.camera=new G.Camera();this.canvas=document.createElement('canvas');this.canvas.className='map-3d-canvas';this.canvas.setAttribute('aria-hidden','true');this.canvas.hidden=true;this.lost=false;this.dynamicPeople=[];this.builds=0;this.animation=0;this.lastDraw=-Infinity;
      this.gl=this.canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});if(!this.gl)throw Error('В этом браузере недоступна 3D-графика');
      this.init();map.canvas.before(this.canvas);
      this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;map.setMode('plan');this.status('3D временно недоступно. Включена схема; город продолжает работать.');});
      this.canvas.addEventListener('webglcontextrestored',()=>{try{this.init();this.lost=false;this.key=null;this.status('3D снова доступно. Можно включить его кнопкой над картой.');}catch{this.lost=true;}});
    }
    init(){const gl=this.gl,v=shader(gl,gl.VERTEX_SHADER,vertex),f=shader(gl,gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('Не удалось запустить 3D-графику');this.program=p;this.staticBuffer=gl.createBuffer();this.dynamicBuffer=gl.createBuffer();this.attributes=['aPosition','aNormal','aColor'].map(n=>gl.getAttribLocation(p,n));this.cameraUniform=gl.getUniformLocation(p,'uCamera');this.dayUniform=gl.getUniformLocation(p,'uDaylight');gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);}
    status(text){const note=document.getElementById('map-view-status');if(note)note.textContent=text;}
    resize(){const m=this.map,d=Math.min(root.devicePixelRatio||1,1.5);this.canvas.width=Math.max(1,Math.round(m.width*d));this.canvas.height=Math.max(1,Math.round(m.height*d));this.camera.update(m.width,m.height,m.zoom);this.lastDraw=-Infinity;this.lastView=null;}
    reset(){this.camera.reset();this.lastDraw=-Infinity;}
    focus(x,z){this.camera.x=x;this.camera.z=z;this.lastDraw=-Infinity;}
    orbit(delta){this.camera.yaw+=delta;this.map.followId=null;this.lastDraw=-Infinity;}
    tilt(){this.camera.elevation=this.camera.elevation<1.1?1.25:.72;this.lastDraw=-Infinity;}
    pan(dx,dy){this.camera.pan(dx,dy);this.lastDraw=-Infinity;}
    project(x,y,z){this.camera.update(this.map.width,this.map.height,this.map.zoom);return this.camera.project(x,y,z);}
    ground(sx,sy){this.camera.update(this.map.width,this.map.height,this.map.zoom);return this.camera.ground(sx,sy);}
    selected(){const v=this.map.getSelection();return v.tab==='buildings'?v.building:null;}
    fingerprint(s){return s.buildings.map(b=>[b.id,b.development?.level,b.development?.extras?.join(),!!b.development?.project,!!b.construction,!!b.damaged].join(':')).join('|')+'|'+this.map.filter+'|'+this.map.showLots;}
    rebuild(s,key){const mesh=new G.Mesh();M.terrain(mesh,W,s);if(this.map.showLots&&['all','land','ownership'].includes(this.map.filter))for(const lot of W.expansionLots)if(!s.building(lot.id))M.lot(mesh,lot);
      for(const b of s.buildings){const start=mesh.vertices.length;M.building(mesh,b);if(!this.map.matches(b))for(let i=start;i<mesh.vertices.length;i+=9)for(let k=6;k<9;k++)mesh.vertices[i+k]=mesh.vertices[i+k]*.38+[.59,.65,.49][k-6]*.62;}
      const data=mesh.data();this.staticCount=data.length/9;this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.staticBuffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,data,this.gl.STATIC_DRAW);this.key=key;this.builds++;
    }
    paint(buffer,count){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);this.attributes.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,i*12);});gl.drawArrays(gl.TRIANGLES,0,count);}
    draw(now){if(this.lost)return;const m=this.map,s=m.getSim(),selection=m.getSelection(),following=s.person(m.followId);if(following&&following.absence?.status!=='away'){const at=A.personPoint(following,selection.paused?1:s.remainder/5);this.camera.x=at.x;this.camera.z=at.y;}
      this.camera.update(m.width,m.height,m.zoom);const key=this.fingerprint(s),view=[...this.camera.matrix,m.labels,m.routes,m.showPeople,selection.tab,selection.person,selection.building,selection.lot,m.hover?.kind,m.hover?.id,s.now,selection.paused].join();
      // Keep UI response immediate; bound visual animation cost at high simulation speeds.
      if(key===this.key&&view===this.lastView&&(selection.paused||now-this.lastDraw<1000/40))return;this.lastDraw=now;this.lastView=view;if(key!==this.key)this.rebuild(s,key);
      if(!selection.paused)this.animation=now;const moving=new G.Mesh();this.dynamicPeople=[];m.positions.clear();
      for(const p of s.alive){if(!m.visible(p)||p.absence?.status==='away'||!p.path.length&&!['market','market2','dock'].includes(p.location))continue;const at=A.personPoint(p,selection.paused?1:s.remainder/5);m.positions.set(p.id,at);this.dynamicPeople.push({p,at});const next=p.path[0];M.citizen(moving,p,at,this.animation,false,next?Math.atan2(next.x-at.x,next.y-at.y):0);}
      for(const b of s.buildings)if(b.type==='mill'&&!b.construction)M.millBlades(moving,b,this.animation);
      const chosen=s.building(this.selected());if(chosen){const w=chosen.w+14,d=chosen.h+14;for(const dx of[-w/2,w/2])moving.box(chosen.x+dx,1,chosen.y,2,.2,d,'#dfb956');for(const dz of[-d/2,d/2])moving.box(chosen.x,1,chosen.y+dz,w,.2,2,'#dfb956');}
      const lot=W.expansionLots.find(l=>l.id===selection.lot);if(lot&&!s.building(lot.id)&&m.showLots)M.lot(moving,lot,true);
      if(m.routes)for(const e of W.edges.filter(e=>!e.expansion||s.building(e.b.slice(2))))moving.strip(W.nodes[e.a],W.nodes[e.b],1.5,1.1,'#739dad');
      const person=selection.tab==='people'&&s.person(selection.person);if(person&&person.absence?.status!=='away'){const points=A.remainingPath(person);for(let i=1;i<points.length;i++)moving.strip(points[i-1],points[i],2.1,1.3,'#bd5e43');}
      const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(.74,.8,.7,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this.cameraUniform,false,this.camera.matrix);gl.uniform1f(this.dayUniform,s.hour<5||s.hour>=22?.35:s.hour<7||s.hour>=20?.7:1);this.paint(this.staticBuffer,this.staticCount);
      const data=moving.data();gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);this.paint(this.dynamicBuffer,data.length/9);this.drawLabels(s,selection,person);this.stats={triangles:(this.staticCount+data.length/9)/3,people:this.dynamicPeople.length,builds:this.builds};
    }
    drawLabels(s,selection,person){const m=this.map,c=m.ctx,d=Math.min(root.devicePixelRatio||1,2);c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,m.width,m.height);m.labelHits=[];
      const rows=s.buildings.filter(b=>m.matches(b)).map(b=>({b,at:this.camera.project(b.x,M.height(b),b.y),priority:b.id===this.selected()?100:m.hover?.id===b.id?90:['hall','church','market','mill','dock'].includes(b.type)?45:10})).sort((a,b)=>b.priority-a.priority||b.at.depth-a.at.depth);
      for(const row of rows){if(!m.labels&&row.priority<90||m.labelHits.length>=11&&row.priority<90)continue;const b=row.b,text=m.filter==='ownership'?root.DanzigLawPropertyView.mapLabel(s,b):b.type==='home'?(b.residence==='manor'?'Поместье':b.residence==='townhouse'?'Городской дом':'Дом')+' '+(b.expansion?b.id.slice(3):Number(b.id.slice(1))+1):root.DanzigPlan.shortNames[b.type]||root.DanzigPlan.names[b.type]||s.buildingType(b.type),p=row.at;c.font='600 11px Segoe UI';const width=c.measureText(text).width+16,box={x:p.x-width/2,y:p.y-20,w:width,h:21,kind:'building',id:b.id};
        if(box.x<4||box.x+width>m.width-4||box.y<48||box.y+21>m.height-40||m.labelHits.some(a=>box.x<a.x+a.w+6&&box.x+width>a.x-6&&box.y<a.y+a.h+6&&box.y+21>a.y-6))continue;
        c.fillStyle=row.priority===100?'#ecd08f':'#f7f0dfe8';c.strokeStyle=row.priority===100?'#805c2e':'#56705f66';c.lineWidth=1;c.beginPath();c.roundRect(box.x,box.y,width,21,4);c.fill();c.stroke();c.fillStyle='#344c40';c.textAlign='center';c.fillText(text,p.x,box.y+14);m.labelHits.push(box);
      }
      if(person&&person.absence?.status!=='away'){const at=A.personPoint(person,selection.paused?1:s.remainder/5),b=s.building(person.location),inside=!person.path.length&&b&&!['market','market2','dock'].includes(b.type),p=this.camera.project(inside?b.x:at.x,inside?M.height(b)+8:18,inside?b.y:at.y);c.strokeStyle='#b95e3c';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,7,0,Math.PI*2);c.stroke();}
      c.fillStyle='#365340';c.font='600 11px Segoe UI';c.textAlign='left';c.fillText('ДАНЦИГ / ОБЪЁМНЫЙ ГОРОД',16,25);c.font='10px Segoe UI';c.fillStyle='#49634f';c.fillText(m.width<700?'Перетаскивание — движение':'Перетаскивание — движение · Shift + движение — поворот',16,41);
    }
    pick(sx,sy){const m=this.map,s=m.getSim();for(const b of [...m.labelHits].reverse())if(sx>=b.x&&sx<=b.x+b.w&&sy>=b.y&&sy<=b.y+b.h)return{kind:'building',id:b.id};const ray=this.camera.ray(sx,sy);let closest=Infinity,hit=null;
      // Ray against volumes, rather than the ground footprint: roofs are clickable too.
      for(const b of s.buildings){const t=G.rayBox(ray,[b.x-b.w/2,0,b.y-b.h/2],[b.x+b.w/2,M.height(b),b.y+b.h/2]);if(t<closest){closest=t;hit=m.matches(b)?{kind:'building',id:b.id}:null;}}
      for(const {p,at}of this.dynamicPeople){const t=G.rayBox(ray,[at.x-4,0,at.y-4],[at.x+4,14,at.y+4]);if(t<closest){closest=t;hit={kind:'person',id:p.id};}}
      if(closest===Infinity&&m.showLots&&['all','land','ownership'].includes(m.filter)){const point=this.camera.ground(sx,sy);for(const l of W.expansionLots)if(!s.building(l.id)&&Math.abs(point.x-l.x)<(l.types.includes('farm')?45:30)&&Math.abs(point.y-l.y)<(l.types.includes('farm')?31:21))return{kind:'lot',id:l.id};}return hit;
    }
  }
  root.Danzig3D=City3D;
})(window);
