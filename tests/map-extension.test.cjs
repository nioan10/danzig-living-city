const test=require('node:test'),assert=require('node:assert/strict');
const {Simulation,World:W,Expansion}=require('../sim.js');
const additions=W.expansionLots.filter(l=>l.extension);
function intersects(a,b,box,pad=0){let lo=0,hi=1;for(const [axis,half]of [['x',box.w/2+pad],['y',box.h/2+pad]]){const d=b[axis]-a[axis],min=box[axis]-half,max=box[axis]+half;if(!d){if(a[axis]<=min||a[axis]>=max)return false;continue;}let t=(min-a[axis])/d,u=(max-a[axis])/d;if(t>u)[t,u]=[u,t];lo=Math.max(lo,t);hi=Math.min(hi,u);if(lo>=hi)return false;}return true;}
test('новые участки добавлены в поля, северную слободу, все городские кварталы и порт',()=>{
 assert.equal(additions.length,29);const districts=new Set(additions.map(l=>W.Layout.districtAt(l.x,l.y)));assert.deepEqual([...districts].sort(),['artisan','civic','market','noble','port','rural','suburbs']);assert.equal(additions.filter(l=>l.y<230&&l.x>540).length,7);
 for(const l of additions){assert.ok(W.route('b:hall','b:'+l.id).length);if(l.types.some(t=>['farm','pasture','wood','clay'].includes(t)))assert.equal(W.insideTown(l.x,l.y),false);}
});
test('новые дворы и подъезды не перекрывают другие участки или дороги',()=>{
 const added=new Set(additions.map(l=>l.id)),parcels=[...W.buildings(),...W.expansionLots.map(l=>({id:l.id,x:l.x,y:l.y,w:l.types.includes('farm')?90:60,h:l.types.includes('farm')?62:42}))];
 for(const a of parcels.filter(p=>added.has(p.id)))for(const b of parcels.filter(p=>p.id!==a.id))assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2||Math.abs(a.y-b.y)>=(a.h+b.h)/2,a.id+' overlaps '+b.id);
 for(const e of W.edges)for(const p of parcels){if(e.a==='b:'+p.id||e.b==='b:'+p.id||!added.has(p.id)&&!added.has(e.b.slice(2)))continue;assert.equal(intersects(W.nodes[e.a],W.nodes[e.b],p,e.width/2),false,e.a+'>'+e.b+' crosses '+p.id);}
});
test('новые участки доступны стройке в разных районах и переносятся сохранением',()=>{
 const s=new Simulation();s.treasury=10000;for(const [id,type]of [['new41','farm'],['new45','home'],['new54','tailor'],['new62','carpenter']]){assert.ok(Expansion.build(s,id,type).ok);assert.equal(s.building(id).type,type);}
 const r=Simulation.fromJSON(JSON.parse(JSON.stringify(s)));assert.deepEqual(r.toJSON(),s.toJSON());
});
test('добавление участков сохраняет путь, деньги и груз пешехода из планировки 3',()=>{
 const s=new Simulation(),p=s.person(2),a=W.nodes.west,b=W.nodes.bend;Object.assign(p,{location:null,goal:'bakery',navNode:'west',x:(a.x+b.x)/2,y:(a.y+b.y)/2,path:[{id:'bend',x:b.x,y:b.y},...W.route('bend','b:bakery')],motionSegments:[]});p.bag.wood=3;
 const raw=JSON.parse(JSON.stringify(s));raw.state.layoutVersion=3;const r=Simulation.fromJSON(raw),q=r.person(p.id);assert.equal(q.x,p.x);assert.equal(q.y,p.y);assert.equal(q.coins,p.coins);assert.deepEqual(q.bag,p.bag);assert.equal(r.treasury,s.treasury);assert.equal(q.path.at(-1).id,'b:bakery');
 for(const [i,n]of q.path.entries()){const prev=i?q.path[i-1].id:q.navNode;assert.ok(W.edges.some(e=>e.a===prev&&e.b===n.id||e.b===prev&&e.a===n.id));}
});
