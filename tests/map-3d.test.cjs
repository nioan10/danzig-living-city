const test=require('node:test'),assert=require('node:assert/strict');
const {Camera,Mesh,rayBox}=require('../map-3d-geometry.js'),Models=require('../map-3d-models.js'),{Simulation,World}=require('../sim.js');
test('3D: обратная проекция земли и выбор объёмов сохраняются при повороте камеры',()=>{
 const c=new Camera();for(const yaw of[-2,-.28,0,1.7,Math.PI])for(const elevation of[.72,1.25]){Object.assign(c,{yaw,elevation});c.update(1240,780,2);const p=c.project(880,0,430),g=c.ground(p.x,p.y);assert.ok(Math.abs(g.x-880)<1e-6&&Math.abs(g.y-430)<1e-6);const roof=c.project(880,55,430),ray=c.ray(roof.x,roof.y);assert.ok(Number.isFinite(rayBox(ray,[850,0,400],[910,60,460])));assert.equal(rayBox(ray,[1,0,1],[2,2,2]),Infinity);}
});
test('3D: геометрия всего города и нового двора не меняет модель или генератор случайности',()=>{
 const s=new Simulation(),before=JSON.stringify(s),m=new Mesh();Models.terrain(m,World,s);for(const b of s.buildings)Models.building(m,b);for(const l of World.expansionLots)Models.lot(m,l);const b=World.expansionBuilding(World.expansionLots[0].id,'home');Object.assign(b,{construction:{},development:{level:1,extras:[]}});Models.building(m,b);assert.equal(JSON.stringify(s),before);assert.ok(m.vertices.length>10000);assert.equal(m.vertices.length%27,0);assert.ok(m.vertices.every(Number.isFinite));assert.ok(m.vertices.length/27<100000,'геометрия ограничена по сложности');
});
test('3D: движение фигурок, груз, возраст и разные уровни зданий дают конечную геометрию',()=>{
 const s=new Simulation();s.advance(100);const before=JSON.stringify(s);for(const p of s.living){const m=new Mesh();Models.citizen(m,p,{x:p.x,y:p.y},1200,false,Math.PI/3);assert.ok(m.vertices.every(Number.isFinite));}for(const type of Object.keys(require('../sim.js').TYPES)){const b={...s.buildings[0],type,id:'preview-'+type,residence:'manor',development:{level:3,extras:[1],project:{}},damaged:true};const m=new Mesh();Models.building(m,b);assert.ok(m.vertices.every(Number.isFinite),type);}assert.equal(JSON.stringify(s),before);
});
