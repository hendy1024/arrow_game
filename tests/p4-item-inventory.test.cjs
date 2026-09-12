'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Controller}=require('../src/ui/controller'),{View}=require('../src/ui/view');
const {generate}=require('../src/generation/generator');
const {snapshot,restore,validate}=require('../src/persistence/store');
const {fakePlatform}=require('./helpers.cjs');
const make=()=>new Controller(fakePlatform(),{generate:async(n,s)=>generate(n,s)});
test('P4 下方图标有数量且小屏不挡棋盘，竞速不显示道具',async()=>{
 const a=make();await a.start(25);a.action('life-accept');const v=new View(a.platform.ctx);
 for(const [width,height]of [[320,568],[390,844],[430,932]]){v.render(a,{width,height,safeTop:24,menuBottom:54,safeBottom:24});const bar=v.buttons.filter(b=>b.id.startsWith('item-'));assert.equal(bar.length,3);assert.ok(!v.buttons.some(b=>b.id==='items'));for(const b of bar){assert.ok(b.y>v.lastLayout.card.y+v.lastLayout.card.height);assert.ok(b.y+b.height<=height-24);assert.equal(v.hitButton(b.x+b.width/2,b.y+b.height/2),b.id);}}
 a.mode='race';v.render(a,a.platform.info());assert.equal(v.buttons.filter(b=>b.id.startsWith('item-')).length,0);
});
test('P4 默认每种10个、耗尽弹窗，连续使用按实际次数存档且重试不补库存',async()=>{
 const a=make();await a.start(25);a.action('life-accept');assert.deepEqual(a.inventory,{time:10,life:10,shuffle:10});const before=a.session.remainingMs;
 for(let i=0;i<10;i++)a.action('item-time');assert.equal(a.inventory.time,0);assert.equal(a.session.remainingMs,before+300000);assert.equal(a.session.itemUses.time,10);
 a.action('item-time');assert.equal(a.modal,'item-empty');assert.equal(a.session.remainingMs,before+300000);a.action('item-empty-close');assert.equal(a.modal,null);assert.equal(a.session.state,'playing');
 const b=make();restore(b,snapshot(a));assert.equal(b.inventory.time,0);assert.equal(b.session.remainingMs,before+300000);await b.action('start');b.action('pause');b.action('restart-ask');b.action('restart');assert.equal(b.inventory.time,0);assert.equal(b.session.remainingMs,before);
});
test('P4 挑战共用库存，返回、普通进度重置及重载不返还；旧存档只初始化一次',async()=>{
 const a=make();a.unlocked=20;a.challengeUnlockSeen=true;await a.action('challenge');a.action('rush-accept');a.action('item-life');assert.equal(a.inventory.life,9);assert.equal(snapshot(a).inventory.life,9);a.action('pause');a.action('home');assert.equal(a.inventory.life,9);a.action('reset-progress-ask');a.action('reset-progress-confirm');assert.equal(a.inventory.life,9);
 const b=make();restore(b,snapshot(a));assert.equal(b.inventory.life,9);const old=snapshot(make());delete old.inventory;restore(b,old);assert.equal(b.inventory.life,10);b.inventory.life=0;const stored=snapshot(b);restore(b,stored);assert.equal(b.inventory.life,0);stored.inventory.life=-1;assert.equal(validate(stored),false);
});
