'use strict';
const fs=require('node:fs'),path=require('node:path'),{denseCandidate}=require('../src/generation/dense'),{random}=require('../src/generation/random'),{solve}=require('../src/generation/validate'),{scatterSafe,spread}=require('./obstacle-layout.cjs');
const root=path.resolve(__dirname,'..'),levels=JSON.parse(fs.readFileSync(path.join(root,'config/campaign-levels.json'))).slice(0,20),tiers=require('../config/campaign-pacing.json'),report=[];
const cachePath=path.join(root,'work/campaign-tuning-cache.json');fs.mkdirSync(path.dirname(cachePath),{recursive:true});let cache={};try{cache=JSON.parse(fs.readFileSync(cachePath));}catch{}
function acceptable(b,p){const v=solve(b);return b.width===p.size&&b.height===p.size&&b.lifeLimit===3&&b.timeLimitMs===p.timeSeconds*1000&&b.obstacles.length===p.obstacles&&spread(b.obstacles,p.size)&&v.valid&&v.metrics.fill===1&&v.metrics.initialOpen===1&&v.metrics.depth>=p.minDepth&&v.metrics.depth<=p.minDepth+3&&v.metrics.averageLength>=p.minAverageLength&&b.arrows.every(a=>a.path.length<=p.maxLength)&&Math.max(...b.arrows.map(a=>a.path.length))>=p.maxLength*.65;}
for(const row of levels){
 const p=tiers.find(t=>row.id>=t.from&&row.id<=t.to);if(!p)continue;const rng=random(910000+row.id);let chosen,attempt=0;
 const old=cache[row.id];if(old&&JSON.stringify(old.target)===JSON.stringify(p)&&old.board.number===row.id&&old.board.seed===row.board.seed&&acceptable(old.board,p))chosen=old.board;
 while(!chosen&&attempt++<12000){
  const b={...row.board,width:p.size,height:p.size,lifeLimit:3,arrows:[],obstacles:[],timeLimitMs:p.timeSeconds*1000},task=denseCandidate(b,{maxLength:p.maxLength,minTargetLength:Math.ceil(p.maxLength*.6),depthCeiling:p.minDepth+3},rng);let r;do{r=task.next();}while(!r.done);
  const v=solve(b);if(!v.valid||v.metrics.fill!==1||v.metrics.depth<p.minDepth||v.metrics.averageLength-p.obstacles/b.arrows.length<p.minAverageLength)continue;
  if(scatterSafe(b,p.obstacles,p.minDepth,p.minAverageLength)&&acceptable(b,p))chosen=b;
 }
 if(!chosen)throw Error('无法满足第'+row.id+'关的目标，原配置未改动');
 row.board=chosen;cache[row.id]={target:p,board:chosen};fs.writeFileSync(cachePath,JSON.stringify(cache));report.push({number:row.id,attempts:attempt,...solve(chosen).metrics,obstacles:p.obstacles,seconds:p.timeSeconds});console.log('已验证至第 '+row.id+' 关');
}
require('./check-campaign.cjs').check(levels);
fs.writeFileSync(path.join(root,'config/campaign-levels.json'),'[\n'+levels.map(r=>JSON.stringify(r)).join(',\n')+'\n]\n');
fs.writeFileSync(path.join(root,'reports/campaign-pacing.json'),JSON.stringify(report,null,2));console.log('已保存全部固定关卡，奖励保持原配置');
