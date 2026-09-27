const assert=require('node:assert/strict');
const {Construction,Finance,Development,Expansion}=require('../../sim.js');
// Fixture completion for tests of levels, offices and inheritance. Production and
// road delivery are tested independently in enterprise-economy.test.cjs.
function supply(s,b){const project=b.construction||b.development.project,q=project?.local;if(!q)return;
 const p=s.person(2);for(const [good,amount]of Object.entries(q.needs)){const seller=s.buildings.find(x=>x.id!==b.id&&s.productRecipes(x).some(r=>r.out===good));assert.ok(seller);seller.stock[good]=Math.max(seller.stock[good],amount);const cost=amount*s.price(seller,good);assert.ok(q.cash-q.capital>=cost);q.cash-=cost;q.materialSpent+=cost;seller.stock[good]-=amount;Finance.sale(s,seller,cost,false,{good,amount});q.stock[good]=amount;}
 const prior={location:p.location,absence:p.absence};p.location=b.id;p.absence=null;const r=Construction.execute(s,p,{kind:'buildWork',jobId:q.id},q.required);assert.ok(r.ok);Object.assign(p,prior);if(prior.absence===undefined)delete p.absence;
}
function complete(s,b){supply(s,b);const p=b.construction||b.development.project;s.day=Math.floor(p.until/1440);s.minute=p.until%1440;Expansion.tick(s);Development.tick(s);}
module.exports={supply,complete};
