'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Controller}=require('../src/ui/controller'),{Session}=require('../src/domain/session'),{View,layout}=require('../src/ui/view');
const {fakePlatform}=require('./helpers.cjs'),catalog=require('../src/campaign/catalog'),{solve}=require('../src/generation/validate');
const {snapshot,restore,validate}=require('../src/persistence/store');
function app(){const a=new Controller(fakePlatform());a.tutorialDone=a.lifeIntroDone=a.challengeUnlockSeen=a.raceUnlockSeen=true;return a;}
function clear(a){if(a.modal==='life-intro')a.action('life-accept');a.modal=null;a.session.resume();for(const id of solve(a.session.level).sequence){assert.equal(a.clickArrow(id).type,'allowed');a.tick(1000);}}
test('P8 100关固定配置全部可解，读取独立副本，配置奖励校验',async()=>{
 assert.equal(require('../scripts/check-campaign.cjs').check(),100);
 for(let n=1;n<=100;n++){const a=await catalog.load(n),b=await catalog.load(n);assert.deepEqual(a,b);a.level.arrows.length=0;assert.ok(b.level.arrows.length>0);}
 const bad=JSON.parse(JSON.stringify(catalog.levels));bad[4].rewards.life=-1;assert.throws(()=>require('../scripts/check-campaign.cjs').check(bad));
 await assert.rejects(async()=>catalog.load(101));
});
test('P8 首通奖励与库存一起保存，重复通关、恢复、重置不重复发放',async()=>{
 const a=app();a.unlocked=5;await a.start(5);clear(a);assert.equal(a.inventory.life,12);assert.ok(a.rewardClaims.includes(5));assert.equal(a.unlocked,6);a.events();assert.equal(a.inventory.life,12);
 const data=snapshot(a);assert.ok(validate(data));const b=app();restore(b,data);assert.equal(b.inventory.life,12);assert.ok(b.rewardClaims.includes(5));b.modal=null;b.screen='home';b.action('reset-progress-ask');b.action('reset-progress-confirm');assert.ok(b.rewardClaims.includes(5));
 await b.start(5);clear(b);assert.equal(b.inventory.life,12);
 const old=snapshot(app());old.unlocked=21;delete old.rewardClaims;restore(b,old);assert.equal(b.rewardClaims.length,20);
});
test('P8 总览每20关解锁下一页，锁定关只看奖励，已过关可重玩',async()=>{
 const a=app();a.unlocked=20;a.action('level-map');assert.equal(a.mapPage,0);a.action('map-next');assert.equal(a.mapPage,0);a.action('map-level-20');assert.equal(a.modal,'level-detail');a.action('map-detail-close');
 a.unlocked=21;a.action('map-next');assert.equal(a.mapPage,1);a.action('map-level-22');a.action('map-play');assert.equal(a.screen,'map');assert.equal(a.session,null);a.action('dismiss-modal');assert.equal(a.modal,null);
 a.action('map-prev');a.action('map-level-5');a.action('map-play');await new Promise(setImmediate);assert.equal(a.currentLevel,5);assert.equal(a.screen,'game');assert.equal(a.unlocked,21);
 a.session=null;await a.start(100);clear(a);a.action('next');assert.equal(a.screen,'map');assert.equal(a.mapPage,4);
});
test('P8 无道具个人最快记录，暂停不计时，修改布局不复用旧纪录',async()=>{
 const a=app();await a.start(2);a.action('pause');a.tick(5000);assert.equal(a.session.recordMs,0);a.action('resume');clear(a);const k=catalog.key(a.session.level),best=a.levelBests[k];assert.ok(best>0);
 const data=snapshot(a),b=app();restore(b,data);assert.equal(b.levelBests[k],best);
 b.session=null;await b.start(2);b.session.itemUses.shuffle=1;clear(b);assert.equal(b.levelBests[k],best);
 const changed=JSON.parse(JSON.stringify(catalog.entry(2).board));changed.lifeLimit=7;assert.notEqual(catalog.key(changed),k);
});
test('P8 关卡总览小屏到手机安全区20个目标均44像素、不重叠、奖励可查看',()=>{
 for(const [width,height]of [[320,568],[390,844],[430,932]]){const a=app(),p=a.platform,v=new View(p.ctx),info={width,height,safeTop:24,menuBottom:54,safeBottom:24};a.action('level-map');v.render(a,info);const nodes=v.buttons.filter(b=>b.id.startsWith('map-level-'));assert.equal(nodes.length,20);for(const b of v.buttons){assert.ok(b.width>=44&&b.height>=44);assert.ok(b.x>=0&&b.x+b.width<=width);assert.ok(b.y>=layout(info).top&&b.y+b.height<=layout(info).bottom);}for(let i=0;i<nodes.length;i++)for(let j=0;j<i;j++){const a=nodes[i],b=nodes[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}
 a.action('map-level-20');v.render(a,info);assert.ok(!v.buttons.some(b=>b.id==='map-play'));assert.ok(p.ctx.calls.some(c=>c[0]==='fillText'&&String(c[1]).includes('加时')));
 }
});

test('P8 配置关卡不限容错规则恢复后保留，奖励库存超过10仍可保存',async()=>{
 const a=app();await a.start(5);a.session.level.lifeLimit=null;a.session.lives=null;a.inventory.life=50;const data=snapshot(a);assert.ok(validate(data));const b=app();restore(b,data);assert.equal(b.session.lives,null);assert.equal(b.session.level.lifeLimit,null);assert.equal(b.inventory.life,50);
});
