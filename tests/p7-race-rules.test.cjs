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
test('P7 同周期同一关种子一致，日周分别固定，五关指数难度增长', () => {
    const day = period('daily', Date.parse('2026-09-12T01:00:00Z')).key;
    const seeds = new Set(); let previous = 0;
    for (let n = 1; n <= ROUNDS; n++) {
        assert.equal(seedFor(day, n), seedFor(day, n)); seeds.add(seedFor(day, n));
        assert.notEqual(seedFor(day, n), seedFor('weekly:2026-09-07', n));
        const p = difficulty(n); assert.ok(p.factor > previous); previous = p.factor;
        assert.equal(p.timeLimitMs, null); assert.ok(p.size <= 20);
        if (n > 1) assert.ok(p.minDepth > difficulty(n - 1).minDepth);
    }
    assert.equal(seeds.size, 5); assert.equal(difficulty(1).size, 14); assert.equal(difficulty(5).size, 20);
});

test('P7 每日五关比每周同关更轻松，日周各自固定并采用对应保底棋盘',()=>{
 const {generateRound,profile}=require('../src/race/course'),{solve}=require('../src/generation/validate'),{acceptable}=require('../src/generation/generator');
 assert.deepEqual([1,2,3,4,5].map(n=>difficulty(n,'daily').size),[12,13,14,15,16]);
 assert.deepEqual([1,2,3,4,5].map(n=>difficulty(n,'weekly').size),[14,15,17,18,20]);
 for(let n=1;n<=5;n++){
  assert.ok(difficulty(n,'daily').minDepth<difficulty(n,'weekly').minDepth);
  for(const kind of ['daily','weekly'])for(const maxAttempts of [0,64]){
   const key=kind+':2026-09-14',a=generateRound(key,n,{maxAttempts}),p=profile(n,kind),v=solve(a);
   assert.equal(a.width,p.size);assert.equal(a.height,p.size);assert.ok(v.valid);assert.ok(acceptable(v.metrics,p));assert.deepEqual(a,generateRound(key,n,{maxAttempts}));
  }
 }
 assert.throws(()=>difficulty(1,'invalid'));
});

test('P7 难度配置校验、参数生效和成绩版本隔离',()=>{
 const {settings,validate,version}=require('../src/race/settings'),fs=require('node:fs'),vm=require('node:vm');
 const changed=JSON.parse(JSON.stringify(settings));changed.daily[0]={size:10,minDepth:3,maxInitialOpen:3,maxLength:12,minArrows:12};
 assert.notEqual(version(changed),version(settings));assert.equal(version(JSON.parse(JSON.stringify(settings))),version(settings));
 const sandbox={module:{exports:{}},require:()=>({settings:validate(changed),version})};vm.runInNewContext(fs.readFileSync('src/race/rules.js','utf8'),sandbox);
 assert.equal(sandbox.module.exports.difficulty(1,'daily').size,10);assert.equal(sandbox.module.exports.difficulty(1,'daily').maxInitialOpen,3);assert.equal(sandbox.module.exports.difficulty(1,'weekly').size,14);
 for(const change of [c=>c.daily.pop(),c=>c.weekly[0].size=30,c=>c.daily[0].minDepth=0,c=>c.daily[0].minArrows=200,c=>c.daily[0].maxLength='9']){
  const bad=JSON.parse(JSON.stringify(settings));change(bad);assert.throws(()=>validate(bad));
 }
 const {matches}=require('../scripts/race-fallbacks.cjs'),{profile}=require('../src/race/course');
 assert.equal(matches(require('../src/race/daily-fallbacks')[0],{...profile(1,'daily'),size:20}),false);
});
