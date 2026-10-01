const {Court,Government}=require('../../sim.js');
function at(s,p,id='hall'){Object.assign(p,{location:id,goal:id,navNode:'b:'+id,path:[],x:s.building(id).door.x,y:s.building(id).door.y,plan:null,absence:null,arriving:false});}
function clock(s,now){s.day=Math.floor(now/1440);s.minute=now%1440;}
function hearing(s,c){at(s,s.person(c.plaintiffId));Court.file(s,s.person(c.plaintiffId),c);const judge=s.person(c.judgeId);if(!judge)throw Error('No impartial judge');Object.assign(judge.character.values,{justice:.5,honesty:.9});judge.relationships={};for(const id of [c.plaintiffId,c.defendantId,c.judgeId,...(Court.source(s,c)?.witnesses||[])])at(s,s.person(id));clock(s,c.hearingAt);Court.adjudicate(s,c,judge);clock(s,c.hearingAt+30);Court.adjudicate(s,c,judge);return judge;}
function enforce(s,c){clock(s,Math.max(s.now,(c.nextEnforcement||s.day)*1440+600));const guard=Court.officer(s,c),b=['wage','supply'].includes(c.kind)?c.buildingId:s.person(c.defendantId).homeId;at(s,guard,b);if(!['wage','supply'].includes(c.kind))at(s,s.person(c.defendantId),b);return Court.enforce(s,guard,c);}
module.exports={at,clock,hearing,enforce};
