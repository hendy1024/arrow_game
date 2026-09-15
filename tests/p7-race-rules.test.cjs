'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { period, seedFor, difficulty, ROUNDS } = require('../src/race/rules');
test('P7 日榜按北京时间午夜切换，周榜按周一午夜切换', () => {
    const before = Date.parse('2026-09-13T15:59:59Z'), after = Date.parse('2026-09-13T16:00:00Z');
    assert.equal(period('daily', before).key, 'daily:2026-09-13');
    assert.equal(period('daily', after).key, 'daily:2026-09-14');
    assert.equal(period('weekly', before).key, 'weekly:2026-09-07');
    assert.equal(period('weekly', after).key, 'weekly:2026-09-14');
    assert.equal(period('weekly', before).endsAt, after);
});
test('P7 同周期同一关种子一致，日周分别固定，三关指数难度增长', () => {
    const day = period('daily', Date.parse('2026-09-12T01:00:00Z')).key;
    const seeds = new Set(); let previous = 0;
    for (let n = 1; n <= ROUNDS; n++) {
        assert.equal(seedFor(day, n), seedFor(day, n)); seeds.add(seedFor(day, n));
        assert.notEqual(seedFor(day, n), seedFor('weekly:2026-09-07', n));
        const p = difficulty(n); assert.ok(p.factor > previous); previous = p.factor;
        assert.equal(p.timeLimitMs, null); assert.ok(p.size <= 32);
        if (n > 1) assert.ok(p.minDepth > difficulty(n - 1).minDepth);
    }
    assert.equal(seeds.size, 3); assert.equal(difficulty(1).size, 26); assert.equal(difficulty(3).size, 30);assert.equal(difficulty(3).height,37);assert.ok(difficulty(3).width*difficulty(3).height>=32*32);
});

test('P7 每日三关比每周同关更轻松，日周各自固定并采用对应保底棋盘',()=>{
 const {generateRound,profile}=require('../src/race/course'),{solve}=require('../src/generation/validate'),{acceptable}=require('../src/generation/generator');
 assert.deepEqual([1,2,3].map(n=>difficulty(n,'daily').size),[26,28,30]);
 assert.deepEqual([1,2,3].map(n=>difficulty(n,'weekly').size),[26,30,30]);
 for(let n=1;n<=3;n++){
  assert.ok(difficulty(n,'daily').minDepth<=difficulty(n,'weekly').minDepth);
  for(const kind of ['daily','weekly'])for(const maxAttempts of [0,64]){
   const key=kind+':2026-09-14',a=generateRound(key,n,{maxAttempts}),p=profile(n,kind),v=solve(a);
   assert.deepEqual([a.width,a.height].sort((a,b)=>a-b),[p.width,p.height].sort((a,b)=>a-b));assert.ok(v.valid);assert.ok(acceptable(v.metrics,p));assert.deepEqual(a,generateRound(key,n,{maxAttempts}));
  }
 }
 assert.throws(()=>difficulty(1,'invalid'));
});

test('P7 难度配置校验、参数生效和成绩版本隔离',()=>{
 const {settings,validate,version}=require('../src/race/settings'),fs=require('node:fs'),vm=require('node:vm');
 const changed=JSON.parse(JSON.stringify(settings));changed.daily[0]={campaignLevel:3};
 assert.notEqual(version(changed),version(settings));assert.equal(version(JSON.parse(JSON.stringify(settings))),version(settings));
 const sandbox={module:{exports:{}},require:()=>({settings:validate(changed),version})};vm.runInNewContext(fs.readFileSync('src/race/rules.js','utf8'),sandbox);
 assert.equal(sandbox.module.exports.difficulty(1,'daily').size,25);assert.equal(sandbox.module.exports.difficulty(1,'daily').obstacles,0);assert.equal(sandbox.module.exports.difficulty(1,'weekly').size,26);
 for(const change of [c=>c.daily.pop(),c=>c.weekly[0].campaignLevel=30,c=>c.daily[0].campaignLevel=0,c=>c.daily[0].campaignLevel=20,c=>c.daily[0].campaignLevel='9']){
  const bad=JSON.parse(JSON.stringify(settings));change(bad);assert.throws(()=>validate(bad));
 }
 const {matches}=require('../scripts/race-fallbacks.cjs'),{profile}=require('../src/race/course');
 assert.equal(matches(require('../src/race/daily-fallbacks')[0],{...profile(1,'daily'),size:20,width:20,height:20}),false);
});
