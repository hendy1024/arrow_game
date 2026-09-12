'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {createRaceWechat}=require('../src/race/wechat');
const {period}=require('../src/race/rules');
const {Controller}=require('../src/ui/controller'),{View,layout}=require('../src/ui/view');
const {fakePlatform}=require('./helpers.cjs');
test('P7 好友托管只上传本期最佳，失败可重试，日周互不覆盖',async()=>{
 const data=new Map(),writes=[];let fail=true;const api=createRaceWechat({getStorageSync:k=>data.get(k),setStorageSync:(k,v)=>data.set(k,v),setUserCloudStorage:o=>{writes.push(o.KVDataList[0]);fail?o.fail(Error('offline')):o.success();}});
 const record={kind:'daily',period:period('daily').key,elapsed:12345};await assert.rejects(api.publishRace(record));fail=false;await api.publishRace({...record,elapsed:99999});assert.equal(JSON.parse(writes.at(-1).value).elapsed,12345);
 await api.publishRace({...record,kind:'weekly',period:period('weekly').key});assert.notEqual(writes.at(-1).key,writes[0].key);const count=writes.length;await api.publishRace({...record,period:'daily:2000-01-01'});assert.equal(writes.length,count);
});
test('P7 开放域按本期成绩排序并排除坏数据，过期异步响应不覆盖周榜',()=>{
 let handler;const requests=[],drawn=[];const ctx={clearRect(){drawn.length=0},fillText:t=>drawn.push(t)};
 vm.runInNewContext(fs.readFileSync('src/open-data/index.js','utf8'),{wx:{getSharedCanvas:()=>({width:560,height:360,getContext:()=>ctx}),onMessage:f=>handler=f,getFriendCloudStorage:o=>requests.push(o)}});
 const user=(nickname,period,elapsed)=>({nickname,KVDataList:[{key:'arrow-race-weekly-v1',value:JSON.stringify({period,elapsed,version:1})}]});
 handler({type:'show',period:'daily:2026-09-12',version:1});handler({type:'show',period:'weekly:2026-09-07',version:1});requests[1].success({data:[user('慢','weekly:2026-09-07',9000),user('旧','weekly:2026-08-31',1),user('快','weekly:2026-09-07',3000),user('坏','weekly:2026-09-07',-1)]});
 assert.equal(drawn[0],'1. 快');assert.equal(drawn[2],'2. 慢');const before=[...drawn];requests[0].fail();assert.deepEqual(drawn,before);handler({type:'close'});assert.deepEqual(drawn,[]);
});
test('P7 首页与竞速各弹窗在小屏和iPhone安全区可点击、不溢出',()=>{
 const p=fakePlatform(),a=new Controller(p),v=new View(p.ctx);a.unlocked=15;a.race={finishedElapsed:60000};
 for(const [width,height]of [[320,568],[390,844],[430,932]]){
 const info={width,height,safeTop:24,menuBottom:54,safeBottom:24},l=layout(info);
 for(const modal of [null,'race-menu','race-history','race-friends','race-ready','race-loading','race-error','race-finished','race-unlocked']){
 a.modal=modal;v.render(a,info);for(const b of v.buttons){assert.ok(b.y>=l.top);assert.ok(b.y+b.height<=height-24,JSON.stringify({modal,b}));assert.ok(b.width>=44&&b.height>=44);}
 }
 }
});
test('P7 好友授权拒绝可从设置重试，关闭页面后晚到授权不会重开',()=>{
 let authorization,settings;const messages=[];const api=createRaceWechat({getOpenDataContext:()=>({postMessage:m=>messages.push(m)}),authorize:o=>authorization=o,openSetting:o=>settings=o});
 api.showFriends('daily:2026-09-12');authorization.fail();assert.equal(messages.at(-1).type,'error');api.nextFriends();settings.success();authorization.success();assert.equal(messages.at(-1).type,'show');api.showFriends('weekly:2026-09-07');api.closeFriends();authorization.success();assert.equal(messages.at(-1).type,'close');
});
