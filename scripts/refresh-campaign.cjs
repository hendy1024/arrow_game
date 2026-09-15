'use strict';
const fs=require('fs'),{denseCandidate}=require('../src/generation/dense'),{random}=require('../src/generation/random'),{solve}=require('../src/generation/validate'),{scatterSafe}=require('./obstacle-layout.cjs'),{clone,exitCells,key}=require('../src/domain/board');
const levels=require('../config/campaign-levels.json'),tiers=require('../config/campaign-pacing.json'),old=(()=>{try{return require('../work/campaign-tuning-cache.json');}catch{return {};}})();fs.mkdirSync('work',{recursive:true});let cache={};try{cache=require('../work/new-campaign-cache.json');}catch{}
function matches(b,p,n){
 if(!b||!p)return false;const v=solve(b);
 return b.width===(p.width||p.size)&&b.height===(p.height||p.size)&&b.obstacles?.length===(n<4?0:n)&&v.valid&&v.metrics.fill===1&&v.metrics.initialOpen===1&&v.metrics.depth>=p.minDepth&&v.metrics.depth<=p.minDepth*2&&v.metrics.averageLength>=p.minAverageLength&&b.arrows.every(a=>a.path.length<=p.maxLength)&&(b.doors||[]).filter(d=>d.keyArrowId).length===(n>=13?1:0)&&(b.doors||[]).filter(d=>d.required).length===(n>=8?1:0)&&(n<8||(b.doors||[]).every(d=>d.edges?.length>=6));
}
function decorate(b,n){
 if(n<8)return true;b.doors=[];const upgraded=require('./upgrade-gates.cjs').gated(b,n);if(!upgraded)return false;Object.assign(b,upgraded);return true;
}
function tutorial(n){return clone(levels[n-1].board);}
const only=Number(process.argv[2])||0;
for(let n=only||1;n<=(only||40);n++){
 const p=tiers.find(p=>p.from===n),seconds=p?.timeSeconds??(n<=10?300:Math.round(300-(n-10)*4)),rewards=levels[n-1]?.rewards||(n%4===3?{time:1,life:2,shuffle:1}:{});let b;
 if(n===1)b=clone(levels[0].board);
 else if([4,8,12].includes(n))b=tutorial(n);
 else if(matches(levels[n-1]?.board,p,n))b=clone(levels[n-1].board);
 else if(matches(cache[n],p,n))b=clone(cache[n]);
 else{
  const rng=random(940000+n);let attempt=0;
  while(!b&&attempt<40000){
   let candidate;if(attempt++===0&&old[n])candidate=clone(old[n].board);else{candidate={number:n,seed:710000+n,width:p.width||p.size,height:p.height||p.size,arrows:[],obstacles:[],lifeLimit:3,timeLimitMs:seconds*1000};const gen=denseCandidate(candidate,{maxLength:p.maxLength,minTargetLength:Math.ceil(p.maxLength*.65),depthCeiling:p.minDepth*2},rng);while(!gen.next().done){}}
   if(n<4)candidate.obstacles=[];
   if(attempt%100===0)console.log('关卡',n,'尝试',attempt);
   const v=solve(candidate);if(!v.valid||v.metrics.fill!==1||v.metrics.depth<p.minDepth||v.metrics.averageLength<p.minAverageLength)continue;
   if(scatterSafe(candidate,n<4?0:n,p.minDepth,p.minAverageLength)&&decorate(candidate,n)){
    const result=solve(candidate);if(result.metrics.fill===1&&result.metrics.initialOpen===1&&result.metrics.averageLength>=p.minAverageLength&&result.metrics.depth<=p.minDepth*2)b=candidate;
   }
   if(attempt%100===0)console.log('关卡',n,'尝试',attempt);
  }if(!b)throw Error('生成未达标准 '+n);
 }
 b.obstacles=b.obstacles||[];b.timeLimitMs=seconds*1000;b.number=n;b.campaignConfigured=true;
 if(n===1)b.guide={title:'认识倒计时',text:'前10关每关5分钟。点击箭头，让它沿着指向移出棋盘。遇到阻挡先移走其他箭头。暂停和查看教学时不计时。',hint:'先点击标记的箭头。'};
 if(!solve(b).valid)throw Error('不可解 '+n);cache[n]=b;fs.writeFileSync(only?'work/new-campaign-level-'+only+'.json':'work/new-campaign-cache.json',JSON.stringify(only?b:cache));
 levels[n-1]={id:n,rewards,board:b};console.log('已验证',n,solve(b).metrics.depth,b.obstacles.length);
}
if(only)process.exit(0);
fs.writeFileSync('config/campaign-levels.json','[\n'+levels.map(r=>JSON.stringify(r)).join(',\n')+'\n]\n');
console.log('全部40关已保存');

