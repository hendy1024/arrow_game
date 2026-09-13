'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {generateRound,profile}=require('../src/race/course');
const {solve}=require('../src/generation/validate');
const {acceptable}=require('../src/generation/generator');
const {Controller}=require('../src/ui/controller');
const {snapshot}=require('../src/persistence/store');
const history=require('../src/race/history');
const fallbacks=require('../src/race/fallbacks');
function setup(){let time=Date.parse('2026-09-12T01:00:00Z');const data=new Map();const app=new Controller({now:()=>time,seed:()=>1,feedback(){},storage:{get:k=>data.get(k),set:(k,v)=>data.set(k,v)}});app.unlocked=5;app.raceUnlockSeen=true;app.lifeIntroDone=true;app.raceGenerate=async()=>JSON.parse(JSON.stringify(fallbacks));return {app,advance:ms=>time+=ms,data};}
async function start(app){app.action('race');await app.action('race-start');app.action('race-accept');}
function clear(app){for(const id of solve(app.session.level).sequence){assert.equal(app.clickArrow(id).type,'allowed');app.tick(10000);}}
test('P7 每日每周赛道可解、确定生成、三关密度和依赖符合验收，兜底亦符合',()=>{
 for(const key of ['daily:2026-09-12','daily:2026-09-13','weekly:2026-09-07'])for(let n=1;n<=3;n++){
 const a=generateRound(key,n),b=generateRound(key,n);assert.deepEqual(a,b);const v=solve(a);assert.ok(v.valid);assert.ok(acceptable(v.metrics,profile(n,key.split(':')[0])));assert.equal(a.lifeLimit,null);assert.equal(a.timeLimitMs,null);assert.ok(acceptable(solve(generateRound(key,n,{maxAttempts:0})).metrics,profile(n,key.split(':')[0])));
 }
 assert.notDeepEqual(generateRound('daily:2026-09-12',1).arrows,generateRound('daily:2026-09-13',1).arrows);
});
test('P7 解锁、三关实际移动通关记录、暂停计时、无道具、进度隔离',async()=>{
 const {app,advance}=setup();app.unlocked=4;app.action('race');assert.equal(app.modal,'race-locked');app.action('race-close');app.unlocked=5;
 const before=snapshot(app);await start(app);assert.equal(app.modal,null);app.action('items');assert.equal(app.modal,null);app.action('pause');advance(6000);assert.equal(require('../src/race/controller').elapsed(app),6000);app.action('resume');
 for(let n=1;n<=3;n++){assert.equal(app.currentLevel,n);assert.equal(app.session.remainingMs,null);assert.equal(app.session.lives,null);advance(10000);clear(app);assert.equal(app.modal,n===3?'race-finished':'won');if(n<3){const frozen=require('../src/race/controller').elapsed(app);advance(30000);app.syncModal();assert.equal(require('../src/race/controller').elapsed(app),frozen);app.action('next');assert.equal(require('../src/race/controller').elapsed(app),frozen);}}
 assert.equal(history.read(app.platform.storage)[0].elapsed,36000);assert.deepEqual(snapshot(app),before);app.action('race-retry-save');assert.equal(history.read(app.platform.storage).length,1);app.action('home');assert.equal(app.mode,'campaign');assert.deepEqual(snapshot(app),before);
});
test('P7 竞速点错不限次数，无失败扣命，主动重跑回第一关且未完成不入榜',async()=>{
 const {app}=setup();await start(app);clear(app);app.action('next');const id=app.session.level.arrows.find(a=>app.session.classify(a.id).type==='blocked').id;
 for(let i=0;i<30;i++){app.clickArrow(id);app.tick(250);}assert.equal(app.modal,null);assert.equal(app.session.state,'playing');assert.equal(app.session.lives,null);assert.equal(history.read(app.platform.storage).length,0);app.action('pause');app.action('restart-ask');await app.action('restart');app.action('race-accept');assert.equal(app.currentLevel,1);assert.equal(app.session.lives,null);
});
test('P7 开始前跨周期重新准备，进行中的周期保持固定，损坏历史不覆盖',async()=>{
 const {app,advance,data}=setup();app.action('race');await app.action('race-start');const old=app.race.event.key;advance(86400000);await app.action('race-accept');assert.equal(app.modal,'race-ready');assert.notEqual(app.race.event.key,old);app.action('race-accept');const pinned=app.race.event.key;advance(86400000);assert.equal(app.race.event.key,pinned);
 data.set('arrow-garden.race-history.v1','broken');assert.throws(()=>history.save(app.platform.storage,{kind:'daily',elapsed:1,period:pinned}));assert.equal(data.get('arrow-garden.race-history.v1'),'broken');
});
test('P7 第4关通关仅弹一次竞速解锁提示，确认回到通关流程',()=>{
 const {app}=setup();app.unlocked=4;app.raceUnlockSeen=false;app.screen='game';app.currentLevel=4;app.session=new (require('../src/domain/session').Session)({...require('../src/fixtures').fixtures.boundary,number:4});app.clickArrow('a');app.tick(10000);assert.equal(app.unlocked,5);assert.equal(app.modal,'race-unlocked');app.action('race-notice-close');assert.equal(app.modal,'won');assert.equal(app.raceUnlockSeen,true);app.syncModal();assert.equal(app.modal,'won');
});
test('P7 竞速切后台不提前完成动画或提交成绩，返回后继续',async()=>{
 const p=require('./helpers.cjs').fakePlatform();let time=100000;p.now=()=>time;const {app}=require('../src/runtime').mount(p);app.unlocked=5;app.raceGenerate=async()=>JSON.parse(JSON.stringify(fallbacks));await start(app);const id=solve(app.session.level).sequence[0];app.clickArrow(id);assert.ok(app.session.moves.has(id));p.callbacks.hide();assert.ok(app.session.moves.has(id));assert.equal(app.session.removed.size,0);time+=10000;p.callbacks.show();assert.equal(require('../src/race/controller').elapsed(app),10000);app.tick(10000);assert.ok(app.session.removed.has(id));
});
test('P7 好友榜停留跨零点自动刷新，个人历史可重试同步当前最佳',async()=>{
 const {app,advance}=setup();const shown=[],sent=[];app.platform.showFriends=k=>shown.push(k);app.platform.publishRace=async r=>sent.push(r);app.action('race');app.action('race-friends');const first=shown[0];advance(86400000);app.tick(0);assert.equal(shown.length,2);assert.notEqual(shown[1],first);app.tick(0);assert.equal(shown.length,2);
 app.action('race-back');app.action('race-history');const key=require('../src/race/rules').period('daily',app.platform.now()).key;
 for(const [id,elapsed]of [['one',9000],['two',3000]])history.save(app.platform.storage,{id,version:require('../src/race/rules').VERSION,kind:'daily',period:key,elapsed,finishedAt:app.platform.now()});await app.action('race-sync');assert.equal(sent[0].elapsed,3000);
});
