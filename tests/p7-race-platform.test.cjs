'use strict';
const {installPrivacy}=require('../src/platform/privacy');
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {createRaceWechat}=require('../src/race/wechat');
const {period}=require('../src/race/rules');
const {Controller}=require('../src/ui/controller'),{View,layout}=require('../src/ui/view');
const {fakePlatform}=require('./helpers.cjs');

test('P7 无官方弹窗时自定义隐私告知先于好友授权，只有明确同意才继续',()=>{
 let listener,modal,sheet,privacy;let requests=0;const events=[];
 const wx={onNeedPrivacyAuthorization:f=>listener=f,showModal:o=>modal=o,showActionSheet:o=>sheet=o,
  getOpenDataContext:()=>({postMessage(){}}),getPrivacySetting:o=>o.success({needAuthorization:true}),
  requirePrivacyAuthorize:o=>{privacy=o;listener(r=>{events.push(r.event);if(r.event==='agree')o.success();if(r.event==='disagree')o.fail({errMsg:'privacy denied'});});},
  authorize:o=>{requests++;o.success();}};
 const api=createRaceWechat(wx);api.showFriends('daily:2026-09-12');api.authorizeFriends();assert.ok(privacy);assert.equal(requests,0);assert.ok(modal.content.includes('微信朋友关系'));assert.deepEqual(events,['exposureAuthorization']);
 modal.success({confirm:true});assert.equal(requests,0);assert.equal(sheet.itemList.length,3);sheet.success({tapIndex:1});assert.equal(requests,1);assert.equal(api.rankState.authorization,'granted');assert.deepEqual(events,['exposureAuthorization','agree']);
 api.authorizeFriends();modal.success({confirm:false});assert.equal(requests,1);assert.equal(events.at(-1),'disagree');assert.equal(api.rankState.authorization,'unknown');
});

test('P7 隐私指引返回后仍须点击同意，取消不会授权，并发请求共用一次弹窗',()=>{
 let listener,modal,sheet,onShow,contract;let count=0;const first=[],second=[];
 installPrivacy({onNeedPrivacyAuthorization:f=>listener=f,onShow:f=>onShow=f,showModal:o=>{modal=o;count++;},showActionSheet:o=>sheet=o,openPrivacyContract:o=>contract=o});
 listener(r=>first.push(r.event));listener(r=>second.push(r.event));assert.equal(count,1);
 modal.success({confirm:true});sheet.success({tapIndex:0});contract.success();assert.deepEqual(first,['exposureAuthorization']);assert.deepEqual(second,[]);
 onShow();sheet.success({tapIndex:1});assert.deepEqual(first,['exposureAuthorization','agree']);assert.deepEqual(second,['agree']);
 listener(r=>first.push(r.event));modal.success({confirm:true});sheet.fail();assert.equal(first.at(-1),'disagree');
 listener(r=>first.push(r.event));modal.success({confirm:true});sheet.success({tapIndex:0});contract.fail();assert.equal(modal.title,'指引打开失败');modal.complete();assert.equal(first.at(-1),'disagree');
});
test('P7 好友托管只上传本期最佳，失败可重试，日周互不覆盖',async()=>{
 const data=new Map(),writes=[];let fail=true;const api=createRaceWechat({getStorageSync:k=>data.get(k),setStorageSync:(k,v)=>data.set(k,v),setUserCloudStorage:o=>{writes.push(o.KVDataList[0]);fail?o.fail(Error('offline')):o.success();}});
 const record={version:require('../src/race/rules').VERSION,kind:'daily',period:period('daily').key,elapsed:12345};await assert.rejects(api.publishRace(record));fail=false;await api.publishRace({...record,elapsed:99999});assert.equal(JSON.parse(writes.at(-1).value).elapsed,12345);
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
 const p=fakePlatform(),a=new Controller(p),v=new View(p.ctx);a.unlocked=6;a.race={finishedElapsed:60000};
 for(const [width,height]of [[320,568],[390,844],[430,932]]){
 const info={width,height,safeTop:24,menuBottom:54,safeBottom:24},l=layout(info);
 for(const modal of [null,'race-menu','race-history','race-friends','race-ready','race-loading','race-error','race-finished','race-unlocked']){
 a.modal=modal;v.render(a,info);for(const b of v.buttons){assert.ok(b.y>=l.top);assert.ok(b.y+b.height<=height-24,JSON.stringify({modal,b}));assert.ok(b.width>=44&&b.height>=44);}
 }
 }
});
test('P7 好友授权先请求隐私再请求关系权限，失败不自动进入设置',()=>{
 let privacy,authorization,prompt,settings,allowed;const messages=[];let opened=0;
 const api=createRaceWechat({getOpenDataContext:()=>({postMessage:m=>messages.push(m)}),getSetting:o=>o.success({authSetting:{'scope.WxFriendInteraction':allowed}}),requirePrivacyAuthorize:o=>privacy=o,authorize:o=>authorization=o,showModal:o=>prompt=o,openSetting:o=>{opened++;settings=o;}});
 api.showFriends('daily:2026-09-12');assert.equal(authorization,undefined);api.authorizeFriends();assert.equal(authorization,undefined);privacy.success();assert.equal(authorization.scope,'scope.WxFriendInteraction');
 authorization.fail({errMsg:'authorize:fail scope is not declared'});assert.equal(opened,0);assert.equal(api.rankState.authorization,'unknown');assert.ok(prompt.content.includes('scope is not declared'));assert.equal(prompt.showCancel,false);
 allowed=false;api.authorizeFriends();privacy.success();authorization.fail({errMsg:'authorize:fail auth deny'});assert.equal(opened,0);assert.equal(prompt.showCancel,true);prompt.success({confirm:false});assert.equal(opened,0);prompt.success({confirm:true});assert.equal(opened,1);allowed=true;settings.success();assert.equal(messages.at(-1).friendsAllowed,true);
 api.authorizeFriends();api.closeFriends();privacy.success();assert.equal(messages.at(-1).type,'close');assert.equal(api.rankState.authorizing,false);
});

