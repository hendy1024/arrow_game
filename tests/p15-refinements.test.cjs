'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Controller}=require('../src/ui/controller'),{View}=require('../src/ui/view'),{fakePlatform}=require('./helpers.cjs');
const {snapshot,restore,validate}=require('../src/persistence/store');
test('P15 正式/未知版本隐藏重置并拒绝调用，体验版保留确认流程',()=>{
 for(const isTrial of [true,false,undefined]){
  const p=fakePlatform();p.isTrial=isTrial;const a=new Controller(p),v=new View(p.ctx);a.currentLevel=a.unlocked=8;v.render(a,p.info());
  assert.equal(v.buttons.some(b=>b.id==='reset-progress-ask'),isTrial===true);
  a.action('reset-progress-ask');assert.equal(a.modal,isTrial?'reset-progress':null);a.action('reset-progress-confirm');assert.equal(a.unlocked,isTrial?1:8);
  if(!isTrial){a.modal='reset-progress';a.action('reset-progress-confirm');assert.equal(a.unlocked,8);}
 }
});
test('P15 前10关统一5分钟，教学暂停计时，时间耗尽可续关',async()=>{
 for(let n=1;n<=10;n++){
  const a=new Controller(fakePlatform());a.lifeIntroDone=true;await a.start(n);
  assert.equal(a.session.remainingMs,300000);
  if(a.modal){a.tick(1000);assert.equal(a.session.remainingMs,300000);a.action('dismiss-modal');}a.tick(300000);assert.equal(a.modal,'time-rescue');
 }
});
test('P15 旧版前4关存档延长倒计时，保留棋盘消除进度、库存与解锁，超时记录可以继续',async()=>{
 const a=new Controller(fakePlatform());a.lifeIntroDone=true;await a.start(2);a.unlocked=7;a.inventory.time=17;
 const data=snapshot(a);data.session.level.timeLimitMs=120000;data.session.remainingMs=0;data.session.state='failed';data.session.failureReason='timeout';data.session.removed=[data.session.level.arrows[0].id];data.session.restartLevel=JSON.parse(JSON.stringify(data.session.level));
 assert.ok(validate(data));const b=new Controller(fakePlatform());restore(b,data);assert.equal(b.session.remainingMs,180000);assert.equal(b.session.restartLevel.timeLimitMs,300000);assert.equal(b.session.state,'paused');assert.equal(b.session.failureReason,null);assert.equal(b.session.removed.size,1);assert.equal(b.inventory.time,17);assert.equal(b.unlocked,7);await b.start();assert.equal(b.session.state,'playing');b.tick(1000);assert.equal(b.session.remainingMs,179000);assert.ok(validate(snapshot(b)));
});
