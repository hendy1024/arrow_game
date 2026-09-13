'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const levels=require('../config/campaign-levels.json'),tiers=require('../config/campaign-pacing.json'),{solve}=require('../src/generation/validate');
test('P8 20关指数曲线，第2关限时高难、第4关障碍、长箭头密集且全部可解',()=>{
 assert.equal(levels.length,20);assert.equal(tiers.length,19);let previousStones=0,previousTime=Infinity;
 for(const p of tiers){const n=p.from,t=(n-2)/18,b=levels[n-1].board,v=solve(b);
 assert.equal(p.size,Math.round(25*Math.pow(32/25,t)));assert.equal(p.minDepth,Math.round(40*Math.pow(64/40,t)));
 assert.ok(v.valid);assert.equal(b.width,p.size);assert.equal(v.metrics.fill,1);assert.equal(v.metrics.initialOpen,1);assert.ok(v.metrics.depth>=p.minDepth&&v.metrics.depth<=p.minDepth+3);assert.ok(v.metrics.averageLength>=p.minAverageLength);assert.ok(b.arrows.every(a=>a.path.length<=p.maxLength));
 assert.equal(b.obstacles.length,p.obstacles);
 if(p.obstacles){const xs=b.obstacles.map(p=>p[0]),ys=b.obstacles.map(p=>p[1]);assert.ok(Math.max(...xs)-Math.min(...xs)>=b.width*.4);assert.ok(Math.max(...ys)-Math.min(...ys)>=b.height*.4);for(let i=0;i<b.obstacles.length;i++)for(let j=i+1;j<b.obstacles.length;j++)assert.ok(Math.max(Math.abs(xs[i]-xs[j]),Math.abs(ys[i]-ys[j]))>=3);}
 assert.ok(p.obstacles>=previousStones);previousStones=p.obstacles;assert.equal(b.timeLimitMs,p.timeSeconds*1000);assert.ok(p.timeSeconds<=previousTime);previousTime=p.timeSeconds;assert.equal(b.lifeLimit,3);
 }
 assert.equal(levels[1].board.width,25);assert.equal(levels[1].board.timeLimitMs,120000);assert.equal(levels[2].board.obstacles.length,0);assert.equal(levels[3].board.obstacles.length,4);assert.equal(levels[19].board.width,32);assert.equal(levels[19].board.timeLimitMs,75000);
 assert.deepEqual(levels[19].rewards,{time:3,life:3,shuffle:3});
});