test('P7 隐私失败与接口异常保留原始原因，不误标用户拒绝、不继续获取关系',()=>{
 let privacy,prompt;let friendRequests=0,opens=0;const api=createRaceWechat({getOpenDataContext:()=>({postMessage(){}}),requirePrivacyAuthorize:o=>privacy=o,authorize:()=>friendRequests++,showModal:o=>prompt=o,openSetting:()=>opens++});
 api.showFriends('daily:2026-09-12');api.authorizeFriends();privacy.fail({errMsg:'requirePrivacyAuthorize:fail privacy permission is not authorized'});assert.equal(friendRequests,0);assert.equal(opens,0);assert.equal(api.rankState.authorization,'unknown');assert.equal(api.rankState.lastError.stage,'privacy');assert.ok(prompt.content.includes('privacy permission'));
});

test('P7 未授权仍读取本人，区分已同步、未完赛及待同步，不伪造成绩',()=>{
 let handler;const own=[],friends=[],drawn=[];const ctx={clearRect(){drawn.length=0},fillText:t=>drawn.push(t)};
 vm.runInNewContext(fs.readFileSync('src/open-data/index.js','utf8'),{wx:{getSharedCanvas:()=>({width:600,height:700,getContext:()=>ctx}),onMessage:f=>handler=f,getUserCloudStorage:o=>own.push(o),getFriendCloudStorage:o=>friends.push(o)}});
 const msg={type:'show',period:'daily:2026-09-12',version:2,friendsAllowed:false,notice:'请授权'};
 handler(msg);assert.equal(friends.length,0);own.at(-1).success({KVDataList:[{key:'arrow-race-daily-v2',value:JSON.stringify({period:msg.period,version:2,elapsed:12345})}]});assert.ok(drawn.includes('我'));assert.ok(drawn.includes('0:12.3'));assert.ok(drawn.includes('本期成绩已同步'));
 handler(msg);own.at(-1).success({KVDataList:[]});assert.ok(drawn.includes('完成本期3关后即可记录成绩'));assert.ok(!drawn.includes('0:00.0'));
 handler({...msg,oldVersion:true});own.at(-1).success({KVDataList:[]});assert.ok(drawn.includes('本期旧版成绩在个人榜，新版需重跑'));
 handler({...msg,localElapsed:11000});own.at(-1).success({KVDataList:[]});assert.ok(drawn.includes('0:11.0'));assert.ok(drawn.includes('本机成绩待同步，请到个人榜同步'));
 handler({...msg,period:'weekly:2026-09-07'});const before=[...drawn];own.at(-2).fail();assert.deepEqual(drawn,before);own.at(-1).fail();assert.ok(drawn.includes('我的成绩读取失败，请刷新'));
});

test('P7 排行榜占据安全区大部分空间，日周视觉按钮紧凑但可点，列表随屏幕增长',()=>{
 const app=new Controller(fakePlatform()),view=new View(app.platform.ctx);app.modal='rank';app.rankTab='friends';
 let previous=0;
 for(const [width,height]of [[320,568],[390,844],[430,932]]){
 const info={width,height,safeTop:24,menuBottom:54,safeBottom:24};view.render(app,info);const panel=view.dialogRect;assert.equal(panel.width,width-24);assert.ok(panel.height>height*.75);assert.ok(panel.height>previous);previous=panel.height;
 for(const id of ['rank-daily','rank-weekly']){const b=view.buttons.find(b=>b.id===id);assert.equal(b.width,64);assert.ok(b.height>=44);}
 for(const b of view.buttons)assert.ok(b.y+b.height<=height-24);
 assert.ok(view.buttons.some(b=>b.id==='rank-authorize'));assert.ok(view.buttons.some(b=>b.id==='rank-refresh'));
 }
});

test('P7 隐私尚未同意时不触发本人或好友数据请求，避免拒绝后再次弹窗',()=>{
 const messages=[];const api=createRaceWechat({getOpenDataContext:()=>({postMessage:m=>messages.push(m)}),getPrivacySetting:o=>o.success({needAuthorization:true}),getSetting:()=>assert.fail('privacy must gate reads')});
 api.showFriends('daily:2026-09-12');assert.equal(messages.at(-1).readOwn,false);assert.equal(messages.at(-1).friendsAllowed,false);
 let handler;const ctx={clearRect(){},fillText(){}};vm.runInNewContext(fs.readFileSync('src/open-data/index.js','utf8'),{wx:{getSharedCanvas:()=>({width:600,height:700,getContext:()=>ctx}),onMessage:f=>handler=f,getUserCloudStorage:()=>assert.fail('no self read without privacy'),getFriendCloudStorage:()=>assert.fail('no friend read without privacy')}});
 handler(messages.at(-1));
});
