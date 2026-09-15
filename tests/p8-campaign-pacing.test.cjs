'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const levels=require('../config/campaign-levels.json'),tiers=require('../config/campaign-pacing.json'),{solve}=require('../src/generation/validate');
test('P8 40关高难曲线与独立教学，障碍逐关增加、前10关5分钟、完整可解',()=>{
 assert.equal(levels.length,40);assert.equal(tiers.length,39);let previousTime=300000;
 for(const {id:n,board:b,rewards} of levels){const v=solve(b),p=tiers.find(t=>t.from===n);assert.ok(v.valid,'可解 '+n);assert.equal(b.obstacles.length,n<4?0:n);assert.equal(b.timeLimitMs,n<=10?300000:300000-(n-10)*4000);assert.ok(b.timeLimitMs<=previousTime);previousTime=b.timeLimitMs;
 assert.deepEqual(rewards,n%4===3?{time:1,life:2,shuffle:1}:{});
 if(n===1)continue;
 assert.equal(b.lifeLimit,3);
 if([4,8,12].includes(n)){assert.ok(b.guide);const range=n===4?[8,16,20,45]:n===8?[14,32,35,75]:[20,40,45,90];assert.ok(v.metrics.depth>=range[0]&&v.metrics.depth<=range[1]);assert.ok(b.arrows.length>=range[2]&&b.arrows.length<=range[3]);continue;}
 assert.equal(b.width,p.width||p.size);assert.equal(b.height,p.height||p.size);assert.equal(v.metrics.fill,1);assert.equal(v.metrics.initialOpen,1);assert.ok(v.metrics.depth>=p.minDepth&&v.metrics.depth<=p.minDepth*2,'依赖深度 '+n);assert.ok(v.metrics.averageLength>=p.minAverageLength,'箭头长度 '+n);assert.ok(b.arrows.every(a=>a.path.length<=p.maxLength));
 if(n>=4){const xs=b.obstacles.map(p=>p[0]),ys=b.obstacles.map(p=>p[1]);assert.ok(Math.max(...xs)-Math.min(...xs)>=b.width*.4);assert.ok(Math.max(...ys)-Math.min(...ys)>=b.height*.4);for(let i=0;i<b.obstacles.length;i++)for(let j=i+1;j<b.obstacles.length;j++)assert.ok(Math.max(Math.abs(xs[i]-xs[j]),Math.abs(ys[i]-ys[j]))>=3);}
 if(n<8)assert.equal((b.doors||[]).length,0);else{assert.ok(b.doors.some(d=>d.required));assert.equal(b.doors.some(d=>d.keyArrowId),n>=12);}
 }
 assert.equal(levels[1].board.width,25);assert.ok(levels.slice(20).every(r=>r.board.height>r.board.width));assert.ok(solve(levels[8].board).metrics.depth>40);assert.ok(solve(levels[12].board).metrics.depth>50);
});
