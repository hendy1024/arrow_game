'use strict';
const fs=require('fs'),{clone,validateLevel,firstBlocker}=require('../src/domain/board'),{solve}=require('../src/generation/validate'),{block}=require('../src/domain/doors'),{denseCandidate}=require('../src/generation/dense'),{random}=require('../src/generation/random'),{scatterSafe}=require('./obstacle-layout.cjs');
const levels=require('../config/campaign-levels.json'),tiers=require('../config/campaign-pacing.json');
if(!fs.existsSync('work/campaign-before-gates.json'))fs.writeFileSync('work/campaign-before-gates.json',JSON.stringify(levels));
const original=require('../work/campaign-before-gates.json');
function edges(b,side,from,to){return Array.from({length:to-from},(_,i)=>{const k=from+i;return side==='up'?[[k,0],[k,-1]]:side==='down'?[[k,b.height-1],[k,b.height]]:side==='left'?[[0,k],[-1,k]]:[[b.width-1,k],[b.width,k]];});}
function gateOptions(b,type,minimum=5){
 const base=solve(b),baseLayers=new Map(base.layers.flatMap((a,i)=>a.map(id=>[id,i])));const candidates=[];
 for(const side of ['up','right','down','left']){const size=['up','down'].includes(side)?b.width:b.height;
  for(const span of [...new Set([size,Math.ceil(size*.7),Math.ceil(size*.45),Math.ceil(size*.3)])])for(let start=0;start<=size-span;start+=2){
   const d={id:'gate-'+b.doors.length,edges:edges(b,side,start,start+span),required:9999},map=new Map();block(d,map);const affected=b.arrows.filter(a=>firstBlocker(a,b,map)).length;
   if(affected<minimum)continue;const probe={...b,doors:[...b.doors,d]};if(!validateLevel(probe).valid)continue;
   const reach=solve(probe);const ordinary=reach.sequence.filter(id=>!b.doors.some(g=>g.keyArrowId===id));if(ordinary.length<5)continue;
   if(type==='count')d.required=Math.max(5,ordinary.length);
   else{const keys=reach.sequence.filter(id=>baseLayers.get(id)>=3&&!b.doors.some(g=>g.keyArrowId===id));if(!keys.length)continue;delete d.required;d.keyArrowId=keys[keys.length-1];}
   const result=solve(probe);if(!result.valid)continue;
   const delayed=result.layers.flatMap((a,i)=>a.filter(id=>i>baseLayers.get(id))).length;
   if(delayed<3)continue;candidates.push({d,score:affected+Math.min(ordinary.length,b.arrows.length*.4)+delayed*.25,result});
  }
 }
 candidates.sort((a,b)=>b.score-a.score);return candidates;
}
function addGate(b,type,minimum=5){const opts=gateOptions(b,type,minimum);if(!opts.length)return false;b.doors.push(opts[0].d);return true;}
function gated(original,n){
 const variants=[clone(original)];
 for(const side of ['up','right','down','left']){
 const b=clone(original);let changed=0;
 for(const a of b.arrows){const path=a.path.slice().reverse(),h=path.at(-1),t=path.at(-2),direction=h[0]>t[0]?'right':h[0]<t[0]?'left':h[1]>t[1]?'down':'up';
 if(direction!==side||!(side==='up'?h[1]===0:side==='down'?h[1]===b.height-1:side==='left'?h[0]===0:h[0]===b.width-1))continue;
 const prev=a.path,dir=a.direction;a.path=path;a.direction=direction;if(!solve(b).valid){a.path=prev;a.direction=dir;}else changed++;
 }if(changed>=2)variants.push(b);
 }
 for(const seed of variants){for(const choice of gateOptions(seed,'count').slice(0,12)){const b=clone(seed);b.doors.push(choice.d);if(n>=13&&!addGate(b,'key'))continue;const v=solve(b);if(v.valid&&v.metrics.initialOpen===1&&v.metrics.depth>=tiers.find(p=>p.from===n).minDepth)return b;}}
 return null;
}
function restoreCells(b){const doors=b.doors||[];b.doors=[];for(const d of doors.slice().reverse()){if(!d.cell)continue;let placed=false;for(const a of b.arrows){if(Math.abs(a.path[0][0]-d.cell[0])+Math.abs(a.path[0][1]-d.cell[1])!==1)continue;a.path.unshift(d.cell);if(solve(b).valid){placed=true;break;}a.path.shift();}if(!placed)throw Error('无法恢复旧门格子 '+b.number);}}
function teaching(n){const targets={4:[14,16,8],8:[18,20,14],12:[20,22,20]},[width,height,depth]=targets[n],rng=random(852000+n);
 for(let attempt=0;attempt<4000;attempt++){
 const b={number:n,seed:852000+n,width,height,lifeLimit:3,timeLimitMs:original[n-1].board.timeLimitMs,campaignConfigured:true,arrows:[],obstacles:[],doors:[]};const task=denseCandidate(b,{maxLength:18,minTargetLength:8,depthCeiling:depth+3},rng);while(!task.next().done){}
 const v=solve(b);if(!v.valid||v.metrics.fill!==1||v.metrics.depth<depth||v.metrics.averageLength<4)continue;if(!scatterSafe(b,n,depth,4))continue;
 if(n>=8&&!addGate(b,n===8?'count':'key',5))continue;
 b.guide=n===4?{title:'绕过石块，找到出口',text:'这一关需要连续拆开几层遮挡。灰色石块不会消失，先找出口没有阻挡的箭头，再逐步清理内部。',hint:'先观察箭头朝向，从可用出口逐层清理。'}:n===8?{title:'先清外侧，再开闸门',text:'整段彩色闸门封住了一组箭头的出口。先清理其他出口的普通箭头，门上数字归零后，闸门会打开。',hint:'先清理未封闭的出口，观察闸门上的剩余数量。'}:{title:'解开遮挡，送出钥匙',text:'带钥匙图标的箭头藏在几层遮挡后。先替它腾出路线，让钥匙完全移出，再清理彩色闸门后的一组箭头。',hint:'找到彩色钥匙，先清理挡在它前面的箭头。'};
 return b;
 }throw Error('教学关生成失败 '+n);
}
function run(){let saved={};try{saved=require('../work/strong-gates-cache.json');}catch{}
for(const row of levels){const n=row.id;if(saved[n])row.board=saved[n];else if([4,8,12].includes(n))row.board=teaching(n);else if(n>=8){const b=clone(original[n-1].board);restoreCells(b);row.board=gated(b,n);if(!row.board)throw Error('闸门生成失败 '+n);}const v=solve(row.board);if(!v.valid)throw Error('关卡不可解 '+n);saved[n]=row.board;fs.writeFileSync('work/strong-gates-cache.json',JSON.stringify(saved));console.log(n,v.metrics.arrowCount,v.metrics.depth,(row.board.doors||[]).map(d=>[d.edges?.length,d.required,d.keyArrowId]));}
fs.writeFileSync('config/campaign-levels.json','[\n'+levels.map(r=>JSON.stringify(r)).join(',\n')+'\n]\n');

}
if(require.main===module)run();
module.exports={gated,teaching,gateOptions};
