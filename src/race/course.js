'use strict';
const {difficulty,seedFor,VERSION,ROUNDS}=require('./rules');
const {solve}=require('../generation/validate');
function profile(round,kind='weekly'){return {...difficulty(round,kind),minFill:1,maxFill:1,maxOpenRatio:1,dense:true};}
function generateRound(periodKey,round){
 const kind=periodKey.split(':')[0],p=profile(round,kind),base=require('../../config/campaign-levels.json')[p.campaignLevel-1].board;
 const days=Math.floor(Date.parse(periodKey.split(':')[1]+'T00:00:00Z')/86400000);if(!Number.isFinite(days))throw Error('Invalid race period');
 const variant=((kind==='weekly'?Math.floor(days/7):days)+round*3)%8,turns=variant%4,mirror=variant>=4,size=base.width;
 const point=p=>{let [x,y]=p;let w=base.width,h=base.height;if(mirror)x=w-1-x;for(let i=0;i<turns;i++){[x,y]=[h-1-y,x];[w,h]=[h,w];}return [x,y];};
 const level={...JSON.parse(JSON.stringify(base)),number:round,seed:seedFor(periodKey,round),lifeLimit:null,timeLimitMs:null,raceVersion:VERSION};
 delete level.campaignConfigured;
 if(turns%2){level.width=base.height;level.height=base.width;}
 level.doors=(base.doors||[]).map(d=>require('../domain/doors').transform(d,point));
 level.obstacles=base.obstacles.map(point);level.arrows=base.arrows.map(a=>{const path=a.path.map(point),h=path.at(-1),t=path.at(-2),direction=h[0]>t[0]?'right':h[0]<t[0]?'left':h[1]>t[1]?'down':'up';return {...a,path,direction};});
 if(!solve(level).valid)throw Error('Invalid race course');return level;
}
async function generateCourse(periodKey){const result=[];for(let n=1;n<=ROUNDS;n++){result.push(generateRound(periodKey,n));await new Promise(resolve=>setTimeout(resolve,0));}return result;}
module.exports={profile,generateRound,generateCourse};
