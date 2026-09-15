'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {Controller}=require('../src/ui/controller'),{fakePlatform}=require('./helpers.cjs');
const {upload,retry}=require('../src/race/upload'),history=require('../src/race/history'),{VERSION,period}=require('../src/race/rules');
function setup(){const p=fakePlatform(),data=new Map();p.now=()=>Date.parse('2026-09-14T02:00:00Z');p.storage={get:k=>data.get(k),set:(k,v)=>data.set(k,v)};const a=new Controller(p);return {a,p,data};}
function record(p,kind='daily',elapsed=1000){return {id:kind+elapsed,kind,period:period(kind,p.now()).key,version:VERSION,elapsed,finishedAt:p.now()};}
const drain=()=>new Promise(r=>setImmediate(r));
test('P14 竞速结束无需点击自动上传，失败后打开榜单补传成功，成功结算隐藏重试按钮',async()=>{
 const {a,p}=setup();let calls=0;p.publishRace=async()=>{if(++calls===1)throw Error('offline');return true;};
 a.mode='race';a.session={state:'won',moves:new Map()};a.race={index:2,event:period('daily',p.now()),startedAt:p.now()-1000};
 require('../src/race/controller').sync(a);await drain();assert.equal(calls,1);assert.ok(a.race.publishStatus.includes('自动重试'));assert.equal(history.read(p.storage).length,1);
 a.screen='home';a.modal=null;a.action('rank');await drain();assert.equal(calls,2);assert.equal(a.race.publishStatus,'好友成绩已同步');
 a.modal='race-finished';assert.ok(!require('../src/race/view').dialog(a).actions.some(x=>x[0]==='race-retry-save'));
});
test('P14 回到前台和重新启动自动补传，仅传当期新版最佳，日周独立',async()=>{
 const {p}=setup(),sent=[];let fail=true;p.publishRace=async r=>{sent.push(r);if(fail)throw Error('offline');return true;};
 for(const r of [record(p),record(p,'daily',2000),record(p,'weekly',3000),{...record(p,'weekly',4000),version:'old'},{...record(p,'daily',5000),period:'daily:2000-01-01'}])history.save(p.storage,r);
 const game=require('../src/runtime').mount(p);await drain();assert.equal(sent.length,2);fail=false;game.app.modal=null;p.callbacks.show();await drain();assert.equal(sent.length,4);assert.deepEqual(sent.slice(-2).map(r=>r.elapsed),[1000,3000]);
 p.callbacks.show();await drain();assert.equal(sent.length,4);game.stop();
});
test('P14 并发同步合并且按顺序发送，更慢成绩不覆盖已同步最佳，失败可再试',async()=>{
 const {a,p}=setup(),sent=[];let resolve;p.publishRace=r=>{sent.push(r.elapsed);return new Promise(r=>resolve=r);};
 const first=upload(a,record(p,'daily',2000)),same=upload(a,record(p,'daily',2000));assert.equal(first,same);const faster=upload(a,record(p));await drain();assert.deepEqual(sent,[2000]);resolve(true);await first;await drain();assert.deepEqual(sent,[2000,1000]);resolve(true);await faster;await upload(a,record(p,'daily',3000));assert.deepEqual(sent,[2000,1000]);
});
test('P14 跨期拒绝不显示同步成功，也不标记已上传',async()=>{
 const {a,p}=setup();let calls=0;p.publishRace=async()=>{calls++;return false;};history.save(p.storage,record(p));a.modal='rank';a.rankTab='personal';a.raceKind='daily';await a.action('race-sync');assert.equal(a.historyNotice,'已跨期，仅保存本机成绩');await retry(a);assert.equal(calls,2);
});
test('P14 好友读取错误保留原因与错误码，本机成绩不伪装同步，刷新清除旧错误',()=>{
 let handler,friends,own;const drawn=[],logs=[],ctx={clearRect(){drawn.length=0;},fillText:t=>drawn.push(t)};
 vm.runInNewContext(fs.readFileSync('src/open-data/index.js','utf8'),{console:{warn:(...v)=>logs.push(v)},wx:{getSharedCanvas:()=>({width:560,height:720,getContext:()=>ctx}),onMessage:f=>handler=f,getUserCloudStorage:o=>own=o,getFriendCloudStorage:o=>friends=o}});
 const msg={type:'show',period:'daily:2026-09-14',version:VERSION,localElapsed:1000};handler(msg);own.fail({errMsg:'offline'});friends.fail({errCode:-2,errMsg:'getFriendCloudStorage:fail system error'});
 assert.ok(drawn.includes('好友成绩读取失败，请点击刷新'));assert.ok(drawn.join('').includes('-2'));assert.ok(drawn.join('').includes('system error'));assert.ok(drawn.includes('本机成绩 · 同步状态未确认'));assert.ok(!drawn.includes('本期成绩已同步'));assert.equal(logs.length,2);
 handler(msg);friends.success({data:[]});assert.ok(drawn.includes('暂无好友完成本期3关'));assert.ok(!drawn.join('').includes('system error'));
});
