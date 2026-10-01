(function(root){
  'use strict';
  const color=h=>{if(Array.isArray(h))return h;const v=parseInt(h.replace('#',''),16);return[(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];};
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  class Mesh {
    constructor(){this.vertices=[];}
    tri(a,b,c,tint){const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1,rgb=color(tint);for(const p of[a,b,c])this.vertices.push(...p,...n.map(x=>x/len),...rgb);}
    quad(a,b,c,d,tint){this.tri(a,b,c,tint);this.tri(a,c,d,tint);}
    box(x,y,z,w,h,d,tint){const a=x-w/2,b=x+w/2,c=z-d/2,e=z+d/2,t=y+h;
      this.quad([a,y,e],[b,y,e],[b,t,e],[a,t,e],tint);this.quad([b,y,c],[a,y,c],[a,t,c],[b,t,c],tint);
      this.quad([a,y,c],[a,y,e],[a,t,e],[a,t,c],tint);this.quad([b,y,e],[b,y,c],[b,t,c],[b,t,e],tint);
      this.quad([a,t,e],[b,t,e],[b,t,c],[a,t,c],tint);this.quad([a,y,c],[b,y,c],[b,y,e],[a,y,e],tint);
    }
    roof(x,y,z,w,d,h,tint,wall){const a=x-w/2,b=x+w/2,c=z-d/2,e=z+d/2;
      this.quad([a,y,e],[x,y+h,e],[x,y+h,c],[a,y,c],tint);this.quad([x,y+h,e],[b,y,e],[b,y,c],[x,y+h,c],tint);
      this.tri([a,y,e],[b,y,e],[x,y+h,e],wall);this.tri([b,y,c],[a,y,c],[x,y+h,c],wall);
    }
    cylinder(x,y,z,r,h,tint,top=r,sides=8){for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides,b=(i+1)*Math.PI*2/sides,p=[x+Math.cos(a)*r,y,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,y,z+Math.sin(b)*r],u=[x+Math.cos(a)*top,y+h,z+Math.sin(a)*top],v=[x+Math.cos(b)*top,y+h,z+Math.sin(b)*top];this.quad(q,p,u,v,tint);this.tri([x,y+h,z],v,u,tint);}}
    strip(a,b,width,y,tint){const dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz);if(!len)return;const x=-dz/len*width/2,z=dx/len*width/2;this.quad([a.x-x,y,a.y-z],[a.x+x,y,a.y+z],[b.x+x,y,b.y+z],[b.x-x,y,b.y-z],tint);}
    disk(x,y,z,r,tint,n=20){this.cylinder(x,y,z,r,.06,tint,r,n);}
    data(){return new Float32Array(this.vertices);}
  }
  class Camera {
    constructor(){this.reset();}
    reset(){this.x=800;this.z=550;this.yaw=-.28;this.elevation=.72;}
    update(width,height,zoom=1){this.width=Math.max(1,width);this.height=Math.max(1,height);const c=Math.cos(this.yaw),s=Math.sin(this.yaw),e=Math.sin(this.elevation),v=Math.cos(this.elevation);this.right=[c,0,-s];this.up=[-s*e,v,-c*e];this.back=[s*v,e,c*v];
      // Fit does not change while rotating: orbiting must not pump the zoom.
      this.scale=Math.min(this.width/1800,(this.height-65)/1250)*zoom;this.center=[this.x,14,this.z];const sx=this.scale*2/this.width,sy=this.scale*2/this.height,sz=1/4000,r=this.right,u=this.up,b=this.back;
      this.matrix=new Float32Array([r[0]*sx,u[0]*sy,-b[0]*sz,0,r[1]*sx,u[1]*sy,-b[1]*sz,0,r[2]*sx,u[2]*sy,-b[2]*sz,0,-dot(r,this.center)*sx,-dot(u,this.center)*sy,dot(b,this.center)*sz,1]);
    }
    project(x,y,z){const p=[x-this.x,y-14,z-this.z];return{x:this.width/2+dot(p,this.right)*this.scale,y:this.height/2-dot(p,this.up)*this.scale,depth:dot(p,this.back)};}
    ground(x,y){const a=(x-this.width/2)/this.scale,b=(y-this.height/2-14*Math.cos(this.elevation)*this.scale)/this.scale/Math.sin(this.elevation);return{x:this.x+Math.cos(this.yaw)*a+Math.sin(this.yaw)*b,y:this.z-Math.sin(this.yaw)*a+Math.cos(this.yaw)*b};}
    pan(dx,dy){this.x-= (Math.cos(this.yaw)*dx+Math.sin(this.yaw)*dy/Math.sin(this.elevation))/this.scale;this.z-=(-Math.sin(this.yaw)*dx+Math.cos(this.yaw)*dy/Math.sin(this.elevation))/this.scale;this.x=Math.max(-100,Math.min(1700,this.x));this.z=Math.max(-100,Math.min(1200,this.z));}
    ray(x,y){const a=(x-this.width/2)/this.scale,b=(this.height/2-y)/this.scale;return{origin:this.center.map((v,i)=>v+this.right[i]*a+this.up[i]*b+this.back[i]*3000),direction:this.back.map(v=>-v)};}
  }
  function rayBox(ray,min,max){let near=0,far=Infinity;for(let i=0;i<3;i++){const d=ray.direction[i],p=ray.origin[i];if(Math.abs(d)<1e-8){if(p<min[i]||p>max[i])return Infinity;continue;}const a=(min[i]-p)/d,b=(max[i]-p)/d;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(far<near)return Infinity;}return near;}
  const api={Mesh,Camera,rayBox,color};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Danzig3DGeometry=api;
})(typeof window!=='undefined'?window:globalThis);
