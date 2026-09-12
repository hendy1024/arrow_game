'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Controller}=require('../src/ui/controller'),{Session}=require('../src/domain/session'),{fixtures}=require('../src/fixtures'),{fakePlatform}=require('./helpers.cjs');
const {snapshot,restore,bindPersistence,createStore}=require('../src/persistence/store');
function failed(inventory=2){const a=new Controller(fakePlatform());a.lifeIntroDone=true;a.session=new Session({...fixtures.tutorial,number:3,lifeLimit:1,timeLimitMs:60000});a.currentLevel=3;a.screen='game';a.inventory.life=inventory;a.clickArrow('second');assert.equal(a.modal,'life-rescue');return a;}
test('P9 容错归零提示、冻结计时，确认仅扣一个道具且保留当前棋盘',()=>{
 const a=failed(),before=JSON.stringify(a.session.level),time=a.session.remainingMs;a.tick(5000);assert.equal(a.session.remainingMs,time);a.action('life-rescue-use');assert.equal(a.modal,null);assert.equal(a.session.lives,1);assert.equal(a.inventory.life,1);assert.equal(a.session.state,'playing');assert.equal(a.session.itemUses.life,1);assert.equal(a.session.recordEligible,false);assert.equal(JSON.stringify(a.session.level),before);
 a.action('life-rescue-use');assert.equal(a.inventory.life,1);a.clickArrow('second');assert.equal(a.modal,'life-rescue');a.action('life-rescue-use');assert.equal(a.inventory.life,0);assert.equal(a.session.lives,1);
 const b=new Controller(fakePlatform());restore(b,snapshot(a));assert.equal(b.session.lives,1);assert.equal(b.inventory.life,0);
});
test('P9 取消或库存为0不扣道具，超时与竞速不出现容错续关',()=>{
 const a=failed();a.action('dismiss-modal');assert.equal(a.modal,'failed');assert.equal(a.inventory.life,2);a.syncModal();assert.equal(a.modal,'failed');const b=failed(0);b.action('life-rescue-use');assert.equal(b.inventory.life,0);assert.equal(b.session.lives,0);b.action('life-rescue-decline');assert.equal(b.modal,'failed');
 const c=failed();c.session.failureReason='timeout';c.session.remainingMs=0;c.syncModal();assert.equal(c.modal,'failed');c.mode='race';assert.equal(require('../src/ui/life-rescue').eligible(c),false);
});
test('P9 旧100关进度一次性重置，库存设置保留、普通旧纪录清除，新进度不重复重置',async()=>{
 const a=new Controller(fakePlatform());a.unlocked=74;a.currentLevel=73;a.inventory.life=27;a.rewardClaims=[5,20];a.settings.sound=false;a.levelBests={'50:123':4567};const old=snapshot(a);delete old.campaignRevision;
 const data=new Map(),storage={get:k=>data.get(k),set:(k,v)=>data.set(k,v)};createStore(storage).save(old);
 const b=new Controller(fakePlatform());bindPersistence(b,storage);assert.equal(b.currentLevel,1);assert.equal(b.unlocked,1);assert.equal(b.session,null);assert.equal(b.inventory.life,27);assert.equal(b.settings.sound,false);assert.deepEqual(b.rewardClaims,[]);assert.deepEqual(b.levelBests,{});assert.equal(createStore(storage).load().data.campaignRevision,3);
 b.unlocked=3;b.currentLevel=2;b.changed();const c=new Controller(fakePlatform());bindPersistence(c,storage);assert.equal(c.unlocked,3);assert.equal(c.currentLevel,2);assert.equal(c.inventory.life,27);
});

test('P9 32格密集棋盘缩放后箭头头部及轻微偏移可选，障碍中心不误选箭头',()=>{
 const b=require('../src/campaign/catalog').entry(20).board,{boardTransform}=require('../src/rendering/board'),{hitArrow}=require('../src/input/pointer');assert.equal(b.width,32);
 for(const width of [224,324,360])for(const zoom of [1,2,3]){const t=boardTransform(b,{x:0,y:0,width:width*zoom,height:width*zoom}),tolerance=Math.max(.48,Math.min(.8,8/t.cell));for(const a of b.arrows){const p=t.toScreen(a.path.at(-1));for(const [dx,dy]of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])assert.equal(hitArrow(b,t.toBoard([p[0]+dx,p[1]+dy]),new Set(),new Map(),tolerance),a.id);}
 for(const p of b.obstacles)assert.equal(hitArrow(b,p,new Set(),new Map(),tolerance),null);
 }
});
